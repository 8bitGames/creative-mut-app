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
  private pipelineScriptPath: string;
  private stitcherExePath: string;
  private stitcherScriptPath: string;
  private stitcherWorkingDir: string;
  private pipelineWorkingDir: string;

  constructor() {
    super();

    this.isProd = app.isPackaged;

    if (this.isProd) {
      // Production: Use PyInstaller-built executables (no Python installation needed!)
      this.pythonPath = ''; // Not used in production
      this.pipelineExePath = path.join(process.resourcesPath, 'python', 'pipeline.exe');
      this.pipelineScriptPath = ''; // Not used in production
      this.stitcherExePath = path.join(process.resourcesPath, 'python', 'stitch_images.exe');
      this.stitcherScriptPath = ''; // Not used in production
      this.stitcherWorkingDir = path.join(process.resourcesPath, 'python');
      this.pipelineWorkingDir = path.join(process.resourcesPath, 'python');

      console.log('🎬 [PythonBridge] Initialized (Production - Bundled EXE)');
      console.log(`   Pipeline EXE: ${this.pipelineExePath}`);
      console.log(`   Stitcher EXE: ${this.stitcherExePath}`);
    } else {
      // Development: Use system Python and script files
      // Windows uses 'python', Unix uses 'python3'
      this.pythonPath = process.platform === 'win32' ? 'python' : 'python3';
      this.pipelineExePath = ''; // Not used in development
      this.pipelineScriptPath = path.join(app.getAppPath(), 'MUT-distribution', 'pipeline.py');
      this.stitcherExePath = ''; // Not used in development
      this.stitcherScriptPath = path.join(app.getAppPath(), 'python', 'stitch_images.py');
      this.stitcherWorkingDir = path.join(app.getAppPath(), 'python');
      this.pipelineWorkingDir = path.join(app.getAppPath(), 'MUT-distribution');

      console.log('🐍 [PythonBridge] Initialized (Development - Python Scripts)');
      console.log(`   Python: ${this.pythonPath}`);
      console.log(`   Pipeline: ${this.pipelineScriptPath}`);
      console.log(`   Stitcher: ${this.stitcherScriptPath}`);
    }
    console.log(`   Stitcher working dir: ${this.stitcherWorkingDir}`);
    console.log(`   Pipeline working dir: ${this.pipelineWorkingDir}`);
  }

  /**
   * Process video using Python pipeline
   */
  async processVideo(options: VideoProcessingOptions): Promise<VideoProcessingResult> {
    return new Promise((resolve, reject) => {
      let executable: string;
      let args: string[];

      if (this.isProd) {
        // Production: Use standalone exe (no Python needed)
        executable = this.pipelineExePath;
        args = [
          '--input', options.inputVideo,
          '--frame', options.frameOverlay,
        ];
      } else {
        // Development: Use Python with script
        executable = this.pythonPath;
        args = [
          this.pipelineScriptPath,
          '--input', options.inputVideo,
          '--frame', options.frameOverlay,
        ];
      }

      if (options.subtitleText) {
        args.push('--subtitle', options.subtitleText);
      }

      if (options.s3Folder) {
        args.push('--s3-folder', options.s3Folder);
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
        },
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

          resolve(result);
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
   * Stitch 3 images into a video using stitch_images executable or script
   */
  private async stitchImagesToVideo(imagePaths: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`\n🎬 [PythonBridge] Stitching images...`);

      const timestamp = Date.now();
      const outputPath = path.join(this.stitcherWorkingDir, 'output', `stitched_${timestamp}.mp4`);

      let executable: string;
      let args: string[];

      if (this.isProd) {
        // Production: Use standalone exe
        executable = this.stitcherExePath;
        args = [
          '--images', ...imagePaths,
          '--output', outputPath,
          '--duration', '3.0',
        ];
      } else {
        // Development: Use Python with script
        executable = this.pythonPath;
        args = [
          this.stitcherScriptPath,
          '--images', ...imagePaths,
          '--output', outputPath,
          '--duration', '3.0',
        ];
      }

      console.log(`   Command: ${executable} ${args.join(' ')}`);

      const stitchProcess: ChildProcess = spawn(executable, args, {
        cwd: this.stitcherWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
        },
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
        // Create output directory for frames
        const fs = await import('fs/promises');
        const timestamp = Date.now();
        const outputDir = path.join(this.pipelineWorkingDir, 'output', `frames_${timestamp}`);
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`   Output directory: ${outputDir}`);

        const extractedFrames: string[] = [];

        // Extract each frame sequentially
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i];
          const framePath = path.join(outputDir, `frame_${time}s.jpg`);

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
            const ffmpegProcess = spawn('ffmpeg', args);

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
    if (this.isProd) {
      // Production: Check if exe files exist
      const fs = await import('fs');
      const pipelineExists = fs.existsSync(this.pipelineExePath);
      const stitcherExists = fs.existsSync(this.stitcherExePath);

      if (pipelineExists && stitcherExists) {
        console.log('Bundled executables found');
        console.log(`   Pipeline: ${this.pipelineExePath}`);
        console.log(`   Stitcher: ${this.stitcherExePath}`);
        return { available: true };
      } else {
        const missing = [];
        if (!pipelineExists) missing.push('pipeline.exe');
        if (!stitcherExists) missing.push('stitch_images.exe');
        return {
          available: false,
          error: `Missing bundled executables: ${missing.join(', ')}`,
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
