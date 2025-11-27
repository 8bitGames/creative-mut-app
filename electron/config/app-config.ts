/**
 * Application Configuration Manager
 * Reads/writes configuration from a JSON file that persists outside the app bundle.
 * This allows changing settings without rebuilding the application.
 *
 * Config file location:
 * - Windows: %APPDATA%/MUT Hologram Studio/config.json
 * - macOS: ~/Library/Application Support/MUT Hologram Studio/config.json
 * - Linux: ~/.config/MUT Hologram Studio/config.json
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface TL3600Config {
  port: string;           // COM port (e.g., 'COM3')
  terminalId: string;     // 16-character terminal ID
  timeout: number;        // Response timeout in ms
  retryCount: number;     // Number of retries on failure
}

export interface PaymentConfig {
  useMockMode: boolean;   // Force mock mode even in production (false = auto: mock in dev, real in prod)
  defaultAmount: number;  // Default payment amount in KRW
  mockApprovalRate: number; // Mock mode approval rate (0.0 - 1.0)
}

export interface CameraConfig {
  useWebcam: boolean;     // true: Use webcam, false: Use DSLR
  mockMode: boolean;      // Force mock camera (no actual capture)
}

export interface PrinterConfig {
  mockMode: boolean;      // true: Skip actual printing (for testing)
}

export interface DisplayConfig {
  splitScreenMode: boolean;  // true: Single window split, false: Dual monitor
  swapDisplays: boolean;     // true: Swap main/hologram displays (main→display2, hologram→display1)
  mainWidth: number;         // Main screen width (default: 1080)
  mainHeight: number;        // Main screen height (default: 1920)
  hologramWidth: number;     // Hologram screen width (default: 1080)
  hologramHeight: number;    // Hologram screen height (default: 1920)
}

export interface DemoConfig {
  enabled: boolean;          // true: Show demo video option in frame selection
  videoPath: string;         // Path to demo video file (relative to public folder)
}

export interface AppConfig {
  tl3600: TL3600Config;
  payment: PaymentConfig;
  camera: CameraConfig;
  printer: PrinterConfig;
  display: DisplayConfig;
  demo: DemoConfig;
  debug: {
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AppConfig = {
  tl3600: {
    port: 'COM3',
    terminalId: '0000000000000000',
    timeout: 3000,
    retryCount: 3,
  },
  payment: {
    useMockMode: false,  // Will be overridden by isDevelopment if not explicitly set
    defaultAmount: 5000,
    mockApprovalRate: 0.8,
  },
  camera: {
    useWebcam: true,     // Default to webcam for easier testing
    mockMode: false,
  },
  printer: {
    mockMode: false,     // Default to real printer
  },
  display: {
    splitScreenMode: false,  // Default to dual-monitor mode
    swapDisplays: false,     // Default: main→display1, hologram→display2
    mainWidth: 1080,
    mainHeight: 1920,
    hologramWidth: 1080,
    hologramHeight: 1920,
  },
  demo: {
    enabled: false,          // Default: demo mode disabled
    videoPath: './GD_PROTO_MACAU Fin_F.mov',  // Default demo video path
  },
  debug: {
    enableLogging: true,
    logLevel: 'info',
  },
};

// =============================================================================
// Config Manager
// =============================================================================

class ConfigManager {
  private config: AppConfig = DEFAULT_CONFIG;
  private configPath: string = '';
  private loaded: boolean = false;

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    if (!this.configPath) {
      // Use userData directory which is writable and persists
      const userDataPath = app.getPath('userData');
      this.configPath = path.join(userDataPath, 'config.json');
    }
    return this.configPath;
  }

  /**
   * Load configuration from file
   * Creates default config file if it doesn't exist
   */
  load(): AppConfig {
    if (this.loaded) {
      return this.config;
    }

    const configPath = this.getConfigPath();
    console.log(`📂 [Config] Loading configuration from: ${configPath}`);

    try {
      // Check if config file exists
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const loadedConfig = JSON.parse(fileContent) as Partial<AppConfig>;

        // Merge with defaults to ensure all fields exist
        this.config = this.mergeWithDefaults(loadedConfig);
        console.log('✅ [Config] Configuration loaded successfully');
      } else {
        // Create default config file
        console.log('📝 [Config] Config file not found, creating default...');
        this.config = { ...DEFAULT_CONFIG };
        this.save();
        console.log('✅ [Config] Default configuration created');
      }
    } catch (error) {
      console.error('❌ [Config] Failed to load config, using defaults:', error);
      this.config = { ...DEFAULT_CONFIG };
    }

    this.loaded = true;
    this.logConfig();
    return this.config;
  }

  /**
   * Save current configuration to file
   */
  save(): boolean {
    const configPath = this.getConfigPath();

    try {
      // Ensure directory exists
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write config with pretty formatting for easy editing
      const content = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(configPath, content, 'utf-8');
      console.log('💾 [Config] Configuration saved');
      return true;
    } catch (error) {
      console.error('❌ [Config] Failed to save config:', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    if (!this.loaded) {
      return this.load();
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  update(updates: Partial<AppConfig>): boolean {
    this.config = this.mergeWithDefaults({ ...this.config, ...updates });
    return this.save();
  }

  /**
   * Update TL3600 settings
   */
  updateTL3600(updates: Partial<TL3600Config>): boolean {
    this.config.tl3600 = { ...this.config.tl3600, ...updates };
    return this.save();
  }

  /**
   * Update payment settings
   */
  updatePayment(updates: Partial<PaymentConfig>): boolean {
    this.config.payment = { ...this.config.payment, ...updates };
    return this.save();
  }

  /**
   * Reset to default configuration
   */
  reset(): boolean {
    this.config = { ...DEFAULT_CONFIG };
    return this.save();
  }

  /**
   * Update camera settings
   */
  updateCamera(updates: Partial<CameraConfig>): boolean {
    this.config.camera = { ...this.config.camera, ...updates };
    return this.save();
  }

  /**
   * Update display settings
   */
  updateDisplay(updates: Partial<DisplayConfig>): boolean {
    this.config.display = { ...this.config.display, ...updates };
    return this.save();
  }

  /**
   * Merge loaded config with defaults
   */
  private mergeWithDefaults(loaded: Partial<AppConfig>): AppConfig {
    return {
      tl3600: {
        ...DEFAULT_CONFIG.tl3600,
        ...(loaded.tl3600 || {}),
      },
      payment: {
        ...DEFAULT_CONFIG.payment,
        ...(loaded.payment || {}),
      },
      camera: {
        ...DEFAULT_CONFIG.camera,
        ...(loaded.camera || {}),
      },
      printer: {
        ...DEFAULT_CONFIG.printer,
        ...(loaded.printer || {}),
      },
      display: {
        ...DEFAULT_CONFIG.display,
        ...(loaded.display || {}),
      },
      demo: {
        ...DEFAULT_CONFIG.demo,
        ...(loaded.demo || {}),
      },
      debug: {
        ...DEFAULT_CONFIG.debug,
        ...(loaded.debug || {}),
      },
    };
  }

  /**
   * Log current configuration (for debugging)
   */
  private logConfig(): void {
    console.log('📋 [Config] Current configuration:');
    console.log(`   TL3600 Port: ${this.config.tl3600.port}`);
    console.log(`   Payment Mock Mode: ${this.config.payment.useMockMode}`);
    console.log(`   Camera: ${this.config.camera.useWebcam ? 'Webcam' : 'DSLR'} (mock: ${this.config.camera.mockMode})`);
    console.log(`   Printer: ${this.config.printer.mockMode ? 'Mock (skip printing)' : 'Real printer'}`);
    console.log(`   Display: ${this.config.display.splitScreenMode ? 'Split Screen' : 'Dual Monitor'}${this.config.display.swapDisplays ? ' (SWAPPED)' : ''}`);
    console.log(`   Resolution: Main ${this.config.display.mainWidth}x${this.config.display.mainHeight}, Hologram ${this.config.display.hologramWidth}x${this.config.display.hologramHeight}`);
    console.log(`   Demo Mode: ${this.config.demo.enabled ? 'Enabled' : 'Disabled'}${this.config.demo.enabled ? ` (${this.config.demo.videoPath})` : ''}`);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const appConfig = new ConfigManager();

/**
 * Helper function to get config (ensures it's loaded)
 */
export function getConfig(): AppConfig {
  return appConfig.get();
}

/**
 * Helper function to get TL3600 config
 */
export function getTL3600Config(): TL3600Config {
  return appConfig.get().tl3600;
}

/**
 * Helper function to get payment config
 */
export function getPaymentConfig(): PaymentConfig {
  return appConfig.get().payment;
}

/**
 * Helper function to get camera config
 */
export function getCameraConfig(): CameraConfig {
  return appConfig.get().camera;
}

/**
 * Helper function to get printer config
 */
export function getPrinterConfig(): PrinterConfig {
  return appConfig.get().printer;
}

/**
 * Helper function to get display config
 */
export function getDisplayConfig(): DisplayConfig {
  return appConfig.get().display;
}

/**
 * Helper function to get demo config
 */
export function getDemoConfig(): DemoConfig {
  return appConfig.get().demo;
}
