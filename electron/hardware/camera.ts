/**
 * Camera Hardware Integration
 * MUT Hologram Studio - DSLR Camera Controller
 *
 * This module provides camera control via gphoto2.
 * For testing without hardware, set MOCK_CAMERA=true.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface CameraConfig {
  mockMode?: boolean;
  useWebcam?: boolean; // Use MacBook webcam instead of DSLR
  captureDir?: string;
}

export interface CaptureResult {
  success: boolean;
  imagePath?: string;
  error?: string;
}

export interface CameraInfo {
  model: string;
  serial?: string;
  batteryLevel?: number;
}

export class CameraController extends EventEmitter {
  private mockMode: boolean;
  private useWebcam: boolean;
  private captureDir: string;
  private cameraProcess: ChildProcess | null = null;
  private isConnected: boolean = false;
  private cameraInfo: CameraInfo | null = null;
  private liveViewActive: boolean = false;
  private liveViewInterval: NodeJS.Timeout | null = null;
  private previewPath: string;

  constructor(config: CameraConfig = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_CAMERA === 'true';
    this.useWebcam = config.useWebcam ?? process.env.USE_WEBCAM === 'true';
    this.captureDir = config.captureDir ?? path.join(process.cwd(), 'captures');
    this.previewPath = path.join(this.captureDir, 'live_preview.jpg');

    // Ensure capture directory exists
    if (!fs.existsSync(this.captureDir)) {
      fs.mkdirSync(this.captureDir, { recursive: true });
    }
  }

  /**
   * Kill MacOS PTPCamera service that blocks gphoto2
   */
  private async killPTPCameraService(): Promise<void> {
    try {
      // Kill PTPCamera multiple times to ensure it's dead
      for (let i = 0; i < 3; i++) {
        try {
          await this.executeCommand('killall', ['-9', 'PTPCamera']);
        } catch {
          // Ignore errors - process might already be dead
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log('🔧 Killed PTPCamera service to allow gphoto2 access');
      // Wait longer for the process to fully terminate and prevent auto-restart
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Process might not be running, which is fine
      console.log('ℹ️ PTPCamera service not running or already killed');
    }
  }

  /**
   * Initialize camera connection
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.mockMode) {
      return this.mockConnect();
    }

    if (this.useWebcam) {
      return this.webcamConnect();
    }

    try {
      // Kill MacOS PTPCamera service before attempting to use gphoto2
      await this.killPTPCameraService();

      // Try to detect camera using gphoto2
      const detectResult = await this.executeGPhoto2Command(['--auto-detect']);

      if (detectResult.includes('No camera found')) {
        return {
          success: false,
          error: 'No camera detected. Please connect a DSLR camera.',
        };
      }

      // Get camera info
      const summaryResult = await this.executeGPhoto2Command(['--summary']);
      this.cameraInfo = this.parseCameraInfo(summaryResult);

      this.isConnected = true;
      this.emit('connected', this.cameraInfo);

      console.log('✅ Camera connected:', this.cameraInfo?.model);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Camera connection failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Disconnect camera
   */
  async disconnect(): Promise<void> {
    if (this.cameraProcess) {
      this.cameraProcess.kill();
      this.cameraProcess = null;
    }

    this.isConnected = false;
    this.emit('disconnected');
    console.log('📷 Camera disconnected');
  }

  /**
   * Capture a photo
   */
  async capture(): Promise<CaptureResult> {
    if (!this.isConnected && !this.mockMode) {
      return {
        success: false,
        error: 'Camera not connected',
      };
    }

    if (this.mockMode) {
      return this.mockCapture();
    }

    if (this.useWebcam) {
      return this.webcamCapture();
    }

    try {
      // Kill MacOS PTPCamera service before capturing
      await this.killPTPCameraService();

      const timestamp = Date.now();
      const filename = `capture_${timestamp}.jpg`;
      const outputPath = path.join(this.captureDir, filename);

      console.log('📷 Capturing photo...');
      this.emit('capturing');

      // Capture and download image
      await this.executeGPhoto2Command([
        '--capture-image-and-download',
        '--filename', outputPath,
      ]);

      // Verify file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('Capture file not created');
      }

      this.emit('captured', outputPath);
      console.log('✅ Photo captured:', outputPath);

      return {
        success: true,
        imagePath: outputPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Capture failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get camera status
   */
  getStatus(): { connected: boolean; info: CameraInfo | null } {
    return {
      connected: this.isConnected,
      info: this.cameraInfo,
    };
  }

  /**
   * Start live view streaming (webcam-like)
   * Continuously captures preview frames for real-time display
   */
  async startLiveView(fps: number = 10): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected && !this.mockMode && !this.useWebcam) {
      return {
        success: false,
        error: 'Camera not connected',
      };
    }

    if (this.liveViewActive) {
      return {
        success: false,
        error: 'Live view already active',
      };
    }

    if (this.mockMode) {
      return this.mockStartLiveView(fps);
    }

    if (this.useWebcam) {
      return this.webcamStartLiveView();
    }

    try {
      // Kill MacOS PTPCamera service before starting live view
      await this.killPTPCameraService();

      this.liveViewActive = true;
      const intervalMs = 1000 / fps;

      // Capture first frame immediately
      await this.captureLiveViewFrame();

      // Set up continuous capture
      this.liveViewInterval = setInterval(async () => {
        try {
          await this.captureLiveViewFrame();
        } catch (error) {
          console.error('Live view frame capture error:', error);
        }
      }, intervalMs);

      this.emit('liveview-started');
      console.log(`📹 Live view started at ${fps} fps`);

      return { success: true };
    } catch (error) {
      this.liveViewActive = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Live view start failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Stop live view streaming
   */
  async stopLiveView(): Promise<void> {
    if (this.liveViewInterval) {
      clearInterval(this.liveViewInterval);
      this.liveViewInterval = null;
    }

    this.liveViewActive = false;
    this.emit('liveview-stopped');
    console.log('📹 Live view stopped');
  }

  /**
   * Get current live view frame path
   */
  getLiveViewFramePath(): string {
    return this.previewPath;
  }

  /**
   * Check if live view is active
   */
  isLiveViewActive(): boolean {
    return this.liveViewActive;
  }

  /**
   * Capture a single live view frame
   */
  private async captureLiveViewFrame(): Promise<void> {
    await this.executeGPhoto2Command([
      '--capture-preview',
      '--filename', this.previewPath,
      '--force-overwrite',
    ]);

    // Emit event with frame data
    this.emit('liveview-frame', {
      path: this.previewPath,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute gphoto2 command
   */
  private async executeGPhoto2Command(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('gphoto2', args);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `gphoto2 exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute gphoto2: ${error.message}`));
      });
    });
  }

  /**
   * Parse camera info from gphoto2 summary
   */
  private parseCameraInfo(summary: string): CameraInfo {
    const modelMatch = summary.match(/Model:\s*(.+)/);
    const serialMatch = summary.match(/Serial Number:\s*(.+)/);
    const batteryMatch = summary.match(/Battery Level:\s*(\d+)/);

    return {
      model: modelMatch ? modelMatch[1].trim() : 'Unknown Camera',
      serial: serialMatch ? serialMatch[1].trim() : undefined,
      batteryLevel: batteryMatch ? parseInt(batteryMatch[1]) : undefined,
    };
  }

  /**
   * Mock mode: Simulate camera connection
   */
  private async mockConnect(): Promise<{ success: boolean }> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isConnected = true;
    this.cameraInfo = {
      model: 'Mock Camera (Canon EOS 5D Mark IV)',
      serial: 'MOCK123456789',
      batteryLevel: 85,
    };

    this.emit('connected', this.cameraInfo);
    console.log('✅ Mock camera connected');

    return { success: true };
  }

  /**
   * Mock mode: Simulate photo capture
   */
  private async mockCapture(): Promise<CaptureResult> {
    // Simulate capture delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const timestamp = Date.now();
    const filename = `mock_capture_${timestamp}.txt`;
    const outputPath = path.join(this.captureDir, filename);

    // Create a mock capture file
    fs.writeFileSync(outputPath, `Mock photo captured at ${new Date().toISOString()}\nResolution: 5760x3840\nISO: 400\nShutter: 1/125\nAperture: f/2.8`);

    this.emit('captured', outputPath);
    console.log('✅ Mock photo captured:', outputPath);

    return {
      success: true,
      imagePath: outputPath,
    };
  }

  /**
   * Mock mode: Start live view
   */
  private async mockStartLiveView(fps: number): Promise<{ success: boolean }> {
    this.liveViewActive = true;
    const intervalMs = 1000 / fps;

    // Simulate live view frames
    this.liveViewInterval = setInterval(() => {
      const mockFrame = `Mock live view frame at ${new Date().toISOString()}`;
      fs.writeFileSync(this.previewPath, mockFrame);

      this.emit('liveview-frame', {
        path: this.previewPath,
        timestamp: Date.now(),
      });
    }, intervalMs);

    this.emit('liveview-started');
    console.log(`✅ Mock live view started at ${fps} fps`);

    return { success: true };
  }

  /**
   * Webcam mode: Connect to built-in webcam
   */
  private async webcamConnect(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if imagesnap is available (for macOS)
      await this.executeCommand('which', ['imagesnap']);

      this.isConnected = true;
      this.cameraInfo = {
        model: 'Built-in Webcam',
        serial: 'WEBCAM',
        batteryLevel: 100,
      };

      this.emit('connected', this.cameraInfo);
      console.log('✅ Webcam connected');

      return { success: true };
    } catch (error) {
      // imagesnap not found, but we'll still connect and try to use it
      console.warn('⚠️ imagesnap not found. Install with: brew install imagesnap');

      this.isConnected = true;
      this.cameraInfo = {
        model: 'Built-in Webcam',
        serial: 'WEBCAM',
        batteryLevel: 100,
      };

      this.emit('connected', this.cameraInfo);
      console.log('✅ Webcam connected (imagesnap not found - will use fallback)');

      return { success: true };
    }
  }

  /**
   * Webcam mode: Capture from built-in webcam using imagesnap
   */
  private async webcamCapture(): Promise<CaptureResult> {
    try {
      const timestamp = Date.now();
      const filename = `webcam_capture_${timestamp}.jpg`;
      const outputPath = path.join(this.captureDir, filename);

      console.log('📷 Capturing from webcam...');
      this.emit('capturing');

      // Try using imagesnap (macOS)
      try {
        await this.executeCommand('imagesnap', ['-q', outputPath]);

        // Verify file exists
        if (!fs.existsSync(outputPath)) {
          throw new Error('Webcam capture file not created');
        }

        this.emit('captured', outputPath);
        console.log('✅ Webcam photo captured:', outputPath);

        return {
          success: true,
          imagePath: outputPath,
        };
      } catch (error) {
        // Fallback: Create a placeholder image
        console.warn('⚠️ imagesnap failed, creating placeholder');

        const placeholderText = `Webcam photo captured at ${new Date().toISOString()}\n\nTo enable webcam capture, install imagesnap:\nbrew install imagesnap\n\nResolution: 1280x720\nWebcam: Built-in`;
        fs.writeFileSync(outputPath + '.txt', placeholderText);

        this.emit('captured', outputPath + '.txt');
        console.log('✅ Webcam placeholder created:', outputPath + '.txt');

        return {
          success: true,
          imagePath: outputPath + '.txt',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Webcam capture failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Webcam mode: Start live view
   */
  private async webcamStartLiveView(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if imagesnap is available
      await this.executeCommand('which', ['imagesnap']);

      this.liveViewActive = true;

      // Capture frames continuously using imagesnap
      this.liveViewInterval = setInterval(async () => {
        try {
          await this.executeCommand('imagesnap', ['-q', this.previewPath]);

          this.emit('liveview-frame', {
            path: this.previewPath,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error('Webcam live view frame error:', error);
        }
      }, 100); // ~10 fps

      this.emit('liveview-started');
      console.log('📹 Webcam live view started');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Webcam live view start failed:', errorMessage);

      return {
        success: false,
        error: `${errorMessage}\n\nInstall imagesnap: brew install imagesnap`,
      };
    }
  }

  /**
   * Execute a generic command (not gphoto2)
   */
  private async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `${command} exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute ${command}: ${error.message}`));
      });
    });
  }
}
