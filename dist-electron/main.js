var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import path__default from "path";
import * as fs$1 from "fs/promises";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
class PythonBridge extends EventEmitter {
  constructor() {
    super();
    __publicField(this, "pythonPath");
    __publicField(this, "pipelineScriptPath");
    __publicField(this, "stitcherScriptPath");
    __publicField(this, "stitcherWorkingDir");
    __publicField(this, "pipelineWorkingDir");
    const isProd = app.isPackaged;
    if (isProd) {
      this.pythonPath = path__default.join(process.resourcesPath, "python", "python.exe");
      this.pipelineScriptPath = path__default.join(process.resourcesPath, "python", "pipeline.py");
      this.stitcherScriptPath = path__default.join(process.resourcesPath, "python", "stitch_images.py");
      this.stitcherWorkingDir = path__default.join(process.resourcesPath, "python");
      this.pipelineWorkingDir = path__default.join(process.resourcesPath, "python");
    } else {
      this.pythonPath = "python3";
      this.pipelineScriptPath = path__default.join(app.getAppPath(), "MUT-distribution", "pipeline.py");
      this.stitcherScriptPath = path__default.join(app.getAppPath(), "python", "stitch_images.py");
      this.stitcherWorkingDir = path__default.join(app.getAppPath(), "python");
      this.pipelineWorkingDir = path__default.join(app.getAppPath(), "MUT-distribution");
    }
    console.log("🐍 [PythonBridge] Initialized");
    console.log(`   Python: ${this.pythonPath}`);
    console.log(`   Pipeline: ${this.pipelineScriptPath}`);
    console.log(`   Stitcher: ${this.stitcherScriptPath}`);
    console.log(`   Stitcher working dir: ${this.stitcherWorkingDir}`);
    console.log(`   Pipeline working dir: ${this.pipelineWorkingDir}`);
  }
  /**
   * Process video using Python pipeline
   */
  async processVideo(options) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const args = [
        this.pipelineScriptPath,
        "--input",
        options.inputVideo,
        "--frame",
        options.frameOverlay
      ];
      if (options.subtitleText) {
        args.push("--subtitle", options.subtitleText);
      }
      if (options.s3Folder) {
        args.push("--s3-folder", options.s3Folder);
      }
      args.push("--json");
      console.log("Starting Python pipeline:", args.join(" "));
      const pythonProcess = spawn(this.pythonPath, args, {
        cwd: this.pipelineWorkingDir
      });
      let stdoutData = "";
      let stderrData = "";
      (_a = pythonProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log("[Python]", output);
        this.parseProgress(output);
      });
      (_b = pythonProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderrData += data.toString();
        console.error("[Python Error]", data.toString());
      });
      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}
${stderrData}`));
          return;
        }
        try {
          const lines = stdoutData.trim().split("\n");
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}
${stdoutData}`));
        }
      });
      pythonProcess.on("error", (error) => {
        reject(new Error(`Failed to start Python process: ${error}`));
      });
    });
  }
  /**
   * Parse progress updates from Python stdout
   */
  parseProgress(output) {
    if (output.includes("Step 1/3") || output.includes("VIDEO COMPOSITOR")) {
      this.emit("progress", {
        step: "compositing",
        progress: 20,
        message: "비디오 합성 중..."
      });
    } else if (output.includes("Step 2/3") || output.includes("S3 Upload")) {
      this.emit("progress", {
        step: "uploading",
        progress: 60,
        message: "S3 업로드 중..."
      });
    } else if (output.includes("Step 3/3") || output.includes("QR Code")) {
      this.emit("progress", {
        step: "generating-qr",
        progress: 90,
        message: "QR 코드 생성 중..."
      });
    }
  }
  /**
   * Process images by stitching them into a video, then running pipeline
   */
  async processFromImages(options) {
    console.log(`
${"=".repeat(70)}`);
    console.log(`📷 [PythonBridge] PROCESSING FROM IMAGES`);
    console.log(`${"=".repeat(70)}`);
    console.log(`   Image count: ${options.imagePaths.length}`);
    console.log(`   Frame template (URL): ${options.frameTemplatePath}`);
    console.log(`   Subtitle: ${options.subtitleText || "(none)"}`);
    if (options.imagePaths.length !== 3) {
      throw new Error(`Expected 3 images, got ${options.imagePaths.length}`);
    }
    let frameFilesystemPath = options.frameTemplatePath;
    if (options.frameTemplatePath.startsWith("/")) {
      const relativePath = options.frameTemplatePath.substring(1);
      frameFilesystemPath = path__default.join(app.getAppPath(), "public", relativePath);
      console.log(`   Frame template (filesystem): ${frameFilesystemPath}`);
    }
    this.emit("progress", {
      step: "compositing",
      progress: 10,
      message: "이미지를 비디오로 변환 중..."
    });
    const stitchedVideoPath = await this.stitchImagesToVideo(options.imagePaths);
    console.log(`   ✓ Stitched video: ${stitchedVideoPath}`);
    this.emit("progress", {
      step: "compositing",
      progress: 30,
      message: "프레임 오버레이 적용 중..."
    });
    console.log(`
📺 [PythonBridge] Running pipeline with stitched video...`);
    const result = await this.processVideo({
      inputVideo: stitchedVideoPath,
      frameOverlay: frameFilesystemPath,
      subtitleText: options.subtitleText,
      s3Folder: options.s3Folder
    });
    console.log(`✅ [PythonBridge] Image processing complete!`);
    console.log(`${"=".repeat(70)}
`);
    console.log(`
🧹 [PythonBridge] Cleaning up temporary files...`);
    for (const imagePath of options.imagePaths) {
      try {
        const fs2 = await import("fs/promises");
        await fs2.unlink(imagePath);
        console.log(`   ✓ Deleted: ${imagePath}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to delete ${imagePath}:`, error);
      }
    }
    try {
      const fs2 = await import("fs/promises");
      await fs2.unlink(stitchedVideoPath);
      console.log(`   ✓ Deleted stitched video: ${stitchedVideoPath}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to delete stitched video ${stitchedVideoPath}:`, error);
    }
    console.log(`✅ [PythonBridge] Cleanup complete!
`);
    return result;
  }
  /**
   * Stitch 3 images into a video using stitch_images.py
   */
  async stitchImagesToVideo(imagePaths) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      console.log(`
🎬 [PythonBridge] Stitching images...`);
      const timestamp = Date.now();
      const outputPath = path__default.join(this.stitcherWorkingDir, "output", `stitched_${timestamp}.mp4`);
      const args = [
        this.stitcherScriptPath,
        "--images",
        ...imagePaths,
        "--output",
        outputPath,
        "--duration",
        "3.0"
      ];
      console.log(`   Command: ${this.pythonPath} ${args.join(" ")}`);
      const stitchProcess = spawn(this.pythonPath, args, {
        cwd: this.stitcherWorkingDir
      });
      let stdoutData = "";
      let stderrData = "";
      (_a = stitchProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log("[Stitcher]", output);
      });
      (_b = stitchProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderrData += data.toString();
        console.error("[Stitcher Error]", data.toString());
      });
      stitchProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Stitcher process exited with code ${code}
${stderrData}`));
          return;
        }
        try {
          const lines = stdoutData.trim().split("\n");
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);
          if (result.success) {
            resolve(result.videoPath);
          } else {
            reject(new Error(result.error || "Unknown stitching error"));
          }
        } catch (error) {
          reject(new Error(`Failed to parse stitcher output: ${error}
${stdoutData}`));
        }
      });
      stitchProcess.on("error", (error) => {
        reject(new Error(`Failed to start stitcher process: ${error}`));
      });
    });
  }
  /**
   * Extract frames from video at specific timestamps using FFmpeg
   */
  async extractFrames(videoPath, timestamps) {
    return new Promise(async (resolve, reject) => {
      console.log(`
${"=".repeat(70)}`);
      console.log(`📸 [PythonBridge] EXTRACTING FRAMES FROM VIDEO`);
      console.log(`${"=".repeat(70)}`);
      console.log(`   Video: ${videoPath}`);
      console.log(`   Timestamps: ${timestamps.join("s, ")}s`);
      try {
        const fs2 = await import("fs/promises");
        const timestamp = Date.now();
        const outputDir = path__default.join(this.pipelineWorkingDir, "output", `frames_${timestamp}`);
        await fs2.mkdir(outputDir, { recursive: true });
        console.log(`   Output directory: ${outputDir}`);
        const extractedFrames = [];
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i];
          const framePath = path__default.join(outputDir, `frame_${time}s.jpg`);
          console.log(`
   Extracting frame ${i + 1}/${timestamps.length} at ${time}s...`);
          const args = [
            "-ss",
            time.toString(),
            "-i",
            videoPath,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-y",
            // overwrite
            framePath
          ];
          await new Promise((resolveFrame, rejectFrame) => {
            var _a;
            const ffmpegProcess = spawn("ffmpeg", args);
            let stderr = "";
            (_a = ffmpegProcess.stderr) == null ? void 0 : _a.on("data", (data) => {
              stderr += data.toString();
            });
            ffmpegProcess.on("close", (code) => {
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
            ffmpegProcess.on("error", (error) => {
              rejectFrame(new Error(`Failed to start FFmpeg: ${error}`));
            });
          });
        }
        console.log(`
✅ [PythonBridge] All frames extracted successfully!`);
        console.log(`   Total frames: ${extractedFrames.length}`);
        console.log(`${"=".repeat(70)}
`);
        resolve(extractedFrames);
      } catch (error) {
        console.error(`❌ [PythonBridge] Frame extraction failed:`, error);
        console.log(`${"=".repeat(70)}
`);
        reject(error);
      }
    });
  }
  /**
   * Check if Python and dependencies are available
   */
  async checkDependencies() {
    return new Promise((resolve) => {
      var _a;
      const checkProcess = spawn(this.pythonPath, ["--version"]);
      let versionOutput = "";
      (_a = checkProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        versionOutput += data.toString();
      });
      checkProcess.on("close", (code) => {
        if (code === 0) {
          console.log("Python version:", versionOutput.trim());
          resolve({ available: true });
        } else {
          resolve({
            available: false,
            error: "Python not found. Please install Python 3.8+"
          });
        }
      });
      checkProcess.on("error", () => {
        resolve({
          available: false,
          error: "Python not found. Please install Python 3.8+"
        });
      });
    });
  }
}
class CameraController extends EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "mockMode");
    __publicField(this, "useWebcam");
    __publicField(this, "captureDir");
    __publicField(this, "cameraProcess", null);
    __publicField(this, "isConnected", false);
    __publicField(this, "cameraInfo", null);
    this.mockMode = config.mockMode ?? process.env.MOCK_CAMERA === "true";
    this.useWebcam = config.useWebcam ?? process.env.USE_WEBCAM === "true";
    this.captureDir = config.captureDir ?? path.join(process.cwd(), "captures");
    if (!fs.existsSync(this.captureDir)) {
      fs.mkdirSync(this.captureDir, { recursive: true });
    }
  }
  /**
   * Initialize camera connection
   */
  async connect() {
    var _a;
    if (this.mockMode) {
      return this.mockConnect();
    }
    if (this.useWebcam) {
      return this.webcamConnect();
    }
    try {
      const detectResult = await this.executeGPhoto2Command(["--auto-detect"]);
      if (detectResult.includes("No camera found")) {
        return {
          success: false,
          error: "No camera detected. Please connect a DSLR camera."
        };
      }
      const summaryResult = await this.executeGPhoto2Command(["--summary"]);
      this.cameraInfo = this.parseCameraInfo(summaryResult);
      this.isConnected = true;
      this.emit("connected", this.cameraInfo);
      console.log("✅ Camera connected:", (_a = this.cameraInfo) == null ? void 0 : _a.model);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Camera connection failed:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Disconnect camera
   */
  async disconnect() {
    if (this.cameraProcess) {
      this.cameraProcess.kill();
      this.cameraProcess = null;
    }
    this.isConnected = false;
    this.emit("disconnected");
    console.log("📷 Camera disconnected");
  }
  /**
   * Capture a photo
   */
  async capture() {
    if (!this.isConnected && !this.mockMode) {
      return {
        success: false,
        error: "Camera not connected"
      };
    }
    if (this.mockMode) {
      return this.mockCapture();
    }
    if (this.useWebcam) {
      return this.webcamCapture();
    }
    try {
      const timestamp = Date.now();
      const filename = `capture_${timestamp}.jpg`;
      const outputPath = path.join(this.captureDir, filename);
      console.log("📷 Capturing photo...");
      this.emit("capturing");
      await this.executeGPhoto2Command([
        "--capture-image-and-download",
        "--filename",
        outputPath
      ]);
      if (!fs.existsSync(outputPath)) {
        throw new Error("Capture file not created");
      }
      this.emit("captured", outputPath);
      console.log("✅ Photo captured:", outputPath);
      return {
        success: true,
        imagePath: outputPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Capture failed:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Get camera status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      info: this.cameraInfo
    };
  }
  /**
   * Execute gphoto2 command
   */
  async executeGPhoto2Command(args) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const process2 = spawn("gphoto2", args);
      let stdout = "";
      let stderr = "";
      (_a = process2.stdout) == null ? void 0 : _a.on("data", (data) => {
        stdout += data.toString();
      });
      (_b = process2.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderr += data.toString();
      });
      process2.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `gphoto2 exited with code ${code}`));
        }
      });
      process2.on("error", (error) => {
        reject(new Error(`Failed to execute gphoto2: ${error.message}`));
      });
    });
  }
  /**
   * Parse camera info from gphoto2 summary
   */
  parseCameraInfo(summary) {
    const modelMatch = summary.match(/Model:\s*(.+)/);
    const serialMatch = summary.match(/Serial Number:\s*(.+)/);
    const batteryMatch = summary.match(/Battery Level:\s*(\d+)/);
    return {
      model: modelMatch ? modelMatch[1].trim() : "Unknown Camera",
      serial: serialMatch ? serialMatch[1].trim() : void 0,
      batteryLevel: batteryMatch ? parseInt(batteryMatch[1]) : void 0
    };
  }
  /**
   * Mock mode: Simulate camera connection
   */
  async mockConnect() {
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.isConnected = true;
    this.cameraInfo = {
      model: "Mock Camera (Canon EOS 5D Mark IV)",
      serial: "MOCK123456789",
      batteryLevel: 85
    };
    this.emit("connected", this.cameraInfo);
    console.log("✅ Mock camera connected");
    return { success: true };
  }
  /**
   * Mock mode: Simulate photo capture
   */
  async mockCapture() {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    const timestamp = Date.now();
    const filename = `mock_capture_${timestamp}.txt`;
    const outputPath = path.join(this.captureDir, filename);
    fs.writeFileSync(outputPath, `Mock photo captured at ${(/* @__PURE__ */ new Date()).toISOString()}
Resolution: 5760x3840
ISO: 400
Shutter: 1/125
Aperture: f/2.8`);
    this.emit("captured", outputPath);
    console.log("✅ Mock photo captured:", outputPath);
    return {
      success: true,
      imagePath: outputPath
    };
  }
  /**
   * Webcam mode: Connect to built-in webcam
   */
  async webcamConnect() {
    try {
      await this.executeCommand("which", ["imagesnap"]);
      this.isConnected = true;
      this.cameraInfo = {
        model: "Built-in Webcam",
        serial: "WEBCAM",
        batteryLevel: 100
      };
      this.emit("connected", this.cameraInfo);
      console.log("✅ Webcam connected");
      return { success: true };
    } catch (error) {
      console.warn("⚠️ imagesnap not found. Install with: brew install imagesnap");
      this.isConnected = true;
      this.cameraInfo = {
        model: "Built-in Webcam",
        serial: "WEBCAM",
        batteryLevel: 100
      };
      this.emit("connected", this.cameraInfo);
      console.log("✅ Webcam connected (imagesnap not found - will use fallback)");
      return { success: true };
    }
  }
  /**
   * Webcam mode: Capture from built-in webcam using imagesnap
   */
  async webcamCapture() {
    try {
      const timestamp = Date.now();
      const filename = `webcam_capture_${timestamp}.jpg`;
      const outputPath = path.join(this.captureDir, filename);
      console.log("📷 Capturing from webcam...");
      this.emit("capturing");
      try {
        await this.executeCommand("imagesnap", ["-q", outputPath]);
        if (!fs.existsSync(outputPath)) {
          throw new Error("Webcam capture file not created");
        }
        this.emit("captured", outputPath);
        console.log("✅ Webcam photo captured:", outputPath);
        return {
          success: true,
          imagePath: outputPath
        };
      } catch (error) {
        console.warn("⚠️ imagesnap failed, creating placeholder");
        const placeholderText = `Webcam photo captured at ${(/* @__PURE__ */ new Date()).toISOString()}

To enable webcam capture, install imagesnap:
brew install imagesnap

Resolution: 1280x720
Webcam: Built-in`;
        fs.writeFileSync(outputPath + ".txt", placeholderText);
        this.emit("captured", outputPath + ".txt");
        console.log("✅ Webcam placeholder created:", outputPath + ".txt");
        return {
          success: true,
          imagePath: outputPath + ".txt"
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Webcam capture failed:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Execute a generic command (not gphoto2)
   */
  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const process2 = spawn(command, args);
      let stdout = "";
      let stderr = "";
      (_a = process2.stdout) == null ? void 0 : _a.on("data", (data) => {
        stdout += data.toString();
      });
      (_b = process2.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderr += data.toString();
      });
      process2.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `${command} exited with code ${code}`));
        }
      });
      process2.on("error", (error) => {
        reject(new Error(`Failed to execute ${command}: ${error.message}`));
      });
    });
  }
}
class PrinterController extends EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "mockMode");
    __publicField(this, "printerName");
    __publicField(this, "currentJob", null);
    __publicField(this, "mockPaperLevel", 100);
    __publicField(this, "mockInkLevels", {
      cyan: 85,
      magenta: 90,
      yellow: 75,
      black: 88
    });
    this.mockMode = config.mockMode ?? process.env.MOCK_PRINTER === "true";
    this.printerName = config.printerName ?? "Default";
  }
  /**
   * Initialize printer connection
   */
  async connect() {
    if (this.mockMode) {
      return this.mockConnect();
    }
    try {
      const printers = await this.listPrinters();
      if (printers.length === 0) {
        return {
          success: false,
          error: "No printers found. Please connect a printer."
        };
      }
      console.log("✅ Printer connected:", printers[0]);
      this.emit("connected", { name: printers[0] });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Printer connection failed:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Get printer status
   */
  async getStatus() {
    if (this.mockMode) {
      return this.mockGetStatus();
    }
    try {
      const status = await this.executePrinterCommand(["lpstat", "-p", this.printerName]);
      const isPrinting = status.includes("printing");
      const hasError = status.includes("error");
      return {
        available: true,
        status: hasError ? "error" : isPrinting ? "printing" : "idle",
        paperLevel: 100,
        // Real implementation would query actual level
        inkLevel: {
          cyan: 85,
          magenta: 90,
          yellow: 75,
          black: 88
        }
      };
    } catch (error) {
      return {
        available: false,
        status: "offline",
        paperLevel: 0,
        inkLevel: {
          cyan: 0,
          magenta: 0,
          yellow: 0,
          black: 0
        },
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * Print a photo
   */
  async print(options) {
    if (this.mockMode) {
      return this.mockPrint(options);
    }
    try {
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Image file not found: ${options.imagePath}`);
      }
      const jobId = `job_${Date.now()}`;
      this.currentJob = jobId;
      console.log("🖨️  Starting print job:", jobId);
      this.emit("printing", { jobId, options });
      const args = [
        "-d",
        this.printerName,
        "-n",
        String(options.copies || 1),
        "-o",
        "media=4x6",
        "-o",
        "fit-to-page",
        options.imagePath
      ];
      const result = await this.executePrinterCommand(["lp", ...args]);
      const jobIdMatch = result.match(/request id is (.+)/);
      const actualJobId = jobIdMatch ? jobIdMatch[1] : jobId;
      this.emit("printed", { jobId: actualJobId });
      console.log("✅ Print job completed:", actualJobId);
      this.currentJob = null;
      return {
        success: true,
        jobId: actualJobId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Print failed:", errorMessage);
      this.currentJob = null;
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Cancel current print job
   */
  async cancelPrint(jobId) {
    if (this.mockMode) {
      return this.mockCancelPrint(jobId);
    }
    try {
      await this.executePrinterCommand(["cancel", jobId]);
      this.emit("cancelled", { jobId });
      console.log("✅ Print job cancelled:", jobId);
      return { success: true };
    } catch (error) {
      console.error("❌ Cancel failed:", error);
      return { success: false };
    }
  }
  /**
   * List available printers
   */
  async listPrinters() {
    const output = await this.executePrinterCommand(["lpstat", "-p"]);
    const printers = [];
    const lines = output.split("\n");
    for (const line of lines) {
      const match = line.match(/printer (.+) is/);
      if (match) {
        printers.push(match[1]);
      }
    }
    return printers;
  }
  /**
   * Execute printer command
   */
  async executePrinterCommand(args) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const [command, ...cmdArgs] = args;
      const process2 = spawn(command, cmdArgs);
      let stdout = "";
      let stderr = "";
      (_a = process2.stdout) == null ? void 0 : _a.on("data", (data) => {
        stdout += data.toString();
      });
      (_b = process2.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderr += data.toString();
      });
      process2.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command exited with code ${code}`));
        }
      });
      process2.on("error", (error) => {
        reject(error);
      });
    });
  }
  /**
   * Mock mode: Simulate printer connection
   */
  async mockConnect() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log("✅ Mock printer connected");
    this.emit("connected", { name: "Mock Photo Printer (Canon SELPHY CP1300)" });
    return { success: true };
  }
  /**
   * Mock mode: Get printer status
   */
  async mockGetStatus() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      available: true,
      status: this.currentJob ? "printing" : "idle",
      paperLevel: this.mockPaperLevel,
      inkLevel: this.mockInkLevels
    };
  }
  /**
   * Mock mode: Simulate printing
   */
  async mockPrint(options) {
    const jobId = `mock_job_${Date.now()}`;
    this.currentJob = jobId;
    console.log("🖨️  Starting mock print job:", jobId);
    this.emit("printing", { jobId, options });
    for (let i = 0; i <= 100; i += 20) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.emit("progress", { jobId, progress: i });
      console.log(`🖨️  Print progress: ${i}%`);
    }
    this.mockPaperLevel = Math.max(0, this.mockPaperLevel - 1);
    this.emit("printed", { jobId });
    console.log("✅ Mock print job completed:", jobId);
    this.currentJob = null;
    return {
      success: true,
      jobId
    };
  }
  /**
   * Mock mode: Cancel print
   */
  async mockCancelPrint(jobId) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.currentJob = null;
    this.emit("cancelled", { jobId });
    console.log("✅ Mock print job cancelled:", jobId);
    return { success: true };
  }
}
class CardReaderController extends EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "mockMode");
    __publicField(this, "mockApprovalRate");
    __publicField(this, "readerPort");
    __publicField(this, "isConnected", false);
    __publicField(this, "currentTransaction", null);
    __publicField(this, "timeoutTimer", null);
    this.mockMode = config.mockMode ?? process.env.MOCK_CARD_READER !== "false";
    this.mockApprovalRate = config.mockApprovalRate ?? 0.8;
    this.readerPort = config.readerPort ?? "COM1";
    if (!this.mockMode) {
      console.log(`Card reader configured on port: ${this.readerPort}`);
    }
  }
  /**
   * Initialize card reader connection
   */
  async connect() {
    if (this.mockMode) {
      return this.mockConnect();
    }
    try {
      throw new Error("Real card reader not implemented. Set MOCK_CARD_READER=true for testing.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Card reader connection failed:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Disconnect card reader
   */
  async disconnect() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.isConnected = false;
    this.currentTransaction = null;
    this.emit("disconnected");
    console.log("💳 Card reader disconnected");
  }
  /**
   * Process a payment
   */
  async processPayment(options) {
    if (!this.isConnected && !this.mockMode) {
      return {
        success: false,
        status: "error",
        error: "Card reader not connected"
      };
    }
    if (this.mockMode) {
      return this.mockProcessPayment(options);
    }
    try {
      throw new Error("Real card reader not implemented. Set MOCK_CARD_READER=true for testing.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Payment processing failed:", errorMessage);
      return {
        success: false,
        status: "error",
        error: errorMessage
      };
    }
  }
  /**
   * Cancel current payment
   */
  async cancelPayment() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.currentTransaction = null;
    this.emit("status", {
      status: "cancelled",
      message: "결제가 취소되었습니다"
    });
    console.log("💳 Payment cancelled");
    return { success: true };
  }
  /**
   * Get reader status
   */
  getStatus() {
    return {
      connected: this.isConnected
    };
  }
  /**
   * Mock mode: Simulate card reader connection
   */
  async mockConnect() {
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.isConnected = true;
    console.log("✅ Mock card reader connected (Dummy Mode)");
    console.log(`   - Approval rate: ${(this.mockApprovalRate * 100).toFixed(0)}%`);
    this.emit("connected", { model: "Mock Card Reader (Test Device)" });
    return { success: true };
  }
  /**
   * Mock mode: Simulate payment processing
   */
  async mockProcessPayment(options) {
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    this.currentTransaction = transactionId;
    console.log("💳 Starting mock payment:", transactionId);
    console.log(`   Amount: ${options.amount.toLocaleString()} ${options.currency || "KRW"}`);
    this.emit("status", {
      status: "waiting",
      message: `카드를 삽입해주세요
금액: ${options.amount.toLocaleString()}원`
    });
    this.timeoutTimer = setTimeout(() => {
      if (this.currentTransaction === transactionId) {
        this.emit("status", {
          status: "timeout",
          message: "시간이 초과되었습니다"
        });
        this.currentTransaction = null;
      }
    }, 3e4);
    const insertDelay = 2e3 + Math.random() * 2e3;
    await new Promise((resolve) => setTimeout(resolve, insertDelay));
    if (this.currentTransaction !== transactionId) {
      return {
        success: false,
        status: "cancelled",
        error: "Payment cancelled"
      };
    }
    this.emit("status", {
      status: "card_inserted",
      message: "카드가 감지되었습니다"
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.emit("status", {
      status: "processing",
      message: "결제 처리 중..."
    });
    const processingDelay = 1e3 + Math.random() * 1e3;
    await new Promise((resolve) => setTimeout(resolve, processingDelay));
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    const isApproved = Math.random() < this.mockApprovalRate;
    if (isApproved) {
      const cardTypes = ["visa", "mastercard", "amex"];
      const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
      const cardLast4 = String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
      const result = {
        success: true,
        status: "approved",
        transactionId,
        amount: options.amount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        cardType,
        cardLast4
      };
      this.emit("status", {
        status: "approved",
        message: "결제가 완료되었습니다!"
      });
      console.log("✅ Mock payment approved:", transactionId);
      console.log(`   Card: ${cardType.toUpperCase()} ****${cardLast4}`);
      this.currentTransaction = null;
      return result;
    } else {
      const declineReasons = [
        "잔액 부족",
        "카드 승인 거부",
        "한도 초과",
        "카드 정보 오류"
      ];
      const declineReason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
      const result = {
        success: false,
        status: "declined",
        transactionId,
        error: declineReason
      };
      this.emit("status", {
        status: "declined",
        message: `결제가 거부되었습니다
사유: ${declineReason}`
      });
      console.log("❌ Mock payment declined:", transactionId);
      console.log(`   Reason: ${declineReason}`);
      this.currentTransaction = null;
      return result;
    }
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
let pythonBridge = null;
let cameraController = null;
let printerController = null;
let cardReader = null;
let hologramState = {
  mode: "logo"
};
const isDevelopment = process.env.NODE_ENV !== "production";
function createWindow() {
  mainWindow = new BrowserWindow({
    width: isDevelopment ? 2200 : 1080,
    // Wider in dev for split view
    height: isDevelopment ? 1100 : 1920,
    // Shorter in dev for better fit
    fullscreen: !isDevelopment,
    // Only fullscreen in production
    kiosk: !isDevelopment,
    // Only kiosk in production
    resizable: isDevelopment,
    // Allow resizing in development
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false
      // Disable CORS for S3 video loading in split-screen
    }
  });
  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(async () => {
  console.log("🚀 Initializing MUT Hologram Studio...");
  pythonBridge = new PythonBridge();
  const pythonCheck = await pythonBridge.checkDependencies();
  if (!pythonCheck.available) {
    console.error("⚠️  Python not available:", pythonCheck.error);
  } else {
    console.log("✅ Python bridge initialized");
  }
  pythonBridge.on("progress", (progress) => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:progress", progress);
  });
  const useMock = process.env.MOCK_CAMERA !== "false";
  const useWebcam = process.env.USE_WEBCAM === "true";
  cameraController = new CameraController({
    mockMode: useMock && !useWebcam,
    useWebcam
  });
  const cameraResult = await cameraController.connect();
  if (cameraResult.success) {
    console.log("✅ Camera controller initialized");
  } else {
    console.error("⚠️  Camera initialization failed:", cameraResult.error);
  }
  printerController = new PrinterController({ mockMode: true });
  const printerResult = await printerController.connect();
  if (printerResult.success) {
    console.log("✅ Printer controller initialized");
  } else {
    console.error("⚠️  Printer initialization failed:", printerResult.error);
  }
  cardReader = new CardReaderController({ mockMode: true, mockApprovalRate: 0.8 });
  const cardReaderResult = await cardReader.connect();
  if (cardReaderResult.success) {
    console.log("✅ Card reader initialized (mock mode)");
    cardReader.on("status", (statusUpdate) => {
      mainWindow == null ? void 0 : mainWindow.webContents.send("payment:status", statusUpdate);
    });
  } else {
    console.error("⚠️  Card reader initialization failed:", cardReaderResult.error);
  }
  console.log("✅ All systems initialized\n");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("camera:start-preview", async () => {
  console.log("📷 Camera preview requested");
  if (!cameraController) {
    return { success: false, error: "Camera not initialized" };
  }
  const status = cameraController.getStatus();
  return {
    success: status.connected,
    error: status.connected ? void 0 : "Camera not connected"
  };
});
ipcMain.handle("camera:stop-preview", async () => {
  console.log("📷 Camera preview stopped");
  return { success: true };
});
ipcMain.handle("camera:capture", async () => {
  console.log("📷 Camera capture requested");
  if (!cameraController) {
    return {
      success: false,
      error: "Camera not initialized"
    };
  }
  try {
    const result = await cameraController.capture();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
});
ipcMain.handle("printer:get-status", async () => {
  console.log("🖨️  Printer status requested");
  if (!printerController) {
    return {
      success: false,
      status: "offline",
      paperLevel: 0,
      error: "Printer not initialized"
    };
  }
  try {
    const status = await printerController.getStatus();
    return {
      success: status.available,
      ...status
    };
  } catch (error) {
    return {
      success: false,
      status: "offline",
      paperLevel: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
ipcMain.handle("printer:print", async (_event, options) => {
  console.log("🖨️  Print requested:", options);
  if (!printerController) {
    return {
      success: false,
      error: "Printer not initialized"
    };
  }
  try {
    const result = await printerController.print(options);
    printerController.on("progress", (progressData) => {
      mainWindow == null ? void 0 : mainWindow.webContents.send("printer:progress", progressData);
    });
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
ipcMain.handle("video:process", async (_event, params) => {
  console.log("Video processing requested:", params);
  if (!pythonBridge) {
    return {
      success: false,
      error: "Python bridge not initialized"
    };
  }
  try {
    let frameOverlayPath = params.chromaVideo;
    if (params.chromaVideo && params.chromaVideo.startsWith("/")) {
      const relativePath = params.chromaVideo.substring(1);
      frameOverlayPath = path.join(app.getAppPath(), "public", relativePath);
      console.log(`   Frame overlay converted: ${params.chromaVideo} -> ${frameOverlayPath}`);
    }
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      frameOverlay: frameOverlayPath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || "mut-hologram"
    });
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:complete", {
      success: true,
      result
    });
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error("Video processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:complete", {
      success: false,
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
});
ipcMain.handle("video:cancel", async (_event, taskId) => {
  console.log("Video processing cancelled:", taskId);
  return { success: true };
});
ipcMain.handle("video:process-from-images", async (_event, params) => {
  console.log(`
${"=".repeat(70)}`);
  console.log(`🎬 [IPC] VIDEO PROCESSING FROM IMAGES`);
  console.log(`${"=".repeat(70)}`);
  console.log(`   Image count: ${params.imagePaths.length}`);
  console.log(`   Frame template: ${params.frameTemplatePath}`);
  console.log(`   Subtitle: ${params.subtitleText || "(none)"}`);
  console.log(`   S3 folder: ${params.s3Folder || "mut-hologram"}`);
  if (!pythonBridge) {
    console.error(`❌ [IPC] Python bridge not initialized`);
    console.log(`${"=".repeat(70)}
`);
    return {
      success: false,
      error: "Python bridge not initialized"
    };
  }
  try {
    const progressListener = (progress) => {
      console.log(`📊 [IPC] Progress: ${progress.step} - ${progress.progress}% - ${progress.message}`);
      mainWindow == null ? void 0 : mainWindow.webContents.send("video:progress", progress);
    };
    pythonBridge.on("progress", progressListener);
    const result = await pythonBridge.processFromImages({
      imagePaths: params.imagePaths,
      frameTemplatePath: params.frameTemplatePath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || "mut-hologram"
    });
    pythonBridge.off("progress", progressListener);
    console.log(`
✅ [IPC] Processing complete!`);
    console.log(`   Video: ${result.videoPath}`);
    console.log(`   S3 URL: ${result.s3Url}`);
    console.log(`   QR Code: ${result.qrCodePath}`);
    console.log(`${"=".repeat(70)}
`);
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:complete", {
      success: true,
      result
    });
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error(`❌ [IPC] Video processing error:`, error);
    console.log(`${"=".repeat(70)}
`);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:complete", {
      success: false,
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
});
ipcMain.handle("image:save-blob", async (_event, blobData, filename) => {
  console.log(`
${"=".repeat(70)}`);
  console.log(`💾 [IPC] SAVING BLOB TO FILE`);
  console.log(`${"=".repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Blob data length: ${blobData.length} chars`);
  try {
    const tempDir = path.join(app.getPath("temp"), "mut-captures");
    await fs$1.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);
    const dataUrlPrefix = blobData.substring(0, 50);
    console.log(`   Data URL prefix: ${dataUrlPrefix}...`);
    const base64Data = blobData.replace(/^data:[^;]+;base64,/, "");
    console.log(`   Base64 data length after strip: ${base64Data.length} chars`);
    const buffer = Buffer.from(base64Data, "base64");
    console.log(`   ✓ Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);
    const hexHeader = buffer.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);
    const filePath = path.join(tempDir, filename);
    await fs$1.writeFile(filePath, buffer);
    console.log(`   ✓ File saved: ${filePath}`);
    console.log(`✅ BLOB SAVED SUCCESSFULLY`);
    console.log(`${"=".repeat(70)}
`);
    return {
      success: true,
      filePath
    };
  } catch (error) {
    console.error(`❌ [IPC] Failed to save blob:`, error);
    console.log(`${"=".repeat(70)}
`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
ipcMain.handle("video:extract-frames", async (_event, videoPath, timestamps) => {
  console.log(`📸 Frame extraction requested: ${videoPath} at [${timestamps.join(", ")}]s`);
  if (!pythonBridge) {
    return {
      success: false,
      error: "Python bridge not initialized"
    };
  }
  try {
    const framePaths = await pythonBridge.extractFrames(videoPath, timestamps);
    console.log(`✅ Frames extracted successfully: ${framePaths.length} frames`);
    return {
      success: true,
      framePaths
    };
  } catch (error) {
    console.error("❌ Frame extraction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
});
ipcMain.handle("video:save-buffer", async (_event, byteArray, filename) => {
  console.log(`
${"=".repeat(70)}`);
  console.log(`💾 [IPC] SAVING VIDEO BUFFER TO FILE`);
  console.log(`${"=".repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Buffer size: ${(byteArray.length / 1024).toFixed(2)} KB`);
  try {
    const tempDir = path.join(app.getPath("temp"), "mut-captures");
    await fs$1.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);
    const buffer = Buffer.from(byteArray);
    console.log(`   ✓ Buffer created: ${(buffer.length / 1024).toFixed(2)} KB`);
    const hexHeader = buffer.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);
    const filePath = path.join(tempDir, filename);
    await fs$1.writeFile(filePath, buffer);
    console.log(`   ✓ File saved: ${filePath}`);
    console.log(`✅ VIDEO BUFFER SAVED SUCCESSFULLY`);
    console.log(`${"=".repeat(70)}
`);
    return {
      success: true,
      filePath
    };
  } catch (error) {
    console.error(`❌ [IPC] Failed to save buffer:`, error);
    console.log(`${"=".repeat(70)}
`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
ipcMain.handle("payment:process", async (_event, params) => {
  console.log("💳 Payment processing requested:", params);
  if (!cardReader) {
    return {
      success: false,
      error: "Card reader not initialized"
    };
  }
  try {
    const result = await cardReader.processPayment({
      amount: params.amount,
      currency: params.currency || "KRW",
      description: params.description || "Photo print"
    });
    mainWindow == null ? void 0 : mainWindow.webContents.send("payment:complete", result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    mainWindow == null ? void 0 : mainWindow.webContents.send("payment:complete", {
      success: false,
      status: "error",
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
});
ipcMain.handle("payment:cancel", async () => {
  console.log("💳 Payment cancellation requested");
  if (!cardReader) {
    return { success: false };
  }
  try {
    const result = await cardReader.cancelPayment();
    return result;
  } catch (error) {
    return { success: false };
  }
});
ipcMain.handle("payment:get-status", async () => {
  console.log("💳 Payment status requested");
  if (!cardReader) {
    return {
      success: false,
      status: "error",
      error: "Card reader not initialized"
    };
  }
  const status = cardReader.getStatus();
  return {
    success: status.connected,
    status: status.connected ? "idle" : "offline"
  };
});
ipcMain.handle("hologram:set-mode", async (_event, mode, data) => {
  console.log("🎭 Hologram mode change requested:", mode);
  hologramState = {
    mode,
    qrCodePath: data == null ? void 0 : data.qrCodePath,
    videoPath: data == null ? void 0 : data.videoPath
  };
  console.log("💾 Hologram state stored:", hologramState);
  if (!mainWindow) {
    return { success: false, error: "Main window not initialized" };
  }
  mainWindow.webContents.send("hologram:update", hologramState);
  return { success: true };
});
ipcMain.handle("hologram:show-qr", async (_event, qrCodePath, videoPath) => {
  console.log("🎭 [IPC] hologram:show-qr called");
  console.log("   QR Code:", qrCodePath);
  console.log("   Video path:", videoPath);
  hologramState = {
    mode: "result",
    qrCodePath,
    videoPath
  };
  console.log("💾 [IPC] Hologram state updated:", JSON.stringify(hologramState));
  if (!mainWindow) {
    console.error("❌ [IPC] Main window is NULL - cannot send message!");
    return { success: false, error: "Main window not initialized" };
  }
  if (mainWindow.isDestroyed()) {
    console.error("❌ [IPC] Main window is DESTROYED - cannot send message!");
    return { success: false, error: "Main window destroyed" };
  }
  console.log("✅ [IPC] Main window exists and is not destroyed");
  console.log("   isLoading:", mainWindow.webContents.isLoading());
  console.log("   URL:", mainWindow.webContents.getURL());
  console.log("📤 [IPC] Sending hologram:update to main window...");
  mainWindow.webContents.send("hologram:update", hologramState);
  console.log("✅ [IPC] Message sent successfully");
  return { success: true };
});
ipcMain.handle("hologram:show-logo", async () => {
  console.log("🎭 Hologram showing logo");
  hologramState = {
    mode: "logo"
  };
  console.log("💾 Hologram state stored:", hologramState);
  if (!mainWindow) {
    return { success: false, error: "Main window not initialized" };
  }
  mainWindow.webContents.send("hologram:update", hologramState);
  return { success: true };
});
ipcMain.handle("hologram:get-state", async () => {
  console.log("🎭 Hologram state requested:", hologramState);
  return { success: true, state: hologramState };
});
ipcMain.handle("file:read-as-data-url", async (_event, filePath) => {
  try {
    console.log(`📂 [IPC] Reading file as data URL: ${filePath}`);
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.join(app.getAppPath(), "MUT-distribution", filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }
    const fileBuffer = await fs$1.readFile(absolutePath);
    const base64 = fileBuffer.toString("base64");
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm"
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log(`✅ [IPC] File read successfully (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
    return { success: true, dataUrl };
  } catch (error) {
    console.error(`❌ [IPC] Failed to read file: ${filePath}`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});
ipcMain.handle("file:delete", async (_event, filePath) => {
  try {
    console.log(`🗑️ [IPC] Deleting file: ${filePath}`);
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.join(app.getAppPath(), "MUT-distribution", filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }
    try {
      await fs$1.access(absolutePath);
    } catch {
      console.warn(`⚠️ [IPC] File does not exist, skipping: ${absolutePath}`);
      return { success: true, skipped: true };
    }
    await fs$1.unlink(absolutePath);
    console.log(`✅ [IPC] File deleted successfully: ${absolutePath}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [IPC] Failed to delete file: ${filePath}`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});
