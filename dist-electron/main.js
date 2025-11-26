var N = Object.defineProperty;
var q = (s, o, e) => o in s ? N(s, o, { enumerable: !0, configurable: !0, writable: !0, value: e }) : s[o] = e;
var h = (s, o, e) => q(s, typeof o != "symbol" ? o + "" : o, e);
import { app as w, BrowserWindow as _, ipcMain as p, screen as H } from "electron";
import * as f from "path";
import P from "path";
import * as F from "fs/promises";
import { fileURLToPath as G } from "url";
import * as M from "fs";
import K from "fs";
import { spawn as T } from "child_process";
import { EventEmitter as U } from "events";
const J = K, Q = P;
function z(s) {
  console.log(`[dotenv][DEBUG] ${s}`);
}
const Y = `
`, X = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/, Z = /\\n/g, ee = /\r\n|\n|\r/;
function te(s, o) {
  const e = !!(o && o.debug), t = {};
  return s.toString().split(ee).forEach(function(r, n) {
    const a = r.match(X);
    if (a != null) {
      const c = a[1];
      let i = a[2] || "";
      const d = i.length - 1, u = i[0] === '"' && i[d] === '"';
      i[0] === "'" && i[d] === "'" || u ? (i = i.substring(1, d), u && (i = i.replace(Z, Y))) : i = i.trim(), t[c] = i;
    } else e && z(`did not match key and value when parsing line ${n + 1}: ${r}`);
  }), t;
}
function re(s) {
  let o = Q.resolve(process.cwd(), ".env"), e = "utf8", t = !1;
  s && (s.path != null && (o = s.path), s.encoding != null && (e = s.encoding), s.debug != null && (t = !0));
  try {
    const r = te(J.readFileSync(o, { encoding: e }), { debug: t });
    return Object.keys(r).forEach(function(n) {
      Object.prototype.hasOwnProperty.call(process.env, n) ? t && z(`"${n}" is already defined in \`process.env\` and will not be overwritten`) : process.env[n] = r[n];
    }), { parsed: r };
  } catch (r) {
    return { error: r };
  }
}
var oe = re;
class se extends U {
  constructor() {
    super();
    h(this, "pythonPath");
    h(this, "pipelineScriptPath");
    h(this, "stitcherScriptPath");
    h(this, "stitcherWorkingDir");
    h(this, "pipelineWorkingDir");
    w.isPackaged ? (this.pythonPath = P.join(process.resourcesPath, "python", "python.exe"), this.pipelineScriptPath = P.join(process.resourcesPath, "python", "pipeline.py"), this.stitcherScriptPath = P.join(process.resourcesPath, "python", "stitch_images.py"), this.stitcherWorkingDir = P.join(process.resourcesPath, "python"), this.pipelineWorkingDir = P.join(process.resourcesPath, "python")) : (this.pythonPath = "python3", this.pipelineScriptPath = P.join(w.getAppPath(), "MUT-distribution", "pipeline.py"), this.stitcherScriptPath = P.join(w.getAppPath(), "python", "stitch_images.py"), this.stitcherWorkingDir = P.join(w.getAppPath(), "python"), this.pipelineWorkingDir = P.join(w.getAppPath(), "MUT-distribution")), console.log("🐍 [PythonBridge] Initialized"), console.log(`   Python: ${this.pythonPath}`), console.log(`   Pipeline: ${this.pipelineScriptPath}`), console.log(`   Stitcher: ${this.stitcherScriptPath}`), console.log(`   Stitcher working dir: ${this.stitcherWorkingDir}`), console.log(`   Pipeline working dir: ${this.pipelineWorkingDir}`);
  }
  /**
   * Process video using Python pipeline
   */
  async processVideo(e) {
    return new Promise((t, r) => {
      var d, u;
      const n = [
        this.pipelineScriptPath,
        "--input",
        e.inputVideo,
        "--frame",
        e.frameOverlay
      ];
      e.subtitleText && n.push("--subtitle", e.subtitleText), e.s3Folder && n.push("--s3-folder", e.s3Folder), n.push("--json"), console.log("Starting Python pipeline:", n.join(" "));
      const a = T(this.pythonPath, n, {
        cwd: this.pipelineWorkingDir
      });
      let c = "", i = "";
      (d = a.stdout) == null || d.on("data", (m) => {
        const g = m.toString();
        c += g, console.log("[Python]", g), this.parseProgress(g);
      }), (u = a.stderr) == null || u.on("data", (m) => {
        i += m.toString(), console.error("[Python Error]", m.toString());
      }), a.on("close", (m) => {
        if (m !== 0) {
          r(new Error(`Python process exited with code ${m}
${i}`));
          return;
        }
        try {
          const g = c.trim().split(`
`), v = g[g.length - 1], C = JSON.parse(v);
          t(C);
        } catch (g) {
          r(new Error(`Failed to parse Python output: ${g}
${c}`));
        }
      }), a.on("error", (m) => {
        r(new Error(`Failed to start Python process: ${m}`));
      });
    });
  }
  /**
   * Parse progress updates from Python stdout
   */
  parseProgress(e) {
    e.includes("Step 1/3") || e.includes("VIDEO COMPOSITOR") ? this.emit("progress", {
      step: "compositing",
      progress: 20,
      message: "비디오 합성 중..."
    }) : e.includes("Step 2/3") || e.includes("S3 Upload") ? this.emit("progress", {
      step: "uploading",
      progress: 60,
      message: "S3 업로드 중..."
    }) : (e.includes("Step 3/3") || e.includes("QR Code")) && this.emit("progress", {
      step: "generating-qr",
      progress: 90,
      message: "QR 코드 생성 중..."
    });
  }
  /**
   * Process images by stitching them into a video, then running pipeline
   */
  async processFromImages(e) {
    if (console.log(`
${"=".repeat(70)}`), console.log("📷 [PythonBridge] PROCESSING FROM IMAGES"), console.log(`${"=".repeat(70)}`), console.log(`   Image count: ${e.imagePaths.length}`), console.log(`   Frame template (URL): ${e.frameTemplatePath}`), console.log(`   Subtitle: ${e.subtitleText || "(none)"}`), e.imagePaths.length !== 3)
      throw new Error(`Expected 3 images, got ${e.imagePaths.length}`);
    let t = e.frameTemplatePath;
    if (e.frameTemplatePath.startsWith("/")) {
      const a = e.frameTemplatePath.substring(1);
      t = P.join(w.getAppPath(), "public", a), console.log(`   Frame template (filesystem): ${t}`);
    }
    this.emit("progress", {
      step: "compositing",
      progress: 10,
      message: "이미지를 비디오로 변환 중..."
    });
    const r = await this.stitchImagesToVideo(e.imagePaths);
    console.log(`   ✓ Stitched video: ${r}`), this.emit("progress", {
      step: "compositing",
      progress: 30,
      message: "프레임 오버레이 적용 중..."
    }), console.log(`
📺 [PythonBridge] Running pipeline with stitched video...`);
    const n = await this.processVideo({
      inputVideo: r,
      frameOverlay: t,
      subtitleText: e.subtitleText,
      s3Folder: e.s3Folder
    });
    console.log("✅ [PythonBridge] Image processing complete!"), console.log(`${"=".repeat(70)}
`), console.log(`
🧹 [PythonBridge] Cleaning up temporary files...`);
    for (const a of e.imagePaths)
      try {
        await (await import("fs/promises")).unlink(a), console.log(`   ✓ Deleted: ${a}`);
      } catch (c) {
        console.warn(`   ⚠️  Failed to delete ${a}:`, c);
      }
    try {
      await (await import("fs/promises")).unlink(r), console.log(`   ✓ Deleted stitched video: ${r}`);
    } catch (a) {
      console.warn(`   ⚠️  Failed to delete stitched video ${r}:`, a);
    }
    return console.log(`✅ [PythonBridge] Cleanup complete!
`), n;
  }
  /**
   * Stitch 3 images into a video using stitch_images.py
   */
  async stitchImagesToVideo(e) {
    return new Promise((t, r) => {
      var m, g;
      console.log(`
🎬 [PythonBridge] Stitching images...`);
      const n = Date.now(), a = P.join(this.stitcherWorkingDir, "output", `stitched_${n}.mp4`), c = [
        this.stitcherScriptPath,
        "--images",
        ...e,
        "--output",
        a,
        "--duration",
        "3.0"
      ];
      console.log(`   Command: ${this.pythonPath} ${c.join(" ")}`);
      const i = T(this.pythonPath, c, {
        cwd: this.stitcherWorkingDir
      });
      let d = "", u = "";
      (m = i.stdout) == null || m.on("data", (v) => {
        const C = v.toString();
        d += C, console.log("[Stitcher]", C);
      }), (g = i.stderr) == null || g.on("data", (v) => {
        u += v.toString(), console.error("[Stitcher Error]", v.toString());
      }), i.on("close", (v) => {
        if (v !== 0) {
          r(new Error(`Stitcher process exited with code ${v}
${u}`));
          return;
        }
        try {
          const C = d.trim().split(`
`), L = C[C.length - 1], I = JSON.parse(L);
          I.success ? t(I.videoPath) : r(new Error(I.error || "Unknown stitching error"));
        } catch (C) {
          r(new Error(`Failed to parse stitcher output: ${C}
${d}`));
        }
      }), i.on("error", (v) => {
        r(new Error(`Failed to start stitcher process: ${v}`));
      });
    });
  }
  /**
   * Extract frames from video at specific timestamps using FFmpeg
   */
  async extractFrames(e, t) {
    return new Promise(async (r, n) => {
      console.log(`
${"=".repeat(70)}`), console.log("📸 [PythonBridge] EXTRACTING FRAMES FROM VIDEO"), console.log(`${"=".repeat(70)}`), console.log(`   Video: ${e}`), console.log(`   Timestamps: ${t.join("s, ")}s`);
      try {
        const a = await import("fs/promises"), c = Date.now(), i = P.join(this.pipelineWorkingDir, "output", `frames_${c}`);
        await a.mkdir(i, { recursive: !0 }), console.log(`   Output directory: ${i}`);
        const d = [];
        for (let u = 0; u < t.length; u++) {
          const m = t[u], g = P.join(i, `frame_${m}s.jpg`);
          console.log(`
   Extracting frame ${u + 1}/${t.length} at ${m}s...`);
          const v = [
            "-ss",
            m.toString(),
            "-i",
            e,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-y",
            // overwrite
            g
          ];
          await new Promise((C, L) => {
            var B;
            const I = T("ffmpeg", v);
            let O = "";
            (B = I.stderr) == null || B.on("data", (D) => {
              O += D.toString();
            }), I.on("close", (D) => {
              D !== 0 ? (console.error(`   ❌ FFmpeg failed with code ${D}`), console.error(`   Error: ${O}`), L(new Error(`FFmpeg failed to extract frame at ${m}s`))) : (console.log(`   ✅ Frame extracted: ${g}`), d.push(g), C());
            }), I.on("error", (D) => {
              L(new Error(`Failed to start FFmpeg: ${D}`));
            });
          });
        }
        console.log(`
✅ [PythonBridge] All frames extracted successfully!`), console.log(`   Total frames: ${d.length}`), console.log(`${"=".repeat(70)}
`), r(d);
      } catch (a) {
        console.error("❌ [PythonBridge] Frame extraction failed:", a), console.log(`${"=".repeat(70)}
`), n(a);
      }
    });
  }
  /**
   * Check if Python and dependencies are available
   */
  async checkDependencies() {
    return new Promise((e) => {
      var n;
      const t = T(this.pythonPath, ["--version"]);
      let r = "";
      (n = t.stdout) == null || n.on("data", (a) => {
        r += a.toString();
      }), t.on("close", (a) => {
        a === 0 ? (console.log("Python version:", r.trim()), e({ available: !0 })) : e({
          available: !1,
          error: "Python not found. Please install Python 3.8+"
        });
      }), t.on("error", () => {
        e({
          available: !1,
          error: "Python not found. Please install Python 3.8+"
        });
      });
    });
  }
}
class ne extends U {
  constructor(e = {}) {
    super();
    h(this, "mockMode");
    h(this, "useWebcam");
    h(this, "captureDir");
    h(this, "cameraProcess", null);
    h(this, "isConnected", !1);
    h(this, "cameraInfo", null);
    h(this, "liveViewActive", !1);
    h(this, "liveViewInterval", null);
    h(this, "previewPath");
    this.mockMode = e.mockMode ?? process.env.MOCK_CAMERA === "true", this.useWebcam = e.useWebcam ?? process.env.USE_WEBCAM === "true", this.captureDir = e.captureDir ?? f.join(process.cwd(), "captures"), this.previewPath = f.join(this.captureDir, "live_preview.jpg"), M.existsSync(this.captureDir) || M.mkdirSync(this.captureDir, { recursive: !0 });
  }
  /**
   * Kill MacOS PTPCamera service that blocks gphoto2
   */
  async killPTPCameraService() {
    try {
      for (let e = 0; e < 3; e++) {
        try {
          await this.executeCommand("killall", ["-9", "PTPCamera"]);
        } catch {
        }
        await new Promise((t) => setTimeout(t, 200));
      }
      console.log("🔧 Killed PTPCamera service to allow gphoto2 access"), await new Promise((e) => setTimeout(e, 1e3));
    } catch {
      console.log("ℹ️ PTPCamera service not running or already killed");
    }
  }
  /**
   * Initialize camera connection
   */
  async connect() {
    var e;
    if (this.mockMode)
      return this.mockConnect();
    if (this.useWebcam)
      return this.webcamConnect();
    try {
      if (await this.killPTPCameraService(), (await this.executeGPhoto2Command(["--auto-detect"])).includes("No camera found"))
        return {
          success: !1,
          error: "No camera detected. Please connect a DSLR camera."
        };
      const r = await this.executeGPhoto2Command(["--summary"]);
      return this.cameraInfo = this.parseCameraInfo(r), this.isConnected = !0, this.emit("connected", this.cameraInfo), console.log("✅ Camera connected:", (e = this.cameraInfo) == null ? void 0 : e.model), { success: !0 };
    } catch (t) {
      const r = t instanceof Error ? t.message : "Unknown error";
      return console.error("❌ Camera connection failed:", r), {
        success: !1,
        error: r
      };
    }
  }
  /**
   * Disconnect camera
   */
  async disconnect() {
    this.cameraProcess && (this.cameraProcess.kill(), this.cameraProcess = null), this.isConnected = !1, this.emit("disconnected"), console.log("📷 Camera disconnected");
  }
  /**
   * Capture a photo
   */
  async capture() {
    if (!this.isConnected && !this.mockMode)
      return {
        success: !1,
        error: "Camera not connected"
      };
    if (this.mockMode)
      return this.mockCapture();
    if (this.useWebcam)
      return this.webcamCapture();
    try {
      await this.killPTPCameraService();
      const t = `capture_${Date.now()}.jpg`, r = f.join(this.captureDir, t);
      if (console.log("📷 Capturing photo..."), this.emit("capturing"), await this.executeGPhoto2Command([
        "--capture-image-and-download",
        "--filename",
        r
      ]), !M.existsSync(r))
        throw new Error("Capture file not created");
      return this.emit("captured", r), console.log("✅ Photo captured:", r), {
        success: !0,
        imagePath: r
      };
    } catch (e) {
      const t = e instanceof Error ? e.message : "Unknown error";
      return console.error("❌ Capture failed:", t), {
        success: !1,
        error: t
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
   * Start live view streaming (webcam-like)
   * Continuously captures preview frames for real-time display
   */
  async startLiveView(e = 10) {
    if (!this.isConnected && !this.mockMode && !this.useWebcam)
      return {
        success: !1,
        error: "Camera not connected"
      };
    if (this.liveViewActive)
      return {
        success: !1,
        error: "Live view already active"
      };
    if (this.mockMode)
      return this.mockStartLiveView(e);
    if (this.useWebcam)
      return this.webcamStartLiveView();
    try {
      await this.killPTPCameraService(), this.liveViewActive = !0;
      const t = 1e3 / e;
      return await this.captureLiveViewFrame(), this.liveViewInterval = setInterval(async () => {
        try {
          await this.captureLiveViewFrame();
        } catch (r) {
          console.error("Live view frame capture error:", r);
        }
      }, t), this.emit("liveview-started"), console.log(`📹 Live view started at ${e} fps`), { success: !0 };
    } catch (t) {
      this.liveViewActive = !1;
      const r = t instanceof Error ? t.message : "Unknown error";
      return console.error("❌ Live view start failed:", r), {
        success: !1,
        error: r
      };
    }
  }
  /**
   * Stop live view streaming
   */
  async stopLiveView() {
    this.liveViewInterval && (clearInterval(this.liveViewInterval), this.liveViewInterval = null), this.liveViewActive = !1, this.emit("liveview-stopped"), console.log("📹 Live view stopped");
  }
  /**
   * Get current live view frame path
   */
  getLiveViewFramePath() {
    return this.previewPath;
  }
  /**
   * Check if live view is active
   */
  isLiveViewActive() {
    return this.liveViewActive;
  }
  /**
   * Capture a single live view frame
   */
  async captureLiveViewFrame() {
    await this.executeGPhoto2Command([
      "--capture-preview",
      "--filename",
      this.previewPath,
      "--force-overwrite"
    ]), this.emit("liveview-frame", {
      path: this.previewPath,
      timestamp: Date.now()
    });
  }
  /**
   * Execute gphoto2 command
   */
  async executeGPhoto2Command(e) {
    return new Promise((t, r) => {
      var i, d;
      const n = T("gphoto2", e);
      let a = "", c = "";
      (i = n.stdout) == null || i.on("data", (u) => {
        a += u.toString();
      }), (d = n.stderr) == null || d.on("data", (u) => {
        c += u.toString();
      }), n.on("close", (u) => {
        u === 0 ? t(a) : r(new Error(c || `gphoto2 exited with code ${u}`));
      }), n.on("error", (u) => {
        r(new Error(`Failed to execute gphoto2: ${u.message}`));
      });
    });
  }
  /**
   * Parse camera info from gphoto2 summary
   */
  parseCameraInfo(e) {
    const t = e.match(/Model:\s*(.+)/), r = e.match(/Serial Number:\s*(.+)/), n = e.match(/Battery Level:\s*(\d+)/);
    return {
      model: t ? t[1].trim() : "Unknown Camera",
      serial: r ? r[1].trim() : void 0,
      batteryLevel: n ? parseInt(n[1]) : void 0
    };
  }
  /**
   * Mock mode: Simulate camera connection
   */
  async mockConnect() {
    return await new Promise((e) => setTimeout(e, 500)), this.isConnected = !0, this.cameraInfo = {
      model: "Mock Camera (Canon EOS 5D Mark IV)",
      serial: "MOCK123456789",
      batteryLevel: 85
    }, this.emit("connected", this.cameraInfo), console.log("✅ Mock camera connected"), { success: !0 };
  }
  /**
   * Mock mode: Simulate photo capture
   */
  async mockCapture() {
    await new Promise((n) => setTimeout(n, 1e3));
    const t = `mock_capture_${Date.now()}.txt`, r = f.join(this.captureDir, t);
    return M.writeFileSync(r, `Mock photo captured at ${(/* @__PURE__ */ new Date()).toISOString()}
Resolution: 5760x3840
ISO: 400
Shutter: 1/125
Aperture: f/2.8`), this.emit("captured", r), console.log("✅ Mock photo captured:", r), {
      success: !0,
      imagePath: r
    };
  }
  /**
   * Mock mode: Start live view
   */
  async mockStartLiveView(e) {
    this.liveViewActive = !0;
    const t = 1e3 / e;
    return this.liveViewInterval = setInterval(() => {
      const r = `Mock live view frame at ${(/* @__PURE__ */ new Date()).toISOString()}`;
      M.writeFileSync(this.previewPath, r), this.emit("liveview-frame", {
        path: this.previewPath,
        timestamp: Date.now()
      });
    }, t), this.emit("liveview-started"), console.log(`✅ Mock live view started at ${e} fps`), { success: !0 };
  }
  /**
   * Webcam mode: Connect to built-in webcam
   */
  async webcamConnect() {
    try {
      return await this.executeCommand("which", ["imagesnap"]), this.isConnected = !0, this.cameraInfo = {
        model: "Built-in Webcam",
        serial: "WEBCAM",
        batteryLevel: 100
      }, this.emit("connected", this.cameraInfo), console.log("✅ Webcam connected"), { success: !0 };
    } catch {
      return console.warn("⚠️ imagesnap not found. Install with: brew install imagesnap"), this.isConnected = !0, this.cameraInfo = {
        model: "Built-in Webcam",
        serial: "WEBCAM",
        batteryLevel: 100
      }, this.emit("connected", this.cameraInfo), console.log("✅ Webcam connected (imagesnap not found - will use fallback)"), { success: !0 };
    }
  }
  /**
   * Webcam mode: Capture from built-in webcam using imagesnap
   */
  async webcamCapture() {
    try {
      const t = `webcam_capture_${Date.now()}.jpg`, r = f.join(this.captureDir, t);
      console.log("📷 Capturing from webcam..."), this.emit("capturing");
      try {
        if (await this.executeCommand("imagesnap", ["-q", r]), !M.existsSync(r))
          throw new Error("Webcam capture file not created");
        return this.emit("captured", r), console.log("✅ Webcam photo captured:", r), {
          success: !0,
          imagePath: r
        };
      } catch {
        console.warn("⚠️ imagesnap failed, creating placeholder");
        const a = `Webcam photo captured at ${(/* @__PURE__ */ new Date()).toISOString()}

To enable webcam capture, install imagesnap:
brew install imagesnap

Resolution: 1280x720
Webcam: Built-in`;
        return M.writeFileSync(r + ".txt", a), this.emit("captured", r + ".txt"), console.log("✅ Webcam placeholder created:", r + ".txt"), {
          success: !0,
          imagePath: r + ".txt"
        };
      }
    } catch (e) {
      const t = e instanceof Error ? e.message : "Unknown error";
      return console.error("❌ Webcam capture failed:", t), {
        success: !1,
        error: t
      };
    }
  }
  /**
   * Webcam mode: Start live view
   */
  async webcamStartLiveView() {
    try {
      return await this.executeCommand("which", ["imagesnap"]), this.liveViewActive = !0, this.liveViewInterval = setInterval(async () => {
        try {
          await this.executeCommand("imagesnap", ["-q", this.previewPath]), this.emit("liveview-frame", {
            path: this.previewPath,
            timestamp: Date.now()
          });
        } catch (e) {
          console.error("Webcam live view frame error:", e);
        }
      }, 100), this.emit("liveview-started"), console.log("📹 Webcam live view started"), { success: !0 };
    } catch (e) {
      const t = e instanceof Error ? e.message : "Unknown error";
      return console.error("❌ Webcam live view start failed:", t), {
        success: !1,
        error: `${t}

Install imagesnap: brew install imagesnap`
      };
    }
  }
  /**
   * Execute a generic command (not gphoto2)
   */
  async executeCommand(e, t) {
    return new Promise((r, n) => {
      var d, u;
      const a = T(e, t);
      let c = "", i = "";
      (d = a.stdout) == null || d.on("data", (m) => {
        c += m.toString();
      }), (u = a.stderr) == null || u.on("data", (m) => {
        i += m.toString();
      }), a.on("close", (m) => {
        m === 0 ? r(c) : n(new Error(i || `${e} exited with code ${m}`));
      }), a.on("error", (m) => {
        n(new Error(`Failed to execute ${e}: ${m.message}`));
      });
    });
  }
}
class ae extends U {
  constructor(e = {}) {
    super();
    h(this, "mockMode");
    h(this, "printerName");
    h(this, "currentJob", null);
    h(this, "mockPaperLevel", 100);
    h(this, "mockInkLevels", {
      cyan: 85,
      magenta: 90,
      yellow: 75,
      black: 88
    });
    this.mockMode = e.mockMode ?? process.env.MOCK_PRINTER === "true", this.printerName = e.printerName ?? "Default";
  }
  /**
   * Initialize printer connection
   */
  async connect() {
    if (this.mockMode)
      return this.mockConnect();
    try {
      const e = await this.listPrinters();
      return e.length === 0 ? {
        success: !1,
        error: "No printers found. Please connect a printer."
      } : (console.log("✅ Printer connected:", e[0]), this.emit("connected", { name: e[0] }), { success: !0 });
    } catch (e) {
      const t = e instanceof Error ? e.message : "Unknown error";
      return console.error("❌ Printer connection failed:", t), {
        success: !1,
        error: t
      };
    }
  }
  /**
   * Get printer status
   */
  async getStatus() {
    if (this.mockMode)
      return this.mockGetStatus();
    try {
      const e = await this.executePrinterCommand(["lpstat", "-p", this.printerName]), t = e.includes("printing");
      return {
        available: !0,
        status: e.includes("error") ? "error" : t ? "printing" : "idle",
        paperLevel: 100,
        // Real implementation would query actual level
        inkLevel: {
          cyan: 85,
          magenta: 90,
          yellow: 75,
          black: 88
        }
      };
    } catch (e) {
      return {
        available: !1,
        status: "offline",
        paperLevel: 0,
        inkLevel: {
          cyan: 0,
          magenta: 0,
          yellow: 0,
          black: 0
        },
        error: e instanceof Error ? e.message : "Unknown error"
      };
    }
  }
  /**
   * Print a photo
   */
  async print(e) {
    if (this.mockMode)
      return this.mockPrint(e);
    try {
      if (!M.existsSync(e.imagePath))
        throw new Error(`Image file not found: ${e.imagePath}`);
      const t = `job_${Date.now()}`;
      this.currentJob = t, console.log("🖨️  Starting print job:", t), this.emit("printing", { jobId: t, options: e });
      const r = [
        "-d",
        this.printerName,
        "-n",
        String(e.copies || 1),
        "-o",
        "media=4x6",
        "-o",
        "fit-to-page",
        e.imagePath
      ], a = (await this.executePrinterCommand(["lp", ...r])).match(/request id is (.+)/), c = a ? a[1] : t;
      return this.emit("printed", { jobId: c }), console.log("✅ Print job completed:", c), this.currentJob = null, {
        success: !0,
        jobId: c
      };
    } catch (t) {
      const r = t instanceof Error ? t.message : "Unknown error";
      return console.error("❌ Print failed:", r), this.currentJob = null, {
        success: !1,
        error: r
      };
    }
  }
  /**
   * Cancel current print job
   */
  async cancelPrint(e) {
    if (this.mockMode)
      return this.mockCancelPrint(e);
    try {
      return await this.executePrinterCommand(["cancel", e]), this.emit("cancelled", { jobId: e }), console.log("✅ Print job cancelled:", e), { success: !0 };
    } catch (t) {
      return console.error("❌ Cancel failed:", t), { success: !1 };
    }
  }
  /**
   * List available printers
   */
  async listPrinters() {
    const e = await this.executePrinterCommand(["lpstat", "-p"]), t = [], r = e.split(`
`);
    for (const n of r) {
      const a = n.match(/printer (.+) is/);
      a && t.push(a[1]);
    }
    return t;
  }
  /**
   * Execute printer command
   */
  async executePrinterCommand(e) {
    return new Promise((t, r) => {
      var u, m;
      const [n, ...a] = e, c = T(n, a);
      let i = "", d = "";
      (u = c.stdout) == null || u.on("data", (g) => {
        i += g.toString();
      }), (m = c.stderr) == null || m.on("data", (g) => {
        d += g.toString();
      }), c.on("close", (g) => {
        g === 0 ? t(i) : r(new Error(d || `Command exited with code ${g}`));
      }), c.on("error", (g) => {
        r(g);
      });
    });
  }
  /**
   * Mock mode: Simulate printer connection
   */
  async mockConnect() {
    return await new Promise((e) => setTimeout(e, 300)), console.log("✅ Mock printer connected"), this.emit("connected", { name: "Mock Photo Printer (Canon SELPHY CP1300)" }), { success: !0 };
  }
  /**
   * Mock mode: Get printer status
   */
  async mockGetStatus() {
    return await new Promise((e) => setTimeout(e, 100)), {
      available: !0,
      status: this.currentJob ? "printing" : "idle",
      paperLevel: this.mockPaperLevel,
      inkLevel: this.mockInkLevels
    };
  }
  /**
   * Mock mode: Simulate printing
   */
  async mockPrint(e) {
    const t = `mock_job_${Date.now()}`;
    this.currentJob = t, console.log("🖨️  Starting mock print job:", t), this.emit("printing", { jobId: t, options: e });
    for (let r = 0; r <= 100; r += 20)
      await new Promise((n) => setTimeout(n, 500)), this.emit("progress", { jobId: t, progress: r }), console.log(`🖨️  Print progress: ${r}%`);
    return this.mockPaperLevel = Math.max(0, this.mockPaperLevel - 1), this.emit("printed", { jobId: t }), console.log("✅ Mock print job completed:", t), this.currentJob = null, {
      success: !0,
      jobId: t
    };
  }
  /**
   * Mock mode: Cancel print
   */
  async mockCancelPrint(e) {
    return await new Promise((t) => setTimeout(t, 200)), this.currentJob = null, this.emit("cancelled", { jobId: e }), console.log("✅ Mock print job cancelled:", e), { success: !0 };
  }
}
class ie extends U {
  constructor(e = {}) {
    super();
    h(this, "mockMode");
    h(this, "mockApprovalRate");
    h(this, "readerPort");
    h(this, "isConnected", !1);
    h(this, "currentTransaction", null);
    h(this, "timeoutTimer", null);
    this.mockMode = e.mockMode ?? process.env.MOCK_CARD_READER !== "false", this.mockApprovalRate = e.mockApprovalRate ?? 0.8, this.readerPort = e.readerPort ?? "COM1", this.mockMode || console.log(`Card reader configured on port: ${this.readerPort}`);
  }
  /**
   * Initialize card reader connection
   */
  async connect() {
    if (this.mockMode)
      return this.mockConnect();
    try {
      throw new Error("Real card reader not implemented. Set MOCK_CARD_READER=true for testing.");
    } catch (e) {
      const t = e instanceof Error ? e.message : "Unknown error";
      return console.error("❌ Card reader connection failed:", t), {
        success: !1,
        error: t
      };
    }
  }
  /**
   * Disconnect card reader
   */
  async disconnect() {
    this.timeoutTimer && (clearTimeout(this.timeoutTimer), this.timeoutTimer = null), this.isConnected = !1, this.currentTransaction = null, this.emit("disconnected"), console.log("💳 Card reader disconnected");
  }
  /**
   * Process a payment
   */
  async processPayment(e) {
    if (!this.isConnected && !this.mockMode)
      return {
        success: !1,
        status: "error",
        error: "Card reader not connected"
      };
    if (this.mockMode)
      return this.mockProcessPayment(e);
    try {
      throw new Error("Real card reader not implemented. Set MOCK_CARD_READER=true for testing.");
    } catch (t) {
      const r = t instanceof Error ? t.message : "Unknown error";
      return console.error("❌ Payment processing failed:", r), {
        success: !1,
        status: "error",
        error: r
      };
    }
  }
  /**
   * Cancel current payment
   */
  async cancelPayment() {
    return this.timeoutTimer && (clearTimeout(this.timeoutTimer), this.timeoutTimer = null), this.currentTransaction = null, this.emit("status", {
      status: "cancelled",
      message: "결제가 취소되었습니다"
    }), console.log("💳 Payment cancelled"), { success: !0 };
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
    return await new Promise((e) => setTimeout(e, 500)), this.isConnected = !0, console.log("✅ Mock card reader connected (Dummy Mode)"), console.log(`   - Approval rate: ${(this.mockApprovalRate * 100).toFixed(0)}%`), this.emit("connected", { model: "Mock Card Reader (Test Device)" }), { success: !0 };
  }
  /**
   * Mock mode: Simulate payment processing
   */
  async mockProcessPayment(e) {
    const t = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    this.currentTransaction = t, console.log("💳 Starting mock payment:", t), console.log(`   Amount: ${e.amount.toLocaleString()} ${e.currency || "KRW"}`), this.emit("status", {
      status: "waiting",
      message: `카드를 삽입해주세요
금액: ${e.amount.toLocaleString()}원`
    }), this.timeoutTimer = setTimeout(() => {
      this.currentTransaction === t && (this.emit("status", {
        status: "timeout",
        message: "시간이 초과되었습니다"
      }), this.currentTransaction = null);
    }, 3e4);
    const r = 2e3 + Math.random() * 2e3;
    if (await new Promise((c) => setTimeout(c, r)), this.currentTransaction !== t)
      return {
        success: !1,
        status: "cancelled",
        error: "Payment cancelled"
      };
    this.emit("status", {
      status: "card_inserted",
      message: "카드가 감지되었습니다"
    }), await new Promise((c) => setTimeout(c, 800)), this.emit("status", {
      status: "processing",
      message: "결제 처리 중..."
    });
    const n = 1e3 + Math.random() * 1e3;
    if (await new Promise((c) => setTimeout(c, n)), this.timeoutTimer && (clearTimeout(this.timeoutTimer), this.timeoutTimer = null), Math.random() < this.mockApprovalRate) {
      const c = ["visa", "mastercard", "amex"], i = c[Math.floor(Math.random() * c.length)], d = String(Math.floor(Math.random() * 1e4)).padStart(4, "0"), u = {
        success: !0,
        status: "approved",
        transactionId: t,
        amount: e.amount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        cardType: i,
        cardLast4: d
      };
      return this.emit("status", {
        status: "approved",
        message: "결제가 완료되었습니다!"
      }), console.log("✅ Mock payment approved:", t), console.log(`   Card: ${i.toUpperCase()} ****${d}`), this.currentTransaction = null, u;
    } else {
      const c = [
        "잔액 부족",
        "카드 승인 거부",
        "한도 초과",
        "카드 정보 오류"
      ], i = c[Math.floor(Math.random() * c.length)], d = {
        success: !1,
        status: "declined",
        transactionId: t,
        error: i
      };
      return this.emit("status", {
        status: "declined",
        message: `결제가 거부되었습니다
사유: ${i}`
      }), console.log("❌ Mock payment declined:", t), console.log(`   Reason: ${i}`), this.currentTransaction = null, d;
    }
  }
}
oe();
const ce = G(import.meta.url), R = f.dirname(ce);
let l = null, $ = null, b = null, y = null, x = null, S = null, k = {
  mode: "logo"
};
const E = process.env.NODE_ENV !== "production", V = process.env.SPLIT_SCREEN_MODE === "true";
function j() {
  return V ? l : $;
}
function W() {
  l = new _({
    width: E ? 2200 : 1080,
    // Wider in dev for split view
    height: E ? 1100 : 1920,
    // Shorter in dev for better fit
    fullscreen: !E,
    // Only fullscreen in production
    kiosk: !E,
    // Only kiosk in production
    resizable: E,
    // Allow resizing in development
    webPreferences: {
      preload: f.join(R, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0,
      webSecurity: !1
      // Disable CORS for S3 video loading in split-screen
    }
  }), E ? (l.loadURL("http://localhost:5173/"), l.webContents.openDevTools()) : l.loadFile(f.join(R, "../dist/index.html")), l.on("closed", () => {
    l = null;
  });
}
function A() {
  const s = H.getAllDisplays(), o = s.length > 1 ? s[1] : s[0], { x: e, y: t } = o.bounds, r = 1080, n = 1920;
  $ = new _({
    x: e + 100,
    // Offset slightly from edge
    y: t,
    width: r,
    height: n,
    fullscreen: !1,
    // Don't use fullscreen, maintain 9:16 aspect ratio
    frame: !0,
    // Always show frame so we can see the window and prevent accidental closing
    show: !0,
    closable: !E,
    // In development, prevent closing the hologram window
    webPreferences: {
      preload: f.join(R, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0,
      webSecurity: !1
      // Disable CORS for S3 video loading
    }
  }), E ? $.loadURL("http://localhost:5173/#/hologram") : $.loadFile(f.join(R, "../dist/index.html"), {
    hash: "/hologram"
  }), $.on("close", (a) => {
    console.warn("⚠️ [Main] Hologram window close event triggered!"), console.warn("   Preventing close to maintain dual-monitor setup"), a.preventDefault(), console.log("   Window minimized instead of closed"), $ == null || $.minimize();
  }), $.on("closed", () => {
    console.error("❌ [Main] Hologram window was forcefully closed!"), $ = null, console.log("🔄 [Main] Will attempt to recreate hologram window in 1 second..."), setTimeout(() => {
      $ || (console.log("🔄 [Main] Recreating hologram window..."), A());
    }, 1e3);
  }), console.log(`✅ Hologram window created on display ${s.length > 1 ? 2 : 1}`), console.log(`   Position: (${e + 100}, ${t}), Size: ${r}x${n} (9:16)`);
}
w.whenReady().then(async () => {
  console.log("🚀 Initializing MUT Hologram Studio..."), b = new se();
  const s = await b.checkDependencies();
  s.available ? console.log("✅ Python bridge initialized") : console.error("⚠️  Python not available:", s.error), b.on("progress", (n) => {
    l == null || l.webContents.send("video:progress", n);
  });
  const o = process.env.USE_WEBCAM === "true";
  console.log(`📷 Camera mode: ${o ? "WEBCAM (MacBook/Canon EOS Webcam Utility)" : "DSLR (gphoto2)"}`), console.log(`   USE_WEBCAM env var: ${process.env.USE_WEBCAM}`), y = new ne({
    mockMode: !1,
    // No mock mode
    useWebcam: o
  });
  const e = await y.connect();
  e.success ? console.log("✅ Camera controller initialized") : console.error("⚠️  Camera initialization failed:", e.error), x = new ae({ mockMode: !0 });
  const t = await x.connect();
  t.success ? console.log("✅ Printer controller initialized") : console.error("⚠️  Printer initialization failed:", t.error), S = new ie({ mockMode: !0, mockApprovalRate: 0.8 });
  const r = await S.connect();
  r.success ? (console.log("✅ Card reader initialized (mock mode)"), S.on("status", (n) => {
    l == null || l.webContents.send("payment:status", n);
  })) : console.error("⚠️  Card reader initialization failed:", r.error), console.log(`✅ All systems initialized
`), W(), V ? console.log("🔀 Using split-screen mode (single window)") : (console.log("📺 Creating separate hologram window (dual-monitor mode)"), A()), w.on("activate", () => {
    _.getAllWindows().length === 0 && (W(), V || A());
  });
});
w.on("window-all-closed", () => {
  process.platform !== "darwin" && w.quit();
});
p.handle("camera:start-preview", async () => {
  if (console.log("📷 Camera live view requested"), !y)
    return { success: !1, error: "Camera not initialized" };
  try {
    const s = await y.startLiveView(3);
    return y.on("liveview-frame", (o) => {
      l == null || l.webContents.send("camera:preview-frame", {
        framePath: o.path,
        timestamp: o.timestamp
      });
    }), s;
  } catch (s) {
    return {
      success: !1,
      error: s instanceof Error ? s.message : "Unknown error"
    };
  }
});
p.handle("camera:stop-preview", async () => {
  if (console.log("📷 Camera live view stopped"), !y)
    return { success: !1, error: "Camera not initialized" };
  try {
    return await y.stopLiveView(), { success: !0 };
  } catch (s) {
    return {
      success: !1,
      error: s instanceof Error ? s.message : "Unknown error"
    };
  }
});
p.handle("camera:get-preview-frame", async () => {
  if (!y)
    return { success: !1, error: "Camera not initialized" };
  if (!y.isLiveViewActive())
    return { success: !1, error: "Live view not active" };
  try {
    return { success: !0, framePath: y.getLiveViewFramePath() };
  } catch (s) {
    return {
      success: !1,
      error: s instanceof Error ? s.message : "Unknown error"
    };
  }
});
p.handle("camera:capture", async () => {
  if (console.log("📷 Camera capture requested"), !y)
    return {
      success: !1,
      error: "Camera not initialized"
    };
  try {
    return await y.capture();
  } catch (s) {
    return {
      success: !1,
      error: s instanceof Error ? s.message : "Unknown error"
    };
  }
});
p.handle("printer:get-status", async () => {
  if (console.log("🖨️  Printer status requested"), !x)
    return {
      success: !1,
      status: "offline",
      paperLevel: 0,
      error: "Printer not initialized"
    };
  try {
    const s = await x.getStatus();
    return {
      success: s.available,
      ...s
    };
  } catch (s) {
    return {
      success: !1,
      status: "offline",
      paperLevel: 0,
      error: s instanceof Error ? s.message : "Unknown error"
    };
  }
});
p.handle("printer:print", async (s, o) => {
  if (console.log("🖨️  Print requested:", o), !x)
    return {
      success: !1,
      error: "Printer not initialized"
    };
  try {
    const e = await x.print(o);
    return x.on("progress", (t) => {
      l == null || l.webContents.send("printer:progress", t);
    }), e;
  } catch (e) {
    return {
      success: !1,
      error: e instanceof Error ? e.message : "Unknown error"
    };
  }
});
p.handle("video:process", async (s, o) => {
  if (console.log("Video processing requested:", o), !b)
    return {
      success: !1,
      error: "Python bridge not initialized"
    };
  try {
    let e = o.chromaVideo;
    if (o.chromaVideo && o.chromaVideo.startsWith("/")) {
      const r = o.chromaVideo.substring(1);
      e = f.join(w.getAppPath(), "public", r), console.log(`   Frame overlay converted: ${o.chromaVideo} -> ${e}`);
    }
    const t = await b.processVideo({
      inputVideo: o.inputVideo,
      frameOverlay: e,
      subtitleText: o.subtitleText,
      s3Folder: o.s3Folder || "mut-hologram"
    });
    return l == null || l.webContents.send("video:complete", {
      success: !0,
      result: t
    }), {
      success: !0,
      result: t
    };
  } catch (e) {
    console.error("Video processing error:", e);
    const t = e instanceof Error ? e.message : "Unknown error";
    return l == null || l.webContents.send("video:complete", {
      success: !1,
      error: t
    }), {
      success: !1,
      error: t
    };
  }
});
p.handle("video:cancel", async (s, o) => (console.log("Video processing cancelled:", o), { success: !0 }));
p.handle("video:process-from-images", async (s, o) => {
  if (console.log(`
${"=".repeat(70)}`), console.log("🎬 [IPC] VIDEO PROCESSING FROM IMAGES"), console.log(`${"=".repeat(70)}`), console.log(`   Image count: ${o.imagePaths.length}`), console.log(`   Frame template: ${o.frameTemplatePath}`), console.log(`   Subtitle: ${o.subtitleText || "(none)"}`), console.log(`   S3 folder: ${o.s3Folder || "mut-hologram"}`), !b)
    return console.error("❌ [IPC] Python bridge not initialized"), console.log(`${"=".repeat(70)}
`), {
      success: !1,
      error: "Python bridge not initialized"
    };
  try {
    const e = (r) => {
      console.log(`📊 [IPC] Progress: ${r.step} - ${r.progress}% - ${r.message}`), l == null || l.webContents.send("video:progress", r);
    };
    b.on("progress", e);
    const t = await b.processFromImages({
      imagePaths: o.imagePaths,
      frameTemplatePath: o.frameTemplatePath,
      subtitleText: o.subtitleText,
      s3Folder: o.s3Folder || "mut-hologram"
    });
    return b.off("progress", e), console.log(`
✅ [IPC] Processing complete!`), console.log(`   Video: ${t.videoPath}`), console.log(`   S3 URL: ${t.s3Url}`), console.log(`   QR Code: ${t.qrCodePath}`), console.log(`${"=".repeat(70)}
`), l == null || l.webContents.send("video:complete", {
      success: !0,
      result: t
    }), {
      success: !0,
      result: t
    };
  } catch (e) {
    console.error("❌ [IPC] Video processing error:", e), console.log(`${"=".repeat(70)}
`);
    const t = e instanceof Error ? e.message : "Unknown error";
    return l == null || l.webContents.send("video:complete", {
      success: !1,
      error: t
    }), {
      success: !1,
      error: t
    };
  }
});
p.handle("image:save-blob", async (s, o, e) => {
  console.log(`
${"=".repeat(70)}`), console.log("💾 [IPC] SAVING BLOB TO FILE"), console.log(`${"=".repeat(70)}`), console.log(`   Filename: ${e}`), console.log(`   Blob data length: ${o.length} chars`);
  try {
    const t = f.join(w.getPath("temp"), "mut-captures");
    await F.mkdir(t, { recursive: !0 }), console.log(`   ✓ Temp directory: ${t}`);
    const r = o.substring(0, 50);
    console.log(`   Data URL prefix: ${r}...`);
    const n = o.replace(/^data:[^;]+;base64,/, "");
    console.log(`   Base64 data length after strip: ${n.length} chars`);
    const a = Buffer.from(n, "base64");
    console.log(`   ✓ Buffer size: ${(a.length / 1024).toFixed(2)} KB`);
    const c = a.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${c}`);
    const i = f.join(t, e);
    return await F.writeFile(i, a), console.log(`   ✓ File saved: ${i}`), console.log("✅ BLOB SAVED SUCCESSFULLY"), console.log(`${"=".repeat(70)}
`), {
      success: !0,
      filePath: i
    };
  } catch (t) {
    return console.error("❌ [IPC] Failed to save blob:", t), console.log(`${"=".repeat(70)}
`), {
      success: !1,
      error: t instanceof Error ? t.message : "Unknown error"
    };
  }
});
p.handle("video:extract-frames", async (s, o, e) => {
  if (console.log(`📸 Frame extraction requested: ${o} at [${e.join(", ")}]s`), !b)
    return {
      success: !1,
      error: "Python bridge not initialized"
    };
  try {
    const t = await b.extractFrames(o, e);
    return console.log(`✅ Frames extracted successfully: ${t.length} frames`), {
      success: !0,
      framePaths: t
    };
  } catch (t) {
    return console.error("❌ Frame extraction error:", t), {
      success: !1,
      error: t instanceof Error ? t.message : "Unknown error"
    };
  }
});
p.handle("video:save-buffer", async (s, o, e) => {
  console.log(`
${"=".repeat(70)}`), console.log("💾 [IPC] SAVING VIDEO BUFFER TO FILE"), console.log(`${"=".repeat(70)}`), console.log(`   Filename: ${e}`), console.log(`   Buffer size: ${(o.length / 1024).toFixed(2)} KB`);
  try {
    const t = f.join(w.getPath("temp"), "mut-captures");
    await F.mkdir(t, { recursive: !0 }), console.log(`   ✓ Temp directory: ${t}`);
    const r = Buffer.from(o);
    console.log(`   ✓ Buffer created: ${(r.length / 1024).toFixed(2)} KB`);
    const n = r.slice(0, 16).toString("hex").toUpperCase();
    console.log(`   File header (hex): ${n}`);
    const a = f.join(t, e);
    return await F.writeFile(a, r), console.log(`   ✓ File saved: ${a}`), console.log("✅ VIDEO BUFFER SAVED SUCCESSFULLY"), console.log(`${"=".repeat(70)}
`), {
      success: !0,
      filePath: a
    };
  } catch (t) {
    return console.error("❌ [IPC] Failed to save buffer:", t), console.log(`${"=".repeat(70)}
`), {
      success: !1,
      error: t instanceof Error ? t.message : "Unknown error"
    };
  }
});
p.handle("payment:process", async (s, o) => {
  if (console.log("💳 Payment processing requested:", o), !S)
    return {
      success: !1,
      error: "Card reader not initialized"
    };
  try {
    const e = await S.processPayment({
      amount: o.amount,
      currency: o.currency || "KRW",
      description: o.description || "Photo print"
    });
    return l == null || l.webContents.send("payment:complete", e), e;
  } catch (e) {
    const t = e instanceof Error ? e.message : "Unknown error";
    return l == null || l.webContents.send("payment:complete", {
      success: !1,
      status: "error",
      error: t
    }), {
      success: !1,
      error: t
    };
  }
});
p.handle("payment:cancel", async () => {
  if (console.log("💳 Payment cancellation requested"), !S)
    return { success: !1 };
  try {
    return await S.cancelPayment();
  } catch {
    return { success: !1 };
  }
});
p.handle("payment:get-status", async () => {
  if (console.log("💳 Payment status requested"), !S)
    return {
      success: !1,
      status: "error",
      error: "Card reader not initialized"
    };
  const s = S.getStatus();
  return {
    success: s.connected,
    status: s.connected ? "idle" : "offline"
  };
});
p.handle("hologram:set-mode", async (s, o, e) => {
  console.log("🎭 Hologram mode change requested:", o), k = {
    mode: o,
    qrCodePath: e == null ? void 0 : e.qrCodePath,
    videoPath: e == null ? void 0 : e.videoPath
  }, console.log("💾 Hologram state stored:", k);
  const t = j();
  return t ? (t.webContents.send("hologram:update", k), { success: !0 }) : { success: !1, error: "Target window not initialized" };
});
p.handle("hologram:show-qr", async (s, o, e) => {
  console.log("🎭 [IPC] hologram:show-qr called"), console.log("   QR Code:", o), console.log("   Video path:", e), k = {
    mode: "result",
    qrCodePath: o,
    videoPath: e
  }, console.log("💾 [IPC] Hologram state updated:", JSON.stringify(k));
  const t = j(), r = V ? "main window" : "hologram window";
  return t ? t.isDestroyed() ? (console.error(`❌ [IPC] ${r} is DESTROYED - cannot send message!`), { success: !1, error: `${r} destroyed` }) : (console.log(`✅ [IPC] ${r} exists and is not destroyed`), console.log("   isLoading:", t.webContents.isLoading()), console.log("   URL:", t.webContents.getURL()), console.log(`📤 [IPC] Sending hologram:update to ${r}...`), t.webContents.send("hologram:update", k), console.log("✅ [IPC] Message sent successfully"), { success: !0 }) : (console.error(`❌ [IPC] ${r} is NULL - cannot send message!`), { success: !1, error: `${r} not initialized` });
});
p.handle("hologram:show-logo", async () => {
  console.log("🎭 Hologram showing logo"), k = {
    mode: "logo"
  }, console.log("💾 Hologram state stored:", k);
  const s = j();
  return s ? (s.webContents.send("hologram:update", k), { success: !0 }) : { success: !1, error: "Target window not initialized" };
});
p.handle("hologram:get-state", async () => (console.log("🎭 Hologram state requested:", k), { success: !0, state: k }));
p.handle("file:read-as-data-url", async (s, o) => {
  try {
    console.log(`📂 [IPC] Reading file as data URL: ${o}`);
    let e = o;
    f.isAbsolute(o) || (e = f.join(w.getAppPath(), "MUT-distribution", o), console.log(`   Resolved to absolute path: ${e}`));
    const t = await F.readFile(e), r = t.toString("base64"), n = f.extname(o).toLowerCase(), i = `data:${{
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm"
    }[n] || "application/octet-stream"};base64,${r}`;
    return console.log(`✅ [IPC] File read successfully (${(t.length / 1024).toFixed(2)} KB)`), { success: !0, dataUrl: i };
  } catch (e) {
    return console.error(`❌ [IPC] Failed to read file: ${o}`, e), { success: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
p.handle("file:delete", async (s, o) => {
  try {
    console.log(`🗑️ [IPC] Deleting file: ${o}`);
    let e = o;
    f.isAbsolute(o) || (e = f.join(w.getAppPath(), "MUT-distribution", o), console.log(`   Resolved to absolute path: ${e}`));
    try {
      await F.access(e);
    } catch {
      return console.warn(`⚠️ [IPC] File does not exist, skipping: ${e}`), { success: !0, skipped: !0 };
    }
    return await F.unlink(e), console.log(`✅ [IPC] File deleted successfully: ${e}`), { success: !0 };
  } catch (e) {
    return console.error(`❌ [IPC] Failed to delete file: ${o}`, e), { success: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
