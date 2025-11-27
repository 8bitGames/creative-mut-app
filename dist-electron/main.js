"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs$1 = require("fs/promises");
const child_process = require("child_process");
const events = require("events");
const fs = require("fs");
const os = require("os");
const serialport = require("serialport");
const Database = require("better-sqlite3");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace$1 = /* @__PURE__ */ _interopNamespaceDefault(fs$1);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const DEFAULT_CONFIG = {
  tl3600: {
    port: "COM3",
    terminalId: "0000000000000000",
    timeout: 3e3,
    retryCount: 3
  },
  payment: {
    useMockMode: false,
    // Will be overridden by isDevelopment if not explicitly set
    defaultAmount: 5e3,
    mockApprovalRate: 0.8
  },
  camera: {
    useWebcam: true,
    // Default to webcam for easier testing
    mockMode: false
  },
  printer: {
    mockMode: false
    // Default to real printer
  },
  display: {
    splitScreenMode: false,
    // Default to dual-monitor mode
    swapDisplays: false,
    // Default: main→display1, hologram→display2
    mainWidth: 1080,
    mainHeight: 1920,
    hologramWidth: 1080,
    hologramHeight: 1920
  },
  demo: {
    enabled: false,
    // Default: demo mode disabled
    videoPath: "demo.mov"
    // Relative path auto-resolved to userData folder
  },
  debug: {
    enableLogging: true,
    logLevel: "info",
    logToFile: false,
    // Set to true to write logs to file
    logFilePath: "debug.log"
    // Relative to userData folder
  }
};
class ConfigManager {
  config = DEFAULT_CONFIG;
  configPath = "";
  loaded = false;
  /**
   * Get the config file path
   */
  getConfigPath() {
    if (!this.configPath) {
      const userDataPath = electron.app.getPath("userData");
      this.configPath = path__namespace.join(userDataPath, "config.json");
    }
    return this.configPath;
  }
  /**
   * Load configuration from file
   * Creates default config file if it doesn't exist
   */
  load() {
    if (this.loaded) {
      return this.config;
    }
    const configPath = this.getConfigPath();
    console.log(`📂 [Config] Loading configuration from: ${configPath}`);
    try {
      if (fs__namespace.existsSync(configPath)) {
        const fileContent = fs__namespace.readFileSync(configPath, "utf-8");
        const loadedConfig = JSON.parse(fileContent);
        this.config = this.mergeWithDefaults(loadedConfig);
        console.log("✅ [Config] Configuration loaded successfully");
      } else {
        console.log("📝 [Config] Config file not found, creating default...");
        this.config = { ...DEFAULT_CONFIG };
        this.save();
        console.log("✅ [Config] Default configuration created");
      }
    } catch (error) {
      console.error("❌ [Config] Failed to load config, using defaults:", error);
      this.config = { ...DEFAULT_CONFIG };
    }
    this.loaded = true;
    this.logConfig();
    return this.config;
  }
  /**
   * Save current configuration to file
   */
  save() {
    const configPath = this.getConfigPath();
    try {
      const configDir = path__namespace.dirname(configPath);
      if (!fs__namespace.existsSync(configDir)) {
        fs__namespace.mkdirSync(configDir, { recursive: true });
      }
      const content = JSON.stringify(this.config, null, 2);
      fs__namespace.writeFileSync(configPath, content, "utf-8");
      console.log("💾 [Config] Configuration saved");
      return true;
    } catch (error) {
      console.error("❌ [Config] Failed to save config:", error);
      return false;
    }
  }
  /**
   * Get current configuration
   */
  get() {
    if (!this.loaded) {
      return this.load();
    }
    return this.config;
  }
  /**
   * Update configuration
   */
  update(updates) {
    this.config = this.mergeWithDefaults({ ...this.config, ...updates });
    return this.save();
  }
  /**
   * Update TL3600 settings
   */
  updateTL3600(updates) {
    this.config.tl3600 = { ...this.config.tl3600, ...updates };
    return this.save();
  }
  /**
   * Update payment settings
   */
  updatePayment(updates) {
    this.config.payment = { ...this.config.payment, ...updates };
    return this.save();
  }
  /**
   * Reset to default configuration
   */
  reset() {
    this.config = { ...DEFAULT_CONFIG };
    return this.save();
  }
  /**
   * Update camera settings
   */
  updateCamera(updates) {
    this.config.camera = { ...this.config.camera, ...updates };
    return this.save();
  }
  /**
   * Update display settings
   */
  updateDisplay(updates) {
    this.config.display = { ...this.config.display, ...updates };
    return this.save();
  }
  /**
   * Merge loaded config with defaults
   */
  mergeWithDefaults(loaded) {
    return {
      tl3600: {
        ...DEFAULT_CONFIG.tl3600,
        ...loaded.tl3600 || {}
      },
      payment: {
        ...DEFAULT_CONFIG.payment,
        ...loaded.payment || {}
      },
      camera: {
        ...DEFAULT_CONFIG.camera,
        ...loaded.camera || {}
      },
      printer: {
        ...DEFAULT_CONFIG.printer,
        ...loaded.printer || {}
      },
      display: {
        ...DEFAULT_CONFIG.display,
        ...loaded.display || {}
      },
      demo: {
        ...DEFAULT_CONFIG.demo,
        ...loaded.demo || {}
      },
      debug: {
        ...DEFAULT_CONFIG.debug,
        ...loaded.debug || {}
      }
    };
  }
  /**
   * Log current configuration (for debugging)
   */
  logConfig() {
    console.log("📋 [Config] Current configuration:");
    console.log(`   TL3600 Port: ${this.config.tl3600.port}`);
    console.log(`   Payment Mock Mode: ${this.config.payment.useMockMode}`);
    console.log(`   Camera: ${this.config.camera.useWebcam ? "Webcam" : "DSLR"} (mock: ${this.config.camera.mockMode})`);
    console.log(`   Printer: ${this.config.printer.mockMode ? "Mock (skip printing)" : "Real printer"}`);
    console.log(`   Display: ${this.config.display.splitScreenMode ? "Split Screen" : "Dual Monitor"}${this.config.display.swapDisplays ? " (SWAPPED)" : ""}`);
    console.log(`   Resolution: Main ${this.config.display.mainWidth}x${this.config.display.mainHeight}, Hologram ${this.config.display.hologramWidth}x${this.config.display.hologramHeight}`);
    console.log(`   Demo Mode: ${this.config.demo.enabled ? "Enabled" : "Disabled"}${this.config.demo.enabled ? ` (${this.config.demo.videoPath})` : ""}`);
  }
}
const appConfig = new ConfigManager();
function getConfig() {
  return appConfig.get();
}
function getTL3600Config() {
  return appConfig.get().tl3600;
}
function getPaymentConfig() {
  return appConfig.get().payment;
}
function getCameraConfig() {
  return appConfig.get().camera;
}
function getPrinterConfig() {
  return appConfig.get().printer;
}
function getDebugConfig() {
  const debug = appConfig.get().debug;
  const userDataPath = electron.app.getPath("userData");
  let resolvedLogPath = debug.logFilePath;
  if (debug.logFilePath && !path__namespace.isAbsolute(debug.logFilePath)) {
    resolvedLogPath = path__namespace.join(userDataPath, debug.logFilePath.replace(/^\.\//, ""));
  }
  return {
    ...debug,
    resolvedLogPath
  };
}
class PythonBridge extends events.EventEmitter {
  isProd;
  pythonPath;
  pipelineExePath;
  pipelineScriptPath;
  stitcherExePath;
  stitcherScriptPath;
  stitcherWorkingDir;
  pipelineWorkingDir;
  ffmpegPath;
  outputDir;
  // Output directory with write permissions
  constructor() {
    super();
    this.isProd = electron.app.isPackaged;
    if (this.isProd) {
      this.pythonPath = "";
      this.pipelineExePath = path.join(process.resourcesPath, "python", "pipeline.exe");
      this.pipelineScriptPath = "";
      this.stitcherExePath = path.join(process.resourcesPath, "python", "stitch_images.exe");
      this.stitcherScriptPath = "";
      this.stitcherWorkingDir = path.join(process.resourcesPath, "python");
      this.pipelineWorkingDir = path.join(process.resourcesPath, "python");
      this.ffmpegPath = path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe");
      this.outputDir = path.join(electron.app.getPath("userData"), "output");
      console.log("🎬 [PythonBridge] Initialized (Production - Bundled EXE)");
      console.log(`   Pipeline EXE: ${this.pipelineExePath}`);
      console.log(`   Stitcher EXE: ${this.stitcherExePath}`);
      console.log(`   FFmpeg: ${this.ffmpegPath}`);
      console.log(`   Output dir: ${this.outputDir}`);
    } else {
      this.pythonPath = process.platform === "win32" ? "python" : "python3";
      this.pipelineExePath = "";
      this.pipelineScriptPath = path.join(electron.app.getAppPath(), "MUT-distribution", "pipeline.py");
      this.stitcherExePath = "";
      this.stitcherScriptPath = path.join(electron.app.getAppPath(), "python", "stitch_images.py");
      this.stitcherWorkingDir = path.join(electron.app.getAppPath(), "python");
      this.pipelineWorkingDir = path.join(electron.app.getAppPath(), "MUT-distribution");
      this.ffmpegPath = "ffmpeg";
      this.outputDir = path.join(electron.app.getAppPath(), "MUT-distribution", "output");
      console.log("🐍 [PythonBridge] Initialized (Development - Python Scripts)");
      console.log(`   Python: ${this.pythonPath}`);
      console.log(`   Pipeline: ${this.pipelineScriptPath}`);
      console.log(`   Stitcher: ${this.stitcherScriptPath}`);
      console.log(`   Output dir: ${this.outputDir}`);
    }
    console.log(`   Stitcher working dir: ${this.stitcherWorkingDir}`);
    console.log(`   Pipeline working dir: ${this.pipelineWorkingDir}`);
  }
  /**
   * Process video using Python pipeline
   */
  async processVideo(options) {
    return new Promise((resolve, reject) => {
      let executable;
      let args;
      if (this.isProd) {
        executable = this.pipelineExePath;
        args = [
          "--input",
          options.inputVideo,
          "--frame",
          options.frameOverlay,
          "--output-dir",
          this.outputDir
          // Use userData folder for write permissions
        ];
      } else {
        executable = this.pythonPath;
        args = [
          this.pipelineScriptPath,
          "--input",
          options.inputVideo,
          "--frame",
          options.frameOverlay
        ];
      }
      if (options.subtitleText) {
        args.push("--subtitle", options.subtitleText);
      }
      if (options.s3Folder) {
        args.push("--s3-folder", options.s3Folder);
      }
      const debugConfig = getDebugConfig();
      if (debugConfig.logToFile && debugConfig.resolvedLogPath) {
        args.push("--log-file", debugConfig.resolvedLogPath);
        console.log(`   Debug logging to: ${debugConfig.resolvedLogPath}`);
      }
      args.push("--json");
      console.log(`Starting pipeline: ${executable} ${args.join(" ")}`);
      const pipelineProcess = child_process.spawn(executable, args, {
        cwd: this.pipelineWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1"
        }
      });
      let stdoutData = "";
      let stderrData = "";
      pipelineProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log("[Pipeline]", output);
        this.parseProgress(output);
      });
      pipelineProcess.stderr?.on("data", (data) => {
        stderrData += data.toString();
        console.error("[Pipeline Error]", data.toString());
      });
      pipelineProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Pipeline process exited with code ${code}
${stderrData}`));
          return;
        }
        try {
          const lines = stdoutData.trim().split("\n");
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse pipeline output: ${error}
${stdoutData}`));
        }
      });
      pipelineProcess.on("error", (error) => {
        reject(new Error(`Failed to start pipeline process: ${error}`));
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
      frameFilesystemPath = path.join(electron.app.getAppPath(), "public", relativePath);
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
   * Stitch 3 images into a video using stitch_images executable or script
   */
  async stitchImagesToVideo(imagePaths) {
    return new Promise(async (resolve, reject) => {
      console.log(`
🎬 [PythonBridge] Stitching images...`);
      const timestamp = Date.now();
      const outputPath = path.join(this.outputDir, `stitched_${timestamp}.mp4`);
      try {
        const fs2 = await import("fs/promises");
        await fs2.mkdir(this.outputDir, { recursive: true });
      } catch (err) {
        console.warn(`   Warning: Could not create output directory: ${err}`);
      }
      let executable;
      let args;
      if (this.isProd) {
        executable = this.stitcherExePath;
        args = [
          "--images",
          ...imagePaths,
          "--output",
          outputPath,
          "--duration",
          "3.0"
        ];
      } else {
        executable = this.pythonPath;
        args = [
          this.stitcherScriptPath,
          "--images",
          ...imagePaths,
          "--output",
          outputPath,
          "--duration",
          "3.0"
        ];
      }
      console.log(`   Command: ${executable} ${args.join(" ")}`);
      const stitchProcess = child_process.spawn(executable, args, {
        cwd: this.stitcherWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1"
        }
      });
      let stdoutData = "";
      let stderrData = "";
      stitchProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log("[Stitcher]", output);
      });
      stitchProcess.stderr?.on("data", (data) => {
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
        const framesOutputDir = path.join(this.outputDir, `frames_${timestamp}`);
        await fs2.mkdir(framesOutputDir, { recursive: true });
        console.log(`   Output directory: ${framesOutputDir}`);
        const extractedFrames = [];
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i];
          const framePath = path.join(framesOutputDir, `frame_${time}s.jpg`);
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
            const ffmpegProcess = child_process.spawn(this.ffmpegPath, args);
            let stderr = "";
            ffmpegProcess.stderr?.on("data", (data) => {
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
   * Check if dependencies are available
   */
  async checkDependencies() {
    if (this.isProd) {
      const fs2 = await import("fs");
      const pipelineExists = fs2.existsSync(this.pipelineExePath);
      const stitcherExists = fs2.existsSync(this.stitcherExePath);
      if (pipelineExists && stitcherExists) {
        console.log("Bundled executables found");
        console.log(`   Pipeline: ${this.pipelineExePath}`);
        console.log(`   Stitcher: ${this.stitcherExePath}`);
        return { available: true };
      } else {
        const missing = [];
        if (!pipelineExists) missing.push("pipeline.exe");
        if (!stitcherExists) missing.push("stitch_images.exe");
        return {
          available: false,
          error: `Missing bundled executables: ${missing.join(", ")}`
        };
      }
    } else {
      return new Promise((resolve) => {
        const checkProcess = child_process.spawn(this.pythonPath, ["--version"]);
        let versionOutput = "";
        checkProcess.stdout?.on("data", (data) => {
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
}
class CameraController extends events.EventEmitter {
  mockMode;
  useWebcam;
  captureDir;
  cameraProcess = null;
  isConnected = false;
  cameraInfo = null;
  constructor(config = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_CAMERA === "true";
    this.useWebcam = config.useWebcam ?? process.env.USE_WEBCAM === "true";
    this.captureDir = config.captureDir ?? path__namespace.join(process.cwd(), "captures");
    if (!fs__namespace.existsSync(this.captureDir)) {
      fs__namespace.mkdirSync(this.captureDir, { recursive: true });
    }
  }
  /**
   * Initialize camera connection
   */
  async connect() {
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
      console.log("✅ Camera connected:", this.cameraInfo?.model);
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
      const outputPath = path__namespace.join(this.captureDir, filename);
      console.log("📷 Capturing photo...");
      this.emit("capturing");
      await this.executeGPhoto2Command([
        "--capture-image-and-download",
        "--filename",
        outputPath
      ]);
      if (!fs__namespace.existsSync(outputPath)) {
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
      const process2 = child_process.spawn("gphoto2", args);
      let stdout = "";
      let stderr = "";
      process2.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      process2.stderr?.on("data", (data) => {
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
    const outputPath = path__namespace.join(this.captureDir, filename);
    fs__namespace.writeFileSync(outputPath, `Mock photo captured at ${(/* @__PURE__ */ new Date()).toISOString()}
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
      const outputPath = path__namespace.join(this.captureDir, filename);
      console.log("📷 Capturing from webcam...");
      this.emit("capturing");
      try {
        await this.executeCommand("imagesnap", ["-q", outputPath]);
        if (!fs__namespace.existsSync(outputPath)) {
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
        fs__namespace.writeFileSync(outputPath + ".txt", placeholderText);
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
      const process2 = child_process.spawn(command, args);
      let stdout = "";
      let stderr = "";
      process2.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      process2.stderr?.on("data", (data) => {
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
class PrinterController extends events.EventEmitter {
  mockMode;
  printerName;
  currentJob = null;
  mockPaperLevel = 100;
  isWindows;
  mockInkLevels = {
    cyan: 85,
    magenta: 90,
    yellow: 75,
    black: 88
  };
  constructor(config = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_PRINTER === "true";
    this.printerName = config.printerName ?? "";
    this.isWindows = os__namespace.platform() === "win32";
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
      let isPrinting = false;
      let hasError = false;
      if (this.isWindows) {
        const printerName = this.printerName || await this.getDefaultPrinter();
        if (printerName) {
          const psCommand = `Get-Printer -Name "${printerName}" | Select-Object -ExpandProperty PrinterStatus`;
          const status = await this.executeWindowsCommand(psCommand);
          isPrinting = status.toLowerCase().includes("printing");
          hasError = status.toLowerCase().includes("error");
        }
      } else {
        const status = await this.executePrinterCommand(["lpstat", "-p", this.printerName || "Default"]);
        isPrinting = status.includes("printing");
        hasError = status.includes("error");
      }
      return {
        available: true,
        status: hasError ? "error" : isPrinting ? "printing" : "idle",
        paperLevel: 100,
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
   * Get default printer name (Windows)
   */
  async getDefaultPrinter() {
    if (!this.isWindows) return "";
    try {
      const psCommand = `Get-CimInstance -ClassName Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object -ExpandProperty Name`;
      const output = await this.executeWindowsCommand(psCommand);
      return output.trim();
    } catch {
      return "";
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
      if (!fs__namespace.existsSync(options.imagePath)) {
        throw new Error(`Image file not found: ${options.imagePath}`);
      }
      const jobId = `job_${Date.now()}`;
      this.currentJob = jobId;
      console.log("🖨️  Starting print job:", jobId);
      this.emit("printing", { jobId, options });
      let result;
      if (this.isWindows) {
        const imagePath = options.imagePath.replace(/\//g, "\\");
        const copies = options.copies || 1;
        const printerName = this.printerName || await this.getDefaultPrinter();
        console.log(`🖨️  Printing to: ${printerName}`);
        console.log(`🖨️  Image path: ${imagePath}`);
        const psCommand = `
          Add-Type -AssemblyName System.Drawing
          
          $imagePath = "${imagePath}"
          $printerName = "${printerName}"
          $copies = ${copies}
          
          $img = [System.Drawing.Image]::FromFile($imagePath)
          Write-Output "Image size: $($img.Width) x $($img.Height)"
          
          $printDoc = New-Object System.Drawing.Printing.PrintDocument
          
          if ($printerName) {
            $printDoc.PrinterSettings.PrinterName = $printerName
          }
          
          # Landscape mode (horizontal paper)
          $printDoc.DefaultPageSettings.Landscape = $true
          
          # Minimize margins
          $printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
          
          $printDoc.add_PrintPage({
            param($sender, $e)
            
            # Use PageBounds for full page area
            $pageWidth = $e.PageBounds.Width
            $pageHeight = $e.PageBounds.Height
            
            Write-Output "Full page: $pageWidth x $pageHeight"
            
            # Fit to HEIGHT, maintain aspect ratio (no stretch)
            $imgRatio = $img.Width / $img.Height
            $drawHeight = $pageHeight
            $drawWidth = $pageHeight * $imgRatio
            
            # Center both horizontally AND vertically
            $x = ($pageWidth - $drawWidth) / 2
            $y = ($pageHeight - $drawHeight) / 2
            
            Write-Output "Drawing: $drawWidth x $drawHeight centered at ($x, $y)"
            
            # High quality rendering
            $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            
            $e.Graphics.DrawImage($img, $x, $y, $drawWidth, $drawHeight)
            $e.HasMorePages = $false
          })
          
          for ($i = 0; $i -lt $copies; $i++) {
            Write-Output "Printing copy $($i + 1) of $copies..."
            $printDoc.Print()
          }
          
          $img.Dispose()
          Write-Output "Print job completed"
        `;
        result = await this.executeWindowsCommand(psCommand);
      } else {
        const args = [
          "-d",
          this.printerName || "Default",
          "-n",
          String(options.copies || 1),
          "-o",
          "media=4x6",
          "-o",
          "fit-to-page",
          options.imagePath
        ];
        result = await this.executePrinterCommand(["lp", ...args]);
      }
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
   * Execute Windows PowerShell command
   */
  async executeWindowsCommand(psCommand) {
    return new Promise((resolve, reject) => {
      const encodedCommand = Buffer.from(psCommand, "utf16le").toString("base64");
      child_process.exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`, (error, stdout, stderr) => {
        if (error) {
          console.error("PowerShell error:", stderr || error.message);
          reject(new Error(stderr || error.message));
        } else {
          if (stderr) {
            console.warn("PowerShell warning:", stderr);
          }
          resolve(stdout);
        }
      });
    });
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
    if (this.isWindows) {
      const psCommand = `Get-Printer | Select-Object -ExpandProperty Name`;
      const output = await this.executeWindowsCommand(psCommand);
      return output.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    } else {
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
  }
  /**
   * Execute printer command
   */
  async executePrinterCommand(args) {
    return new Promise((resolve, reject) => {
      const [command, ...cmdArgs] = args;
      const process2 = child_process.spawn(command, cmdArgs);
      let stdout = "";
      let stderr = "";
      process2.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      process2.stderr?.on("data", (data) => {
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
const STX = 2;
const ETX = 3;
const ACK = 6;
const NACK = 21;
const HEADER_SIZE = 35;
const OFFSET = {
  TERMINAL_ID: 1,
  DATE_TIME: 17,
  JOB_CODE: 31,
  RESPONSE_CODE: 32,
  DATA_LENGTH: 33,
  DATA_START: 35
};
var JobCode = /* @__PURE__ */ ((JobCode2) => {
  JobCode2["DEVICE_CHECK"] = "A";
  JobCode2["TRANSACTION_APPROVAL"] = "B";
  JobCode2["TRANSACTION_CANCEL"] = "C";
  JobCode2["CARD_INQUIRY"] = "D";
  JobCode2["PAYMENT_STANDBY"] = "E";
  JobCode2["CARD_UID_READ"] = "F";
  JobCode2["ADDITIONAL_APPROVAL"] = "G";
  JobCode2["APPROVAL_CONFIRM"] = "H";
  JobCode2["MEMORY_WRITE"] = "K";
  JobCode2["LAST_APPROVAL"] = "L";
  JobCode2["IC_CARD_CHECK"] = "M";
  JobCode2["TRANSIT_INQUIRY"] = "N";
  JobCode2["BARCODE_APPROVAL"] = "Q";
  JobCode2["TERMINAL_RESET"] = "R";
  JobCode2["DISPLAY_SETTINGS"] = "S";
  JobCode2["TRANSIT_DISCOUNT"] = "T";
  JobCode2["VERSION_CHECK"] = "V";
  JobCode2["BARCODE_INQUIRY"] = "W";
  JobCode2["SETTINGS_SET"] = "X";
  JobCode2["SETTINGS_GET"] = "Y";
  JobCode2["DISCOUNT_APPROVAL"] = "Z";
  JobCode2["DEVICE_CHECK_RESPONSE"] = "a";
  JobCode2["TRANSACTION_APPROVAL_RESPONSE"] = "b";
  JobCode2["TRANSACTION_CANCEL_RESPONSE"] = "c";
  JobCode2["CARD_INQUIRY_RESPONSE"] = "d";
  JobCode2["PAYMENT_STANDBY_RESPONSE"] = "e";
  JobCode2["CARD_UID_READ_RESPONSE"] = "f";
  JobCode2["ADDITIONAL_APPROVAL_RESPONSE"] = "g";
  JobCode2["MEMORY_WRITE_RESPONSE"] = "k";
  JobCode2["LAST_APPROVAL_RESPONSE"] = "l";
  JobCode2["IC_CARD_CHECK_RESPONSE"] = "m";
  JobCode2["TRANSIT_INQUIRY_RESPONSE"] = "n";
  JobCode2["BARCODE_APPROVAL_RESPONSE"] = "q";
  JobCode2["DISPLAY_SETTINGS_RESPONSE"] = "s";
  JobCode2["TRANSIT_DISCOUNT_RESPONSE"] = "t";
  JobCode2["VERSION_CHECK_RESPONSE"] = "v";
  JobCode2["BARCODE_INQUIRY_RESPONSE"] = "w";
  JobCode2["SETTINGS_SET_RESPONSE"] = "x";
  JobCode2["SETTINGS_GET_RESPONSE"] = "y";
  JobCode2["DISCOUNT_APPROVAL_RESPONSE"] = "z";
  JobCode2["EVENT_RESPONSE"] = "@";
  return JobCode2;
})(JobCode || {});
var EventType = /* @__PURE__ */ ((EventType2) => {
  EventType2["MS_CARD"] = "M";
  EventType2["RF_CARD"] = "R";
  EventType2["IC_CARD"] = "I";
  EventType2["IC_CARD_REMOVED"] = "O";
  EventType2["IC_FALLBACK"] = "F";
  EventType2["BARCODE"] = "Q";
  return EventType2;
})(EventType || {});
var TransactionType = /* @__PURE__ */ ((TransactionType2) => {
  TransactionType2["APPROVAL"] = "1";
  TransactionType2["FREE_PARKING"] = "7";
  TransactionType2["DEVICE_MERCHANT"] = "M";
  return TransactionType2;
})(TransactionType || {});
var TransactionResponseType = /* @__PURE__ */ ((TransactionResponseType2) => {
  TransactionResponseType2["CREDIT"] = "1";
  TransactionResponseType2["CASH_RECEIPT"] = "2";
  TransactionResponseType2["PREPAID"] = "3";
  TransactionResponseType2["ZERO_PAY"] = "4";
  TransactionResponseType2["KAKAO_MONEY"] = "5";
  TransactionResponseType2["KAKAO_CREDIT"] = "6";
  TransactionResponseType2["NAVER_PAY"] = "8";
  TransactionResponseType2["REJECTED"] = "X";
  return TransactionResponseType2;
})(TransactionResponseType || {});
var CancelType = /* @__PURE__ */ ((CancelType2) => {
  CancelType2["REQUEST_CANCEL"] = "1";
  CancelType2["LAST_TRANSACTION"] = "2";
  CancelType2["VAN_NO_CARD"] = "3";
  CancelType2["PG_NO_CARD"] = "4";
  CancelType2["PG_PARTIAL"] = "5";
  CancelType2["DIRECT_PREV"] = "6";
  return CancelType2;
})(CancelType || {});
var DeviceStatus = /* @__PURE__ */ ((DeviceStatus2) => {
  DeviceStatus2["NOT_INSTALLED"] = "N";
  DeviceStatus2["OK"] = "O";
  DeviceStatus2["ERROR"] = "X";
  DeviceStatus2["FAIL"] = "F";
  return DeviceStatus2;
})(DeviceStatus || {});
var SignatureRequired = /* @__PURE__ */ ((SignatureRequired2) => {
  SignatureRequired2["NO"] = "1";
  SignatureRequired2["YES"] = "2";
  return SignatureRequired2;
})(SignatureRequired || {});
const PAYMENT_DEFAULTS = {
  AMOUNT: 5e3,
  TAX: 0,
  SERVICE_CHARGE: 0,
  INSTALLMENT: "00"
};
const SERIAL_CONFIG = {
  BAUD_RATE: 115200,
  DATA_BITS: 8,
  STOP_BITS: 1,
  PARITY: "none"
};
const TIMEOUT = {
  ACK_WAIT: 3e3,
  // ACK 대기 3초
  RESPONSE_WAIT: 3e4,
  // 응답 대기 30초
  MAX_RETRY: 3,
  // 최대 재시도 3회
  PAYMENT_TIMEOUT: 3e4
  // 결제 타임아웃 30초
};
const ERROR_CODES = {
  "6B": { message: "카드 잔액 부족", userMessage: "잔액이 부족합니다" },
  "0A": { message: "네트워크 오류", userMessage: "네트워크 오류, 다시 시도해주세요" },
  "0C": { message: "서버 타임아웃", userMessage: "서버 응답 없음, 다시 시도해주세요" },
  "6D": { message: "선불 카드 이상", userMessage: "사용할 수 없는 카드입니다" },
  "69": { message: "사용 불가 카드", userMessage: "사용할 수 없는 카드입니다" },
  "71": { message: "미등록 카드", userMessage: "사용할 수 없는 카드입니다" },
  "6F": { message: "재시도 요청", userMessage: "다시 시도해주세요" },
  "7A": { message: "Tmoney 서비스 불가", userMessage: "Tmoney 서비스 불가, 관리자에게 문의하세요" },
  "74": { message: "카드 변경", userMessage: "거래 중 카드가 변경되었습니다" },
  "B3": { message: "포맷오류", userMessage: "시스템 오류, 다시 시도해주세요" }
};
const FIELD_SIZE = {
  TERMINAL_ID: 16,
  DATE_TIME: 14
};
function formatDateTime(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
function formatAmount(amount, length) {
  return amount.toString().padStart(length, "0");
}
function padString(str, length, padChar = 0) {
  const buf = Buffer.alloc(length, padChar);
  const strBuf = Buffer.from(str, "ascii");
  strBuf.copy(buf, 0, 0, Math.min(strBuf.length, length));
  return buf;
}
function calculateBCC(data) {
  let bcc = 0;
  for (let i = 0; i < data.length; i++) {
    bcc ^= data[i];
  }
  return bcc;
}
function extractString(buf, start, length) {
  const slice = buf.slice(start, start + length);
  return slice.toString("ascii").replace(/\x00/g, "").trim();
}
function extractNumber(buf, start, length) {
  const str = extractString(buf, start, length);
  return parseInt(str, 10) || 0;
}
function buildPacket(options) {
  const { terminalId, jobCode, data = Buffer.alloc(0) } = options;
  const dataLength = data.length;
  const packetLength = HEADER_SIZE + dataLength + 2;
  const packet = Buffer.alloc(packetLength);
  let offset = 0;
  packet.writeUInt8(STX, offset);
  offset += 1;
  const terminalIdBuf = padString(terminalId, FIELD_SIZE.TERMINAL_ID);
  terminalIdBuf.copy(packet, offset);
  offset += FIELD_SIZE.TERMINAL_ID;
  const dateTimeBuf = Buffer.from(formatDateTime(), "ascii");
  dateTimeBuf.copy(packet, offset);
  offset += FIELD_SIZE.DATE_TIME;
  packet.write(jobCode, offset, 1, "ascii");
  offset += 1;
  packet.writeUInt8(0, offset);
  offset += 1;
  packet.writeUInt16LE(dataLength, offset);
  offset += 2;
  if (dataLength > 0) {
    data.copy(packet, offset);
    offset += dataLength;
  }
  packet.writeUInt8(ETX, offset);
  offset += 1;
  const bcc = calculateBCC(packet.slice(0, offset));
  packet.writeUInt8(bcc, offset);
  return packet;
}
function buildApprovalRequestData(transactionType, amount, tax = 0, serviceCharge = 0, installment = "00", signature = "1") {
  const data = Buffer.alloc(30);
  let offset = 0;
  data.write(transactionType, offset, 1, "ascii");
  offset += 1;
  data.write(formatAmount(amount, 10), offset, 10, "ascii");
  offset += 10;
  data.write(formatAmount(tax, 8), offset, 8, "ascii");
  offset += 8;
  data.write(formatAmount(serviceCharge, 8), offset, 8, "ascii");
  offset += 8;
  data.write(installment.padStart(2, "0"), offset, 2, "ascii");
  offset += 2;
  data.write(signature, offset, 1, "ascii");
  return data;
}
function buildCancelRequestData(cancelType, transactionType, amount, tax, serviceCharge, installment, signature, approvalNumber, originalDate, originalTime) {
  const data = Buffer.alloc(59);
  let offset = 0;
  data.write(cancelType, offset, 1, "ascii");
  offset += 1;
  data.write(transactionType, offset, 1, "ascii");
  offset += 1;
  data.write(formatAmount(amount, 10), offset, 10, "ascii");
  offset += 10;
  data.write(formatAmount(tax, 8), offset, 8, "ascii");
  offset += 8;
  data.write(formatAmount(serviceCharge, 8), offset, 8, "ascii");
  offset += 8;
  data.write(installment.padStart(2, "0"), offset, 2, "ascii");
  offset += 2;
  data.write(signature, offset, 1, "ascii");
  offset += 1;
  const approvalBuf = Buffer.alloc(12, 32);
  Buffer.from(approvalNumber, "ascii").copy(approvalBuf);
  approvalBuf.copy(data, offset);
  offset += 12;
  data.write(originalDate.padEnd(8, "0"), offset, 8, "ascii");
  offset += 8;
  data.write(originalTime.padEnd(6, "0"), offset, 6, "ascii");
  offset += 6;
  data.write("00", offset, 2, "ascii");
  return data;
}
function parsePacket(buffer) {
  if (buffer.length < HEADER_SIZE + 2) {
    console.error("Packet too short:", buffer.length);
    return null;
  }
  if (buffer[0] !== STX) {
    console.error("Invalid STX:", buffer[0]);
    return null;
  }
  const terminalId = extractString(buffer, OFFSET.TERMINAL_ID, FIELD_SIZE.TERMINAL_ID);
  const dateTime = extractString(buffer, OFFSET.DATE_TIME, FIELD_SIZE.DATE_TIME);
  const jobCode = String.fromCharCode(buffer[OFFSET.JOB_CODE]);
  const responseCode = buffer[OFFSET.RESPONSE_CODE];
  const dataLength = buffer.readUInt16LE(OFFSET.DATA_LENGTH);
  const expectedLength = HEADER_SIZE + dataLength + 2;
  if (buffer.length < expectedLength) {
    console.error("Packet length mismatch. Expected:", expectedLength, "Got:", buffer.length);
    return null;
  }
  const data = buffer.slice(OFFSET.DATA_START, OFFSET.DATA_START + dataLength);
  const etxIndex = OFFSET.DATA_START + dataLength;
  if (buffer[etxIndex] !== ETX) {
    console.error("Invalid ETX at index", etxIndex, ":", buffer[etxIndex]);
    return null;
  }
  const receivedBcc = buffer[etxIndex + 1];
  const calculatedBcc = calculateBCC(buffer.slice(0, etxIndex + 1));
  const isValid = receivedBcc === calculatedBcc;
  if (!isValid) {
    console.error("BCC mismatch. Received:", receivedBcc, "Calculated:", calculatedBcc);
  }
  return {
    header: {
      terminalId,
      dateTime,
      jobCode,
      responseCode,
      dataLength
    },
    data,
    bcc: receivedBcc,
    isValid
  };
}
function parseDeviceCheckResponse(data) {
  return {
    cardModuleStatus: data.toString("ascii", 0, 1),
    rfModuleStatus: data.toString("ascii", 1, 2),
    vanServerStatus: data.toString("ascii", 2, 3),
    linkServerStatus: data.toString("ascii", 3, 4)
  };
}
function parseEventResponse(data) {
  return {
    eventType: data.toString("ascii", 0, 1)
  };
}
function parseApprovalResponse(data) {
  let offset = 0;
  const transactionType = data.toString("ascii", offset, offset + 1);
  offset += 1;
  const transactionMedia = data.toString("ascii", offset, offset + 1);
  offset += 1;
  const cardNumber = extractString(data, offset, 20);
  offset += 20;
  const approvedAmount = extractNumber(data, offset, 10);
  offset += 10;
  const tax = extractNumber(data, offset, 8);
  offset += 8;
  const serviceCharge = extractNumber(data, offset, 8);
  offset += 8;
  const installment = extractString(data, offset, 2);
  offset += 2;
  const approvalNumber = extractString(data, offset, 12);
  offset += 12;
  const salesDate = extractString(data, offset, 8);
  offset += 8;
  const salesTime = extractString(data, offset, 6);
  offset += 6;
  const transactionId = extractString(data, offset, 12);
  offset += 12;
  const merchantId = extractString(data, offset, 15);
  offset += 15;
  const terminalNumber = extractString(data, offset, 14);
  offset += 14;
  const issuerOrRejectData = extractString(data, offset, 20);
  offset += 20;
  const acquirerData = extractString(data, offset, 20);
  const isRejected = transactionType === TransactionResponseType.REJECTED;
  let issuerCode = "";
  let issuerName = "";
  let acquirerCode = "";
  let acquirerName = "";
  let rejectCode;
  let rejectMessage;
  if (isRejected) {
    rejectMessage = issuerOrRejectData;
    if (acquirerData.startsWith("-")) {
      rejectCode = acquirerData.substring(1, 3);
      const errorInfo = ERROR_CODES[rejectCode];
      if (errorInfo) {
        rejectMessage = errorInfo.userMessage;
      }
    }
  } else {
    issuerCode = issuerOrRejectData.substring(0, 4);
    issuerName = issuerOrRejectData.substring(4).trim();
    acquirerCode = acquirerData.substring(0, 4);
    acquirerName = acquirerData.substring(4).trim();
  }
  return {
    transactionType,
    transactionMedia,
    cardNumber,
    approvedAmount,
    tax,
    serviceCharge,
    installment,
    approvalNumber,
    salesDate,
    salesTime,
    transactionId,
    merchantId,
    terminalNumber,
    issuerCode,
    issuerName,
    acquirerCode,
    acquirerName,
    isRejected,
    rejectCode,
    rejectMessage
  };
}
function parseCardInquiryResponse(data) {
  let offset = 0;
  const transactionMedia = data.toString("ascii", offset, offset + 1);
  offset += 1;
  const cardType = data.toString("ascii", offset, offset + 1);
  offset += 1;
  const cardNumber = extractString(data, offset, 20);
  offset += 20;
  const lastTransactionDateTime = extractString(data, offset, 14);
  offset += 14;
  const lastTransactionAmount = extractNumber(data, offset, 8);
  offset += 8;
  const cardBalance = extractNumber(data, offset, 8);
  offset += 8;
  const transactionStatus = data.toString("ascii", offset, offset + 1);
  return {
    transactionMedia,
    cardType,
    cardNumber,
    lastTransactionDateTime,
    lastTransactionAmount,
    cardBalance,
    transactionStatus
  };
}
function findCompletePacket(buffer) {
  if (buffer.length < HEADER_SIZE + 2) {
    return 0;
  }
  const stxIndex = buffer.indexOf(STX);
  if (stxIndex === -1) {
    return 0;
  }
  if (buffer.length - stxIndex < HEADER_SIZE + 2) {
    return 0;
  }
  const dataLength = buffer.readUInt16LE(stxIndex + OFFSET.DATA_LENGTH);
  const expectedLength = HEADER_SIZE + dataLength + 2;
  if (buffer.length - stxIndex >= expectedLength) {
    const etxIndex = stxIndex + HEADER_SIZE + dataLength;
    if (buffer[etxIndex] === ETX) {
      return expectedLength;
    }
  }
  return 0;
}
class TL3600Serial extends events.EventEmitter {
  port = null;
  portPath;
  baudRate;
  isConnected = false;
  receiveBuffer = Buffer.alloc(0);
  pendingResponse = null;
  constructor(config) {
    super();
    this.portPath = config.port;
    this.baudRate = config.baudRate || SERIAL_CONFIG.BAUD_RATE;
  }
  /**
   * Connect to serial port
   */
  async connect() {
    if (this.isConnected && this.port?.isOpen) {
      return { success: true };
    }
    return new Promise((resolve) => {
      try {
        this.port = new serialport.SerialPort({
          path: this.portPath,
          baudRate: this.baudRate,
          dataBits: SERIAL_CONFIG.DATA_BITS,
          stopBits: SERIAL_CONFIG.STOP_BITS,
          parity: SERIAL_CONFIG.PARITY,
          autoOpen: false
        });
        this.port.on("error", (err) => {
          console.error("❌ [TL3600] Serial port error:", err.message);
          this.emit("error", err);
        });
        this.port.on("close", () => {
          console.log("🔌 [TL3600] Serial port closed");
          this.isConnected = false;
          this.emit("disconnected");
        });
        this.port.on("data", (data) => {
          this.handleIncomingData(data);
        });
        this.port.open((err) => {
          if (err) {
            console.error("❌ [TL3600] Failed to open port:", err.message);
            resolve({ success: false, error: err.message });
            return;
          }
          console.log(`✅ [TL3600] Connected to ${this.portPath} at ${this.baudRate} baud`);
          this.isConnected = true;
          this.emit("connected");
          resolve({ success: true });
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("❌ [TL3600] Connection error:", errorMessage);
        resolve({ success: false, error: errorMessage });
      }
    });
  }
  /**
   * Disconnect from serial port
   */
  async disconnect() {
    if (this.pendingResponse) {
      clearTimeout(this.pendingResponse.timeout);
      this.pendingResponse.reject(new Error("Disconnecting"));
      this.pendingResponse = null;
    }
    if (this.port?.isOpen) {
      return new Promise((resolve) => {
        this.port.close((err) => {
          if (err) {
            console.error("❌ [TL3600] Error closing port:", err.message);
          }
          this.isConnected = false;
          this.port = null;
          resolve();
        });
      });
    }
    this.isConnected = false;
    this.port = null;
  }
  /**
   * Check if connected
   */
  isPortConnected() {
    return this.isConnected && (this.port?.isOpen ?? false);
  }
  /**
   * Send packet and wait for response with ACK/NACK handling
   */
  async sendPacket(packet, expectResponse = true) {
    if (!this.isPortConnected()) {
      return { success: false, error: "Not connected" };
    }
    let retryCount = 0;
    while (retryCount < TIMEOUT.MAX_RETRY) {
      try {
        console.log(`📤 [TL3600] Sending packet (attempt ${retryCount + 1}/${TIMEOUT.MAX_RETRY})`);
        console.log(`   Data: ${packet.toString("hex").toUpperCase()}`);
        await this.writeToPort(packet);
        const ackResult = await this.waitForAck();
        if (!ackResult.success) {
          if (ackResult.nack) {
            console.warn(`⚠️ [TL3600] Received NACK, retrying...`);
            retryCount++;
            continue;
          }
          console.warn(`⚠️ [TL3600] ACK timeout, retrying...`);
          retryCount++;
          continue;
        }
        console.log(`✅ [TL3600] ACK received`);
        if (!expectResponse) {
          return { success: true };
        }
        const response = await this.waitForResponse();
        if (response) {
          await this.sendAck();
          return { success: true, response };
        }
        console.warn(`⚠️ [TL3600] Response timeout`);
        return { success: false, error: "Response timeout" };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ [TL3600] Send error:`, errorMessage);
        retryCount++;
      }
    }
    return { success: false, error: `Max retries (${TIMEOUT.MAX_RETRY}) exceeded` };
  }
  /**
   * Send ACK
   */
  async sendAck() {
    if (this.port?.isOpen) {
      await this.writeToPort(Buffer.from([ACK]));
      console.log(`📤 [TL3600] ACK sent`);
    }
  }
  /**
   * Send NACK
   */
  async sendNack() {
    if (this.port?.isOpen) {
      await this.writeToPort(Buffer.from([NACK]));
      console.log(`📤 [TL3600] NACK sent`);
    }
  }
  // ===========================================================================
  // Private Methods
  // ===========================================================================
  /**
   * Write data to serial port
   */
  writeToPort(data) {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) {
        reject(new Error("Port not open"));
        return;
      }
      this.port.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port.drain((drainErr) => {
          if (drainErr) {
            reject(drainErr);
            return;
          }
          resolve();
        });
      });
    });
  }
  /**
   * Wait for ACK/NACK response
   */
  waitForAck() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners("ack");
        this.removeAllListeners("nack");
        resolve({ success: false });
      }, TIMEOUT.ACK_WAIT);
      this.once("ack", () => {
        clearTimeout(timeout);
        this.removeAllListeners("nack");
        resolve({ success: true });
      });
      this.once("nack", () => {
        clearTimeout(timeout);
        this.removeAllListeners("ack");
        resolve({ success: false, nack: true });
      });
    });
  }
  /**
   * Wait for response packet
   */
  waitForResponse() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponse = null;
        resolve(null);
      }, TIMEOUT.RESPONSE_WAIT);
      this.pendingResponse = {
        resolve: (packet) => {
          clearTimeout(timeout);
          this.pendingResponse = null;
          resolve(packet);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.pendingResponse = null;
          reject(error);
        },
        timeout
      };
    });
  }
  /**
   * Handle incoming data from serial port
   */
  handleIncomingData(data) {
    console.log(`📥 [TL3600] Received: ${data.toString("hex").toUpperCase()}`);
    if (data.length === 1) {
      if (data[0] === ACK) {
        this.emit("ack");
        return;
      }
      if (data[0] === NACK) {
        this.emit("nack");
        return;
      }
    }
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
    this.processReceiveBuffer();
  }
  /**
   * Process receive buffer to extract complete packets
   */
  processReceiveBuffer() {
    const stxIndex = this.receiveBuffer.indexOf(STX);
    if (stxIndex === -1) {
      this.receiveBuffer = Buffer.alloc(0);
      return;
    }
    if (stxIndex > 0) {
      this.receiveBuffer = this.receiveBuffer.slice(stxIndex);
    }
    const packetLength = findCompletePacket(this.receiveBuffer);
    if (packetLength === 0) {
      return;
    }
    const packetBuffer = this.receiveBuffer.slice(0, packetLength);
    this.receiveBuffer = this.receiveBuffer.slice(packetLength);
    const packet = parsePacket(packetBuffer);
    if (!packet) {
      console.error("❌ [TL3600] Failed to parse packet");
      return;
    }
    if (!packet.isValid) {
      console.error("❌ [TL3600] Invalid BCC, sending NACK");
      this.sendNack();
      return;
    }
    console.log(`✅ [TL3600] Valid packet received: Job Code = ${packet.header.jobCode}`);
    if (packet.header.jobCode === JobCode.EVENT_RESPONSE) {
      this.emit("event", packet);
      return;
    }
    if (this.pendingResponse) {
      this.pendingResponse.resolve(packet);
    } else {
      console.warn("⚠️ [TL3600] Unexpected packet received");
      this.emit("packet", packet);
    }
    if (this.receiveBuffer.length > 0) {
      this.processReceiveBuffer();
    }
  }
}
async function listSerialPorts() {
  try {
    const ports = await serialport.SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer
    }));
  } catch (error) {
    console.error("Failed to list serial ports:", error);
    return [];
  }
}
class TL3600Controller extends events.EventEmitter {
  serial;
  terminalId;
  isConnected = false;
  isInPaymentMode = false;
  currentPaymentRequest = null;
  constructor(config) {
    super();
    this.terminalId = config.terminalId;
    this.serial = new TL3600Serial({
      port: config.port,
      baudRate: config.baudRate
    });
    this.serial.on("error", (error) => this.emit("error", error));
    this.serial.on("disconnected", () => {
      this.isConnected = false;
      this.isInPaymentMode = false;
      this.emit("disconnected");
    });
    this.serial.on("event", (packet) => {
      this.handleEvent(packet);
    });
  }
  // ===========================================================================
  // Connection Management
  // ===========================================================================
  /**
   * Connect to payment terminal and check device status
   */
  async connect() {
    console.log(`🔌 [TL3600] Connecting to terminal...`);
    const connectResult = await this.serial.connect();
    if (!connectResult.success) {
      return { success: false, error: connectResult.error };
    }
    const deviceStatus = await this.checkDevice();
    if (!deviceStatus) {
      await this.serial.disconnect();
      return { success: false, error: "Device check failed" };
    }
    if (deviceStatus.rfModuleStatus !== DeviceStatus.OK) {
      console.warn(`⚠️ [TL3600] RF module status: ${deviceStatus.rfModuleStatus}`);
    }
    this.isConnected = true;
    console.log(`✅ [TL3600] Connected successfully`);
    console.log(`   Card Module: ${deviceStatus.cardModuleStatus}`);
    console.log(`   RF Module: ${deviceStatus.rfModuleStatus}`);
    console.log(`   VAN Server: ${deviceStatus.vanServerStatus}`);
    return { success: true, deviceStatus };
  }
  /**
   * Disconnect from terminal
   */
  async disconnect() {
    console.log(`🔌 [TL3600] Disconnecting...`);
    this.isConnected = false;
    this.isInPaymentMode = false;
    await this.serial.disconnect();
  }
  /**
   * Check if connected
   */
  isTerminalConnected() {
    return this.isConnected && this.serial.isPortConnected();
  }
  // ===========================================================================
  // Device Operations
  // ===========================================================================
  /**
   * Check device status (Job Code: A)
   */
  async checkDevice() {
    console.log(`🔍 [TL3600] Checking device status...`);
    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.DEVICE_CHECK
    });
    const result = await this.serial.sendPacket(packet);
    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Device check failed:`, result.error);
      return null;
    }
    if (result.response.header.jobCode !== JobCode.DEVICE_CHECK_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return null;
    }
    return parseDeviceCheckResponse(result.response.data);
  }
  // ===========================================================================
  // Payment Operations
  // ===========================================================================
  /**
   * Enter payment standby mode (Job Code: E)
   * Terminal will wait for card input and emit events
   */
  async enterPaymentMode(request) {
    if (!this.isConnected) {
      console.error(`❌ [TL3600] Not connected`);
      return false;
    }
    console.log(`💳 [TL3600] Entering payment standby mode...`);
    this.currentPaymentRequest = request || {};
    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.PAYMENT_STANDBY
    });
    const result = await this.serial.sendPacket(packet);
    if (!result.success) {
      console.error(`❌ [TL3600] Failed to enter payment mode:`, result.error);
      return false;
    }
    this.isInPaymentMode = true;
    this.emit("paymentModeEntered");
    console.log(`✅ [TL3600] Payment standby mode active`);
    return true;
  }
  /**
   * Request transaction approval (Job Code: B)
   * Called internally when card is detected
   */
  async requestApproval(request) {
    if (!this.isConnected) {
      return { success: false, error: "Not connected" };
    }
    const amount = request?.amount ?? PAYMENT_DEFAULTS.AMOUNT;
    const tax = request?.tax ?? PAYMENT_DEFAULTS.TAX;
    const serviceCharge = request?.serviceCharge ?? PAYMENT_DEFAULTS.SERVICE_CHARGE;
    const installment = request?.installment ?? PAYMENT_DEFAULTS.INSTALLMENT;
    console.log(`💳 [TL3600] Requesting approval for ${amount}원...`);
    const data = buildApprovalRequestData(
      TransactionType.APPROVAL,
      amount,
      tax,
      serviceCharge,
      installment,
      SignatureRequired.NO
    );
    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.TRANSACTION_APPROVAL,
      data
    });
    const result = await this.serial.sendPacket(packet);
    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Approval request failed:`, result.error);
      return { success: false, error: result.error || "Request failed" };
    }
    if (result.response.header.jobCode !== JobCode.TRANSACTION_APPROVAL_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return { success: false, error: "Unexpected response" };
    }
    const response = parseApprovalResponse(result.response.data);
    if (response.isRejected) {
      console.error(`❌ [TL3600] Transaction rejected: ${response.rejectMessage}`);
      return {
        success: false,
        error: response.rejectMessage || "Transaction rejected",
        rejectCode: response.rejectCode,
        rejectMessage: response.rejectMessage
      };
    }
    console.log(`✅ [TL3600] Transaction approved!`);
    console.log(`   Approval Number: ${response.approvalNumber}`);
    console.log(`   Amount: ${response.approvedAmount}원`);
    console.log(`   Card: ${response.cardNumber}`);
    return {
      success: true,
      transactionType: response.transactionType,
      cardNumber: response.cardNumber,
      approvedAmount: response.approvedAmount,
      approvalNumber: response.approvalNumber,
      salesDate: response.salesDate,
      salesTime: response.salesTime,
      transactionId: response.transactionId,
      transactionMedia: response.transactionMedia
    };
  }
  /**
   * Request transaction cancel (Job Code: C)
   * For dashboard manual cancellation
   */
  async requestCancel(request) {
    if (!this.isConnected) {
      return { success: false, error: "Not connected" };
    }
    console.log(`🚫 [TL3600] Requesting cancellation...`);
    console.log(`   Original Approval: ${request.approvalNumber}`);
    console.log(`   Original Date: ${request.originalDate}`);
    console.log(`   Amount: ${request.amount}원`);
    const data = buildCancelRequestData(
      CancelType.VAN_NO_CARD,
      // 무카드 취소
      request.transactionType,
      // '1' IC or '2' RF/MS
      request.amount,
      PAYMENT_DEFAULTS.TAX,
      PAYMENT_DEFAULTS.SERVICE_CHARGE,
      PAYMENT_DEFAULTS.INSTALLMENT,
      SignatureRequired.NO,
      request.approvalNumber,
      request.originalDate,
      request.originalTime
    );
    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.TRANSACTION_CANCEL,
      data
    });
    const result = await this.serial.sendPacket(packet);
    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Cancel request failed:`, result.error);
      return { success: false, error: result.error || "Request failed" };
    }
    if (result.response.header.jobCode !== JobCode.TRANSACTION_CANCEL_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return { success: false, error: "Unexpected response" };
    }
    const response = parseApprovalResponse(result.response.data);
    if (response.isRejected) {
      console.error(`❌ [TL3600] Cancellation rejected: ${response.rejectMessage}`);
      return {
        success: false,
        error: response.rejectMessage || "Cancellation rejected"
      };
    }
    console.log(`✅ [TL3600] Cancellation successful!`);
    return { success: true, response };
  }
  /**
   * Inquire card information (Job Code: D)
   */
  async inquireCard() {
    if (!this.isConnected) {
      return null;
    }
    console.log(`🔍 [TL3600] Inquiring card...`);
    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.CARD_INQUIRY
    });
    const result = await this.serial.sendPacket(packet);
    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Card inquiry failed:`, result.error);
      return null;
    }
    if (result.response.header.jobCode !== JobCode.CARD_INQUIRY_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return null;
    }
    return parseCardInquiryResponse(result.response.data);
  }
  // ===========================================================================
  // Event Handling
  // ===========================================================================
  /**
   * Handle incoming event from terminal
   */
  async handleEvent(packet) {
    const event = parseEventResponse(packet.data);
    console.log(`📨 [TL3600] Event received: ${event.eventType}`);
    let cardEventType;
    switch (event.eventType) {
      case EventType.MS_CARD:
        cardEventType = "ms";
        console.log(`💳 [TL3600] MS card detected`);
        break;
      case EventType.RF_CARD:
        cardEventType = "rf";
        console.log(`💳 [TL3600] RF card detected`);
        break;
      case EventType.IC_CARD:
        cardEventType = "ic";
        console.log(`💳 [TL3600] IC card inserted`);
        break;
      case EventType.IC_CARD_REMOVED:
        console.log(`💳 [TL3600] IC card removed`);
        this.emit("cardRemoved");
        return;
      case EventType.IC_FALLBACK:
        cardEventType = "ms";
        console.log(`💳 [TL3600] IC fallback, treating as MS`);
        break;
      case EventType.BARCODE:
        cardEventType = "barcode";
        console.log(`📊 [TL3600] Barcode detected`);
        break;
      default:
        console.warn(`⚠️ [TL3600] Unknown event type: ${event.eventType}`);
        return;
    }
    const cardEvent = {
      type: cardEventType,
      timestamp: Date.now()
    };
    this.emit("cardDetected", cardEvent);
    if (this.isInPaymentMode) {
      this.isInPaymentMode = false;
      this.emit("processingPayment");
      const result = await this.requestApproval(this.currentPaymentRequest || void 0);
      if (result.success) {
        this.emit("paymentApproved", result);
      } else {
        this.emit("paymentRejected", result);
      }
      this.currentPaymentRequest = null;
    }
  }
  // ===========================================================================
  // Utility Methods
  // ===========================================================================
  /**
   * Get available COM ports
   */
  static async listPorts() {
    return listSerialPorts();
  }
  /**
   * Get current status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      inPaymentMode: this.isInPaymentMode,
      terminalId: this.terminalId
    };
  }
}
class CardReaderController extends events.EventEmitter {
  mockMode;
  mockApprovalRate;
  readerPort;
  terminalId;
  isConnected = false;
  currentTransaction = null;
  timeoutTimer = null;
  // TL3600 controller (for real hardware mode)
  tl3600 = null;
  constructor(config = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_CARD_READER !== "false";
    this.mockApprovalRate = config.mockApprovalRate ?? 0.8;
    this.readerPort = config.readerPort ?? process.env.TL3600_PORT ?? "COM3";
    this.terminalId = config.terminalId ?? process.env.TL3600_TERMINAL_ID ?? "0000000000000000";
    if (this.mockMode) {
      console.log("💳 Card reader initialized in MOCK mode");
    } else {
      console.log(`💳 Card reader configured for TL3600 on ${this.readerPort}`);
    }
  }
  /**
   * Initialize card reader connection
   */
  async connect() {
    if (this.mockMode) {
      return this.mockConnect();
    }
    return this.tl3600Connect();
  }
  /**
   * Connect to TL3600 hardware
   */
  async tl3600Connect() {
    try {
      console.log(`🔌 [CardReader] Connecting to TL3600 on ${this.readerPort}...`);
      this.tl3600 = new TL3600Controller({
        port: this.readerPort,
        terminalId: this.terminalId
      });
      this.setupTL3600Events();
      const result = await this.tl3600.connect();
      if (!result.success) {
        console.error("❌ [CardReader] TL3600 connection failed:", result.error);
        return { success: false, error: result.error };
      }
      this.isConnected = true;
      console.log("✅ [CardReader] TL3600 connected successfully");
      this.emit("connected", { model: "TL3600/TL3500BP" });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ [CardReader] TL3600 connection error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  /**
   * Set up TL3600 event handlers
   */
  setupTL3600Events() {
    if (!this.tl3600) return;
    this.tl3600.on("cardDetected", (event) => {
      console.log(`💳 [CardReader] Card detected: ${event.type}`);
      this.emit("status", {
        status: "card_inserted",
        message: "카드가 감지되었습니다",
        cardType: event.type
      });
    });
    this.tl3600.on("cardRemoved", () => {
      console.log("💳 [CardReader] Card removed");
      this.emit("cardRemoved");
    });
    this.tl3600.on("processingPayment", () => {
      console.log("💳 [CardReader] Processing payment...");
      this.emit("status", {
        status: "processing",
        message: "결제 처리 중..."
      });
    });
    this.tl3600.on("paymentApproved", (result) => {
      console.log("✅ [CardReader] Payment approved");
      const paymentResult = this.convertTL3600Result(result, true);
      this.emit("status", {
        status: "approved",
        message: "결제가 완료되었습니다!"
      });
      this.emit("paymentComplete", paymentResult);
    });
    this.tl3600.on("paymentRejected", (result) => {
      console.log("❌ [CardReader] Payment rejected:", result.error);
      const paymentResult = this.convertTL3600Result(result, false);
      this.emit("status", {
        status: "declined",
        message: result.rejectMessage || result.error || "결제가 거부되었습니다"
      });
      this.emit("paymentComplete", paymentResult);
    });
    this.tl3600.on("error", (error) => {
      console.error("❌ [CardReader] TL3600 error:", error.message);
      this.emit("error", error);
    });
    this.tl3600.on("disconnected", () => {
      console.log("🔌 [CardReader] TL3600 disconnected");
      this.isConnected = false;
      this.emit("disconnected");
    });
  }
  /**
   * Convert TL3600 result to PaymentResult format
   */
  convertTL3600Result(result, success) {
    let cardType = "unknown";
    if (result.transactionMedia) {
      switch (result.transactionMedia) {
        case "1":
          cardType = "ic";
          break;
        case "2":
          cardType = "ms";
          break;
        case "3":
          cardType = "rf";
          break;
      }
    }
    const cardLast4 = result.cardNumber ? result.cardNumber.replace(/\D/g, "").slice(-4) : void 0;
    return {
      success,
      status: success ? "approved" : "declined",
      transactionId: result.transactionId,
      amount: result.approvedAmount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      cardType,
      cardLast4,
      cardNumber: result.cardNumber,
      approvalNumber: result.approvalNumber,
      salesDate: result.salesDate,
      salesTime: result.salesTime,
      transactionMedia: result.transactionMedia,
      error: result.error,
      rejectCode: result.rejectCode,
      rejectMessage: result.rejectMessage
    };
  }
  /**
   * Disconnect card reader
   */
  async disconnect() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.tl3600) {
      await this.tl3600.disconnect();
      this.tl3600 = null;
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
    return this.tl3600ProcessPayment(options);
  }
  /**
   * Process payment using TL3600
   */
  async tl3600ProcessPayment(options) {
    if (!this.tl3600) {
      return {
        success: false,
        status: "error",
        error: "TL3600 not initialized"
      };
    }
    console.log(`💳 [CardReader] Starting TL3600 payment: ${options.amount}원`);
    this.emit("status", {
      status: "waiting",
      message: `카드를 삽입해주세요
금액: ${options.amount.toLocaleString()}원`
    });
    const success = await this.tl3600.enterPaymentMode({
      amount: options.amount
    });
    if (!success) {
      return {
        success: false,
        status: "error",
        error: "Failed to enter payment mode"
      };
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners("paymentComplete");
        resolve({
          success: false,
          status: "timeout",
          error: "결제 시간이 초과되었습니다"
        });
      }, 3e4);
      this.once("paymentComplete", (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }
  /**
   * Cancel a previous transaction
   */
  async cancelTransaction(options) {
    if (this.mockMode) {
      console.log("💳 [CardReader] Mock cancel - always succeeds");
      return {
        success: true,
        status: "approved",
        transactionId: `CANCEL_${Date.now()}`,
        amount: options.amount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (!this.tl3600) {
      return {
        success: false,
        status: "error",
        error: "TL3600 not initialized"
      };
    }
    console.log(`🚫 [CardReader] Cancelling transaction: ${options.approvalNumber}`);
    const result = await this.tl3600.requestCancel({
      approvalNumber: options.approvalNumber,
      originalDate: options.originalDate,
      originalTime: options.originalTime,
      amount: options.amount,
      transactionType: options.transactionType
    });
    if (result.success) {
      return {
        success: true,
        status: "approved",
        transactionId: result.response?.transactionId,
        amount: options.amount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    return {
      success: false,
      status: "error",
      error: result.error || "Cancellation failed"
    };
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
      connected: this.isConnected,
      mode: this.mockMode ? "mock" : "tl3600"
    };
  }
  /**
   * Get available COM ports (for configuration)
   */
  static async listPorts() {
    return TL3600Controller.listPorts();
  }
  // ===========================================================================
  // Mock Mode Methods
  // ===========================================================================
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
        cardLast4,
        approvalNumber: Math.random().toString(36).substr(2, 8).toUpperCase(),
        salesDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, ""),
        salesTime: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8).replace(/:/g, "")
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
let db = null;
function initDatabase() {
  const dbPath = path__namespace.join(electron.app.getPath("userData"), "analytics.db");
  console.log(`📊 [Analytics] Initializing database at: ${dbPath}`);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_seconds INTEGER,
      frame_selected TEXT,
      images_captured INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      payment_time INTEGER NOT NULL,
      error_message TEXT,
      approval_number TEXT,
      sales_date TEXT,
      sales_time TEXT,
      transaction_media TEXT,
      card_number TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS prints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      image_path TEXT,
      print_time INTEGER NOT NULL,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `);
  migratePaymentsTable();
  console.log("✅ [Analytics] Database initialized");
}
function migratePaymentsTable() {
  if (!db) return;
  const tableInfo = db.prepare("PRAGMA table_info(payments)").all();
  const columnNames = tableInfo.map((col) => col.name);
  const newColumns = [
    { name: "approval_number", type: "TEXT" },
    { name: "sales_date", type: "TEXT" },
    { name: "sales_time", type: "TEXT" },
    { name: "transaction_media", type: "TEXT" },
    { name: "card_number", type: "TEXT" }
  ];
  for (const column of newColumns) {
    if (!columnNames.includes(column.name)) {
      try {
        db.exec(`ALTER TABLE payments ADD COLUMN ${column.name} ${column.type}`);
        console.log(`📊 [Analytics] Added column: payments.${column.name}`);
      } catch (error) {
        console.log(`📊 [Analytics] Column ${column.name} already exists or error:`, error);
      }
    }
  }
}
function recordSessionStart(sessionId, startTime) {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (session_id, start_time, images_captured, completed)
    VALUES (?, ?, 0, 0)
  `);
  stmt.run(sessionId, startTime);
  console.log(`📊 [Analytics] Session started: ${sessionId}`);
}
function updateSessionImages(sessionId, imageCount) {
  if (!db) return;
  const stmt = db.prepare(`
    UPDATE sessions SET images_captured = ? WHERE session_id = ?
  `);
  stmt.run(imageCount, sessionId);
}
function updateSessionFrame(sessionId, frameName) {
  if (!db) return;
  const stmt = db.prepare(`
    UPDATE sessions SET frame_selected = ? WHERE session_id = ?
  `);
  stmt.run(frameName, sessionId);
}
function recordSessionEnd(sessionId, endTime) {
  if (!db) return;
  const stmt = db.prepare(`
    UPDATE sessions
    SET end_time = ?,
        duration_seconds = (? - start_time) / 1000,
        completed = 1
    WHERE session_id = ?
  `);
  stmt.run(endTime, endTime, sessionId);
  console.log(`📊 [Analytics] Session completed: ${sessionId}`);
}
function recordPayment(sessionId, amount, status, errorMessage, details) {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT INTO payments (session_id, amount, status, payment_time, error_message, approval_number, sales_date, sales_time, transaction_media, card_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    sessionId,
    amount,
    status,
    Date.now(),
    errorMessage || null,
    details?.approvalNumber || null,
    details?.salesDate || null,
    details?.salesTime || null,
    details?.transactionMedia || null,
    details?.cardNumber || null
  );
  console.log(`📊 [Analytics] Payment recorded: ${sessionId} - ${status} - ${amount}원 (approval: ${details?.approvalNumber || "N/A"})`);
}
function recordPrint(sessionId, imagePath, success, errorMessage) {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT INTO prints (session_id, image_path, print_time, success, error_message)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(sessionId, imagePath, Date.now(), success ? 1 : 0, errorMessage || null);
  console.log(`📊 [Analytics] Print recorded: ${sessionId} - ${success ? "success" : "failed"}`);
}
function getDashboardStats() {
  if (!db) {
    return {
      todaySessions: 0,
      todayRevenue: 0,
      todaySuccessRate: 0,
      totalSessions: 0,
      totalRevenue: 0,
      totalSuccessRate: 0,
      popularFrames: [],
      recentSessions: [],
      hourlyDistribution: [],
      dailyRevenue: []
    };
  }
  const todayStart = /* @__PURE__ */ new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();
  const todaySessions = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE start_time >= ?
  `).get(todayTimestamp);
  const todayRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE status = 'approved' AND payment_time >= ?
  `).get(todayTimestamp);
  const todayPayments = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM payments WHERE payment_time >= ?
  `).get(todayTimestamp);
  const totalSessions = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
  `).get();
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'approved'
  `).get();
  const totalPayments = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM payments
  `).get();
  const popularFrames = db.prepare(`
    SELECT frame_selected as frame, COUNT(*) as count
    FROM sessions
    WHERE frame_selected IS NOT NULL
    GROUP BY frame_selected
    ORDER BY count DESC
    LIMIT 5
  `).all();
  const recentSessions = db.prepare(`
    SELECT
      s.session_id,
      s.start_time,
      COALESCE(s.duration_seconds, 0) as duration_seconds,
      COALESCE(s.frame_selected, 'N/A') as frame_selected,
      COALESCE(p.status, 'N/A') as payment_status,
      COALESCE(p.amount, 0) as amount,
      p.approval_number,
      p.sales_date,
      p.sales_time,
      p.transaction_media,
      p.card_number
    FROM sessions s
    LEFT JOIN payments p ON s.session_id = p.session_id
    ORDER BY s.start_time DESC
    LIMIT 20
  `).all();
  const hourlyDistribution = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(start_time/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
      COUNT(*) as count
    FROM sessions
    WHERE start_time >= ?
    GROUP BY hour
    ORDER BY hour
  `).all(todayTimestamp);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
  const dailyRevenue = db.prepare(`
    SELECT
      date(payment_time/1000, 'unixepoch', 'localtime') as date,
      SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as revenue,
      COUNT(DISTINCT session_id) as sessions
    FROM payments
    WHERE payment_time >= ?
    GROUP BY date
    ORDER BY date DESC
  `).all(sevenDaysAgo);
  return {
    todaySessions: todaySessions.count,
    todayRevenue: todayRevenue.total,
    todaySuccessRate: todayPayments.total > 0 ? Math.round(todayPayments.approved / todayPayments.total * 100) : 0,
    totalSessions: totalSessions.count,
    totalRevenue: totalRevenue.total,
    totalSuccessRate: totalPayments.total > 0 ? Math.round(totalPayments.approved / totalPayments.total * 100) : 0,
    popularFrames,
    recentSessions,
    hourlyDistribution,
    dailyRevenue
  };
}
function getFlowStatistics() {
  if (!db) {
    return {
      sessionsStarted: 0,
      frameSelected: 0,
      recordingCompleted: 0,
      processingCompleted: 0,
      paymentAttempted: 0,
      paymentApproved: 0,
      printCompleted: 0,
      frameSelectionRate: 0,
      recordingCompletionRate: 0,
      processingCompletionRate: 0,
      paymentAttemptRate: 0,
      paymentSuccessRate: 0,
      printCompletionRate: 0,
      overallConversionRate: 0,
      dropOffPoints: []
    };
  }
  const sessionsStarted = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
  `).get().count;
  const frameSelected = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE frame_selected IS NOT NULL
  `).get().count;
  const recordingCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE images_captured > 0
  `).get().count;
  const processingCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE completed = 1
  `).get().count;
  const paymentAttempted = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM payments
  `).get().count;
  const paymentApproved = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM payments WHERE status = 'approved'
  `).get().count;
  const printCompleted = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM prints WHERE success = 1
  `).get().count;
  const calcRate = (numerator, denominator) => {
    if (denominator === 0) return 0;
    return Math.round(numerator / denominator * 100);
  };
  const frameSelectionRate = calcRate(frameSelected, sessionsStarted);
  const recordingCompletionRate = calcRate(recordingCompleted, frameSelected);
  const processingCompletionRate = calcRate(processingCompleted, recordingCompleted);
  const paymentAttemptRate = calcRate(paymentAttempted, processingCompleted);
  const paymentSuccessRate = calcRate(paymentApproved, paymentAttempted);
  const printCompletionRate = calcRate(printCompleted, paymentApproved);
  const overallConversionRate = calcRate(printCompleted, sessionsStarted);
  const dropOffPoints = [
    {
      step: "프레임 선택",
      dropped: sessionsStarted - frameSelected,
      dropRate: calcRate(sessionsStarted - frameSelected, sessionsStarted)
    },
    {
      step: "녹화 완료",
      dropped: frameSelected - recordingCompleted,
      dropRate: calcRate(frameSelected - recordingCompleted, frameSelected)
    },
    {
      step: "처리 완료",
      dropped: recordingCompleted - processingCompleted,
      dropRate: calcRate(recordingCompleted - processingCompleted, recordingCompleted)
    },
    {
      step: "결제 시도",
      dropped: processingCompleted - paymentAttempted,
      dropRate: calcRate(processingCompleted - paymentAttempted, processingCompleted)
    },
    {
      step: "결제 승인",
      dropped: paymentAttempted - paymentApproved,
      dropRate: calcRate(paymentAttempted - paymentApproved, paymentAttempted)
    },
    {
      step: "인쇄 완료",
      dropped: paymentApproved - printCompleted,
      dropRate: calcRate(paymentApproved - printCompleted, paymentApproved)
    }
  ];
  return {
    sessionsStarted,
    frameSelected,
    recordingCompleted,
    processingCompleted,
    paymentAttempted,
    paymentApproved,
    printCompleted,
    frameSelectionRate,
    recordingCompletionRate,
    processingCompletionRate,
    paymentAttemptRate,
    paymentSuccessRate,
    printCompletionRate,
    overallConversionRate,
    dropOffPoints
  };
}
function insertSampleData() {
  if (!db) {
    return { success: false, stats: { sessionsStarted: 0, frameSelected: 0, recordingCompleted: 0, processingCompleted: 0, paymentAttempted: 0, paymentApproved: 0, printCompleted: 0 } };
  }
  console.log("📊 [Analytics] Inserting sample data...");
  db.exec("DELETE FROM prints");
  db.exec("DELETE FROM payments");
  db.exec("DELETE FROM sessions");
  const frames = ["프레임A", "프레임B", "프레임C", "프레임D", "프레임E"];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1e3;
  const insertSession = db.prepare(`
    INSERT INTO sessions (session_id, start_time, end_time, duration_seconds, frame_selected, images_captured, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments (session_id, amount, status, payment_time, approval_number, sales_date, sales_time, transaction_media, card_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrint = db.prepare(`
    INSERT INTO prints (session_id, image_path, print_time, success)
    VALUES (?, ?, ?, ?)
  `);
  const stats = {
    sessionsStarted: 0,
    frameSelected: 0,
    recordingCompleted: 0,
    processingCompleted: 0,
    paymentAttempted: 0,
    paymentApproved: 0,
    printCompleted: 0
  };
  for (let i = 0; i < 100; i++) {
    const sessionId = `sample_session_${now}_${i}`;
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const startTime = now - daysAgo * dayMs - hoursAgo * 60 * 60 * 1e3;
    stats.sessionsStarted++;
    const selectedFrame = Math.random() < 0.85;
    const frameName = selectedFrame ? frames[Math.floor(Math.random() * frames.length)] : null;
    if (selectedFrame) stats.frameSelected++;
    const recordingDone = selectedFrame && Math.random() < 0.9;
    const imagesCaptured = recordingDone ? Math.floor(Math.random() * 3) + 1 : 0;
    if (recordingDone) stats.recordingCompleted++;
    const processingDone = recordingDone && Math.random() < 0.95;
    if (processingDone) stats.processingCompleted++;
    const durationSeconds = processingDone ? Math.floor(Math.random() * 360) + 120 : Math.floor(Math.random() * 60);
    const endTime = processingDone ? startTime + durationSeconds * 1e3 : null;
    insertSession.run(
      sessionId,
      startTime,
      endTime,
      durationSeconds,
      frameName,
      imagesCaptured,
      processingDone ? 1 : 0
    );
    const paymentAttemptedFlag = processingDone && Math.random() < 0.85;
    if (paymentAttemptedFlag) {
      stats.paymentAttempted++;
      const paymentApprovedFlag = Math.random() < 0.8;
      const paymentTime = startTime + durationSeconds * 1e3 + 5e3;
      if (paymentApprovedFlag) {
        stats.paymentApproved++;
        const salesDate = new Date(paymentTime).toISOString().slice(0, 10).replace(/-/g, "");
        const salesTime = new Date(paymentTime).toTimeString().slice(0, 8).replace(/:/g, "");
        const approvalNumber = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
        const transactionMedia = ["1", "2", "3"][Math.floor(Math.random() * 3)];
        const cardLast4 = String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
        insertPayment.run(
          sessionId,
          5e3,
          "approved",
          paymentTime,
          approvalNumber,
          salesDate,
          salesTime,
          transactionMedia,
          `****-****-****-${cardLast4}`
        );
        const printDone = Math.random() < 0.95;
        if (printDone) {
          stats.printCompleted++;
          insertPrint.run(
            sessionId,
            `/frames/${sessionId}_print.jpg`,
            paymentTime + 3e4,
            1
          );
        } else {
          insertPrint.run(
            sessionId,
            `/frames/${sessionId}_print.jpg`,
            paymentTime + 3e4,
            0
          );
        }
      } else {
        insertPayment.run(
          sessionId,
          5e3,
          "declined",
          paymentTime,
          null,
          null,
          null,
          null,
          null
        );
      }
    }
  }
  console.log("✅ [Analytics] Sample data inserted");
  console.log(`   Sessions Started: ${stats.sessionsStarted}`);
  console.log(`   Frame Selected: ${stats.frameSelected}`);
  console.log(`   Recording Completed: ${stats.recordingCompleted}`);
  console.log(`   Processing Completed: ${stats.processingCompleted}`);
  console.log(`   Payment Attempted: ${stats.paymentAttempted}`);
  console.log(`   Payment Approved: ${stats.paymentApproved}`);
  console.log(`   Print Completed: ${stats.printCompleted}`);
  return { success: true, stats };
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log("📊 [Analytics] Database closed");
  }
}
try {
  require("dotenv").config({
    path: path__namespace.join(__dirname, "../.env"),
    override: true
  });
} catch (e) {
}
let mainWindow = null;
let hologramWindow = null;
let pythonBridge = null;
let cameraController = null;
let printerController = null;
let cardReader = null;
let hologramState = {
  mode: "logo"
};
const isDevelopment = !electron.app.isPackaged;
let displaySettings = {
  splitScreenMode: false,
  swapDisplays: false,
  mainWidth: 1080,
  mainHeight: 1920,
  hologramWidth: 1080,
  hologramHeight: 1920
};
function getHologramTargetWindow() {
  return displaySettings.splitScreenMode ? mainWindow : hologramWindow;
}
function createWindow() {
  const displays = electron.screen.getAllDisplays();
  const mainDisplayIndex = displaySettings.swapDisplays && displays.length > 1 ? 1 : 0;
  const mainDisplay = displays[mainDisplayIndex];
  const { x, y } = mainDisplay.bounds;
  console.log(`📺 Main window will be on display ${mainDisplayIndex + 1}${displaySettings.swapDisplays ? " (swapped)" : ""}`);
  mainWindow = new electron.BrowserWindow({
    x,
    y,
    width: isDevelopment ? 2200 : displaySettings.mainWidth,
    height: isDevelopment ? 1100 : displaySettings.mainHeight,
    fullscreen: false,
    frame: isDevelopment,
    // No frame in production
    resizable: isDevelopment,
    alwaysOnTop: !isDevelopment && !displaySettings.splitScreenMode,
    // Stay on top in production
    webPreferences: {
      preload: path__namespace.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false
    }
  });
  console.log(`📺 Main window: ${displaySettings.mainWidth}x${displaySettings.mainHeight} at (${x}, ${y})`);
  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path__namespace.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createHologramWindow() {
  const displays = electron.screen.getAllDisplays();
  const hologramDisplayIndex = displaySettings.swapDisplays ? 0 : displays.length > 1 ? 1 : 0;
  const hologramDisplay = displays[hologramDisplayIndex];
  const { x, y, width, height } = hologramDisplay.bounds;
  console.log(`📺 Hologram window will be on display ${hologramDisplayIndex + 1}${displaySettings.swapDisplays ? " (swapped)" : ""}`);
  hologramWindow = new electron.BrowserWindow({
    x,
    y,
    width: isDevelopment ? width : displaySettings.hologramWidth,
    height: isDevelopment ? height : displaySettings.hologramHeight,
    fullscreen: false,
    frame: isDevelopment,
    // No frame in production
    show: true,
    alwaysOnTop: !isDevelopment,
    // Stay on top in production
    webPreferences: {
      preload: path__namespace.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false
    }
  });
  if (isDevelopment) {
    hologramWindow.loadURL("http://localhost:5173/#/hologram");
  } else {
    hologramWindow.loadFile(path__namespace.join(__dirname, "../dist/index.html"), {
      hash: "/hologram"
    });
  }
  hologramWindow.on("closed", () => {
    hologramWindow = null;
  });
  console.log(`📺 Hologram window: ${displaySettings.hologramWidth}x${displaySettings.hologramHeight} at (${x}, ${y}) on display ${hologramDisplayIndex + 1}`);
}
electron.app.whenReady().then(async () => {
  console.log("🚀 Initializing MUT Hologram Studio...");
  electron.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "mediaKeySystem", "geolocation", "notifications"];
    if (allowedPermissions.includes(permission)) {
      console.log(`✅ Permission granted: ${permission}`);
      callback(true);
    } else {
      console.log(`❌ Permission denied: ${permission}`);
      callback(false);
    }
  });
  electron.session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ["media", "mediaKeySystem", "geolocation", "notifications"];
    return allowedPermissions.includes(permission);
  });
  console.log("📷 Camera permissions handler configured");
  const config = appConfig.load();
  displaySettings = {
    splitScreenMode: config.display.splitScreenMode,
    swapDisplays: config.display.swapDisplays,
    mainWidth: config.display.mainWidth,
    mainHeight: config.display.mainHeight,
    hologramWidth: config.display.hologramWidth,
    hologramHeight: config.display.hologramHeight
  };
  console.log(`📺 Display mode: ${displaySettings.splitScreenMode ? "Split Screen" : "Dual Monitor"}${displaySettings.swapDisplays ? " (displays swapped)" : ""}`);
  try {
    initDatabase();
  } catch (error) {
    console.error("⚠️ Failed to initialize analytics database:", error);
  }
  if (!isDevelopment) {
    electron.Menu.setApplicationMenu(null);
  }
  pythonBridge = new PythonBridge();
  const pythonCheck = await pythonBridge.checkDependencies();
  if (!pythonCheck.available) {
    console.error("⚠️  Python not available:", pythonCheck.error);
  } else {
    console.log("✅ Python bridge initialized");
  }
  pythonBridge.on("progress", (progress) => {
    mainWindow?.webContents.send("video:progress", progress);
  });
  const cameraConfig = getCameraConfig();
  cameraController = new CameraController({
    mockMode: cameraConfig.mockMode && !cameraConfig.useWebcam,
    useWebcam: cameraConfig.useWebcam
  });
  const cameraResult = await cameraController.connect();
  if (cameraResult.success) {
    console.log("✅ Camera controller initialized");
  } else {
    console.error("⚠️  Camera initialization failed:", cameraResult.error);
  }
  const printerConfig = getPrinterConfig();
  printerController = new PrinterController({ mockMode: printerConfig.mockMode });
  const printerResult = await printerController.connect();
  if (printerResult.success) {
    console.log("✅ Printer controller initialized");
  } else {
    console.error("⚠️  Printer initialization failed:", printerResult.error);
  }
  const paymentConfig = getPaymentConfig();
  const tl3600Config = getTL3600Config();
  const useMockCardReader = paymentConfig.useMockMode || isDevelopment;
  cardReader = new CardReaderController({
    mockMode: useMockCardReader,
    mockApprovalRate: paymentConfig.mockApprovalRate,
    readerPort: tl3600Config.port,
    terminalId: tl3600Config.terminalId
  });
  const cardReaderResult = await cardReader.connect();
  if (cardReaderResult.success) {
    const mode = useMockCardReader ? "mock mode" : `TL3600 on ${tl3600Config.port}`;
    console.log(`✅ Card reader initialized (${mode})`);
    cardReader.on("status", (statusUpdate) => {
      mainWindow?.webContents.send("payment:status", statusUpdate);
    });
    if (!useMockCardReader) {
      cardReader.on("cardRemoved", () => {
        mainWindow?.webContents.send("payment:card-removed");
      });
      cardReader.on("paymentComplete", (result) => {
        mainWindow?.webContents.send("payment:complete", result);
      });
      cardReader.on("error", (error) => {
        mainWindow?.webContents.send("payment:error", {
          message: error instanceof Error ? error.message : "Unknown error"
        });
      });
      cardReader.on("disconnected", () => {
        mainWindow?.webContents.send("payment:disconnected");
      });
    }
  } else {
    console.error("⚠️  Card reader initialization failed:", cardReaderResult.error);
  }
  console.log("✅ All systems initialized\n");
  createWindow();
  if (!displaySettings.splitScreenMode) {
    console.log("📺 Creating separate hologram window (dual-monitor mode)");
    createHologramWindow();
  } else {
    console.log("🔀 Using split-screen mode (single window)");
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (!displaySettings.splitScreenMode) {
        createHologramWindow();
      }
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("camera:start-preview", async () => {
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
electron.ipcMain.handle("camera:stop-preview", async () => {
  console.log("📷 Camera preview stopped");
  return { success: true };
});
electron.ipcMain.handle("camera:capture", async () => {
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
electron.ipcMain.handle("printer:get-status", async () => {
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
    const statusMap = {
      "idle": "ready",
      "printing": "busy",
      "error": "error",
      "offline": "offline"
    };
    return {
      success: status.available,
      status: statusMap[status.status] || status.status,
      paperLevel: status.paperLevel,
      inkLevel: status.inkLevel,
      error: status.error
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
electron.ipcMain.handle("printer:print", async (_event, options) => {
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
      mainWindow?.webContents.send("printer:progress", progressData);
    });
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("video:process", async (_event, params) => {
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
      frameOverlayPath = path__namespace.join(electron.app.getAppPath(), "public", relativePath);
      console.log(`   Frame overlay converted: ${params.chromaVideo} -> ${frameOverlayPath}`);
    } else if (params.chromaVideo && params.chromaVideo.startsWith("./")) {
      const relativePath = params.chromaVideo.substring(2);
      frameOverlayPath = path__namespace.join(electron.app.getAppPath(), "public", relativePath);
      console.log(`   Frame overlay converted: ${params.chromaVideo} -> ${frameOverlayPath}`);
    }
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      frameOverlay: frameOverlayPath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || "mut-hologram"
    });
    mainWindow?.webContents.send("video:complete", {
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
    mainWindow?.webContents.send("video:complete", {
      success: false,
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
});
electron.ipcMain.handle("video:cancel", async (_event, taskId) => {
  console.log("Video processing cancelled:", taskId);
  return { success: true };
});
electron.ipcMain.handle("video:process-from-images", async (_event, params) => {
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
      mainWindow?.webContents.send("video:progress", progress);
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
    mainWindow?.webContents.send("video:complete", {
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
    mainWindow?.webContents.send("video:complete", {
      success: false,
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
});
electron.ipcMain.handle("image:save-blob", async (_event, blobData, filename) => {
  console.log(`
${"=".repeat(70)}`);
  console.log(`💾 [IPC] SAVING BLOB TO FILE`);
  console.log(`${"=".repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Blob data length: ${blobData.length} chars`);
  try {
    const tempDir = path__namespace.join(electron.app.getPath("temp"), "mut-captures");
    await fs__namespace$1.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);
    const dataUrlPrefix = blobData.substring(0, 50);
    console.log(`   Data URL prefix: ${dataUrlPrefix}...`);
    const base64Data = blobData.replace(/^data:[^;]+;base64,/, "");
    console.log(`   Base64 data length after strip: ${base64Data.length} chars`);
    const buffer = Buffer.from(base64Data, "base64");
    console.log(`   ✓ Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);
    const hexHeader = buffer.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);
    const filePath = path__namespace.join(tempDir, filename);
    await fs__namespace$1.writeFile(filePath, buffer);
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
electron.ipcMain.handle("video:extract-frames", async (_event, videoPath, timestamps) => {
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
electron.ipcMain.handle("video:save-buffer", async (_event, byteArray, filename) => {
  console.log(`
${"=".repeat(70)}`);
  console.log(`💾 [IPC] SAVING VIDEO BUFFER TO FILE`);
  console.log(`${"=".repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Buffer size: ${(byteArray.length / 1024).toFixed(2)} KB`);
  try {
    const tempDir = path__namespace.join(electron.app.getPath("temp"), "mut-captures");
    await fs__namespace$1.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);
    const buffer = Buffer.from(byteArray);
    console.log(`   ✓ Buffer created: ${(buffer.length / 1024).toFixed(2)} KB`);
    const hexHeader = buffer.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);
    const filePath = path__namespace.join(tempDir, filename);
    await fs__namespace$1.writeFile(filePath, buffer);
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
electron.ipcMain.handle("payment:process", async (_event, params) => {
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
    mainWindow?.webContents.send("payment:complete", result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    mainWindow?.webContents.send("payment:complete", {
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
electron.ipcMain.handle("payment:cancel", async () => {
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
electron.ipcMain.handle("payment:get-status", async () => {
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
    status: status.connected ? "idle" : "offline",
    mode: status.mode
  };
});
electron.ipcMain.handle("payment:cancel-transaction", async (_event, options) => {
  console.log("🚫 Transaction cancellation requested:", options);
  if (!cardReader) {
    return {
      success: false,
      error: "Card reader not initialized"
    };
  }
  try {
    const result = await cardReader.cancelTransaction({
      approvalNumber: options.approvalNumber,
      originalDate: options.originalDate,
      originalTime: options.originalTime,
      amount: options.amount,
      transactionType: options.transactionType
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage
    };
  }
});
electron.ipcMain.handle("payment:list-ports", async () => {
  console.log("🔌 Listing available COM ports...");
  try {
    const ports = await CardReaderController.listPorts();
    console.log(`   Found ${ports.length} ports:`, ports.map((p) => p.path).join(", "));
    return {
      success: true,
      ports
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to list ports:", errorMessage);
    return {
      success: false,
      error: errorMessage,
      ports: []
    };
  }
});
electron.ipcMain.handle("hologram:set-mode", async (_event, mode, data) => {
  console.log("🎭 Hologram mode change requested:", mode);
  hologramState = {
    mode,
    qrCodePath: data?.qrCodePath,
    videoPath: data?.videoPath
  };
  console.log("💾 Hologram state stored:", hologramState);
  const targetWindow = getHologramTargetWindow();
  if (!targetWindow) {
    return { success: false, error: "Target window not initialized" };
  }
  targetWindow.webContents.send("hologram:update", hologramState);
  return { success: true };
});
electron.ipcMain.handle("hologram:show-qr", async (_event, qrCodePath, videoPath) => {
  console.log("🎭 [IPC] hologram:show-qr called");
  console.log("   QR Code:", qrCodePath);
  console.log("   Video path:", videoPath);
  hologramState = {
    mode: "result",
    qrCodePath,
    videoPath
  };
  console.log("💾 [IPC] Hologram state updated:", JSON.stringify(hologramState));
  const targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? "main window" : "hologram window";
  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is NULL - cannot send message!`);
    return { success: false, error: `${windowName} not initialized` };
  }
  if (targetWindow.isDestroyed()) {
    console.error(`❌ [IPC] ${windowName} is DESTROYED - cannot send message!`);
    return { success: false, error: `${windowName} destroyed` };
  }
  console.log(`✅ [IPC] ${windowName} exists and is not destroyed`);
  console.log("   isLoading:", targetWindow.webContents.isLoading());
  console.log("   URL:", targetWindow.webContents.getURL());
  console.log(`📤 [IPC] Sending hologram:update to ${windowName}...`);
  targetWindow.webContents.send("hologram:update", hologramState);
  console.log("✅ [IPC] Message sent successfully");
  return { success: true };
});
electron.ipcMain.handle("hologram:show-logo", async () => {
  console.log("🎭 Hologram showing logo");
  hologramState = {
    mode: "logo"
  };
  console.log("💾 Hologram state stored:", hologramState);
  const targetWindow = getHologramTargetWindow();
  if (!targetWindow) {
    return { success: false, error: "Target window not initialized" };
  }
  targetWindow.webContents.send("hologram:update", hologramState);
  return { success: true };
});
electron.ipcMain.handle("hologram:get-state", async () => {
  console.log("🎭 Hologram state requested:", hologramState);
  return { success: true, state: hologramState };
});
electron.ipcMain.handle("file:read-as-data-url", async (_event, filePath) => {
  try {
    console.log(`📂 [IPC] Reading file as data URL: ${filePath}`);
    let absolutePath = filePath;
    if (!path__namespace.isAbsolute(filePath)) {
      absolutePath = path__namespace.join(electron.app.getAppPath(), "MUT-distribution", filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }
    const fileBuffer = await fs__namespace$1.readFile(absolutePath);
    const base64 = fileBuffer.toString("base64");
    const ext = path__namespace.extname(filePath).toLowerCase();
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
electron.ipcMain.handle("file:delete", async (_event, filePath) => {
  try {
    console.log(`🗑️ [IPC] Deleting file: ${filePath}`);
    let absolutePath = filePath;
    if (!path__namespace.isAbsolute(filePath)) {
      absolutePath = path__namespace.join(electron.app.getAppPath(), "MUT-distribution", filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }
    try {
      await fs__namespace$1.access(absolutePath);
    } catch {
      console.warn(`⚠️ [IPC] File does not exist, skipping: ${absolutePath}`);
      return { success: true, skipped: true };
    }
    await fs__namespace$1.unlink(absolutePath);
    console.log(`✅ [IPC] File deleted successfully: ${absolutePath}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [IPC] Failed to delete file: ${filePath}`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});
electron.ipcMain.handle("analytics:session-start", async (_event, sessionId, startTime) => {
  recordSessionStart(sessionId, startTime);
  return { success: true };
});
electron.ipcMain.handle("analytics:session-end", async (_event, sessionId, endTime) => {
  recordSessionEnd(sessionId, endTime);
  return { success: true };
});
electron.ipcMain.handle("analytics:update-frame", async (_event, sessionId, frameName) => {
  updateSessionFrame(sessionId, frameName);
  return { success: true };
});
electron.ipcMain.handle("analytics:update-images", async (_event, sessionId, imageCount) => {
  updateSessionImages(sessionId, imageCount);
  return { success: true };
});
electron.ipcMain.handle("analytics:record-payment", async (_event, sessionId, amount, status, errorMessage, details) => {
  recordPayment(sessionId, amount, status, errorMessage, details);
  return { success: true };
});
electron.ipcMain.handle("analytics:record-print", async (_event, sessionId, imagePath, success, errorMessage) => {
  recordPrint(sessionId, imagePath, success, errorMessage);
  return { success: true };
});
electron.ipcMain.handle("analytics:get-dashboard-stats", async () => {
  const stats = getDashboardStats();
  return { success: true, stats };
});
electron.ipcMain.handle("analytics:get-flow-statistics", async () => {
  const stats = getFlowStatistics();
  return { success: true, stats };
});
electron.ipcMain.handle("analytics:insert-sample-data", async () => {
  console.log("📊 [IPC] Inserting sample data...");
  const result = insertSampleData();
  return result;
});
electron.ipcMain.handle("config:get", async () => {
  console.log("⚙️ [IPC] Getting configuration");
  try {
    const config = getConfig();
    const configPath = appConfig.getConfigPath();
    return {
      success: true,
      config,
      configPath
    };
  } catch (error) {
    console.error("❌ [IPC] Failed to get config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:update", async (_event, updates) => {
  console.log("⚙️ [IPC] Updating configuration:", updates);
  try {
    const success = appConfig.update(updates);
    if (success) {
      return { success: true, config: getConfig() };
    }
    return { success: false, error: "Failed to save config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to update config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:update-tl3600", async (_event, updates) => {
  console.log("⚙️ [IPC] Updating TL3600 configuration:", updates);
  try {
    const success = appConfig.updateTL3600(updates);
    if (success) {
      return { success: true, config: getTL3600Config() };
    }
    return { success: false, error: "Failed to save TL3600 config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to update TL3600 config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:update-payment", async (_event, updates) => {
  console.log("⚙️ [IPC] Updating payment configuration:", updates);
  try {
    const success = appConfig.updatePayment(updates);
    if (success) {
      return { success: true, config: getPaymentConfig() };
    }
    return { success: false, error: "Failed to save payment config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to update payment config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:update-camera", async (_event, updates) => {
  console.log("⚙️ [IPC] Updating camera configuration:", updates);
  try {
    const success = appConfig.updateCamera(updates);
    if (success) {
      return { success: true, config: getCameraConfig() };
    }
    return { success: false, error: "Failed to save camera config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to update camera config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:update-display", async (_event, updates) => {
  console.log("⚙️ [IPC] Updating display configuration:", updates);
  console.log("⚠️ Note: Display changes require app restart to take effect");
  try {
    const success = appConfig.updateDisplay(updates);
    if (success) {
      return { success: true, config: getConfig().display, requiresRestart: true };
    }
    return { success: false, error: "Failed to save display config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to update display config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:reset", async () => {
  console.log("⚙️ [IPC] Resetting configuration to defaults");
  try {
    const success = appConfig.reset();
    if (success) {
      return { success: true, config: getConfig() };
    }
    return { success: false, error: "Failed to reset config" };
  } catch (error) {
    console.error("❌ [IPC] Failed to reset config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("config:get-path", async () => {
  return {
    success: true,
    path: appConfig.getConfigPath()
  };
});
electron.app.on("before-quit", () => {
  closeDatabase();
});
