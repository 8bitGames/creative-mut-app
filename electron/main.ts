import { app, BrowserWindow, ipcMain, screen, Menu, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

// Load .env file from correct location based on environment
// In production: .env is bundled in extraResources
// In development: .env is in project root
// eslint-disable-next-line @typescript-eslint/no-var-requires
try {
  const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '../.env');

  require('dotenv').config({
    path: envPath,
    override: true
  });
  console.log(`Loaded .env from: ${envPath}`);
} catch (e) {
  console.warn('Could not load .env file:', e);
}

import { PythonBridge } from './python/bridge';
import { CameraController } from './hardware/camera';
import { PrinterController } from './hardware/printer';
import { CardReaderController } from './hardware/card-reader';
import { appConfig, getConfig, getPaymentConfig, getTL3600Config, getCameraConfig, getPrinterConfig } from './config';
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
  updatePaymentStatusByApproval,
} from './database/analytics';

// Cloud integration imports
import { CloudClient } from './cloud/client';
import { ConfigSyncManager } from './cloud/config-sync';
import { initializeLogger, getLogger, LogStreamer } from './cloud/log-streamer';
import { SessionSyncManager } from './cloud/session-sync';
import { CommandHandler } from './cloud/command-handler';
import { HeartbeatManager } from './cloud/heartbeat-manager';
import { getHardwareId, getHardwareInfo } from './cloud/hardware-id';

let mainWindow: BrowserWindow | null = null;
let hologramWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let cameraController: CameraController | null = null;
let printerController: PrinterController | null = null;
let cardReader: CardReaderController | null = null;

// Cloud integration globals
let cloudClient: CloudClient | null = null;
let configSync: ConfigSyncManager | null = null;
let sessionSync: SessionSyncManager | null = null;
let commandHandler: CommandHandler | null = null;
let heartbeatManager: HeartbeatManager | null = null;

// Check if cloud integration is enabled
const isCloudEnabled = !!(
  process.env.CLOUD_API_URL &&
  process.env.CLOUD_API_KEY
);

// =========================================
// Live Config State Management
// =========================================
// Track current renderer screen for config application timing
let currentRendererScreen: string = 'idle';
// Queue pending config changes for application at idle screen
let pendingConfigChanges: { newConfig: any; oldConfig: any } | null = null;
// Prevent concurrent config applications
let isApplyingConfig = false;

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

// Cloud integration initialization
async function initializeCloudIntegration(): Promise<void> {
  if (!isCloudEnabled) {
    console.log('☁️ Cloud integration disabled (no CLOUD_API_URL or CLOUD_API_KEY)');
    return;
  }

  console.log('☁️ Initializing cloud integration...');

  try {
    // Initialize cloud client
    cloudClient = CloudClient.initialize({
      apiUrl: process.env.CLOUD_API_URL!,
      apiKey: process.env.CLOUD_API_KEY!,
      organizationId: process.env.CLOUD_ORG_ID || '',
    });

    // Initialize logger
    initializeLogger(cloudClient, {
      minLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      consoleOutput: true,
    });

    const logger = getLogger();
    logger.info('system', 'Cloud client initialized');

    // Get or register machine
    const hardwareId = await getHardwareId();
    const hardwareInfo = await getHardwareInfo();

    logger.info('system', 'Hardware ID generated', { hardwareId });

    if (!(await cloudClient.isRegistered())) {
      logger.info('system', 'Registering machine with cloud...');
      const result = await cloudClient.register(hardwareId, hardwareInfo);

      if (result.success) {
        logger.info('system', 'Machine registered successfully', {
          machineId: result.data?.machineId,
        });
      } else {
        logger.error('system', 'Machine registration failed', {
          error: result.error,
        });
        // Continue without cloud - will retry on next startup
        return;
      }
    }

    // Initialize config sync manager
    configSync = new ConfigSyncManager(cloudClient);
    await configSync.initialize();
    logger.info('system', 'Config sync manager initialized', {
      version: configSync.getCloudVersion(),
    });

    // Initialize session sync manager
    sessionSync = new SessionSyncManager(cloudClient);
    await sessionSync.initialize();
    logger.info('system', 'Session sync manager initialized');

    // Initialize command handler
    commandHandler = new CommandHandler(cloudClient, logger);

    // Register custom command handlers
    commandHandler.setConfigUpdateHandler(async () => {
      return await configSync!.sync();
    });

    commandHandler.setDiagnosticsHandler(async (tests) => {
      return await runDiagnostics(tests);
    });

    commandHandler.startPolling();
    logger.info('system', 'Command handler started');

    // Initialize heartbeat manager
    heartbeatManager = new HeartbeatManager(cloudClient, configSync, logger);
    heartbeatManager.onConfigUpdate(() => {
      configSync?.sync();
    });
    heartbeatManager.start();
    logger.info('system', 'Heartbeat manager started');

    // =========================================
    // Live Config Change Listener
    // =========================================
    // Listen for config changes and apply them based on current screen state
    configSync.onChange(async (newConfig, oldConfig) => {
      console.log('\n☁️ ═══════════════════════════════════════════════════');
      console.log('☁️  CLOUD CONFIG CHANGE DETECTED');
      console.log('☁️ ═══════════════════════════════════════════════════');
      console.log(`   Current screen: ${currentRendererScreen}`);

      if (currentRendererScreen === 'idle' && !isApplyingConfig) {
        // At idle screen - apply immediately
        console.log('   → Applying immediately (at idle screen)');
        await applyConfigChanges(newConfig, oldConfig);
      } else {
        // Not at idle screen - queue for later
        console.log('   → Queuing for later (not at idle screen)');
        pendingConfigChanges = { newConfig, oldConfig };
        console.log('   Pending config stored - will apply when returning to idle');
      }

      console.log('☁️ ═══════════════════════════════════════════════════\n');
    });
    logger.info('system', 'Live config change listener registered');

    // Listen for automatic re-registration events
    cloudClient.onReregistered(async (data) => {
      logger.info('system', 'Machine was automatically re-registered', {
        machineId: data.machineId,
      });

      // Re-initialize config sync with new machine context
      if (configSync) {
        await configSync.sync();
      }

      // Update peripheral status
      updatePeripheralStatus();
    });

    // Update peripheral status based on current hardware state
    updatePeripheralStatus();

    console.log('✅ Cloud integration initialized successfully');
  } catch (error) {
    console.error('❌ Cloud integration failed:', error);
  }
}

// Update heartbeat peripheral status based on current hardware state
function updatePeripheralStatus(): void {
  if (!heartbeatManager) return;

  // Camera status
  if (cameraController) {
    const cameraStatus = cameraController.getStatus();
    heartbeatManager.setCameraStatus(cameraStatus.connected ? 'ok' : 'offline');
  }

  // Printer status
  if (printerController) {
    printerController.getStatus().then((status) => {
      if (!heartbeatManager) return;
      if (!status.available) {
        heartbeatManager.setPrinterStatus('offline');
      } else if (status.paperLevel < 10) {
        heartbeatManager.setPrinterStatus('paper_low');
      } else {
        heartbeatManager.setPrinterStatus('ok');
      }
    });
  }

  // Card reader status
  if (cardReader) {
    const readerStatus = cardReader.getStatus();
    heartbeatManager.setCardReaderStatus(readerStatus.connected ? 'ok' : 'offline');
  }
}

// =========================================
// Live Config Application Functions
// =========================================

/**
 * Reinitialize camera controller with new config
 */
async function reinitializeCamera(newCameraConfig: { useWebcam: boolean; mockMode: boolean }): Promise<void> {
  console.log('\n📷 ═══════════════════════════════════════════════════');
  console.log('📷  REINITIALIZING CAMERA');
  console.log('📷 ═══════════════════════════════════════════════════');
  console.log(`   useWebcam: ${newCameraConfig.useWebcam}`);
  console.log(`   mockMode: ${newCameraConfig.mockMode}`);

  try {
    // Disconnect existing camera
    if (cameraController) {
      console.log('   Disconnecting existing camera...');
      await cameraController.disconnect();
      cameraController = null;
    }

    // Create new camera controller with updated config
    cameraController = new CameraController({
      useWebcam: newCameraConfig.useWebcam,
      mockMode: newCameraConfig.mockMode && !newCameraConfig.useWebcam,
    });

    // Connect to camera
    const result = await cameraController.connect();
    if (result.success) {
      console.log('✅ Camera reinitialized successfully');
    } else {
      console.error('⚠️  Camera reinitialization failed:', result.error);
    }

    // Update peripheral status for heartbeat
    updatePeripheralStatus();
  } catch (error) {
    console.error('❌ Camera reinitialization error:', error);
  }

  console.log('📷 ═══════════════════════════════════════════════════\n');
}

/**
 * Reinitialize card reader controller with new config
 */
async function reinitializeCardReader(config: {
  payment: { useMockMode: boolean; mockApprovalRate: number };
  tl3600: { port: string; terminalId: string };
}): Promise<void> {
  console.log('\n💳 ═══════════════════════════════════════════════════');
  console.log('💳  REINITIALIZING CARD READER');
  console.log('💳 ═══════════════════════════════════════════════════');
  console.log(`   mockMode: ${config.payment.useMockMode}`);
  console.log(`   port: ${process.env.TL3600_PORT || config.tl3600.port}`);
  console.log(`   terminalId: ${process.env.TL3600_TERMINAL_ID || config.tl3600.terminalId}`);

  try {
    // Disconnect existing card reader
    if (cardReader) {
      console.log('   Disconnecting existing card reader...');
      await cardReader.disconnect();
      cardReader = null;
    }

    // Determine mock mode: respect MOCK_CARD_READER=false env setting
    const envMockSetting = process.env.MOCK_CARD_READER;
    const useMockCardReader = envMockSetting === 'false'
      ? false  // Explicitly disabled - use real hardware
      : (config.payment.useMockMode || isDevelopment);

    // Create new card reader controller
    cardReader = new CardReaderController({
      mockMode: useMockCardReader,
      mockApprovalRate: config.payment.mockApprovalRate,
      readerPort: process.env.TL3600_PORT || config.tl3600.port,
      terminalId: process.env.TL3600_TERMINAL_ID || config.tl3600.terminalId,
    });

    // Connect to card reader
    const result = await cardReader.connect();
    if (result.success) {
      const mode = useMockCardReader ? 'mock mode' : `TL3600 on ${process.env.TL3600_PORT || config.tl3600.port}`;
      console.log(`✅ Card reader reinitialized (${mode})`);

      // Re-setup event forwarding
      cardReader.on('status', (statusUpdate) => {
        mainWindow?.webContents.send('payment:status', statusUpdate);
      });

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
      console.error('⚠️  Card reader reinitialization failed:', result.error);
    }

    // Update peripheral status for heartbeat
    updatePeripheralStatus();
  } catch (error) {
    console.error('❌ Card reader reinitialization error:', error);
  }

  console.log('💳 ═══════════════════════════════════════════════════\n');
}

/**
 * Reconfigure windows with new display settings
 */
async function reconfigureWindows(newDisplayConfig: {
  splitScreenMode: boolean;
  swapDisplays: boolean;
  mainWidth: number;
  mainHeight: number;
  hologramWidth: number;
  hologramHeight: number;
}): Promise<void> {
  console.log('\n🖥️  ═══════════════════════════════════════════════════');
  console.log('🖥️   RECONFIGURING WINDOWS');
  console.log('🖥️  ═══════════════════════════════════════════════════');
  console.log(`   splitScreenMode: ${newDisplayConfig.splitScreenMode}`);
  console.log(`   swapDisplays: ${newDisplayConfig.swapDisplays}`);
  console.log(`   mainSize: ${newDisplayConfig.mainWidth}x${newDisplayConfig.mainHeight}`);
  console.log(`   hologramSize: ${newDisplayConfig.hologramWidth}x${newDisplayConfig.hologramHeight}`);

  const displays = screen.getAllDisplays();
  const oldSplitScreenMode = displaySettings.splitScreenMode;

  // Update display settings
  displaySettings = {
    splitScreenMode: newDisplayConfig.splitScreenMode,
    swapDisplays: newDisplayConfig.swapDisplays,
    mainWidth: newDisplayConfig.mainWidth,
    mainHeight: newDisplayConfig.mainHeight,
    hologramWidth: newDisplayConfig.hologramWidth,
    hologramHeight: newDisplayConfig.hologramHeight,
  };

  if (newDisplayConfig.splitScreenMode) {
    // Switching to split-screen mode - hide hologram window
    console.log('   Switching to split-screen mode...');
    if (hologramWindow && !hologramWindow.isDestroyed()) {
      hologramWindow.hide();
      console.log('   Hologram window hidden');
    }

    // Resize main window for split view (if not in dev mode)
    if (mainWindow && !mainWindow.isDestroyed() && !isDevelopment) {
      mainWindow.setSize(newDisplayConfig.mainWidth, newDisplayConfig.mainHeight);
      console.log(`   Main window resized to ${newDisplayConfig.mainWidth}x${newDisplayConfig.mainHeight}`);
    }
  } else {
    // Switching to dual-monitor mode
    console.log('   Switching to dual-monitor mode...');

    // Determine display assignments
    const mainDisplayIndex = newDisplayConfig.swapDisplays && displays.length > 1 ? 1 : 0;
    const hologramDisplayIndex = newDisplayConfig.swapDisplays ? 0 : (displays.length > 1 ? 1 : 0);

    const mainDisplay = displays[mainDisplayIndex];
    const hologramDisplay = displays[hologramDisplayIndex];

    // Reposition and resize main window (if not in dev mode)
    if (mainWindow && !mainWindow.isDestroyed() && !isDevelopment && mainDisplay) {
      mainWindow.setBounds({
        x: mainDisplay.bounds.x,
        y: mainDisplay.bounds.y,
        width: newDisplayConfig.mainWidth,
        height: newDisplayConfig.mainHeight,
      });
      console.log(`   Main window: ${newDisplayConfig.mainWidth}x${newDisplayConfig.mainHeight} on display ${mainDisplayIndex + 1}`);
    }

    // Handle hologram window
    if (hologramWindow && !hologramWindow.isDestroyed()) {
      // Reposition and resize existing hologram window
      if (!isDevelopment && hologramDisplay) {
        hologramWindow.setBounds({
          x: hologramDisplay.bounds.x,
          y: hologramDisplay.bounds.y,
          width: newDisplayConfig.hologramWidth,
          height: newDisplayConfig.hologramHeight,
        });
      }
      hologramWindow.show();
      console.log(`   Hologram window: ${newDisplayConfig.hologramWidth}x${newDisplayConfig.hologramHeight} on display ${hologramDisplayIndex + 1}`);
    } else if (!oldSplitScreenMode === false) {
      // Need to create hologram window (was in split-screen mode before)
      console.log('   Creating hologram window...');
      await createHologramWindow();
    }
  }

  console.log('✅ Windows reconfigured successfully');
  console.log('🖥️  ═══════════════════════════════════════════════════\n');
}

/**
 * Apply config changes - called when at idle screen or config sync detects changes
 */
async function applyConfigChanges(newConfig: any, oldConfig: any): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('⚡ APPLYING LIVE CONFIG CHANGES');
  console.log('═'.repeat(70));
  console.log(`   Current screen: ${currentRendererScreen}`);
  console.log(`   Time: ${new Date().toLocaleString()}`);

  // Notify renderer that config is being applied
  mainWindow?.webContents.send('app:config-applying');

  try {
    // Check for camera changes
    const cameraChanged =
      newConfig.camera?.useWebcam !== oldConfig.camera?.useWebcam ||
      newConfig.camera?.mockMode !== oldConfig.camera?.mockMode;

    if (cameraChanged) {
      console.log('\n📷 Camera config changed');
      await reinitializeCamera({
        useWebcam: newConfig.camera?.useWebcam ?? oldConfig.camera?.useWebcam,
        mockMode: newConfig.camera?.mockMode ?? oldConfig.camera?.mockMode,
      });
    }

    // Check for card reader changes
    const cardReaderChanged =
      newConfig.tl3600?.port !== oldConfig.tl3600?.port ||
      newConfig.tl3600?.terminalId !== oldConfig.tl3600?.terminalId ||
      newConfig.payment?.useMockMode !== oldConfig.payment?.useMockMode;

    if (cardReaderChanged) {
      console.log('\n💳 Card reader config changed');
      await reinitializeCardReader({
        payment: {
          useMockMode: newConfig.payment?.useMockMode ?? oldConfig.payment?.useMockMode,
          mockApprovalRate: newConfig.payment?.mockApprovalRate ?? oldConfig.payment?.mockApprovalRate ?? 0.8,
        },
        tl3600: {
          port: newConfig.tl3600?.port ?? oldConfig.tl3600?.port,
          terminalId: newConfig.tl3600?.terminalId ?? oldConfig.tl3600?.terminalId,
        },
      });
    }

    // Check for display changes
    const displayChanged =
      newConfig.display?.splitScreenMode !== oldConfig.display?.splitScreenMode ||
      newConfig.display?.swapDisplays !== oldConfig.display?.swapDisplays ||
      newConfig.display?.mainWidth !== oldConfig.display?.mainWidth ||
      newConfig.display?.mainHeight !== oldConfig.display?.mainHeight ||
      newConfig.display?.hologramWidth !== oldConfig.display?.hologramWidth ||
      newConfig.display?.hologramHeight !== oldConfig.display?.hologramHeight;

    if (displayChanged) {
      console.log('\n🖥️  Display config changed');
      await reconfigureWindows({
        splitScreenMode: newConfig.display?.splitScreenMode ?? oldConfig.display?.splitScreenMode,
        swapDisplays: newConfig.display?.swapDisplays ?? oldConfig.display?.swapDisplays,
        mainWidth: newConfig.display?.mainWidth ?? oldConfig.display?.mainWidth,
        mainHeight: newConfig.display?.mainHeight ?? oldConfig.display?.mainHeight,
        hologramWidth: newConfig.display?.hologramWidth ?? oldConfig.display?.hologramWidth,
        hologramHeight: newConfig.display?.hologramHeight ?? oldConfig.display?.hologramHeight,
      });
    }

    // Notify renderer that config has been applied
    mainWindow?.webContents.send('app:config-applied');
    mainWindow?.webContents.send('app:config-updated', newConfig);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ LIVE CONFIG CHANGES APPLIED SUCCESSFULLY');
    console.log('═'.repeat(70) + '\n');
  } catch (error) {
    console.error('❌ Error applying config changes:', error);
  }
}

/**
 * Apply pending config changes - called when returning to idle screen
 */
async function applyPendingConfig(): Promise<void> {
  if (!pendingConfigChanges || isApplyingConfig) {
    return;
  }

  isApplyingConfig = true;
  console.log('\n📋 ═══════════════════════════════════════════════════');
  console.log('📋  APPLYING PENDING CONFIG CHANGES');
  console.log('📋 ═══════════════════════════════════════════════════\n');

  try {
    await applyConfigChanges(pendingConfigChanges.newConfig, pendingConfigChanges.oldConfig);
    pendingConfigChanges = null;
  } catch (error) {
    console.error('❌ Failed to apply pending config:', error);
  } finally {
    isApplyingConfig = false;
  }
}

// Run diagnostics for cloud commands
async function runDiagnostics(tests: string[]): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  if (tests.includes('all') || tests.includes('camera')) {
    results.camera = {
      connected: cameraController?.getStatus().connected || false,
    };
  }

  if (tests.includes('all') || tests.includes('printer')) {
    const printerStatus = await printerController?.getStatus();
    results.printer = printerStatus;
  }

  if (tests.includes('all') || tests.includes('payment')) {
    results.payment = {
      connected: cardReader?.getStatus()?.connected || false,
    };
  }

  return results;
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

// Promise that resolves when hologram window is ready
let hologramWindowReadyPromise: Promise<void> | null = null;
let hologramWindowReadyResolve: (() => void) | null = null;

function createHologramWindow(): Promise<void> {
  console.log('📺 [Hologram] Creating hologram window...');

  // Check if window already exists
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    console.log('📺 [Hologram] Window already exists, skipping creation');
    return Promise.resolve();
  }

  // Create a new promise for this window creation
  hologramWindowReadyPromise = new Promise((resolve) => {
    hologramWindowReadyResolve = resolve;
  });

  const displays = screen.getAllDisplays();
  console.log(`📺 [Hologram] Available displays: ${displays.length}`);

  // Determine which display to use for hologram window
  // swapDisplays: false (default) → hologram on display 2 (or display 1 if only one)
  // swapDisplays: true → hologram on display 1
  const hologramDisplayIndex = displaySettings.swapDisplays ? 0 : (displays.length > 1 ? 1 : 0);
  const hologramDisplay = displays[hologramDisplayIndex];
  const { x, y, width, height } = hologramDisplay.bounds;

  console.log(`📺 [Hologram] Using display ${hologramDisplayIndex + 1}${displaySettings.swapDisplays ? ' (swapped)' : ''}`);
  console.log(`📺 [Hologram] Display bounds: ${width}x${height} at (${x}, ${y})`);

  try {
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

    console.log('📺 [Hologram] BrowserWindow created successfully');

    // Load hologram display page
    if (isDevelopment) {
      // In dev mode, load from Vite with hash route for hologram
      const url = 'http://localhost:5173/#/hologram';
      console.log(`📺 [Hologram] Loading URL (dev): ${url}`);
      hologramWindow.loadURL(url);
    } else {
      // In production, load the built file with hash route
      const filePath = path.join(__dirname, '../dist/index.html');
      console.log(`📺 [Hologram] Loading file (prod): ${filePath}`);
      hologramWindow.loadFile(filePath, {
        hash: '/hologram'
      });
    }

    // Resolve promise when page finishes loading
    hologramWindow.webContents.on('did-finish-load', () => {
      console.log('✅ [Hologram] Page finished loading');
      // Add extra delay for React to mount and set up IPC listeners
      setTimeout(() => {
        console.log('✅ [Hologram] Window fully ready (React mounted)');
        if (hologramWindowReadyResolve) {
          hologramWindowReadyResolve();
          hologramWindowReadyResolve = null;
        }
      }, 500);
    });

    // Log any load errors
    hologramWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`❌ [Hologram] Page failed to load: ${errorDescription} (${errorCode})`);
      // Still resolve to avoid hanging
      if (hologramWindowReadyResolve) {
        hologramWindowReadyResolve();
        hologramWindowReadyResolve = null;
      }
    });

    hologramWindow.on('closed', () => {
      console.log('📺 [Hologram] Window closed');
      hologramWindow = null;
      hologramWindowReadyPromise = null;
    });

    console.log(`📺 [Hologram] Window configured: ${displaySettings.hologramWidth}x${displaySettings.hologramHeight} at (${x}, ${y}) on display ${hologramDisplayIndex + 1}`);
  } catch (error) {
    console.error('❌ [Hologram] Failed to create window:', error);
    hologramWindow = null;
    if (hologramWindowReadyResolve) {
      hologramWindowReadyResolve();
      hologramWindowReadyResolve = null;
    }
  }

  return hologramWindowReadyPromise || Promise.resolve();
}

// Helper to wait for hologram window to be ready
async function waitForHologramWindow(): Promise<BrowserWindow | null> {
  if (hologramWindowReadyPromise) {
    await hologramWindowReadyPromise;
  }
  return hologramWindow;
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
  // IMPORTANT: Check .env SPLIT_SCREEN_MODE first to stay in sync with React App
  // This ensures Electron and React use the same split-screen setting
  const envSplitScreen = process.env.SPLIT_SCREEN_MODE === 'true' || process.env.VITE_SPLIT_SCREEN_MODE === 'true';
  const configSplitScreen = config.display.splitScreenMode;

  // Warn if there's a mismatch (helps debugging)
  if (envSplitScreen !== configSplitScreen) {
    console.log(`⚠️  Split-screen mismatch: .env=${envSplitScreen}, config.json=${configSplitScreen}`);
    console.log(`   Using .env setting: ${envSplitScreen}`);
  }

  displaySettings = {
    splitScreenMode: envSplitScreen, // Use .env over config.json for consistency with React
    swapDisplays: config.display.swapDisplays,
    mainWidth: config.display.mainWidth,
    mainHeight: config.display.mainHeight,
    hologramWidth: config.display.hologramWidth,
    hologramHeight: config.display.hologramHeight,
  };
  console.log(`📺 Display mode: ${displaySettings.splitScreenMode ? 'Split Screen (single window)' : 'Dual Monitor (two windows)'}${displaySettings.swapDisplays ? ' (displays swapped)' : ''}`);

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

  // Initialize printer controller
  const printerConfig = getPrinterConfig();
  printerController = new PrinterController({ mockMode: printerConfig.mockMode });
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

  // Determine mock mode:
  // 1. If MOCK_CARD_READER=false in .env, always use real hardware (even in development)
  // 2. If paymentConfig.useMockMode is explicitly true, use mock
  // 3. Otherwise fall back to isDevelopment behavior
  const envMockSetting = process.env.MOCK_CARD_READER;
  const useMockCardReader = envMockSetting === 'false'
    ? false  // Explicitly disabled - use real hardware
    : (paymentConfig.useMockMode || isDevelopment);

  // Use .env settings as priority over config.json (config.json may get reset)
  const readerPort = process.env.TL3600_PORT || tl3600Config.port;
  const terminalId = process.env.TL3600_TERMINAL_ID || tl3600Config.terminalId;

  console.log(`[CardReader] Initializing: port=${readerPort}, terminalId=${terminalId}, mockMode=${useMockCardReader}`);

  cardReader = new CardReaderController({
    mockMode: useMockCardReader,
    mockApprovalRate: paymentConfig.mockApprovalRate,
    readerPort: readerPort,
    terminalId: terminalId,
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

  // Initialize cloud integration (if configured)
  await initializeCloudIntegration();

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
    // Set up progress listener BEFORE printing starts
    const progressHandler = (progressData: { jobId: string; progress: number }) => {
      mainWindow?.webContents.send('printer:progress', progressData);
    };
    printerController.on('progress', progressHandler);

    const result = await printerController.print(options);

    // Clean up progress listener after print completes
    printerController.off('progress', progressHandler);

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

  // CRITICAL: Check dependencies before processing
  const depCheck = await pythonBridge.checkDependencies();
  if (!depCheck.available) {
    console.error(`❌ [video:process] Dependencies not available: ${depCheck.error}`);
    return {
      success: false,
      error: `Pipeline dependencies missing: ${depCheck.error}. Please ensure pipeline.exe and ffmpeg.exe are in the resources folder.`
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

    // CRITICAL: In production, frame files are in extraResources (not asar)
    // FFmpeg and Python cannot read from inside asar archives
    if (app.isPackaged) {
      const frameName = path.basename(frameOverlayPath);
      frameOverlayPath = path.join(process.resourcesPath, 'frames', frameName);
      console.log(`   Production frame path (extraResources): ${frameOverlayPath}`);
    }

    // Process video using Python pipeline
    const result = await pythonBridge.processVideo({
      inputVideo: params.inputVideo,
      frameOverlay: frameOverlayPath,
      subtitleText: params.subtitleText,
      s3Folder: params.s3Folder || 'mut-hologram',
    });

    // Send completion event to renderer (for onComplete listener)
    const completeResult = {
      success: true,
      result: result
    };

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📤 [IPC] SENDING video:complete EVENT`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   mainWindow exists: ${!!mainWindow}`);
    console.log(`   result.success: ${completeResult.success}`);
    console.log(`   result.result exists: ${!!completeResult.result}`);
    console.log(`   framePaths count: ${completeResult.result?.framePaths?.length || 0}`);
    console.log(`   s3Url: ${completeResult.result?.s3Url || 'N/A'}`);
    console.log(`${'='.repeat(70)}\n`);

    mainWindow?.webContents.send('video:complete', completeResult);

    // Also return result directly (for invoke pattern)
    return completeResult;
  } catch (error) {
    console.error('Video processing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const errorResult = {
      success: false,
      error: errorMessage
    };

    // Send error event to renderer
    mainWindow?.webContents.send('video:complete', errorResult);

    return errorResult;
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

  // CRITICAL: Check dependencies before processing
  const depCheck = await pythonBridge.checkDependencies();
  if (!depCheck.available) {
    console.error(`❌ [IPC] Dependencies not available: ${depCheck.error}`);
    console.log(`${'='.repeat(70)}\n`);
    return {
      success: false,
      error: `Pipeline dependencies missing: ${depCheck.error}. Please ensure pipeline.exe, stitch_images.exe and ffmpeg.exe are in the resources folder.`
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

    // Return result directly (no event - using invoke pattern)
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error(`❌ [IPC] Video processing error:`, error);
    console.log(`${'='.repeat(70)}\n`);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
ipcMain.handle('video:save-buffer', async (_event, data: Uint8Array | number[], filename: string) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`💾 [IPC] SAVING VIDEO BUFFER TO FILE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Filename: ${filename}`);
  console.log(`   Data type: ${data.constructor.name}, length: ${data.length}`);
  console.log(`   Buffer size: ${(data.length / 1024).toFixed(2)} KB`);

  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(app.getPath('temp'), 'mut-captures');
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`   ✓ Temp directory: ${tempDir}`);

    // Convert to Buffer - handles both Uint8Array and number[]
    const buffer = Buffer.from(data);
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
  console.log('🎭 [IPC] hologram:set-mode called:', mode);

  // Update persistent state
  hologramState = {
    mode,
    qrCodePath: data?.qrCodePath,
    videoPath: data?.videoPath,
  };
  console.log('💾 [IPC] Hologram state stored:', hologramState);

  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? 'main window' : 'hologram window';

  // Auto-recreate hologram window if it's NULL and we're not in split-screen mode
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow(); // Wait for window to fully load
    targetWindow = getHologramTargetWindow();
  }

  if (!targetWindow) {
    console.error(`❌ [IPC] ${windowName} is NULL - cannot send message!`);
    return { success: false, error: `${windowName} not initialized` };
  }

  // Send mode change to appropriate window
  targetWindow.webContents.send('hologram:update', hologramState);
  console.log(`✅ [IPC] hologram:update sent to ${windowName}`);

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

  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? 'main window' : 'hologram window';

  // Auto-recreate hologram window if it's NULL and we're not in split-screen mode
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow(); // Wait for window to fully load
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
  console.log('   isLoading:', targetWindow.webContents.isLoading());
  console.log('   URL:', targetWindow.webContents.getURL());

  // Send IPC message to appropriate window
  console.log(`📤 [IPC] Sending hologram:update to ${windowName}...`);
  targetWindow.webContents.send('hologram:update', hologramState);
  console.log('✅ [IPC] Message sent successfully');

  return { success: true };
});

ipcMain.handle('hologram:show-logo', async () => {
  console.log('🎭 [IPC] hologram:show-logo called');

  // Update persistent state
  hologramState = {
    mode: 'logo',
  };
  console.log('💾 [IPC] Hologram state stored:', hologramState);

  let targetWindow = getHologramTargetWindow();
  const windowName = displaySettings.splitScreenMode ? 'main window' : 'hologram window';

  // Auto-recreate hologram window if it's NULL and we're not in split-screen mode
  if (!targetWindow && !displaySettings.splitScreenMode) {
    console.warn(`⚠️ [IPC] ${windowName} is NULL - attempting to recreate...`);
    await createHologramWindow(); // Wait for window to fully load
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

  targetWindow.webContents.send('hologram:update', hologramState);
  console.log(`✅ [IPC] hologram:update sent to ${windowName}`);

  return { success: true };
});

// Get current hologram state (for restoring after screen changes)
ipcMain.handle('hologram:get-state', async () => {
  console.log('🎭 Hologram state requested:', hologramState);
  return { success: true, state: hologramState };
});

// Check if file exists
ipcMain.handle('file:exists', async (_event, filePath: string) => {
  try {
    // Resolve relative paths relative to MUT-distribution directory
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.join(app.getAppPath(), 'MUT-distribution', filePath);
    }

    await fs.access(absolutePath);
    return { success: true, exists: true };
  } catch (error) {
    return { success: true, exists: false };
  }
});

// Read local file and return as data URL for secure loading in renderer
ipcMain.handle('file:read-as-data-url', async (_event, filePath: string) => {
  try {
    console.log(`📂 [IPC] Reading file as data URL: ${filePath}`);

    // ROBUST: Try multiple path resolution strategies
    let absolutePath = filePath;
    const attemptedPaths: string[] = [];
    
    if (path.isAbsolute(filePath)) {
      // Already absolute - use as-is
      absolutePath = filePath;
      attemptedPaths.push(absolutePath);
    } else {
      // Try multiple resolution strategies
      const basePaths = [
        app.getAppPath(), // App path (development)
        process.resourcesPath, // Resources path (production)
        path.join(app.getAppPath(), 'MUT-distribution'), // MUT-distribution in app
        path.join(process.resourcesPath, 'MUT-distribution'), // MUT-distribution in resources
      ];
      
      for (const basePath of basePaths) {
        const candidatePath = path.join(basePath, filePath);
        attemptedPaths.push(candidatePath);
        
        try {
          await fs.access(candidatePath);
          absolutePath = candidatePath;
          console.log(`   ✅ Found file at: ${absolutePath}`);
          break;
        } catch {
          // Continue to next path
        }
      }
    }

    // Check if file exists at resolved path
    try {
      await fs.access(absolutePath);
    } catch (accessError) {
      console.error(`❌ [IPC] File does not exist at any attempted path:`);
      attemptedPaths.forEach((p, i) => {
        console.error(`   ${i + 1}. ${p}`);
      });
      return { 
        success: false, 
        error: `File not found: ${filePath}. Attempted paths: ${attemptedPaths.join('; ')}` 
      };
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
  transactionId?: string;
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

ipcMain.handle('analytics:update-payment-status', async (_event, approvalNumber: string, newStatus: string) => {
  console.log(`📊 [IPC] Updating payment status: ${approvalNumber} -> ${newStatus}`);
  const success = updatePaymentStatusByApproval(approvalNumber, newStatus as any);
  return { success };
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

// =========================================
// App Screen State IPC Handlers
// =========================================

// Handle screen change notifications from renderer
ipcMain.on('app:screen-changed', (_event, screen: string) => {
  const previousScreen = currentRendererScreen;
  currentRendererScreen = screen;

  console.log(`📱 [App] Screen changed: ${previousScreen} → ${screen}`);

  // ROBUST: Reset hologram to logo whenever main screen goes to idle
  // This ensures hologram resets regardless of how we got to idle
  if (screen === 'idle') {
    console.log('🔄 [App] Main screen transitioned to idle - resetting hologram to logo');
    // Update persistent state
    hologramState = {
      mode: 'logo',
    };
    
    // Send to hologram window
    const targetWindow = getHologramTargetWindow();
    const windowName = displaySettings.splitScreenMode ? 'main window' : 'hologram window';
    
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('hologram:update', hologramState);
      console.log(`✅ [App] Hologram reset to logo sent to ${windowName}`);
    } else {
      console.warn(`⚠️ [App] Cannot reset hologram - ${windowName} not available`);
    }
  }

  // If we just arrived at idle and have pending config, apply it
  if (screen === 'idle' && pendingConfigChanges && !isApplyingConfig) {
    console.log('📱 [App] At idle screen with pending config - applying...');
    applyPendingConfig();
  }
});

// Get current screen state (for debugging)
ipcMain.handle('app:get-current-screen', async () => {
  return { screen: currentRendererScreen };
});

// Close database on app quit
app.on('before-quit', async () => {
  // Cleanup cloud integration
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

  // Flush remaining logs
  try {
    const logger = getLogger();
    if (logger) {
      await logger.shutdown();
    }
  } catch {
    // Logger may not be initialized
  }

  closeDatabase();
});
