import * as os from 'os';
import { CloudClient } from './client';
import { ConfigSyncManager } from './config-sync';

type MachineStatus = 'online' | 'busy' | 'error';
type PeripheralStatus = 'ok' | 'error' | 'offline' | 'paper_low';

interface PeripheralStatusMap {
  camera: PeripheralStatus;
  printer: PeripheralStatus;
  cardReader: PeripheralStatus;
}

interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage?: number;
  sessionsToday?: number;
}

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export class HeartbeatManager {
  private client: CloudClient;
  private configSync: ConfigSyncManager | null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private status: MachineStatus = 'online';
  private peripheralStatus: PeripheralStatusMap = {
    camera: 'offline',
    printer: 'offline',
    cardReader: 'offline',
  };
  private startTime: number;
  private sessionsToday = 0;
  private onConfigUpdateAvailable?: () => void;
  private configVersion: string = 'unknown';
  private logger: { info: Function; warn: Function } | null = null;

  constructor(client: CloudClient, configSync?: ConfigSyncManager, logger?: { info: Function; warn: Function }) {
    this.client = client;
    this.configSync = configSync || null;
    this.logger = logger || null;
    this.startTime = Date.now();
  }

  private log(level: 'info' | 'warn', category: string, message: string, metadata?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger[level](category, message, metadata);
    } else {
      console[level](`[${category}] ${message}`, metadata || '');
    }
  }

  // =========================================
  // Lifecycle
  // =========================================

  start(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Send initial heartbeat
    this.sendHeartbeat();

    // Start interval
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    this.log('info', 'system', 'Heartbeat manager started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.log('info', 'system', 'Heartbeat manager stopped');
  }

  // =========================================
  // Heartbeat
  // =========================================

  private async sendHeartbeat(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      // Get config version from sync manager if available
      if (this.configSync) {
        this.configVersion = this.configSync.getCloudVersion();
      }

      const response = await this.client.sendHeartbeat({
        status: this.status,
        configVersion: this.configVersion,
        uptime,
        peripheralStatus: this.peripheralStatus,
        metrics,
      });

      if (response.success && response.data) {
        // Check if config update available
        if (response.data.configUpdateAvailable && this.onConfigUpdateAvailable) {
          console.log('\n🔔 ═══════════════════════════════════════════════════');
          console.log('🔔  CLOUD SERVER: Config Update Available!');
          console.log('🔔  Server Time:', response.data.serverTime);
          console.log('🔔  Triggering config sync...');
          console.log('🔔 ═══════════════════════════════════════════════════\n');
          this.onConfigUpdateAvailable();
        }
      } else {
        this.log('warn', 'cloud', 'Heartbeat failed', { error: response.error });
      }
    } catch (error) {
      this.log('warn', 'cloud', 'Error sending heartbeat', { error });
    }
  }

  private async collectMetrics(): Promise<HealthMetrics> {
    // Calculate CPU usage (simple moving average)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = Math.round(100 - (totalIdle / totalTick) * 100);

    // Calculate memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    return {
      cpuUsage,
      memoryUsage,
      sessionsToday: this.sessionsToday,
    };
  }

  // =========================================
  // Status Updates
  // =========================================

  setStatus(status: MachineStatus): void {
    this.status = status;
  }

  setPeripheralStatus(peripheral: keyof PeripheralStatusMap, status: PeripheralStatus): void {
    this.peripheralStatus[peripheral] = status;
  }

  setCameraStatus(status: PeripheralStatus): void {
    this.peripheralStatus.camera = status;
  }

  setPrinterStatus(status: PeripheralStatus): void {
    this.peripheralStatus.printer = status;
  }

  setCardReaderStatus(status: PeripheralStatus): void {
    this.peripheralStatus.cardReader = status;
  }

  incrementSessionsToday(): void {
    this.sessionsToday++;
  }

  resetSessionsToday(): void {
    this.sessionsToday = 0;
  }

  setConfigVersion(version: string): void {
    this.configVersion = version;
  }

  // =========================================
  // Config Update Callback
  // =========================================

  onConfigUpdate(callback: () => void): void {
    this.onConfigUpdateAvailable = callback;
  }

  // =========================================
  // Getters
  // =========================================

  getStatus(): MachineStatus {
    return this.status;
  }

  getPeripheralStatus(): PeripheralStatusMap {
    return { ...this.peripheralStatus };
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

export default HeartbeatManager;
