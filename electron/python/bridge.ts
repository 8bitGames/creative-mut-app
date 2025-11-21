// electron/python/bridge.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface VideoProcessingOptions {
  inputVideo: string;
  frameOverlay: string;
  subtitleText?: string;
  s3Folder?: string;
}

export interface ImageProcessingOptions {
  imagePaths: string[];
  frameTemplatePath: string;
  subtitleText?: string;
  s3Folder?: string;
}

export interface VideoProcessingResult {
  videoPath: string;
  s3Url: string;
  s3Key: string;
  qrCodePath: string;
  compositionTime: number;
  totalTime: number;
}

export interface ProcessingProgress {
  step: 'compositing' | 'uploading' | 'generating-qr';
  progress: number;
  message: string;
}

export class PythonBridge extends EventEmitter {
  private pythonPath: string;
  private pipelineScriptPath: string;
  private stitcherScriptPath: string;
  private stitcherWorkingDir: string;
  private pipelineWorkingDir: string;

  constructor() {
    super();

    const isProd = app.isPackaged;

    if (isProd) {
      // Production: Use bundled Python
      this.pythonPath = path.join(process.resourcesPath, 'python', 'python.exe');
      this.pipelineScriptPath = path.join(process.resourcesPath, 'python', 'pipeline.py');
      this.stitcherScriptPath = path.join(process.resourcesPath, 'python', 'stitch_images.py');
      this.stitcherWorkingDir = path.join(process.resourcesPath, 'python');
      this.pipelineWorkingDir = path.join(process.resourcesPath, 'python');
    } else {
      // Development: Use system Python and MUT-distribution pipeline
      this.pythonPath = 'python3';
      this.pipelineScriptPath = path.join(app.getAppPath(), 'MUT-distribution', 'pipeline.py');
      this.stitcherScriptPath = path.join(app.getAppPath(), 'python', 'stitch_images.py');
      this.stitcherWorkingDir = path.join(app.getAppPath(), 'python');
      this.pipelineWorkingDir = path.join(app.getAppPath(), 'MUT-distribution');
    }

    console.log('🐍 [PythonBridge] Initialized');
    console.log(`   Python: ${this.pythonPath}`);
    console.log(`   Pipeline: ${this.pipelineScriptPath}`);
    console.log(`   Stitcher: ${this.stitcherScriptPath}`);
    console.log(`   Stitcher working dir: ${this.stitcherWorkingDir}`);
    console.log(`   Pipeline working dir: ${this.pipelineWorkingDir}`);
  }

  /**
   * Process video using Python pipeline
   */
  async processVideo(options: VideoProcessingOptions): Promise<VideoProcessingResult> {
    return new Promise((resolve, reject) => {
      const args = [
        this.pipelineScriptPath,
        '--input', options.inputVideo,
        '--frame', options.frameOverlay,
      ];

      if (options.subtitleText) {
        args.push('--subtitle', options.subtitleText);
      }

      if (options.s3Folder) {
        args.push('--s3-folder', options.s3Folder);
      }

      // Add flag to output JSON results
      args.push('--json');

      console.log('Starting Python pipeline:', args.join(' '));

      const pythonProcess: ChildProcess = spawn(this.pythonPath, args, {
        cwd: this.pipelineWorkingDir,
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log('[Python]', output);

        // Parse and emit progress updates
        this.parseProgress(output);
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
        console.error('[Python Error]', data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}\n${stderrData}`));
          return;
        }

        try {
          // Parse JSON output from Python (last line)
          const lines = stdoutData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result: VideoProcessingResult = JSON.parse(jsonLine);

          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}\n${stdoutData}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error}`));
      });
    });
  }

  /**
   * Parse progress updates from Python stdout
   */
  private parseProgress(output: string) {
    if (output.includes('Step 1/3') || output.includes('VIDEO COMPOSITOR')) {
      this.emit('progress', {
        step: 'compositing',
        progress: 20,
        message: '비디오 합성 중...',
      } as ProcessingProgress);
    } else if (output.includes('Step 2/3') || output.includes('S3 Upload')) {
      this.emit('progress', {
        step: 'uploading',
        progress: 60,
        message: 'S3 업로드 중...',
      } as ProcessingProgress);
    } else if (output.includes('Step 3/3') || output.includes('QR Code')) {
      this.emit('progress', {
        step: 'generating-qr',
        progress: 90,
        message: 'QR 코드 생성 중...',
      } as ProcessingProgress);
    }
  }

  /**
   * Process images by stitching them into a video, then running pipeline
   */
  async processFromImages(options: ImageProcessingOptions): Promise<VideoProcessingResult> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📷 [PythonBridge] PROCESSING FROM IMAGES`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Image count: ${options.imagePaths.length}`);
    console.log(`   Frame template (URL): ${options.frameTemplatePath}`);
    console.log(`   Subtitle: ${options.subtitleText || '(none)'}`);

    if (options.imagePaths.length !== 3) {
      throw new Error(`Expected 3 images, got ${options.imagePaths.length}`);
    }

    // Convert URL path to filesystem path
    // URL path like "/frame1.png" -> "/Users/.../MUTUI/public/frame1.png"
    let frameFilesystemPath = options.frameTemplatePath;
    if (options.frameTemplatePath.startsWith('/')) {
      // This is a URL path from public directory
      // Remove leading slash before joining (path.join treats absolute paths specially)
      const relativePath = options.frameTemplatePath.substring(1);
      frameFilesystemPath = path.join(app.getAppPath(), 'public', relativePath);
      console.log(`   Frame template (filesystem): ${frameFilesystemPath}`);
    }

    this.emit('progress', {
      step: 'compositing',
      progress: 10,
      message: '이미지를 비디오로 변환 중...',
    } as ProcessingProgress);

    // Step 1: Stitch images into video
    const stitchedVideoPath = await this.stitchImagesToVideo(options.imagePaths);

    console.log(`   ✓ Stitched video: ${stitchedVideoPath}`);

    this.emit('progress', {
      step: 'compositing',
      progress: 30,
      message: '프레임 오버레이 적용 중...',
    } as ProcessingProgress);

    // Step 2: Process with pipeline (face enhancement, frame overlay, upload, generate QR)
    console.log(`\n📺 [PythonBridge] Running pipeline with stitched video...`);
    const result = await this.processVideo({
      inputVideo: stitchedVideoPath,
      frameOverlay: frameFilesystemPath,
      subtitleText: options.subtitleText,
      s3Folder: options.s3Folder,
    });

    console.log(`✅ [PythonBridge] Image processing complete!`);
    console.log(`${'='.repeat(70)}\n`);

    // Cleanup: Delete temporary captured images
    console.log(`\n🧹 [PythonBridge] Cleaning up temporary files...`);
    for (const imagePath of options.imagePaths) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(imagePath);
        console.log(`   ✓ Deleted: ${imagePath}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to delete ${imagePath}:`, error);
      }
    }

    // Cleanup: Delete stitched video after pipeline completes
    try {
      const fs = await import('fs/promises');
      await fs.unlink(stitchedVideoPath);
      console.log(`   ✓ Deleted stitched video: ${stitchedVideoPath}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to delete stitched video ${stitchedVideoPath}:`, error);
    }

    console.log(`✅ [PythonBridge] Cleanup complete!\n`);

    return result;
  }

  /**
   * Stitch 3 images into a video using stitch_images.py
   */
  private async stitchImagesToVideo(imagePaths: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`\n🎬 [PythonBridge] Stitching images...`);

      const timestamp = Date.now();
      const outputPath = path.join(this.stitcherWorkingDir, 'output', `stitched_${timestamp}.mp4`);

      const args = [
        this.stitcherScriptPath,
        '--images', ...imagePaths,
        '--output', outputPath,
        '--duration', '3.0',
      ];

      console.log(`   Command: ${this.pythonPath} ${args.join(' ')}`);

      const stitchProcess: ChildProcess = spawn(this.pythonPath, args, {
        cwd: this.stitcherWorkingDir,
      });

      let stdoutData = '';
      let stderrData = '';

      stitchProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log('[Stitcher]', output);
      });

      stitchProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
        console.error('[Stitcher Error]', data.toString());
      });

      stitchProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Stitcher process exited with code ${code}\n${stderrData}`));
          return;
        }

        try {
          // Stitcher outputs JSON on last line
          const lines = stdoutData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);

          if (result.success) {
            resolve(result.videoPath);
          } else {
            reject(new Error(result.error || 'Unknown stitching error'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse stitcher output: ${error}\n${stdoutData}`));
        }
      });

      stitchProcess.on('error', (error) => {
        reject(new Error(`Failed to start stitcher process: ${error}`));
      });
    });
  }

  /**
   * Check if Python and dependencies are available
   */
  async checkDependencies(): Promise<{ available: boolean; error?: string }> {
    return new Promise((resolve) => {
      const checkProcess = spawn(this.pythonPath, ['--version']);

      let versionOutput = '';

      checkProcess.stdout?.on('data', (data) => {
        versionOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Python version:', versionOutput.trim());
          resolve({ available: true });
        } else {
          resolve({
            available: false,
            error: 'Python not found. Please install Python 3.8+',
          });
        }
      });

      checkProcess.on('error', () => {
        resolve({
          available: false,
          error: 'Python not found. Please install Python 3.8+',
        });
      });
    });
  }
}
