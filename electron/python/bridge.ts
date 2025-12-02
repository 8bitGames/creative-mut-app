// electron/python/bridge.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { getDebugConfig } from '../config';
import { promises as fs } from 'fs';

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
  framePaths: string[];
  compositionTime: number;
  totalTime: number;
}

export interface ProcessingProgress {
  step: 'compositing' | 'uploading' | 'generating-qr';
  progress: number;
  message: string;
}

export class PythonBridge extends EventEmitter {
  private isProd: boolean;
  private pythonPath: string;
  private pipelineExePath: string;
  private stitcherExePath: string;
  private pipelineScriptPath: string;
  private stitcherScriptPath: string;
  private stitcherWorkingDir: string;
  private pipelineWorkingDir: string;
  private ffmpegPath: string;
  private outputDir: string; // Output directory with write permissions

  constructor() {
    super();

    this.isProd = app.isPackaged;

    if (this.isProd) {
      // Production: Use PyInstaller-bundled exe files directly
      this.pipelineExePath = path.join(process.resourcesPath, 'python', 'pipeline.exe');
      this.stitcherExePath = path.join(process.resourcesPath, 'python', 'stitch_images.exe');
      this.pythonPath = ''; // Not used in production
      this.pipelineScriptPath = ''; // Not used in production
      this.stitcherScriptPath = ''; // Not used in production
      this.stitcherWorkingDir = path.join(process.resourcesPath, 'python');
      this.pipelineWorkingDir = path.join(process.resourcesPath, 'python');
      this.ffmpegPath = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
      // Use userData folder for output (has write permissions on all systems)
      this.outputDir = path.join(app.getPath('userData'), 'output');

      console.log('[PythonBridge] Initialized (Production - PyInstaller EXE)');
      console.log(`   Pipeline EXE: ${this.pipelineExePath}`);
      console.log(`   Stitcher EXE: ${this.stitcherExePath}`);
      console.log(`   FFmpeg: ${this.ffmpegPath}`);
      console.log(`   Output dir: ${this.outputDir}`);
    } else {
      // Development: Use system Python and script files
      // Windows uses 'python', Unix uses 'python3'
      this.pythonPath = process.platform === 'win32' ? 'python' : 'python3';
      this.pipelineScriptPath = path.join(app.getAppPath(), 'MUT-distribution', 'pipeline.py');
      this.stitcherScriptPath = path.join(app.getAppPath(), 'python', 'stitch_images.py');
      this.pipelineExePath = ''; // Not used in development
      this.stitcherExePath = ''; // Not used in development
      this.stitcherWorkingDir = path.join(app.getAppPath(), 'python');
      this.pipelineWorkingDir = path.join(app.getAppPath(), 'MUT-distribution');
      this.ffmpegPath = 'ffmpeg'; // Use system FFmpeg
      // Development: use local output directory
      this.outputDir = path.join(app.getAppPath(), 'MUT-distribution', 'output');

      console.log('[PythonBridge] Initialized (Development - Python Scripts)');
      console.log(`   Python: ${this.pythonPath}`);
      console.log(`   Pipeline: ${this.pipelineScriptPath}`);
      console.log(`   Stitcher: ${this.stitcherScriptPath}`);
      console.log(`   Output dir: ${this.outputDir}`);
    }
    console.log(`   Working dir: ${this.pipelineWorkingDir}`);
  }

  /**
   * Process video using Python pipeline
   */
  async processVideo(options: VideoProcessingOptions): Promise<VideoProcessingResult> {
    return new Promise((resolve, reject) => {
      // Production: Use exe directly, Development: Use python + script
      const executable = this.isProd ? this.pipelineExePath : this.pythonPath;
      const args = this.isProd
        ? [
            '--input', options.inputVideo,
            '--frame', options.frameOverlay,
          ]
        : [
            this.pipelineScriptPath,
            '--input', options.inputVideo,
            '--frame', options.frameOverlay,
          ];

      // In production, specify output dir for write permissions
      if (this.isProd) {
        args.push('--output-dir', this.outputDir);
      }

      if (options.subtitleText) {
        args.push('--subtitle', options.subtitleText);
      }

      if (options.s3Folder) {
        args.push('--s3-folder', options.s3Folder);
      }

      // Add debug log file if enabled in config
      const debugConfig = getDebugConfig();
      if (debugConfig.logToFile && debugConfig.resolvedLogPath) {
        args.push('--log-file', debugConfig.resolvedLogPath);
        console.log(`   Debug logging to: ${debugConfig.resolvedLogPath}`);
      }

      // Add flag to output JSON results
      args.push('--json');

      console.log(`Starting pipeline: ${executable} ${args.join(' ')}`);

      const pipelineProcess: ChildProcess = spawn(executable, args, {
        cwd: this.pipelineWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Pass FFmpeg path to Python scripts
          FFMPEG_PATH: this.ffmpegPath,
          // Pass AWS credentials (loaded from .env in main process)
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
          AWS_REGION: process.env.AWS_REGION || 'ap-northeast-2',
          AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'mut-demo-2025',
        },
        // Hide console window on Windows
        windowsHide: true,
      });

      let stdoutData = '';
      let stderrData = '';

      pipelineProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log('[Pipeline]', output);

        // Parse and emit progress updates
        this.parseProgress(output);
      });

      pipelineProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
        console.error('[Pipeline Error]', data.toString());
      });

      pipelineProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Pipeline process exited with code ${code}\n${stderrData}`));
          return;
        }

        try {
          // Parse JSON output (last line)
          const lines = stdoutData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result: VideoProcessingResult = JSON.parse(jsonLine);

          // ROBUST: Validate QR code file exists before returning
          if (result.qrCodePath) {
            const qrPath = result.qrCodePath;
            
            // Normalize path (handle both absolute and relative)
            const normalizedPath = path.isAbsolute(qrPath) 
              ? qrPath 
              : path.join(this.outputDir, qrPath);
            
            // Verify file exists and is readable (async)
            (async () => {
              try {
                // Check if file exists
                await fs.access(normalizedPath);
                
                // File exists - verify it's not empty
                const stats = await fs.stat(normalizedPath);
                if (stats.size === 0) {
                  console.error(`❌ [PythonBridge] QR code file is empty: ${normalizedPath}`);
                  // Don't fail - just log warning, let retry logic handle it
                } else {
                  console.log(`✅ [PythonBridge] QR code file verified: ${normalizedPath} (${stats.size} bytes)`);
                  // Update result with normalized absolute path
                  result.qrCodePath = path.resolve(normalizedPath);
                }
                resolve(result);
              } catch (error: any) {
                console.error(`❌ [PythonBridge] QR code file does not exist: ${normalizedPath}`);
                console.error(`   Error: ${error.message}`);
                console.error(`   Original path from pipeline: ${qrPath}`);
                console.error(`   Normalized path: ${normalizedPath}`);
                console.error(`   Output directory: ${this.outputDir}`);
                
                // Check if file exists in alternative locations
                const altPaths = [
                  qrPath, // Original path
                  path.join(this.outputDir, path.basename(qrPath)), // Just filename in output dir
                  path.join(path.dirname(qrPath), path.basename(qrPath)), // Same dir as original
                ];
                
                console.error(`   Checking alternative paths...`);
                let found = false;
                for (const altPath of altPaths) {
                  try {
                    await fs.access(altPath);
                    const stats = await fs.stat(altPath);
                    if (stats.size > 0) {
                      console.error(`   ✅ Found at alternative path: ${altPath} (${stats.size} bytes)`);
                      result.qrCodePath = path.resolve(altPath);
                      found = true;
                      break;
                    }
                  } catch {
                    // Continue to next path
                  }
                }
                
                if (found) {
                  console.log(`✅ [PythonBridge] QR code found at alternative path`);
                  resolve(result);
                } else {
                  // File truly doesn't exist - but don't fail, let retry logic handle it
                  console.warn(`⚠️  [PythonBridge] QR code file not found, but continuing (retry logic will handle)`);
                  resolve(result);
                }
              }
            })();
          } else {
            console.warn(`⚠️  [PythonBridge] No QR code path in result`);
            resolve(result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse pipeline output: ${error}\n${stdoutData}`));
        }
      });

      pipelineProcess.on('error', (error) => {
        reject(new Error(`Failed to start pipeline process: ${error}`));
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
    // URL path like "/frame1.png" -> filesystem path
    let frameFilesystemPath = options.frameTemplatePath;
    if (options.frameTemplatePath.startsWith('/')) {
      // This is a URL path from public directory
      // Remove leading slash before joining (path.join treats absolute paths specially)
      const relativePath = options.frameTemplatePath.substring(1);

      if (this.isProd) {
        // CRITICAL: In production, frame files are in extraResources (not asar)
        // FFmpeg and Python cannot read from inside asar archives
        const frameName = path.basename(relativePath);
        frameFilesystemPath = path.join(process.resourcesPath, 'frames', frameName);
        console.log(`   Frame template (production extraResources): ${frameFilesystemPath}`);
      } else {
        // Development: frames are in public directory
        frameFilesystemPath = path.join(app.getAppPath(), 'public', relativePath);
        console.log(`   Frame template (development): ${frameFilesystemPath}`);
      }
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
   * Stitch 3 images into a video using stitch_images executable or script
   */
  private async stitchImagesToVideo(imagePaths: string[]): Promise<string> {
    return new Promise(async (resolve, reject) => {
      console.log(`\n🎬 [PythonBridge] Stitching images...`);

      const timestamp = Date.now();
      // Use outputDir for stitched video (has write permissions in production)
      const outputPath = path.join(this.outputDir, `stitched_${timestamp}.mp4`);

      // Ensure output directory exists
      try {
        const fs = await import('fs/promises');
        await fs.mkdir(this.outputDir, { recursive: true });
      } catch (err) {
        console.warn(`   Warning: Could not create output directory: ${err}`);
      }

      // Production: Use exe directly, Development: Use python + script
      const executable = this.isProd ? this.stitcherExePath : this.pythonPath;
      const args = this.isProd
        ? [
            '--images', ...imagePaths,
            '--output', outputPath,
            '--duration', '3.0',
          ]
        : [
            this.stitcherScriptPath,
            '--images', ...imagePaths,
            '--output', outputPath,
            '--duration', '3.0',
          ];

      console.log(`   Command: ${executable} ${args.join(' ')}`);

      const stitchProcess: ChildProcess = spawn(executable, args, {
        cwd: this.stitcherWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Pass FFmpeg path to Python scripts
          FFMPEG_PATH: this.ffmpegPath,
        },
        // Hide console window on Windows
        windowsHide: true,
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
   * Extract frames from video at specific timestamps using FFmpeg
   */
  async extractFrames(videoPath: string, timestamps: number[]): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📸 [PythonBridge] EXTRACTING FRAMES FROM VIDEO`);
      console.log(`${'='.repeat(70)}`);
      console.log(`   Video: ${videoPath}`);
      console.log(`   Timestamps: ${timestamps.join('s, ')}s`);

      try {
        // Create output directory for frames (use outputDir for write permissions)
        const fs = await import('fs/promises');
        const timestamp = Date.now();
        const framesOutputDir = path.join(this.outputDir, `frames_${timestamp}`);
        await fs.mkdir(framesOutputDir, { recursive: true });
        console.log(`   Output directory: ${framesOutputDir}`);

        const extractedFrames: string[] = [];

        // Extract each frame sequentially
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i];
          const framePath = path.join(framesOutputDir, `frame_${time}s.jpg`);

          console.log(`\n   Extracting frame ${i + 1}/${timestamps.length} at ${time}s...`);

          // FFmpeg command to extract frame at specific timestamp
          // -ss: seek to timestamp
          // -i: input video
          // -frames:v 1: extract 1 frame
          // -q:v 2: high quality (1-31, lower is better)
          const args = [
            '-ss', time.toString(),
            '-i', videoPath,
            '-frames:v', '1',
            '-q:v', '2',
            '-y', // overwrite
            framePath
          ];

          await new Promise<void>((resolveFrame, rejectFrame) => {
            const ffmpegProcess = spawn(this.ffmpegPath, args);

            let stderr = '';

            ffmpegProcess.stderr?.on('data', (data) => {
              stderr += data.toString();
            });

            ffmpegProcess.on('close', (code) => {
              if (code !== 0) {
                console.error(`   ❌ FFmpeg failed with code ${code}`);
                console.error(`   Error: ${stderr}`);
                rejectFrame(new Error(`FFmpeg failed to extract frame at ${time}s`));
              } else {
                console.log(`   ✅ Frame extracted: ${framePath}`);
                extractedFrames.push(framePath);
                resolveFrame();
              }
            });

            ffmpegProcess.on('error', (error) => {
              rejectFrame(new Error(`Failed to start FFmpeg: ${error}`));
            });
          });
        }

        console.log(`\n✅ [PythonBridge] All frames extracted successfully!`);
        console.log(`   Total frames: ${extractedFrames.length}`);
        console.log(`${'='.repeat(70)}\n`);

        resolve(extractedFrames);
      } catch (error) {
        console.error(`❌ [PythonBridge] Frame extraction failed:`, error);
        console.log(`${'='.repeat(70)}\n`);
        reject(error);
      }
    });
  }

  /**
   * Check if dependencies are available
   */
  async checkDependencies(): Promise<{ available: boolean; error?: string }> {
    const fs = await import('fs');

    if (this.isProd) {
      // Production: Check if PyInstaller exe files exist
      const pipelineExeExists = fs.existsSync(this.pipelineExePath);
      const stitcherExeExists = fs.existsSync(this.stitcherExePath);
      const ffmpegExists = fs.existsSync(this.ffmpegPath);

      const missing = [];
      if (!pipelineExeExists) missing.push('pipeline.exe');
      if (!stitcherExeExists) missing.push('stitch_images.exe');
      if (!ffmpegExists) missing.push('ffmpeg.exe');

      if (missing.length === 0) {
        console.log('Bundled executables found');
        console.log(`   Pipeline EXE: ${this.pipelineExePath}`);
        console.log(`   Stitcher EXE: ${this.stitcherExePath}`);
        console.log(`   FFmpeg: ${this.ffmpegPath}`);
        return { available: true };
      } else {
        return {
          available: false,
          error: `Missing bundled files: ${missing.join(', ')}`,
        };
      }
    } else {
      // Development: Check if Python is available
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
}
