import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { PythonBridge } from './python/bridge.js';
import { CameraController } from './hardware/camera.js';
import { PrinterController } from './hardware/printer.js';
import { CardReaderController } from './hardware/card-reader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let hologramWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let cameraController: CameraController | null = null;
let printerController: PrinterController | null = null;
let cardReader: CardReaderController | null = null;

const isDevelopment = process.env.NODE_ENV !== 'production';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: isDevelopment ? 2200 : 1080, // Wider in dev for split view
    height: isDevelopment ? 1100 : 1920, // Shorter in dev for better fit
    fullscreen: !isDevelopment, // Only fullscreen in production
    kiosk: !isDevelopment, // Only kiosk in production
    resizable: isDevelopment, // Allow resizing in development
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDevelopment) {
    // Load split view in development with Electron APIs
    mainWindow.loadURL('http://localhost:5173/#/dev');
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

  // Find second display, or use primary if only one exists
  const secondDisplay = displays.length > 1 ? displays[1] : displays[0];
  const { x, y } = secondDisplay.bounds;

  // Use 9:16 aspect ratio (1080x1920) for both monitors
  const hologramWidth = 1080;
  const hologramHeight = 1920;

  hologramWindow = new BrowserWindow({
    x: x + 100, // Offset slightly from edge
    y: y,
    width: hologramWidth,
    height: hologramHeight,
    fullscreen: false, // Don't use fullscreen, maintain 9:16 aspect ratio
    frame: !isDevelopment, // Show frame in development for easier debugging
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
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

  console.log(`✅ Hologram window created on display ${displays.length > 1 ? 2 : 1}`);
  console.log(`   Position: (${x + 100}, ${y}), Size: ${hologramWidth}x${hologramHeight} (9:16)`);
}

app.whenReady().then(async () => {
  console.log('🚀 Initializing MUT Hologram Studio...');

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

  // Initialize camera controller
  // Modes: mockMode (default), useWebcam (for MacBook), or real DSLR
  const useMock = process.env.MOCK_CAMERA !== 'false';
  const useWebcam = process.env.USE_WEBCAM === 'true';

  cameraController = new CameraController({
    mockMode: useMock && !useWebcam,
    useWebcam: useWebcam
  });
  const cameraResult = await cameraController.connect();
  if (cameraResult.success) {
    console.log('✅ Camera controller initialized');
  } else {
    console.error('⚠️  Camera initialization failed:', cameraResult.error);
  }

  // Initialize printer controller (mock mode by default)
  printerController = new PrinterController({ mockMode: true });
  const printerResult = await printerController.connect();
  if (printerResult.success) {
    console.log('✅ Printer controller initialized');
  } else {
    console.error('⚠️  Printer initialization failed:', printerResult.error);
  }

  // Initialize card reader (mock mode by default, 80% approval rate)
  cardReader = new CardReaderController({ mockMode: true, mockApprovalRate: 0.8 });
  const cardReaderResult = await cardReader.connect();
  if (cardReaderResult.success) {
    console.log('✅ Card reader initialized (mock mode)');

    // Set up payment status event forwarding
    cardReader.on('status', (statusUpdate) => {
      mainWindow?.webContents.send('payment:status', statusUpdate);
    });
  } else {
    console.error('⚠️  Card reader initialization failed:', cardReaderResult.error);
  }

  console.log('✅ All systems initialized\n');

  createWindow();
  createHologramWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createHologramWindow();
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
    return {
      success: status.available,
      ...status,
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
    // Process video using Python pipeline
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      chromaVideo: params.chromaVideo,
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
    // Blob data comes in format: "data:image/jpeg;base64,..."
    const base64Data = blobData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`   ✓ Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);

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
  };
});

// Hologram window control
ipcMain.handle('hologram:set-mode', async (_event, mode, data) => {
  console.log('🎭 Hologram mode change requested:', mode);

  if (!hologramWindow) {
    return { success: false, error: 'Hologram window not initialized' };
  }

  // Send mode change to hologram window
  hologramWindow.webContents.send('hologram:update', { mode, ...data });

  return { success: true };
});

ipcMain.handle('hologram:show-qr', async (_event, qrCodePath, videoPath) => {
  console.log('🎭 Hologram showing QR code:', qrCodePath);

  if (!hologramWindow) {
    return { success: false, error: 'Hologram window not initialized' };
  }

  hologramWindow.webContents.send('hologram:update', {
    mode: 'result',
    qrCodePath,
    videoPath,
  });

  return { success: true };
});

ipcMain.handle('hologram:show-logo', async () => {
  console.log('🎭 Hologram showing logo');

  if (!hologramWindow) {
    return { success: false, error: 'Hologram window not initialized' };
  }

  hologramWindow.webContents.send('hologram:update', {
    mode: 'logo',
  });

  return { success: true };
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
