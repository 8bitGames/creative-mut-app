import { app, BrowserWindow, ipcMain, screen, Menu, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

// Try to load .env file (may not exist in production packaged app)
// eslint-disable-next-line @typescript-eslint/no-var-requires
try {
  require('dotenv').config({
    path: path.join(__dirname, '../.env'),
    override: true
  });
} catch (e) {
  // .env file not found in production - this is expected
}

import { PythonBridge } from './python/bridge';
import { CameraController } from './hardware/camera';
import { PrinterController } from './hardware/printer';
import { CardReaderController } from './hardware/card-reader';
import { appConfig, getConfig, getPaymentConfig, getTL3600Config, getCameraConfig } from './config';
import {
  initDatabase,
  closeDatabase,
  recordSessionStart,
  recordSessionEnd,
  updateSessionFrame,
  updateSessionImages,
  recordPayment,
  recordPrint,
  getDashboardStats,
  getFlowStatistics,
  insertSampleData,
} from './database/analytics';

let mainWindow: BrowserWindow | null = null;
let hologramWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let cameraController: CameraController | null = null;
let printerController: PrinterController | null = null;
let cardReader: CardReaderController | null = null;

// Persistent hologram state - survives screen transitions
let hologramState: {
  mode: 'logo' | 'result';
  qrCodePath?: string;
  videoPath?: string;
} = {
  mode: 'logo',
};

// Detect development mode - app.isPackaged is the reliable way for Electron
// In development: app.isPackaged = false, loads from Vite dev server
// In production (installed app): app.isPackaged = true, loads from built files
const isDevelopment = !app.isPackaged;

// Display settings - loaded from config after app.whenReady()
// These are populated when config is loaded
let displaySettings = {
  splitScreenMode: false,
  swapDisplays: false,
  mainWidth: 1080,
  mainHeight: 1920,
  hologramWidth: 1080,
  hologramHeight: 1920,
};

// Helper function to get the target window for hologram updates
function getHologramTargetWindow() {
  return displaySettings.splitScreenMode ? mainWindow : hologramWindow;
}

function createWindow() {
  const displays = screen.getAllDisplays();

  // Determine which display to use for main window
  // swapDisplays: false (default) → main on display 1, hologram on display 2
  // swapDisplays: true → main on display 2, hologram on display 1
  const mainDisplayIndex = displaySettings.swapDisplays && displays.length > 1 ? 1 : 0;
  const mainDisplay = displays[mainDisplayIndex];
  const { x, y } = mainDisplay.bounds;

  console.log(`📺 Main window will be on display ${mainDisplayIndex + 1}${displaySettings.swapDisplays ? ' (swapped)' : ''}`);

  mainWindow = new BrowserWindow({
    x: x,
    y: y,
    width: isDevelopment ? 2200 : displaySettings.mainWidth,
    height: isDevelopment ? 1100 : displaySettings.mainHeight,
    fullscreen: false,
    frame: isDevelopment, // No frame in production
    resizable: isDevelopment,
    alwaysOnTop: !isDevelopment && !displaySettings.splitScreenMode, // Stay on top in production
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
    },
  });

  console.log(`📺 Main window: ${displaySettings.mainWidth}x${displaySettings.mainHeight} at (${x}, ${y})`);

  if (isDevelopment) {
    // In dev mode, load from Vite server
    // The App component will check VITE_SPLIT_SCREEN_MODE to decide what to render
    mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createHologramWindow() {
  const displays = screen.getAllDisplays();

  // Determine which display to use for hologram window
  // swapDisplays: false (default) → hologram on display 2 (or display 1 if only one)
  // swapDisplays: true → hologram on display 1
  const hologramDisplayIndex = displaySettings.swapDisplays ? 0 : (displays.length > 1 ? 1 : 0);
  const hologramDisplay = displays[hologramDisplayIndex];
  const { x, y, width, height } = hologramDisplay.bounds;

  console.log(`📺 Hologram window will be on display ${hologramDisplayIndex + 1}${displaySettings.swapDisplays ? ' (swapped)' : ''}`);

  hologramWindow = new BrowserWindow({
    x: x,
    y: y,
    width: isDevelopment ? width : displaySettings.hologramWidth,
    height: isDevelopment ? height : displaySettings.hologramHeight,
    fullscreen: false,
    frame: isDevelopment, // No frame in production
    show: true,
    alwaysOnTop: !isDevelopment, // Stay on top in production
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
    },
  });

  // Load hologram display page
  if (isDevelopment) {
    // In dev mode, load from Vite with hash route for hologram
    hologramWindow.loadURL('http://localhost:5173/#/hologram');
  } else {
    // In production, load the built file with hash route
    hologramWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/hologram'
    });
  }

  hologramWindow.on('closed', () => {
    hologramWindow = null;
  });

  console.log(`📺 Hologram window: ${displaySettings.hologramWidth}x${displaySettings.hologramHeight} at (${x}, ${y}) on display ${hologramDisplayIndex + 1}`);
}

app.whenReady().then(async () => {
  console.log('🚀 Initializing MUT Hologram Studio...');

  // Grant camera/microphone permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      console.log(`✅ Permission granted: ${permission}`);
      callback(true);
    } else {
      console.log(`❌ Permission denied: ${permission}`);
      callback(false);
    }
  });

  // Also handle permission check (for getUserMedia)
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications'];
    return allowedPermissions.includes(permission);
  });

  console.log('📷 Camera permissions handler configured');

  // Load configuration from config.json (or create default)
  const config = appConfig.load();

  // Apply display settings from config
  displaySettings = {
    splitScreenMode: config.display.splitScreenMode,
    swapDisplays: config.display.swapDisplays,
    mainWidth: config.display.mainWidth,
    mainHeight: config.display.mainHeight,
    hologramWidth: config.display.hologramWidth,
    hologramHeight: config.display.hologramHeight,
  };
  console.log(`📺 Display mode: ${displaySettings.splitScreenMode ? 'Split Screen' : 'Dual Monitor'}${displaySettings.swapDisplays ? ' (displays swapped)' : ''}`);

  // Initialize analytics database (with error handling for native module issues)
  try {
    initDatabase();
  } catch (error) {
    console.error('⚠️ Failed to initialize analytics database:', error);
    // Continue without analytics - app should still work
  }

  // Remove menu bar in production
  if (!isDevelopment) {
    Menu.setApplicationMenu(null);
  }

  // Initialize Python bridge
  pythonBridge = new PythonBridge();
  const pythonCheck = await pythonBridge.checkDependencies();
  if (!pythonCheck.available) {
    console.error('⚠️  Python not available:', pythonCheck.error);
  } else {
    console.log('✅ Python bridge initialized');
  }

  // Set up progress event forwarding
  pythonBridge.on('progress', (progress) => {
    mainWindow?.webContents.send('video:progress', progress);
  });

  // Initialize camera controller using config
  const cameraConfig = getCameraConfig();
  cameraController = new CameraController({
    mockMode: cameraConfig.mockMode && !cameraConfig.useWebcam,
    useWebcam: cameraConfig.useWebcam
  });
  const cameraResult = await cameraController.connect();
  if (cameraResult.success) {
    console.log('✅ Camera controller initialized');
  } else {
    console.error('⚠️  Camera initialization failed:', cameraResult.error);
  }

  // Initialize printer controller (use actual printer)
  printerController = new PrinterController({ mockMode: false });
  const printerResult = await printerController.connect();
  if (printerResult.success) {
    console.log('✅ Printer controller initialized');
  } else {
    console.error('⚠️  Printer initialization failed:', printerResult.error);
  }

  // Initialize card reader
  // Load config and determine mode:
  // - If config.payment.useMockMode is true: Force mock mode (even in production)
  // - If config.payment.useMockMode is false (default): Auto-detect based on environment
  //   - Development: Use mock mode (safe for testing)
  //   - Production: Use real TL3600 hardware
  const paymentConfig = getPaymentConfig();
  const tl3600Config = getTL3600Config();

  // useMockMode=true forces mock, otherwise development=mock, production=real
  const useMockCardReader = paymentConfig.useMockMode || isDevelopment;

  cardReader = new CardReaderController({
    mockMode: useMockCardReader,
    mockApprovalRate: paymentConfig.mockApprovalRate,
    readerPort: tl3600Config.port,
    terminalId: tl3600Config.terminalId,
  });
  const cardReaderResult = await cardReader.connect();
  if (cardReaderResult.success) {
    const mode = useMockCardReader ? 'mock mode' : `TL3600 on ${tl3600Config.port}`;
    console.log(`✅ Card reader initialized (${mode})`);

    // Set up payment status event forwarding
    cardReader.on('status', (statusUpdate) => {
      mainWindow?.webContents.send('payment:status', statusUpdate);
    });

    // Forward card events for real hardware mode
    if (!useMockCardReader) {
      cardReader.on('cardRemoved', () => {
        mainWindow?.webContents.send('payment:card-removed');
      });

      cardReader.on('paymentComplete', (result) => {
        mainWindow?.webContents.send('payment:complete', result);
      });

      cardReader.on('error', (error) => {
        mainWindow?.webContents.send('payment:error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      cardReader.on('disconnected', () => {
        mainWindow?.webContents.send('payment:disconnected');
      });
    }
  } else {
    console.error('⚠️  Card reader initialization failed:', cardReaderResult.error);
  }

  console.log('✅ All systems initialized\n');

  createWindow();

  // Only create hologram window if NOT in split-screen mode
  if (!displaySettings.splitScreenMode) {
    console.log('📺 Creating separate hologram window (dual-monitor mode)');
    createHologramWindow();
  } else {
    console.log('🔀 Using split-screen mode (single window)');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (!displaySettings.splitScreenMode) {
        createHologramWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers - Placeholder implementations

// Camera operations
ipcMain.handle('camera:start-preview', async () => {
  console.log('📷 Camera preview requested');

  if (!cameraController) {
    return { success: false, error: 'Camera not initialized' };
  }

  // TODO: Implement live preview
  // For now, just verify camera is connected
  const status = cameraController.getStatus();

  return {
    success: status.connected,
    error: status.connected ? undefined : 'Camera not connected',
  };
});

ipcMain.handle('camera:stop-preview', async () => {
  console.log('📷 Camera preview stopped');
  return { success: true };
});

ipcMain.handle('camera:capture', async () => {
  console.log('📷 Camera capture requested');

  if (!cameraController) {
    return {
      success: false,
      error: 'Camera not initialized',
    };
  }

  try {
    const result = await cameraController.capture();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
});

// Printer operations
ipcMain.handle('printer:get-status', async () => {
  console.log('🖨️  Printer status requested');

  if (!printerController) {
    return {
      success: false,
      status: 'offline',
      paperLevel: 0,
      error: 'Printer not initialized',
    };
  }

  try {
    const status = await printerController.getStatus();
    // Map internal status to IPC status
    const statusMap: Record<string, string> = {
      'idle': 'ready',
      'printing': 'busy',
      'error': 'error',
      'offline': 'offline',
    };
    return {
      success: status.available,
      status: statusMap[status.status] || status.status,
      paperLevel: status.paperLevel,
      inkLevel: status.inkLevel,
      error: status.error,
    };
  } catch (error) {
    return {
      success: false,
      status: 'offline',
      paperLevel: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('printer:print', async (_event, options) => {
  console.log('🖨️  Print requested:', options);

  if (!printerController) {
    return {
      success: false,
      error: 'Printer not initialized',
    };
  }

  try {
    const result = await printerController.print(options);

    // Forward progress events
    printerController.on('progress', (progressData) => {
      mainWindow?.webContents.send('printer:progress', progressData);
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Video processing operations
ipcMain.handle('video:process', async (_event, params) => {
  console.log('Video processing requested:', params);

  if (!pythonBridge) {
    return {
      success: false,
      error: 'Python bridge not initialized'
    };
  }

  try {
    // Convert URL path to filesystem path for frame overlay
    let frameOverlayPath = params.chromaVideo;
    if (params.chromaVideo && params.chromaVideo.startsWith('/')) {
      // URL path like "/frame1.png" -> filesystem path
      const relativePath = params.chromaVideo.substring(1);
      frameOverlayPath = path.join(app.getAppPath(), 'public', relativePath);
      console.log(`   Frame overlay converted: ${params.chromaVideo} -> ${frameOverlayPath}`);
    } else if (params.chromaVideo && params.chromaVideo.startsWith('./')) {
      // Relative path like "./frame1.png" -> filesystem path
      const relativePath = params.chromaVideo.substring(2);
      frameOverlayPath = path.join(app.getAppPath(), 'public', relativePath);
      console.log(`   Frame overlay converted: ${params.chromaVideo} -> ${frameOverlayPath}`);
    }

    // Process video using Python pipeline
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      frameOverlay: frameOverlayPath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || 'mut-hologram',
    });

    // Send completion event
    mainWindow?.webContents.send('video:complete', {
      success: true,
      result: result
    });

    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error('Video processing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    mainWindow?.webContents.send('video:complete', {
      success: false,
      error: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
});

ipcMain.handle('video:cancel', async (_event, taskId) => {
  console.log('Video processing cancelled:', taskId);
  // TODO: Implement cancellation if needed
  return { success: true };
});

// Process video from images
ipcMain.handle('video:process-from-images', async (_event, params) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎬 [IPC] VIDEO PROCESSING FROM IMAGES`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Image count: ${params.imagePaths.length}`);
  console.log(`   Frame template: ${params.frameTemplatePath}`);
  console.log(`   Subtitle: ${params.subtitleText || '(none)'}`);
  console.log(`   S3 folder: ${params.s3Folder || 'mut-hologram'}`);

  if (!pythonBridge) {
    console.error(`❌ [IPC] Python bridge not initialized`);
    console.log(`${'='.repeat(70)}\n`);
    return {
      success: false,
      error: 'Python bridge not initialized'
    };
  }

  try {
    // Set up progress listener
    const progressListener = (progress: any) => {
      console.log(`📊 [IPC] Progress: ${progress.step} - ${progress.progress}% - ${progress.message}`);
      mainWindow?.webContents.send('video:progress', progress);
    };
    pythonBridge.on('progress', progressListener);

    // Process images
    const result = await pythonBridge.processFromImages({
      imagePaths: params.imagePaths,
      frameTemplatePath: params.frameTemplatePath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || 'mut-hologram',
    });

    // Clean up listener
    pythonBridge.off('progress', progressListener);

    console.log(`\n✅ [IPC] Processing complete!`);
    console.log(`   Video: ${result.videoPath}`);
    console.log(`   S3 URL: ${result.s3Url}`);
    console.log(`   QR Code: ${result.qrCodePath}`);
    console.log(`${'='.repeat(70)}\n`);

    // Send completion event
    mainWindow?.webContents.send('video:complete', {
      success: true,
      result: result
    });

    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error(`❌ [IPC] Video processing error:`, error);
    console.log(`${'='.repeat(70)}\n`);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    mainWindow?.webContents.send('video:complete', {
      success: false,
      error: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
});

// Save blob data to file
ipcMain.handle('image:save-blob', async (_event, blobData: string, filename: string) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`💾 [IPC] SAVING BLOB TO FILE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Blob data length: ${blobData.length} chars`);

  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(app.getPath('temp'), 'mut-captures');
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);

    // Convert base64 to buffer
    // Blob data comes in format: "data:image/jpeg;base64,..." or "data:video/webm;base64,..."
    const dataUrlPrefix = blobData.substring(0, 50);
    console.log(`   Data URL prefix: ${dataUrlPrefix}...`);

    const base64Data = blobData.replace(/^data:[^;]+;base64,/, '');
    console.log(`   Base64 data length after strip: ${base64Data.length} chars`);

    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`   ✓ Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);

    // Log first 16 bytes in hex to verify file format
    const hexHeader = buffer.slice(0, 16).toString('hex').toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);

    // Save to file
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, buffer);
    console.log(`   ✓ File saved: ${filePath}`);
    console.log(`✅ BLOB SAVED SUCCESSFULLY`);
    console.log(`${'='.repeat(70)}\n`);

    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    console.error(`❌ [IPC] Failed to save blob:`, error);
    console.log(`${'='.repeat(70)}\n`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Extract frames from video at specific timestamps
ipcMain.handle('video:extract-frames', async (_event, videoPath: string, timestamps: number[]) => {
  console.log(`📸 Frame extraction requested: ${videoPath} at [${timestamps.join(', ')}]s`);

  if (!pythonBridge) {
    return {
      success: false,
      error: 'Python bridge not initialized'
    };
  }

  try {
    const framePaths = await pythonBridge.extractFrames(videoPath, timestamps);

    console.log(`✅ Frames extracted successfully: ${framePaths.length} frames`);

    return {
      success: true,
      framePaths: framePaths
    };
  } catch (error) {
    console.error('❌ Frame extraction error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage
    };
  }
});

// Save video buffer (raw bytes) directly to file
ipcMain.handle('video:save-buffer', async (_event, byteArray: number[], filename: string) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`💾 [IPC] SAVING VIDEO BUFFER TO FILE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Buffer size: ${(byteArray.length / 1024).toFixed(2)} KB`);

  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(app.getPath('temp'), 'mut-captures');
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);

    // Convert array to Buffer
    const buffer = Buffer.from(byteArray);
    console.log(`   ✓ Buffer created: ${(buffer.length / 1024).toFixed(2)} KB`);

    // Log first 16 bytes for debugging
    const hexHeader = buffer.slice(0, 16).toString('hex').toUpperCase();
    console.log(`   File header (hex): ${hexHeader}`);

    // Save to file
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, buffer);
    console.log(`   ✓ File saved: ${filePath}`);
    console.log(`✅ VIDEO BUFFER SAVED SUCCESSFULLY`);
    console.log(`${'='.repeat(70)}\n`);

    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    console.error(`❌ [IPC] Failed to save buffer:`, error);
    console.log(`${'='.repeat(70)}\n`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Payment processing operations
ipcMain.handle('payment:process', async (_event, params) => {
  console.log('💳 Payment processing requested:', params);

  if (!cardReader) {
    return {
      success: false,
      error: 'Card reader not initialized',
    };
  }

  try {
    const result = await cardReader.processPayment({
      amount: params.amount,
      currency: params.currency || 'KRW',
      description: params.description || 'Photo print',
    });

    // Send completion event
    mainWindow?.webContents.send('payment:complete', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    mainWindow?.webContents.send('payment:complete', {
      success: false,
      status: 'error',
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
});

ipcMain.handle('payment:cancel', async () => {
  console.log('💳 Payment cancellation requested');

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

ipcMain.handle('payment:get-status', async () => {
  console.log('💳 Payment status requested');

  if (!cardReader) {
    return {
      success: false,
      status: 'error',
      error: 'Card reader not initialized',
    };
  }

  const status = cardReader.getStatus();

  return {
    success: status.connected,
    status: status.connected ? 'idle' : 'offline',
    mode: status.mode,
  };
});

// Cancel a previous transaction (for dashboard manual cancellation)
ipcMain.handle('payment:cancel-transaction', async (_event, options: {
  approvalNumber: string;
  originalDate: string;
  originalTime: string;
  amount: number;
  transactionType: string;
}) => {
  console.log('🚫 Transaction cancellation requested:', options);

  if (!cardReader) {
    return {
      success: false,
      error: 'Card reader not initialized',
    };
  }

  try {
    const result = await cardReader.cancelTransaction({
      approvalNumber: options.approvalNumber,
      originalDate: options.originalDate,
      originalTime: options.originalTime,
      amount: options.amount,
      transactionType: options.transactionType,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
});

// List available COM ports for TL3600 configuration
ipcMain.handle('payment:list-ports', async () => {
  console.log('🔌 Listing available COM ports...');

  try {
    const ports = await CardReaderController.listPorts();
    console.log(`   Found ${ports.length} ports:`, ports.map(p => p.path).join(', '));
    return {
      success: true,
      ports,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to list ports:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      ports: [],
    };
  }
});

// Hologram window control with persistent state
ipcMain.handle('hologram:set-mode', async (_event, mode, data) => {
  console.log('🎭 Hologram mode change requested:', mode);

  // Update persistent state
  hologramState = {
    mode,
    qrCodePath: data?.qrCodePath,
    videoPath: data?.videoPath,
  };
  console.log('💾 Hologram state stored:', hologramState);

  const targetWindow = getHologramTargetWindow();
  if (!targetWindow) {
    return { success: false, error: 'Target window not initialized' };
  }

  // Send mode change to appropriate window
  targetWindow.webContents.send('hologram:update', hologramState);

  return { success: true };
});

ipcMain.handle('hologram:show-qr', async (_event, qrCodePath, videoPath) => {
  console.log('🎭 [IPC] hologram:show-qr called');
  console.log('   QR Code:', qrCodePath);
  console.log('   Video path:', videoPath);

  // Update persistent state
  hologramState = {
    mode: 'result',
    qrCodePath,
    videoPath,
  };
  console.log('💾 [IPC] Hologram state updated:', JSON.stringify(hologramState));

  const targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? 'main window' : 'hologram window';

  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is NULL - cannot send message!`);
    return { success: false, error: `${windowName} not initialized` };
  }

  if (targetWindow.isDestroyed()) {
    console.error(`❌ [IPC] ${windowName} is DESTROYED - cannot send message!`);
    return { success: false, error: `${windowName} destroyed` };
  }

  console.log(`✅ [IPC] ${windowName} exists and is not destroyed`);
  console.log('   isLoading:', targetWindow.webContents.isLoading());
  console.log('   URL:', targetWindow.webContents.getURL());

  // Send IPC message to appropriate window
  console.log(`📤 [IPC] Sending hologram:update to ${windowName}...`);
  targetWindow.webContents.send('hologram:update', hologramState);
  console.log('✅ [IPC] Message sent successfully');

  return { success: true };
});

ipcMain.handle('hologram:show-logo', async () => {
  console.log('🎭 Hologram showing logo');

  // Update persistent state
  hologramState = {
    mode: 'logo',
  };
  console.log('💾 Hologram state stored:', hologramState);

  const targetWindow = getHologramTargetWindow();
  if (!targetWindow) {
    return { success: false, error: 'Target window not initialized' };
  }

  targetWindow.webContents.send('hologram:update', hologramState);

  return { success: true };
});

// Get current hologram state (for restoring after screen changes)
ipcMain.handle('hologram:get-state', async () => {
  console.log('🎭 Hologram state requested:', hologramState);
  return { success: true, state: hologramState };
});

// Read local file and return as data URL for secure loading in renderer
ipcMain.handle('file:read-as-data-url', async (_event, filePath: string) => {
  try {
    console.log(`📂 [IPC] Reading file as data URL: ${filePath}`);

    // Resolve relative paths relative to MUT-distribution directory
    // (where Python pipeline creates output files)
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.join(app.getAppPath(), 'MUT-distribution', filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }

    const fileBuffer = await fs.readFile(absolutePath);
    const base64 = fileBuffer.toString('base64');

    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`✅ [IPC] File read successfully (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

    return { success: true, dataUrl };
  } catch (error) {
    console.error(`❌ [IPC] Failed to read file: ${filePath}`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Delete local file
ipcMain.handle('file:delete', async (_event, filePath: string) => {
  try {
    console.log(`🗑️ [IPC] Deleting file: ${filePath}`);

    // Resolve relative paths relative to MUT-distribution directory
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.join(app.getAppPath(), 'MUT-distribution', filePath);
      console.log(`   Resolved to absolute path: ${absolutePath}`);
    }

    // Check if file exists before attempting to delete
    try {
      await fs.access(absolutePath);
    } catch {
      console.warn(`⚠️ [IPC] File does not exist, skipping: ${absolutePath}`);
      return { success: true, skipped: true };
    }

    // Delete the file
    await fs.unlink(absolutePath);
    console.log(`✅ [IPC] File deleted successfully: ${absolutePath}`);

    return { success: true };
  } catch (error) {
    console.error(`❌ [IPC] Failed to delete file: ${filePath}`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Analytics IPC Handlers
ipcMain.handle('analytics:session-start', async (_event, sessionId: string, startTime: number) => {
  recordSessionStart(sessionId, startTime);
  return { success: true };
});

ipcMain.handle('analytics:session-end', async (_event, sessionId: string, endTime: number) => {
  recordSessionEnd(sessionId, endTime);
  return { success: true };
});

ipcMain.handle('analytics:update-frame', async (_event, sessionId: string, frameName: string) => {
  updateSessionFrame(sessionId, frameName);
  return { success: true };
});

ipcMain.handle('analytics:update-images', async (_event, sessionId: string, imageCount: number) => {
  updateSessionImages(sessionId, imageCount);
  return { success: true };
});

ipcMain.handle('analytics:record-payment', async (_event, sessionId: string, amount: number, status: string, errorMessage?: string, details?: {
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionMedia?: string;
  cardNumber?: string;
}) => {
  recordPayment(sessionId, amount, status as any, errorMessage, details);
  return { success: true };
});

ipcMain.handle('analytics:record-print', async (_event, sessionId: string, imagePath: string, success: boolean, errorMessage?: string) => {
  recordPrint(sessionId, imagePath, success, errorMessage);
  return { success: true };
});

ipcMain.handle('analytics:get-dashboard-stats', async () => {
  const stats = getDashboardStats();
  return { success: true, stats };
});

ipcMain.handle('analytics:get-flow-statistics', async () => {
  const stats = getFlowStatistics();
  return { success: true, stats };
});

ipcMain.handle('analytics:insert-sample-data', async () => {
  console.log('📊 [IPC] Inserting sample data...');
  const result = insertSampleData();
  return result;
});

// Configuration IPC Handlers
ipcMain.handle('config:get', async () => {
  console.log('⚙️ [IPC] Getting configuration');
  try {
    const config = getConfig();
    const configPath = appConfig.getConfigPath();
    return {
      success: true,
      config,
      configPath,
    };
  } catch (error) {
    console.error('❌ [IPC] Failed to get config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:update', async (_event, updates: any) => {
  console.log('⚙️ [IPC] Updating configuration:', updates);
  try {
    const success = appConfig.update(updates);
    if (success) {
      return { success: true, config: getConfig() };
    }
    return { success: false, error: 'Failed to save config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to update config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:update-tl3600', async (_event, updates: any) => {
  console.log('⚙️ [IPC] Updating TL3600 configuration:', updates);
  try {
    const success = appConfig.updateTL3600(updates);
    if (success) {
      return { success: true, config: getTL3600Config() };
    }
    return { success: false, error: 'Failed to save TL3600 config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to update TL3600 config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:update-payment', async (_event, updates: any) => {
  console.log('⚙️ [IPC] Updating payment configuration:', updates);
  try {
    const success = appConfig.updatePayment(updates);
    if (success) {
      return { success: true, config: getPaymentConfig() };
    }
    return { success: false, error: 'Failed to save payment config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to update payment config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:update-camera', async (_event, updates: any) => {
  console.log('⚙️ [IPC] Updating camera configuration:', updates);
  try {
    const success = appConfig.updateCamera(updates);
    if (success) {
      return { success: true, config: getCameraConfig() };
    }
    return { success: false, error: 'Failed to save camera config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to update camera config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:update-display', async (_event, updates: any) => {
  console.log('⚙️ [IPC] Updating display configuration:', updates);
  console.log('⚠️ Note: Display changes require app restart to take effect');
  try {
    const success = appConfig.updateDisplay(updates);
    if (success) {
      return { success: true, config: getConfig().display, requiresRestart: true };
    }
    return { success: false, error: 'Failed to save display config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to update display config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:reset', async () => {
  console.log('⚙️ [IPC] Resetting configuration to defaults');
  try {
    const success = appConfig.reset();
    if (success) {
      return { success: true, config: getConfig() };
    }
    return { success: false, error: 'Failed to reset config' };
  } catch (error) {
    console.error('❌ [IPC] Failed to reset config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('config:get-path', async () => {
  return {
    success: true,
    path: appConfig.getConfigPath(),
  };
});

// Close database on app quit
app.on('before-quit', () => {
  closeDatabase();
});
