import { EventEmitter } from 'events';
import { CloudClient } from './client';
import { appConfig, AppConfig } from '../config/app-config';
import { MachineConfig } from './types';

const CONFIG_SYNC_INTERVAL = 60000; // 60 seconds

/**
 * ConfigSyncManager - Syncs cloud config with local AppConfig
 *
 * This doesn't replace the existing ConfigManager in electron/config/app-config.ts
 * Instead, it fetches from cloud and updates the local config via the singleton.
 *
 * NOTE: The local config uses a singleton pattern - import { appConfig } from '../config/app-config'
 * The appConfig.get() method returns the current config, and appConfig.update() updates it.
 */
export class ConfigSyncManager extends EventEmitter {
  private client: CloudClient;
  private cloudVersion: string = 'unknown';
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor(client: CloudClient) {
    super();
    this.client = client;
  }

  async initialize(): Promise<AppConfig> {
    if (this.initialized) {
      return appConfig.get();
    }

    // Try to sync from cloud
    await this.sync();

    // Start periodic sync
    this.startPeriodicSync();

    this.initialized = true;
    return appConfig.get();
  }

  async sync(): Promise<boolean> {
    try {
      const response = await this.client.getConfig(this.cloudVersion);

      if (!response.success) {
        console.warn('[ConfigSync] Failed to sync:', response.error);
        return false;
      }

      if (!response.data?.changed) {
        return false;
      }

      if (response.data.config) {
        const cloudConfig = response.data.config;
        const oldVersion = this.cloudVersion;
        this.cloudVersion = response.data.version;

        // Map cloud config to local config schema
        const localUpdates = this.mapCloudToLocal(cloudConfig);

        // Get old config for comparison
        const oldConfig = appConfig.get();

        // Update local config (uses singleton)
        appConfig.update(localUpdates);

        const newConfig = appConfig.get();

        // ========== DETAILED CHANGE LOGGING ==========
        console.log('\n' + '='.repeat(60));
        console.log('☁️  CLOUD CONFIG CHANGE DETECTED');
        console.log('='.repeat(60));
        console.log(`📦 Version: ${oldVersion} → ${this.cloudVersion}`);
        console.log(`⏰ Time: ${new Date().toLocaleString()}`);
        console.log('-'.repeat(60));

        // Check if this is initial sync
        const isInitialSync = oldVersion === 'unknown' || oldVersion === 'default';

        if (isInitialSync) {
          console.log('\n🆕 INITIAL SYNC - Cloud config received:');
          this.logCloudConfig(cloudConfig);
        } else {
          // Log each section that changed
          let hasChanges = false;
          hasChanges = this.logConfigChanges('camera', oldConfig.camera, newConfig.camera) || hasChanges;
          hasChanges = this.logConfigChanges('payment', oldConfig.payment, newConfig.payment) || hasChanges;
          hasChanges = this.logConfigChanges('tl3600', oldConfig.tl3600, newConfig.tl3600) || hasChanges;
          hasChanges = this.logConfigChanges('display', oldConfig.display, newConfig.display) || hasChanges;
          hasChanges = this.logConfigChanges('demo', oldConfig.demo, newConfig.demo) || hasChanges;
          hasChanges = this.logConfigChanges('debug', oldConfig.debug, newConfig.debug) || hasChanges;
          hasChanges = this.logConfigChanges('printer', oldConfig.printer, newConfig.printer) || hasChanges;

          if (!hasChanges) {
            console.log('\n📋 No field-level changes detected (config structure update)');
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Config applied successfully');
        console.log('='.repeat(60) + '\n');
        // =============================================

        // Emit change event
        this.emit('change', newConfig, oldConfig);

        return true;
      }

      return false;
    } catch (error) {
      console.error('[ConfigSync] Sync error:', error);
      return false;
    }
  }

  /**
   * Log changes between old and new config sections
   * Returns true if changes were found
   */
  private logConfigChanges(section: string, oldVal: unknown, newVal: unknown): boolean {
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      return false; // No changes in this section
    }

    console.log(`\n📝 [${section.toUpperCase()}] Changes:`);

    if (typeof oldVal === 'object' && oldVal && typeof newVal === 'object' && newVal) {
      const oldObj = oldVal as Record<string, unknown>;
      const newObj = newVal as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        const oldValue = oldObj[key];
        const newValue = newObj[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const oldDisplay = typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue;
          const newDisplay = typeof newValue === 'object' ? JSON.stringify(newValue) : newValue;
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
  private logCloudConfig(cloud: MachineConfig): void {
    console.log('\n📷 [CAMERA]');
    console.log(`   • type: ${cloud.camera?.type}`);
    console.log(`   • resolution: ${cloud.camera?.resolution?.width}x${cloud.camera?.resolution?.height}`);
    console.log(`   • captureCount: ${cloud.camera?.captureCount}`);

    console.log('\n💳 [PAYMENT]');
    console.log(`   • enabled: ${cloud.payment?.enabled}`);
    console.log(`   • mockMode: ${cloud.payment?.mockMode}`);
    console.log(`   • defaultPrice: ${cloud.payment?.defaultPrice} ${cloud.payment?.currency}`);

    console.log('\n🖥️  [DISPLAY]');
    console.log(`   • splitScreenMode: ${cloud.display?.splitScreenMode}`);
    console.log(`   • mainSize: ${cloud.display?.mainWidth}x${cloud.display?.mainHeight}`);
    console.log(`   • language: ${cloud.display?.language}`);

    console.log('\n🖨️  [PRINTER]');
    console.log(`   • enabled: ${cloud.printer?.enabled}`);
    console.log(`   • mockMode: ${cloud.printer?.mockMode}`);
    console.log(`   • paperSize: ${cloud.printer?.paperSize}`);

    console.log('\n⚙️  [PROCESSING]');
    console.log(`   • mode: ${cloud.processing?.mode}`);
    console.log(`   • quality: ${cloud.processing?.quality}`);
    console.log(`   • faceEnhancement: ${cloud.processing?.faceEnhancement}`);

    console.log('\n🔧 [DEBUG]');
    console.log(`   • enableLogging: ${cloud.debug?.enableLogging}`);
    console.log(`   • logLevel: ${cloud.debug?.logLevel}`);
  }

  /**
   * Map cloud config schema to local AppConfig schema
   */
  private mapCloudToLocal(cloud: MachineConfig): Partial<AppConfig> {
    const local: Partial<AppConfig> = {};

    // Camera mapping
    if (cloud.camera) {
      local.camera = {
        useWebcam: cloud.camera.type === 'webcam',
        mockMode: false, // Preserve local value
      };
    }

    // Payment mapping
    if (cloud.payment) {
      local.payment = {
        useMockMode: cloud.payment.mockMode,
        defaultAmount: cloud.payment.defaultPrice,
        mockApprovalRate: 0.8, // Preserve local default
      };
    }

    // TL3600 mapping (direct mapping)
    if (cloud.tl3600) {
      local.tl3600 = {
        port: cloud.tl3600.port,
        terminalId: cloud.tl3600.terminalId,
        timeout: cloud.tl3600.timeout || 3000,
        retryCount: cloud.tl3600.retryCount || 3,
      };
    }

    // Display mapping (NOTE: default is portrait orientation 1080x1920)
    if (cloud.display) {
      local.display = {
        splitScreenMode: cloud.display.splitScreenMode,
        swapDisplays: cloud.display.swapDisplays || false,
        mainWidth: cloud.display.mainWidth || 1080,
        mainHeight: cloud.display.mainHeight || 1920,
        hologramWidth: cloud.display.hologramWidth || 1080,
        hologramHeight: cloud.display.hologramHeight || 1920,
      };
    }

    // Demo mapping
    if (cloud.demo) {
      local.demo = {
        enabled: cloud.demo.enabled,
        videoPath: cloud.demo.videoPath || '',
      };
    }

    // Debug mapping
    if (cloud.debug) {
      local.debug = {
        enableLogging: cloud.debug.enableLogging,
        logLevel: cloud.debug.logLevel || 'info',
        logToFile: cloud.debug.logToFile || false,
        logFilePath: cloud.debug.logFilePath || '',
      };
    }

    // Printer mapping
    if (cloud.printer) {
      local.printer = {
        mockMode: cloud.printer.mockMode,
      };
    }

    return local;
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const changed = await this.sync();
      if (changed) {
        console.log('[ConfigSync] Periodic sync detected changes');
      }
    }, CONFIG_SYNC_INTERVAL);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getCloudVersion(): string {
    return this.cloudVersion;
  }

  onChange(callback: (newConfig: AppConfig, oldConfig: AppConfig) => void): () => void {
    this.on('change', callback);
    return () => this.off('change', callback);
  }
}

export default ConfigSyncManager;
