"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs$1 = require("fs/promises");
const child_process = require("child_process");
const events = require("events");
const fs = require("fs");
const os = require("os");
const serialport = require("serialport");
const Database = require("better-sqlite3");
const util = require("util");
const crypto = require("crypto");
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
  constructor() {
    __publicField(this, "config", DEFAULT_CONFIG);
    __publicField(this, "configPath", "");
    __publicField(this, "loaded", false);
  }
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
  // Output directory with write permissions
  constructor() {
    super();
    __publicField(this, "isProd");
    __publicField(this, "pythonPath");
    __publicField(this, "pipelineScriptPath");
    __publicField(this, "stitcherScriptPath");
    __publicField(this, "stitcherWorkingDir");
    __publicField(this, "pipelineWorkingDir");
    __publicField(this, "ffmpegPath");
    __publicField(this, "outputDir");
    this.isProd = electron.app.isPackaged;
    if (this.isProd) {
      this.pythonPath = path.join(process.resourcesPath, "python", "python.exe");
      this.pipelineScriptPath = path.join(process.resourcesPath, "python", "scripts", "pipeline.py");
      this.stitcherScriptPath = path.join(process.resourcesPath, "python", "scripts", "stitch_images.py");
      this.stitcherWorkingDir = path.join(process.resourcesPath, "python", "scripts");
      this.pipelineWorkingDir = path.join(process.resourcesPath, "python", "scripts");
      this.ffmpegPath = path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe");
      this.outputDir = path.join(electron.app.getPath("userData"), "output");
      console.log("🎬 [PythonBridge] Initialized (Production - Embedded Python)");
      console.log(`   Python: ${this.pythonPath}`);
      console.log(`   Pipeline: ${this.pipelineScriptPath}`);
      console.log(`   Stitcher: ${this.stitcherScriptPath}`);
      console.log(`   FFmpeg: ${this.ffmpegPath}`);
      console.log(`   Output dir: ${this.outputDir}`);
    } else {
      this.pythonPath = process.platform === "win32" ? "python" : "python3";
      this.pipelineScriptPath = path.join(electron.app.getAppPath(), "MUT-distribution", "pipeline.py");
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
      var _a, _b;
      const executable = this.pythonPath;
      const args = [
        this.pipelineScriptPath,
        "--input",
        options.inputVideo,
        "--frame",
        options.frameOverlay
      ];
      if (this.isProd) {
        args.push("--output-dir", this.outputDir);
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
          PYTHONUTF8: "1",
          // Pass FFmpeg path to Python scripts
          FFMPEG_PATH: this.ffmpegPath,
          // Pass AWS credentials (loaded from .env in main process)
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
          AWS_REGION: process.env.AWS_REGION || "ap-northeast-2",
          AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "mut-demo-2025"
        },
        // Hide console window on Windows
        windowsHide: true
      });
      let stdoutData = "";
      let stderrData = "";
      (_a = pipelineProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log("[Pipeline]", output);
        this.parseProgress(output);
      });
      (_b = pipelineProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
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
      if (this.isProd) {
        const frameName = path.basename(relativePath);
        frameFilesystemPath = path.join(process.resourcesPath, "frames", frameName);
        console.log(`   Frame template (production extraResources): ${frameFilesystemPath}`);
      } else {
        frameFilesystemPath = path.join(electron.app.getAppPath(), "public", relativePath);
        console.log(`   Frame template (development): ${frameFilesystemPath}`);
      }
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
      var _a, _b;
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
      const executable = this.pythonPath;
      const args = [
        this.stitcherScriptPath,
        "--images",
        ...imagePaths,
        "--output",
        outputPath,
        "--duration",
        "3.0"
      ];
      console.log(`   Command: ${executable} ${args.join(" ")}`);
      const stitchProcess = child_process.spawn(executable, args, {
        cwd: this.stitcherWorkingDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          // Pass FFmpeg path to Python scripts
          FFMPEG_PATH: this.ffmpegPath
        },
        // Hide console window on Windows
        windowsHide: true
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
            var _a;
            const ffmpegProcess = child_process.spawn(this.ffmpegPath, args);
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
   * Check if dependencies are available
   */
  async checkDependencies() {
    const fs2 = await import("fs");
    if (this.isProd) {
      const pythonExists = fs2.existsSync(this.pythonPath);
      const pipelineExists = fs2.existsSync(this.pipelineScriptPath);
      const stitcherExists = fs2.existsSync(this.stitcherScriptPath);
      const ffmpegExists = fs2.existsSync(this.ffmpegPath);
      const missing = [];
      if (!pythonExists) missing.push("python.exe");
      if (!pipelineExists) missing.push("pipeline.py");
      if (!stitcherExists) missing.push("stitch_images.py");
      if (!ffmpegExists) missing.push("ffmpeg.exe");
      if (missing.length === 0) {
        console.log("Bundled Python environment found");
        console.log(`   Python: ${this.pythonPath}`);
        console.log(`   Pipeline: ${this.pipelineScriptPath}`);
        console.log(`   Stitcher: ${this.stitcherScriptPath}`);
        console.log(`   FFmpeg: ${this.ffmpegPath}`);
        return { available: true };
      } else {
        return {
          available: false,
          error: `Missing bundled files: ${missing.join(", ")}`
        };
      }
    } else {
      return new Promise((resolve) => {
        var _a;
        const checkProcess = child_process.spawn(this.pythonPath, ["--version"]);
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
}
class CameraController extends events.EventEmitter {
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
    this.captureDir = config.captureDir ?? path__namespace.join(process.cwd(), "captures");
    if (!fs__namespace.existsSync(this.captureDir)) {
      fs__namespace.mkdirSync(this.captureDir, { recursive: true });
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
      var _a, _b;
      const process2 = child_process.spawn("gphoto2", args);
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
      var _a, _b;
      const process2 = child_process.spawn(command, args);
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
class PrinterController extends events.EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "mockMode");
    __publicField(this, "printerName");
    __publicField(this, "currentJob", null);
    __publicField(this, "mockPaperLevel", 100);
    __publicField(this, "isWindows");
    __publicField(this, "mockInkLevels", {
      cyan: 85,
      magenta: 90,
      yellow: 75,
      black: 88
    });
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
      var _a, _b;
      const [command, ...cmdArgs] = args;
      const process2 = child_process.spawn(command, cmdArgs);
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
function buildCancelRequestData(cancelType, transactionType, amount, tax, serviceCharge, installment, signature, approvalNumber, originalDate, originalTime, additionalInfo) {
  const additionalInfoLength = 0;
  const additionalInfoLengthStr = additionalInfoLength.toString().padStart(2, "0");
  const totalLength = 59 + additionalInfoLength;
  const data = Buffer.alloc(totalLength);
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
  data.write(additionalInfoLengthStr, offset, 2, "ascii");
  offset += 2;
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
  constructor(config) {
    super();
    __publicField(this, "port", null);
    __publicField(this, "portPath");
    __publicField(this, "baudRate");
    __publicField(this, "isConnected", false);
    __publicField(this, "receiveBuffer", Buffer.alloc(0));
    __publicField(this, "pendingResponse", null);
    this.portPath = config.port;
    this.baudRate = config.baudRate || SERIAL_CONFIG.BAUD_RATE;
  }
  /**
   * Connect to serial port
   */
  async connect() {
    var _a;
    if (this.isConnected && ((_a = this.port) == null ? void 0 : _a.isOpen)) {
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
    var _a;
    if (this.pendingResponse) {
      clearTimeout(this.pendingResponse.timeout);
      this.pendingResponse.reject(new Error("Disconnecting"));
      this.pendingResponse = null;
    }
    if ((_a = this.port) == null ? void 0 : _a.isOpen) {
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
    var _a;
    return this.isConnected && (((_a = this.port) == null ? void 0 : _a.isOpen) ?? false);
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
    var _a;
    if ((_a = this.port) == null ? void 0 : _a.isOpen) {
      await this.writeToPort(Buffer.from([ACK]));
      console.log(`📤 [TL3600] ACK sent`);
    }
  }
  /**
   * Send NACK
   */
  async sendNack() {
    var _a;
    if ((_a = this.port) == null ? void 0 : _a.isOpen) {
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
      var _a;
      if (!((_a = this.port) == null ? void 0 : _a.isOpen)) {
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
  constructor(config) {
    super();
    __publicField(this, "serial");
    __publicField(this, "terminalId");
    __publicField(this, "isConnected", false);
    __publicField(this, "isInPaymentMode", false);
    __publicField(this, "currentPaymentRequest", null);
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
    const amount = (request == null ? void 0 : request.amount) ?? PAYMENT_DEFAULTS.AMOUNT;
    const tax = (request == null ? void 0 : request.tax) ?? PAYMENT_DEFAULTS.TAX;
    const serviceCharge = (request == null ? void 0 : request.serviceCharge) ?? PAYMENT_DEFAULTS.SERVICE_CHARGE;
    const installment = (request == null ? void 0 : request.installment) ?? PAYMENT_DEFAULTS.INSTALLMENT;
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
    if (result.response.header.jobCode === JobCode.CARD_INQUIRY_RESPONSE) {
      console.error(`❌ [TL3600] Card inquiry response received - no cancellable transaction`);
      const cardInfo = parseCardInquiryResponse(result.response.data);
      if (cardInfo.transactionStatus === "0") {
        return { success: false, error: "취소 가능한 거래 내역이 없습니다" };
      } else if (cardInfo.transactionStatus === "X") {
        return { success: false, error: "이미 취소된 거래입니다" };
      }
      return { success: false, error: "취소할 수 없는 카드입니다" };
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
  constructor(config = {}) {
    super();
    __publicField(this, "mockMode");
    __publicField(this, "mockApprovalRate");
    __publicField(this, "readerPort");
    __publicField(this, "terminalId");
    __publicField(this, "isConnected", false);
    __publicField(this, "currentTransaction", null);
    __publicField(this, "timeoutTimer", null);
    // TL3600 controller (for real hardware mode)
    __publicField(this, "tl3600", null);
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
    var _a;
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
        transactionId: (_a = result.response) == null ? void 0 : _a.transactionId,
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
    (details == null ? void 0 : details.approvalNumber) || null,
    (details == null ? void 0 : details.salesDate) || null,
    (details == null ? void 0 : details.salesTime) || null,
    (details == null ? void 0 : details.transactionMedia) || null,
    (details == null ? void 0 : details.cardNumber) || null
  );
  console.log(`📊 [Analytics] Payment recorded: ${sessionId} - ${status} - ${amount}원 (approval: ${(details == null ? void 0 : details.approvalNumber) || "N/A"})`);
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
let _store = null;
function getStore() {
  if (!_store) {
    const Store = require("electron-store");
    _store = new Store({
      name: "cloud-credentials"
    });
  }
  return _store;
}
const store = {
  get: (key) => getStore().get(key),
  set: (key, value) => getStore().set(key, value),
  delete: (key) => getStore().delete(key),
  clear: () => getStore().clear()
};
const INVALID_TOKEN_ERRORS = ["INVALID_TOKEN", "TOKEN_EXPIRED", "MACHINE_NOT_FOUND", "UNAUTHORIZED"];
const _CloudClient = class _CloudClient extends events.EventEmitter {
  constructor(config) {
    super();
    __publicField(this, "config");
    __publicField(this, "offlineQueue", []);
    __publicField(this, "isOnline", true);
    __publicField(this, "isReregistering", false);
    this.config = config;
  }
  static getInstance(config) {
    if (!_CloudClient.instance) {
      if (!config) {
        throw new Error("CloudClient must be initialized with config first");
      }
      _CloudClient.instance = new _CloudClient(config);
    }
    return _CloudClient.instance;
  }
  static initialize(config) {
    _CloudClient.instance = new _CloudClient(config);
    return _CloudClient.instance;
  }
  // =========================================
  // Token Management
  // =========================================
  getStoredToken() {
    const token = store.get("machineToken");
    const expiresAt = store.get("tokenExpiresAt");
    if (!token || !expiresAt) return null;
    if (new Date(expiresAt).getTime() - 36e5 < Date.now()) {
      return null;
    }
    return token;
  }
  storeToken(token, machineId, expiresAt) {
    store.set("machineToken", token);
    store.set("machineId", machineId);
    store.set("tokenExpiresAt", expiresAt);
  }
  getMachineId() {
    return store.get("machineId");
  }
  isRegistered() {
    return !!this.getStoredToken();
  }
  clearCredentials() {
    store.delete("machineToken");
    store.delete("machineId");
    store.delete("tokenExpiresAt");
  }
  /**
   * Clear all stored data including hardware info
   * Use this for complete reset
   */
  clearAllData() {
    store.clear();
  }
  /**
   * Get stored hardware info for re-registration
   */
  getStoredHardwareInfo() {
    return {
      hardwareId: store.get("hardwareId"),
      hardwareInfo: store.get("hardwareInfo")
    };
  }
  /**
   * Store hardware info for future re-registration
   */
  storeHardwareInfo(hardwareId, hardwareInfo) {
    store.set("hardwareId", hardwareId);
    if (hardwareInfo) {
      store.set("hardwareInfo", hardwareInfo);
    }
  }
  // =========================================
  // HTTP Methods
  // =========================================
  async request(method, path2, body, requiresAuth = true, isRetryAfterReregister = false) {
    const url = `${this.config.apiUrl}${path2}`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (requiresAuth) {
      const token = this.getStoredToken();
      if (!token) {
        if (!isRetryAfterReregister) {
          const reregistered = await this.attemptReregistration();
          if (reregistered) {
            return this.request(method, path2, body, requiresAuth, true);
          }
        }
        return {
          success: false,
          error: { code: "NO_TOKEN", message: "Not authenticated" }
        };
      }
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const response = await this.fetchWithRetry(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0
      });
      const data = await response.json();
      this.isOnline = true;
      if (!data.success && data.error && this.isInvalidTokenError(data.error.code)) {
        console.log("\n🔄 ═══════════════════════════════════════════════════");
        console.log("🔄  TOKEN INVALID - Attempting automatic re-registration");
        console.log(`🔄  Error: ${data.error.code} - ${data.error.message}`);
        console.log("🔄 ═══════════════════════════════════════════════════\n");
        if (!isRetryAfterReregister) {
          const reregistered = await this.attemptReregistration();
          if (reregistered) {
            return this.request(method, path2, body, requiresAuth, true);
          }
        }
      }
      return data;
    } catch (error) {
      this.isOnline = false;
      if (requiresAuth) {
        this.offlineQueue.push({ method, path: path2, body });
      }
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error"
        }
      };
    }
  }
  /**
   * Check if error code indicates an invalid/expired token
   */
  isInvalidTokenError(code) {
    return INVALID_TOKEN_ERRORS.includes(code) || code.toLowerCase().includes("invalid") || code.toLowerCase().includes("expired") || code.toLowerCase().includes("unauthorized");
  }
  /**
   * Attempt to re-register with stored hardware info
   */
  async attemptReregistration() {
    var _a;
    if (this.isReregistering) {
      console.log("[CloudClient] Re-registration already in progress, waiting...");
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isReregistering) {
            clearInterval(checkInterval);
            resolve(this.isRegistered());
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 1e4);
      });
    }
    this.isReregistering = true;
    try {
      const { hardwareId, hardwareInfo } = this.getStoredHardwareInfo();
      if (!hardwareId) {
        console.log("[CloudClient] No stored hardware info for re-registration");
        return false;
      }
      console.log("[CloudClient] Clearing old credentials...");
      this.clearCredentials();
      console.log("[CloudClient] Re-registering with stored hardware info...");
      const result = await this.register(hardwareId, hardwareInfo || void 0);
      if (result.success) {
        console.log("\n✅ ═══════════════════════════════════════════════════");
        console.log("✅  AUTO RE-REGISTRATION SUCCESSFUL");
        console.log(`✅  New Machine ID: ${(_a = result.data) == null ? void 0 : _a.machineId}`);
        console.log("✅ ═══════════════════════════════════════════════════\n");
        this.emit("reregistered", result.data);
        return true;
      } else {
        console.error("[CloudClient] Re-registration failed:", result.error);
        return false;
      }
    } catch (error) {
      console.error("[CloudClient] Re-registration error:", error);
      return false;
    } finally {
      this.isReregistering = false;
    }
  }
  /**
   * Listen for re-registration events
   */
  onReregistered(callback) {
    this.on("reregistered", callback);
    return () => this.off("reregistered", callback);
  }
  async fetchWithRetry(url, options, retries = 3, delay = 1e3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || response.status < 500) {
          return response;
        }
        if (i < retries - 1) {
          await this.sleep(delay * Math.pow(2, i));
        }
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(delay * Math.pow(2, i));
      }
    }
    throw new Error("Max retries exceeded");
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  // =========================================
  // Public API Methods
  // =========================================
  async register(hardwareId, hardwareInfo) {
    this.storeHardwareInfo(hardwareId, hardwareInfo);
    const response = await this.request(
      "POST",
      "/machines/register",
      {
        hardwareId,
        apiKey: this.config.apiKey,
        hardwareInfo
      },
      false
      // No auth required for registration
    );
    if (response.success && response.data) {
      this.storeToken(
        response.data.machineToken,
        response.data.machineId,
        response.data.expiresAt
      );
    }
    return response;
  }
  async getConfig(currentVersion) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    const query = currentVersion ? `?currentVersion=${currentVersion}` : "";
    return this.request("GET", `/machines/${machineId}/config${query}`);
  }
  async sendLogs(logs) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("POST", `/machines/${machineId}/logs`, { logs });
  }
  async sendHeartbeat(status) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("POST", `/machines/${machineId}/heartbeat`, status);
  }
  async getPendingCommands() {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("GET", `/machines/${machineId}/commands/pending`);
  }
  async acknowledgeCommand(commandId, ack) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("POST", `/machines/${machineId}/commands/${commandId}/ack`, ack);
  }
  async createSession(session) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("POST", `/machines/${machineId}/sessions`, session);
  }
  async updateSession(sessionId, update) {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: "NOT_REGISTERED", message: "Machine not registered" } };
    }
    return this.request("PATCH", `/machines/${machineId}/sessions/${sessionId}`, update);
  }
  // =========================================
  // Offline Queue
  // =========================================
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    for (const item of queue) {
      await this.request(item.method, item.path, item.body);
    }
  }
  getOnlineStatus() {
    return this.isOnline;
  }
};
__publicField(_CloudClient, "instance");
let CloudClient = _CloudClient;
const CONFIG_SYNC_INTERVAL = 6e4;
class ConfigSyncManager extends events.EventEmitter {
  constructor(client) {
    super();
    __publicField(this, "client");
    __publicField(this, "cloudVersion", "unknown");
    __publicField(this, "syncInterval", null);
    __publicField(this, "initialized", false);
    this.client = client;
  }
  async initialize() {
    if (this.initialized) {
      return appConfig.get();
    }
    await this.sync();
    this.startPeriodicSync();
    this.initialized = true;
    return appConfig.get();
  }
  async sync() {
    var _a;
    try {
      const response = await this.client.getConfig(this.cloudVersion);
      if (!response.success) {
        console.warn("[ConfigSync] Failed to sync:", response.error);
        return false;
      }
      if (!((_a = response.data) == null ? void 0 : _a.changed)) {
        return false;
      }
      if (response.data.config) {
        const cloudConfig = response.data.config;
        const oldVersion = this.cloudVersion;
        this.cloudVersion = response.data.version;
        const localUpdates = this.mapCloudToLocal(cloudConfig);
        const oldConfig = appConfig.get();
        appConfig.update(localUpdates);
        const newConfig = appConfig.get();
        console.log("\n" + "=".repeat(60));
        console.log("☁️  CLOUD CONFIG CHANGE DETECTED");
        console.log("=".repeat(60));
        console.log(`📦 Version: ${oldVersion} → ${this.cloudVersion}`);
        console.log(`⏰ Time: ${(/* @__PURE__ */ new Date()).toLocaleString()}`);
        console.log("-".repeat(60));
        const isInitialSync = oldVersion === "unknown" || oldVersion === "default";
        if (isInitialSync) {
          console.log("\n🆕 INITIAL SYNC - Cloud config received:");
          this.logCloudConfig(cloudConfig);
        } else {
          let hasChanges = false;
          hasChanges = this.logConfigChanges("camera", oldConfig.camera, newConfig.camera) || hasChanges;
          hasChanges = this.logConfigChanges("payment", oldConfig.payment, newConfig.payment) || hasChanges;
          hasChanges = this.logConfigChanges("tl3600", oldConfig.tl3600, newConfig.tl3600) || hasChanges;
          hasChanges = this.logConfigChanges("display", oldConfig.display, newConfig.display) || hasChanges;
          hasChanges = this.logConfigChanges("demo", oldConfig.demo, newConfig.demo) || hasChanges;
          hasChanges = this.logConfigChanges("debug", oldConfig.debug, newConfig.debug) || hasChanges;
          hasChanges = this.logConfigChanges("printer", oldConfig.printer, newConfig.printer) || hasChanges;
          if (!hasChanges) {
            console.log("\n📋 No field-level changes detected (config structure update)");
          }
        }
        console.log("\n" + "=".repeat(60));
        console.log("✅ Config applied successfully");
        console.log("=".repeat(60) + "\n");
        this.emit("change", newConfig, oldConfig);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[ConfigSync] Sync error:", error);
      return false;
    }
  }
  /**
   * Log changes between old and new config sections
   * Returns true if changes were found
   */
  logConfigChanges(section, oldVal, newVal) {
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      return false;
    }
    console.log(`
📝 [${section.toUpperCase()}] Changes:`);
    if (typeof oldVal === "object" && oldVal && typeof newVal === "object" && newVal) {
      const oldObj = oldVal;
      const newObj = newVal;
      const allKeys = /* @__PURE__ */ new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      for (const key of allKeys) {
        const oldValue = oldObj[key];
        const newValue = newObj[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const oldDisplay = typeof oldValue === "object" ? JSON.stringify(oldValue) : oldValue;
          const newDisplay = typeof newValue === "object" ? JSON.stringify(newValue) : newValue;
          console.log(`   • ${key}: ${oldDisplay} → ${newDisplay}`);
        }
      }
    } else {
      console.log(`   • ${section}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
    }
    return true;
  }
  /**
   * Log the full cloud config for initial sync
   */
  logCloudConfig(cloud) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
    console.log("\n📷 [CAMERA]");
    console.log(`   • type: ${(_a = cloud.camera) == null ? void 0 : _a.type}`);
    console.log(`   • resolution: ${(_c = (_b = cloud.camera) == null ? void 0 : _b.resolution) == null ? void 0 : _c.width}x${(_e = (_d = cloud.camera) == null ? void 0 : _d.resolution) == null ? void 0 : _e.height}`);
    console.log(`   • captureCount: ${(_f = cloud.camera) == null ? void 0 : _f.captureCount}`);
    console.log("\n💳 [PAYMENT]");
    console.log(`   • enabled: ${(_g = cloud.payment) == null ? void 0 : _g.enabled}`);
    console.log(`   • mockMode: ${(_h = cloud.payment) == null ? void 0 : _h.mockMode}`);
    console.log(`   • defaultPrice: ${(_i = cloud.payment) == null ? void 0 : _i.defaultPrice} ${(_j = cloud.payment) == null ? void 0 : _j.currency}`);
    console.log("\n🖥️  [DISPLAY]");
    console.log(`   • splitScreenMode: ${(_k = cloud.display) == null ? void 0 : _k.splitScreenMode}`);
    console.log(`   • mainSize: ${(_l = cloud.display) == null ? void 0 : _l.mainWidth}x${(_m = cloud.display) == null ? void 0 : _m.mainHeight}`);
    console.log(`   • language: ${(_n = cloud.display) == null ? void 0 : _n.language}`);
    console.log("\n🖨️  [PRINTER]");
    console.log(`   • enabled: ${(_o = cloud.printer) == null ? void 0 : _o.enabled}`);
    console.log(`   • mockMode: ${(_p = cloud.printer) == null ? void 0 : _p.mockMode}`);
    console.log(`   • paperSize: ${(_q = cloud.printer) == null ? void 0 : _q.paperSize}`);
    console.log("\n⚙️  [PROCESSING]");
    console.log(`   • mode: ${(_r = cloud.processing) == null ? void 0 : _r.mode}`);
    console.log(`   • quality: ${(_s = cloud.processing) == null ? void 0 : _s.quality}`);
    console.log(`   • faceEnhancement: ${(_t = cloud.processing) == null ? void 0 : _t.faceEnhancement}`);
    console.log("\n🔧 [DEBUG]");
    console.log(`   • enableLogging: ${(_u = cloud.debug) == null ? void 0 : _u.enableLogging}`);
    console.log(`   • logLevel: ${(_v = cloud.debug) == null ? void 0 : _v.logLevel}`);
  }
  /**
   * Map cloud config schema to local AppConfig schema
   */
  mapCloudToLocal(cloud) {
    const local = {};
    if (cloud.camera) {
      local.camera = {
        useWebcam: cloud.camera.type === "webcam",
        mockMode: false
        // Preserve local value
      };
    }
    if (cloud.payment) {
      local.payment = {
        useMockMode: cloud.payment.mockMode,
        defaultAmount: cloud.payment.defaultPrice,
        mockApprovalRate: 0.8
        // Preserve local default
      };
    }
    if (cloud.tl3600) {
      local.tl3600 = {
        port: cloud.tl3600.port,
        terminalId: cloud.tl3600.terminalId,
        timeout: cloud.tl3600.timeout || 3e3,
        retryCount: cloud.tl3600.retryCount || 3
      };
    }
    if (cloud.display) {
      local.display = {
        splitScreenMode: cloud.display.splitScreenMode,
        swapDisplays: cloud.display.swapDisplays || false,
        mainWidth: cloud.display.mainWidth || 1080,
        mainHeight: cloud.display.mainHeight || 1920,
        hologramWidth: cloud.display.hologramWidth || 1080,
        hologramHeight: cloud.display.hologramHeight || 1920
      };
    }
    if (cloud.demo) {
      local.demo = {
        enabled: cloud.demo.enabled,
        videoPath: cloud.demo.videoPath || ""
      };
    }
    if (cloud.debug) {
      local.debug = {
        enableLogging: cloud.debug.enableLogging,
        logLevel: cloud.debug.logLevel || "info",
        logToFile: cloud.debug.logToFile || false,
        logFilePath: cloud.debug.logFilePath || ""
      };
    }
    if (cloud.printer) {
      local.printer = {
        mockMode: cloud.printer.mockMode
      };
    }
    return local;
  }
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(async () => {
      const changed = await this.sync();
      if (changed) {
        console.log("[ConfigSync] Periodic sync detected changes");
      }
    }, CONFIG_SYNC_INTERVAL);
  }
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  getCloudVersion() {
    return this.cloudVersion;
  }
  onChange(callback) {
    this.on("change", callback);
    return () => this.off("change", callback);
  }
}
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
const FLUSH_INTERVAL = 1e4;
const MAX_QUEUE_SIZE = 100;
const MAX_LOCAL_QUEUE_SIZE = 1e3;
class LogStreamer {
  constructor(client, options) {
    __publicField(this, "client");
    __publicField(this, "queue", []);
    __publicField(this, "minLevel", "info");
    __publicField(this, "flushInterval", null);
    __publicField(this, "isShuttingDown", false);
    __publicField(this, "consoleOutput", true);
    this.client = client;
    if (options == null ? void 0 : options.minLevel) this.minLevel = options.minLevel;
    if ((options == null ? void 0 : options.consoleOutput) !== void 0) this.consoleOutput = options.consoleOutput;
    this.startFlushInterval();
  }
  // =========================================
  // Logging Methods
  // =========================================
  log(level, category, message, metadata) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }
    const entry = {
      level,
      category,
      message,
      metadata,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.consoleOutput) {
      this.outputToConsole(entry);
    }
    this.queue.push(entry);
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.flush();
    }
  }
  debug(category, message, metadata) {
    this.log("debug", category, message, metadata);
  }
  info(category, message, metadata) {
    this.log("info", category, message, metadata);
  }
  warn(category, message, metadata) {
    this.log("warn", category, message, metadata);
  }
  error(category, message, metadata) {
    this.log("error", category, message, metadata);
  }
  // =========================================
  // Console Output
  // =========================================
  outputToConsole(entry) {
    const icons = {
      debug: "🔍",
      info: "📋",
      warn: "⚠️",
      error: "❌"
    };
    const categoryIcons = {
      system: "💻",
      camera: "📷",
      printer: "🖨️",
      payment: "💳",
      processing: "⚙️",
      session: "🎬",
      cloud: "☁️",
      command: "📡"
    };
    const icon = icons[entry.level];
    const catIcon = categoryIcons[entry.category] || "📌";
    const prefix = `${icon} [${entry.category.toUpperCase()}] ${catIcon}`;
    switch (entry.level) {
      case "debug":
        console.debug(prefix, entry.message, entry.metadata || "");
        break;
      case "info":
        console.info(prefix, entry.message, entry.metadata || "");
        break;
      case "warn":
        console.warn(prefix, entry.message, entry.metadata || "");
        break;
      case "error":
        console.error(prefix, entry.message, entry.metadata || "");
        break;
    }
  }
  // =========================================
  // Flush Logic
  // =========================================
  startFlushInterval() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL);
  }
  async flush() {
    if (this.queue.length === 0) return;
    const logsToSend = this.queue.splice(0, MAX_QUEUE_SIZE);
    try {
      const response = await this.client.sendLogs(logsToSend);
      if (!response.success) {
        if (this.queue.length < MAX_LOCAL_QUEUE_SIZE) {
          this.queue.unshift(...logsToSend);
        }
        console.warn("[LogStreamer] Failed to send logs:", response.error);
      }
    } catch (error) {
      if (this.queue.length < MAX_LOCAL_QUEUE_SIZE) {
        this.queue.unshift(...logsToSend);
      }
      console.warn("[LogStreamer] Error sending logs:", error);
    }
  }
  // =========================================
  // Lifecycle
  // =========================================
  async shutdown() {
    this.isShuttingDown = true;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.queue.length > 0) {
      await this.flush();
    }
  }
  setMinLevel(level) {
    this.minLevel = level;
  }
  getQueueSize() {
    return this.queue.length;
  }
}
let loggerInstance = null;
function initializeLogger(client, options) {
  loggerInstance = new LogStreamer(client, options);
  return loggerInstance;
}
function getLogger() {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger first.");
  }
  return loggerInstance;
}
const SYNC_INTERVAL = 3e4;
class SessionSyncManager {
  constructor(client) {
    __publicField(this, "client");
    __publicField(this, "db", null);
    __publicField(this, "syncInterval", null);
    __publicField(this, "isSyncing", false);
    this.client = client;
  }
  getDb() {
    if (!this.db) {
      const dbPath = path__namespace.join(electron.app.getPath("userData"), "analytics.db");
      this.db = new Database(dbPath);
    }
    return this.db;
  }
  /**
   * Initialize sync manager and start periodic sync
   */
  async initialize() {
    this.ensureSyncColumns();
    this.startPeriodicSync();
  }
  /**
   * Add cloud_synced and cloud_session_id columns to sessions table
   */
  ensureSyncColumns() {
    const db2 = this.getDb();
    try {
      db2.exec(`ALTER TABLE sessions ADD COLUMN cloud_synced INTEGER DEFAULT 0`);
    } catch (e) {
    }
    try {
      db2.exec(`ALTER TABLE sessions ADD COLUMN cloud_session_id TEXT`);
    } catch (e) {
    }
  }
  /**
   * Sync unsynced sessions to cloud
   */
  async syncToCloud() {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }
    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    try {
      const db2 = this.getDb();
      const unsyncedSessions = db2.prepare(`
        SELECT * FROM sessions
        WHERE cloud_synced = 0
        AND completed = 1
        ORDER BY start_time ASC
        LIMIT 50
      `).all();
      for (const session of unsyncedSessions) {
        try {
          const payment = db2.prepare(`
            SELECT * FROM payments WHERE session_id = ?
          `).get(session.session_id);
          const cloudData = this.mapToCloudFormat(session, payment);
          if (!session.cloud_session_id) {
            const response = await this.client.createSession({
              sessionCode: session.session_id,
              // Use session_id as session code
              frameId: session.frame_selected
            });
            if (response.success && response.data) {
              await this.client.updateSession(response.data.sessionId, cloudData);
              db2.prepare(`
                UPDATE sessions
                SET cloud_synced = 1, cloud_session_id = ?
                WHERE id = ?
              `).run(response.data.sessionId, session.id);
              synced++;
            } else {
              failed++;
            }
          } else {
            await this.client.updateSession(session.cloud_session_id, cloudData);
            db2.prepare(`UPDATE sessions SET cloud_synced = 1 WHERE id = ?`).run(session.id);
            synced++;
          }
        } catch (error) {
          console.error(`[SessionSync] Failed to sync session ${session.session_id}:`, error);
          failed++;
        }
      }
    } finally {
      this.isSyncing = false;
    }
    if (synced > 0) {
      console.log(`[SessionSync] Synced ${synced} sessions to cloud`);
    }
    return { synced, failed };
  }
  /**
   * Map local session to cloud API format
   * NOTE: Local schema uses different field names than cloud
   */
  mapToCloudFormat(session, payment) {
    return {
      status: session.completed ? "completed" : "started",
      processingTimeMs: session.duration_seconds ? session.duration_seconds * 1e3 : void 0,
      completedAt: session.end_time ? new Date(session.end_time).toISOString() : void 0,
      // Payment details
      paymentAmount: payment == null ? void 0 : payment.amount,
      currency: "KRW",
      // TL3600 Payment Details
      approvalNumber: payment == null ? void 0 : payment.approval_number,
      salesDate: payment == null ? void 0 : payment.sales_date,
      salesTime: payment == null ? void 0 : payment.sales_time,
      transactionMedia: payment == null ? void 0 : payment.transaction_media,
      cardNumber: payment == null ? void 0 : payment.card_number
    };
  }
  /**
   * Sync a specific session immediately (call after completion)
   */
  async syncSession(sessionId) {
    const db2 = this.getDb();
    const session = db2.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `).get(sessionId);
    if (!session) {
      return false;
    }
    const payment = db2.prepare(`
      SELECT * FROM payments WHERE session_id = ?
    `).get(sessionId);
    try {
      const cloudData = this.mapToCloudFormat(session, payment);
      if (!session.cloud_session_id) {
        const response = await this.client.createSession({
          sessionCode: session.session_id,
          frameId: session.frame_selected
        });
        if (response.success && response.data) {
          await this.client.updateSession(response.data.sessionId, cloudData);
          db2.prepare(`
            UPDATE sessions
            SET cloud_synced = 1, cloud_session_id = ?
            WHERE id = ?
          `).run(response.data.sessionId, session.id);
          return true;
        }
      } else {
        await this.client.updateSession(session.cloud_session_id, cloudData);
        db2.prepare(`UPDATE sessions SET cloud_synced = 1 WHERE id = ?`).run(session.id);
        return true;
      }
    } catch (error) {
      console.error(`[SessionSync] Failed to sync session ${sessionId}:`, error);
    }
    return false;
  }
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(async () => {
      await this.syncToCloud();
    }, SYNC_INTERVAL);
  }
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  /**
   * Get sync status
   */
  getSyncStatus() {
    const db2 = this.getDb();
    const pending = db2.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE cloud_synced = 0 AND completed = 1
    `).get();
    const synced = db2.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE cloud_synced = 1
    `).get();
    return {
      pending: (pending == null ? void 0 : pending.count) || 0,
      synced: (synced == null ? void 0 : synced.count) || 0
    };
  }
  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.stopPeriodicSync();
  }
}
const POLL_INTERVAL = 3e4;
class CommandHandler {
  constructor(client, logger) {
    __publicField(this, "client");
    __publicField(this, "handlers", /* @__PURE__ */ new Map());
    __publicField(this, "pollInterval", null);
    __publicField(this, "isPolling", false);
    __publicField(this, "logger", null);
    this.client = client;
    this.logger = logger || null;
    this.registerDefaultHandlers();
  }
  // =========================================
  // Handler Registration
  // =========================================
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }
  registerDefaultHandlers() {
    this.registerHandler("restart", async (payload) => {
      const delay = payload.delay || 3e3;
      this.log("info", "command", `Restarting app in ${delay}ms`);
      setTimeout(() => {
        electron.app.relaunch();
        electron.app.exit(0);
      }, delay);
      return { success: true, data: { scheduledRestart: true, delay } };
    });
    this.registerHandler("force-idle", async () => {
      this.log("info", "command", "Forcing return to idle screen");
      const mainWindow2 = electron.BrowserWindow.getAllWindows()[0];
      if (mainWindow2) {
        mainWindow2.webContents.send("command:force-idle");
      }
      return { success: true };
    });
    this.registerHandler("clear-cache", async (payload) => {
      const types = payload.types || ["all"];
      this.log("info", "command", "Clearing cache", { types });
      return { success: true, data: { clearedTypes: types } };
    });
  }
  log(level, category, message, metadata) {
    if (this.logger) {
      this.logger[level](category, message, metadata);
    } else {
      console[level](`[${category}] ${message}`, metadata || "");
    }
  }
  // =========================================
  // Polling
  // =========================================
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.poll();
    this.pollInterval = setInterval(() => {
      this.poll();
    }, POLL_INTERVAL);
  }
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
  async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const response = await this.client.getPendingCommands();
      if (!response.success || !response.data) {
        return;
      }
      const { commands } = response.data;
      if (commands.length === 0) {
        return;
      }
      this.log("info", "command", `Received ${commands.length} pending commands`);
      for (const command of commands) {
        await this.executeCommand(command);
      }
    } catch (error) {
      this.log("warn", "command", "Error polling for commands", { error });
    } finally {
      this.isPolling = false;
    }
  }
  // =========================================
  // Command Execution
  // =========================================
  async executeCommand(command) {
    this.log("info", "command", `Executing command: ${command.type}`, {
      commandId: command.id,
      payload: command.payload
    });
    await this.client.acknowledgeCommand(command.id, { status: "received" });
    const handler = this.handlers.get(command.type);
    if (!handler) {
      this.log("warn", "command", `Unknown command type: ${command.type}`);
      await this.client.acknowledgeCommand(command.id, {
        status: "failed",
        errorMessage: `Unknown command type: ${command.type}`
      });
      return;
    }
    try {
      const result = await handler(command.payload);
      await this.client.acknowledgeCommand(command.id, {
        status: result.success ? "completed" : "failed",
        result: result.data,
        errorMessage: result.error
      });
      this.log("info", "command", `Command ${command.type} ${result.success ? "completed" : "failed"}`, {
        commandId: command.id
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.client.acknowledgeCommand(command.id, {
        status: "failed",
        errorMessage
      });
      this.log("error", "command", `Command ${command.type} threw error`, {
        commandId: command.id,
        error: errorMessage
      });
    }
  }
  // =========================================
  // External Handler Registration
  // =========================================
  setConfigUpdateHandler(handler) {
    this.registerHandler("update-config", async () => {
      console.log("\n🎯 ═══════════════════════════════════════════════════");
      console.log("🎯  COMMAND RECEIVED: update-config");
      console.log("🎯  Source: Cloud Dashboard");
      console.log("🎯  Time:", (/* @__PURE__ */ new Date()).toLocaleString());
      console.log("🎯  Executing config sync...");
      console.log("🎯 ═══════════════════════════════════════════════════\n");
      const success = await handler();
      if (success) {
        console.log("🎯 ✅ Config update command completed successfully\n");
      } else {
        console.log("🎯 ⚠️  Config update command: no changes detected\n");
      }
      return { success };
    });
  }
  setScreenshotHandler(handler) {
    this.registerHandler("capture-screenshot", async () => {
      const screenshotPath = await handler();
      return { success: true, data: { path: screenshotPath } };
    });
  }
  setDiagnosticsHandler(handler) {
    this.registerHandler("run-diagnostics", async (payload) => {
      const tests = payload.tests || ["all"];
      const results = await handler(tests);
      return { success: true, data: results };
    });
  }
}
const HEARTBEAT_INTERVAL = 6e4;
class HeartbeatManager {
  constructor(client, configSync2, logger) {
    __publicField(this, "client");
    __publicField(this, "configSync");
    __publicField(this, "interval", null);
    __publicField(this, "status", "online");
    __publicField(this, "peripheralStatus", {
      camera: "offline",
      printer: "offline",
      cardReader: "offline"
    });
    __publicField(this, "startTime");
    __publicField(this, "sessionsToday", 0);
    __publicField(this, "onConfigUpdateAvailable");
    __publicField(this, "configVersion", "unknown");
    __publicField(this, "logger", null);
    this.client = client;
    this.configSync = configSync2 || null;
    this.logger = logger || null;
    this.startTime = Date.now();
  }
  log(level, category, message, metadata) {
    if (this.logger) {
      this.logger[level](category, message, metadata);
    } else {
      console[level](`[${category}] ${message}`, metadata || "");
    }
  }
  // =========================================
  // Lifecycle
  // =========================================
  start() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.sendHeartbeat();
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
    this.log("info", "system", "Heartbeat manager started");
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.log("info", "system", "Heartbeat manager stopped");
  }
  // =========================================
  // Heartbeat
  // =========================================
  async sendHeartbeat() {
    try {
      const metrics = await this.collectMetrics();
      const uptime = Math.floor((Date.now() - this.startTime) / 1e3);
      if (this.configSync) {
        this.configVersion = this.configSync.getCloudVersion();
      }
      const response = await this.client.sendHeartbeat({
        status: this.status,
        configVersion: this.configVersion,
        uptime,
        peripheralStatus: this.peripheralStatus,
        metrics
      });
      if (response.success && response.data) {
        if (response.data.configUpdateAvailable && this.onConfigUpdateAvailable) {
          console.log("\n🔔 ═══════════════════════════════════════════════════");
          console.log("🔔  CLOUD SERVER: Config Update Available!");
          console.log("🔔  Server Time:", response.data.serverTime);
          console.log("🔔  Triggering config sync...");
          console.log("🔔 ═══════════════════════════════════════════════════\n");
          this.onConfigUpdateAvailable();
        }
      } else {
        this.log("warn", "cloud", "Heartbeat failed", { error: response.error });
      }
    } catch (error) {
      this.log("warn", "cloud", "Error sending heartbeat", { error });
    }
  }
  async collectMetrics() {
    const cpus = os__namespace.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuUsage = Math.round(100 - totalIdle / totalTick * 100);
    const totalMem = os__namespace.totalmem();
    const freeMem = os__namespace.freemem();
    const memoryUsage = Math.round((totalMem - freeMem) / totalMem * 100);
    return {
      cpuUsage,
      memoryUsage,
      sessionsToday: this.sessionsToday
    };
  }
  // =========================================
  // Status Updates
  // =========================================
  setStatus(status) {
    this.status = status;
  }
  setPeripheralStatus(peripheral, status) {
    this.peripheralStatus[peripheral] = status;
  }
  setCameraStatus(status) {
    this.peripheralStatus.camera = status;
  }
  setPrinterStatus(status) {
    this.peripheralStatus.printer = status;
  }
  setCardReaderStatus(status) {
    this.peripheralStatus.cardReader = status;
  }
  incrementSessionsToday() {
    this.sessionsToday++;
  }
  resetSessionsToday() {
    this.sessionsToday = 0;
  }
  setConfigVersion(version) {
    this.configVersion = version;
  }
  // =========================================
  // Config Update Callback
  // =========================================
  onConfigUpdate(callback) {
    this.onConfigUpdateAvailable = callback;
  }
  // =========================================
  // Getters
  // =========================================
  getStatus() {
    return this.status;
  }
  getPeripheralStatus() {
    return { ...this.peripheralStatus };
  }
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1e3);
  }
}
const execAsync = util.promisify(child_process.exec);
async function getWindowsUUID() {
  var _a;
  try {
    const { stdout } = await execAsync("wmic csproduct get uuid");
    const lines = stdout.trim().split("\n");
    return ((_a = lines[1]) == null ? void 0 : _a.trim()) || "";
  } catch {
    return "";
  }
}
async function getWindowsCpuId() {
  var _a;
  try {
    const { stdout } = await execAsync("wmic cpu get processorid");
    const lines = stdout.trim().split("\n");
    return ((_a = lines[1]) == null ? void 0 : _a.trim()) || "";
  } catch {
    return "";
  }
}
async function getWindowsDiskSerial() {
  var _a;
  try {
    const { stdout } = await execAsync("wmic diskdrive get serialnumber");
    const lines = stdout.trim().split("\n");
    return ((_a = lines[1]) == null ? void 0 : _a.trim()) || "";
  } catch {
    return "";
  }
}
async function getMacAddress() {
  try {
    const networkInterfaces = os__namespace.networkInterfaces();
    for (const [, interfaces] of Object.entries(networkInterfaces)) {
      if (!interfaces) continue;
      for (const iface of interfaces) {
        if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
          return iface.mac;
        }
      }
    }
    return "";
  } catch {
    return "";
  }
}
async function getMacOsUUID() {
  try {
    const { stdout } = await execAsync(
      `ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { split($0, a, "\\""); print a[4] }'`
    );
    return stdout.trim();
  } catch {
    return "";
  }
}
async function generateHardwareId() {
  const platform = os__namespace.platform();
  let components = [];
  if (platform === "win32") {
    const [uuid, cpuId, diskSerial, mac] = await Promise.all([
      getWindowsUUID(),
      getWindowsCpuId(),
      getWindowsDiskSerial(),
      getMacAddress()
    ]);
    components = [uuid, cpuId, diskSerial, mac];
  } else if (platform === "darwin") {
    const [uuid, mac] = await Promise.all([
      getMacOsUUID(),
      getMacAddress()
    ]);
    components = [uuid, mac];
  } else {
    const mac = await getMacAddress();
    components = [os__namespace.hostname(), mac];
  }
  const fingerprint = components.filter(Boolean).join("|");
  if (!fingerprint) {
    const fallback = `${os__namespace.hostname()}-${Date.now()}`;
    return crypto.createHash("sha256").update(fallback).digest("hex").substring(0, 32);
  }
  return crypto.createHash("sha256").update(fingerprint).digest("hex").substring(0, 32);
}
async function getHardwareInfo() {
  var _a;
  const cpus = os__namespace.cpus();
  return {
    os: os__namespace.platform() === "win32" ? "Windows" : os__namespace.platform() === "darwin" ? "macOS" : "Linux",
    osVersion: os__namespace.release(),
    hostname: os__namespace.hostname(),
    cpu: ((_a = cpus[0]) == null ? void 0 : _a.model) || "Unknown",
    cpuCores: cpus.length,
    ramTotal: Math.round(os__namespace.totalmem() / 1024 / 1024),
    platform: os__namespace.platform(),
    arch: os__namespace.arch()
  };
}
let cachedHardwareId = null;
async function getHardwareId() {
  if (cachedHardwareId) {
    return cachedHardwareId;
  }
  cachedHardwareId = await generateHardwareId();
  return cachedHardwareId;
}
try {
  const envPath = electron.app.isPackaged ? path__namespace.join(process.resourcesPath, ".env") : path__namespace.join(__dirname, "../.env");
  require("dotenv").config({
    path: envPath,
    override: true
  });
  console.log(`Loaded .env from: ${envPath}`);
} catch (e) {
  console.warn("Could not load .env file:", e);
}
let mainWindow = null;
let hologramWindow = null;
let pythonBridge = null;
let cameraController = null;
let printerController = null;
let cardReader = null;
let cloudClient = null;
let configSync = null;
let sessionSync = null;
let commandHandler = null;
let heartbeatManager = null;
const isCloudEnabled = !!(process.env.CLOUD_API_URL && process.env.CLOUD_API_KEY);
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
async function initializeCloudIntegration() {
  var _a;
  if (!isCloudEnabled) {
    console.log("☁️ Cloud integration disabled (no CLOUD_API_URL or CLOUD_API_KEY)");
    return;
  }
  console.log("☁️ Initializing cloud integration...");
  try {
    cloudClient = CloudClient.initialize({
      apiUrl: process.env.CLOUD_API_URL,
      apiKey: process.env.CLOUD_API_KEY,
      organizationId: process.env.CLOUD_ORG_ID || ""
    });
    initializeLogger(cloudClient, {
      minLevel: process.env.LOG_LEVEL || "info",
      consoleOutput: true
    });
    const logger = getLogger();
    logger.info("system", "Cloud client initialized");
    const hardwareId = await getHardwareId();
    const hardwareInfo = await getHardwareInfo();
    logger.info("system", "Hardware ID generated", { hardwareId });
    if (!cloudClient.isRegistered()) {
      logger.info("system", "Registering machine with cloud...");
      const result = await cloudClient.register(hardwareId, hardwareInfo);
      if (result.success) {
        logger.info("system", "Machine registered successfully", {
          machineId: (_a = result.data) == null ? void 0 : _a.machineId
        });
      } else {
        logger.error("system", "Machine registration failed", {
          error: result.error
        });
        return;
      }
    }
    configSync = new ConfigSyncManager(cloudClient);
    await configSync.initialize();
    logger.info("system", "Config sync manager initialized", {
      version: configSync.getCloudVersion()
    });
    sessionSync = new SessionSyncManager(cloudClient);
    await sessionSync.initialize();
    logger.info("system", "Session sync manager initialized");
    commandHandler = new CommandHandler(cloudClient, logger);
    commandHandler.setConfigUpdateHandler(async () => {
      return await configSync.sync();
    });
    commandHandler.setDiagnosticsHandler(async (tests) => {
      return await runDiagnostics(tests);
    });
    commandHandler.startPolling();
    logger.info("system", "Command handler started");
    heartbeatManager = new HeartbeatManager(cloudClient, configSync, logger);
    heartbeatManager.onConfigUpdate(() => {
      configSync == null ? void 0 : configSync.sync();
    });
    heartbeatManager.start();
    logger.info("system", "Heartbeat manager started");
    cloudClient.onReregistered(async (data) => {
      logger.info("system", "Machine was automatically re-registered", {
        machineId: data.machineId
      });
      if (configSync) {
        await configSync.sync();
      }
      updatePeripheralStatus();
    });
    updatePeripheralStatus();
    console.log("✅ Cloud integration initialized successfully");
  } catch (error) {
    console.error("❌ Cloud integration failed:", error);
  }
}
function updatePeripheralStatus() {
  if (!heartbeatManager) return;
  if (cameraController) {
    const cameraStatus = cameraController.getStatus();
    heartbeatManager.setCameraStatus(cameraStatus.connected ? "ok" : "offline");
  }
  if (printerController) {
    printerController.getStatus().then((status) => {
      if (!heartbeatManager) return;
      if (!status.available) {
        heartbeatManager.setPrinterStatus("offline");
      } else if (status.paperLevel < 10) {
        heartbeatManager.setPrinterStatus("paper_low");
      } else {
        heartbeatManager.setPrinterStatus("ok");
      }
    });
  }
  if (cardReader) {
    const readerStatus = cardReader.getStatus();
    heartbeatManager.setCardReaderStatus(readerStatus.connected ? "ok" : "offline");
  }
}
async function runDiagnostics(tests) {
  var _a;
  const results = {};
  if (tests.includes("all") || tests.includes("camera")) {
    results.camera = {
      connected: (cameraController == null ? void 0 : cameraController.getStatus().connected) || false
    };
  }
  if (tests.includes("all") || tests.includes("printer")) {
    const printerStatus = await (printerController == null ? void 0 : printerController.getStatus());
    results.printer = printerStatus;
  }
  if (tests.includes("all") || tests.includes("payment")) {
    results.payment = {
      connected: ((_a = cardReader == null ? void 0 : cardReader.getStatus()) == null ? void 0 : _a.connected) || false
    };
  }
  return results;
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
let hologramWindowReadyPromise = null;
let hologramWindowReadyResolve = null;
function createHologramWindow() {
  console.log("📺 [Hologram] Creating hologram window...");
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    console.log("📺 [Hologram] Window already exists, skipping creation");
    return Promise.resolve();
  }
  hologramWindowReadyPromise = new Promise((resolve) => {
    hologramWindowReadyResolve = resolve;
  });
  const displays = electron.screen.getAllDisplays();
  console.log(`📺 [Hologram] Available displays: ${displays.length}`);
  const hologramDisplayIndex = displaySettings.swapDisplays ? 0 : displays.length > 1 ? 1 : 0;
  const hologramDisplay = displays[hologramDisplayIndex];
  const { x, y, width, height } = hologramDisplay.bounds;
  console.log(`📺 [Hologram] Using display ${hologramDisplayIndex + 1}${displaySettings.swapDisplays ? " (swapped)" : ""}`);
  console.log(`📺 [Hologram] Display bounds: ${width}x${height} at (${x}, ${y})`);
  try {
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
    console.log("📺 [Hologram] BrowserWindow created successfully");
    if (isDevelopment) {
      const url = "http://localhost:5173/#/hologram";
      console.log(`📺 [Hologram] Loading URL (dev): ${url}`);
      hologramWindow.loadURL(url);
    } else {
      const filePath = path__namespace.join(__dirname, "../dist/index.html");
      console.log(`📺 [Hologram] Loading file (prod): ${filePath}`);
      hologramWindow.loadFile(filePath, {
        hash: "/hologram"
      });
    }
    hologramWindow.webContents.on("did-finish-load", () => {
      console.log("✅ [Hologram] Page finished loading");
      setTimeout(() => {
        console.log("✅ [Hologram] Window fully ready (React mounted)");
        if (hologramWindowReadyResolve) {
          hologramWindowReadyResolve();
          hologramWindowReadyResolve = null;
        }
      }, 500);
    });
    hologramWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
      console.error(`❌ [Hologram] Page failed to load: ${errorDescription} (${errorCode})`);
      if (hologramWindowReadyResolve) {
        hologramWindowReadyResolve();
        hologramWindowReadyResolve = null;
      }
    });
    hologramWindow.on("closed", () => {
      console.log("📺 [Hologram] Window closed");
      hologramWindow = null;
      hologramWindowReadyPromise = null;
    });
    console.log(`📺 [Hologram] Window configured: ${displaySettings.hologramWidth}x${displaySettings.hologramHeight} at (${x}, ${y}) on display ${hologramDisplayIndex + 1}`);
  } catch (error) {
    console.error("❌ [Hologram] Failed to create window:", error);
    hologramWindow = null;
    if (hologramWindowReadyResolve) {
      hologramWindowReadyResolve();
      hologramWindowReadyResolve = null;
    }
  }
  return hologramWindowReadyPromise || Promise.resolve();
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
    mainWindow == null ? void 0 : mainWindow.webContents.send("video:progress", progress);
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
      mainWindow == null ? void 0 : mainWindow.webContents.send("payment:status", statusUpdate);
    });
    if (!useMockCardReader) {
      cardReader.on("cardRemoved", () => {
        mainWindow == null ? void 0 : mainWindow.webContents.send("payment:card-removed");
      });
      cardReader.on("paymentComplete", (result) => {
        mainWindow == null ? void 0 : mainWindow.webContents.send("payment:complete", result);
      });
      cardReader.on("error", (error) => {
        mainWindow == null ? void 0 : mainWindow.webContents.send("payment:error", {
          message: error instanceof Error ? error.message : "Unknown error"
        });
      });
      cardReader.on("disconnected", () => {
        mainWindow == null ? void 0 : mainWindow.webContents.send("payment:disconnected");
      });
    }
  } else {
    console.error("⚠️  Card reader initialization failed:", cardReaderResult.error);
  }
  console.log("✅ All systems initialized\n");
  await initializeCloudIntegration();
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
    const progressHandler = (progressData) => {
      mainWindow == null ? void 0 : mainWindow.webContents.send("printer:progress", progressData);
    };
    printerController.on("progress", progressHandler);
    const result = await printerController.print(options);
    printerController.off("progress", progressHandler);
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
    if (electron.app.isPackaged) {
      const frameName = path__namespace.basename(frameOverlayPath);
      frameOverlayPath = path__namespace.join(process.resourcesPath, "frames", frameName);
      console.log(`   Production frame path (extraResources): ${frameOverlayPath}`);
    }
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      frameOverlay: frameOverlayPath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || "mut-hologram"
    });
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error("Video processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error(`❌ [IPC] Video processing error:`, error);
    console.log(`${"=".repeat(70)}
`);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
  console.log("🎭 [IPC] hologram:set-mode called:", mode);
  hologramState = {
    mode,
    qrCodePath: data == null ? void 0 : data.qrCodePath,
    videoPath: data == null ? void 0 : data.videoPath
  };
  console.log("💾 [IPC] Hologram state stored:", hologramState);
  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? "main window" : "hologram window";
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow();
    targetWindow = getHologramTargetWindow();
  }
  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is NULL - cannot send message!`);
    return { success: false, error: `${windowName} not initialized` };
  }
  targetWindow.webContents.send("hologram:update", hologramState);
  console.log(`✅ [IPC] hologram:update sent to ${windowName}`);
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
  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? "main window" : "hologram window";
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow();
    targetWindow = getHologramTargetWindow();
  }
  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is still NULL after recreation attempt!`);
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
  console.log("🎭 [IPC] hologram:show-logo called");
  hologramState = {
    mode: "logo"
  };
  console.log("💾 [IPC] Hologram state stored:", hologramState);
  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? "main window" : "hologram window";
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow();
    targetWindow = getHologramTargetWindow();
  }
  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is NULL - cannot send message!`);
    return { success: false, error: `${windowName} not initialized` };
  }
  if (targetWindow.isDestroyed()) {
    console.error(`❌ [IPC] ${windowName} is DESTROYED - cannot send message!`);
    return { success: false, error: `${windowName} destroyed` };
  }
  targetWindow.webContents.send("hologram:update", hologramState);
  console.log(`✅ [IPC] hologram:update sent to ${windowName}`);
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
electron.app.on("before-quit", async () => {
  if (heartbeatManager) {
    heartbeatManager.stop();
  }
  if (commandHandler) {
    commandHandler.stopPolling();
  }
  if (sessionSync) {
    sessionSync.close();
  }
  if (configSync) {
    configSync.stopPeriodicSync();
  }
  try {
    const logger = getLogger();
    if (logger) {
      await logger.shutdown();
    }
  } catch {
  }
  closeDatabase();
});
