import { EventEmitter } from 'events';
import Store from 'electron-store';
import { CloudConfig, MachineRegistration, ApiResponse, MachineConfig, Command, HeartbeatStatus, SessionData, SessionUpdate, LogEntry } from './types';

const store = new Store<{
  machineToken: string | null;
  machineId: string | null;
  tokenExpiresAt: string | null;
  hardwareId: string | null;
  hardwareInfo: object | null;
}>({
  name: 'cloud-credentials',
});

// Error codes that indicate invalid/expired token requiring re-registration
const INVALID_TOKEN_ERRORS = ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'MACHINE_NOT_FOUND', 'UNAUTHORIZED'];

export class CloudClient extends EventEmitter {
  private static instance: CloudClient;
  private config: CloudConfig;
  private offlineQueue: Array<{ method: string; path: string; body?: unknown }> = [];
  private isOnline = true;
  private isReregistering = false;

  private constructor(config: CloudConfig) {
    super();
    this.config = config;
  }

  static getInstance(config?: CloudConfig): CloudClient {
    if (!CloudClient.instance) {
      if (!config) {
        throw new Error('CloudClient must be initialized with config first');
      }
      CloudClient.instance = new CloudClient(config);
    }
    return CloudClient.instance;
  }

  static initialize(config: CloudConfig): CloudClient {
    CloudClient.instance = new CloudClient(config);
    return CloudClient.instance;
  }

  // =========================================
  // Token Management
  // =========================================

  private getStoredToken(): string | null {
    const token = store.get('machineToken');
    const expiresAt = store.get('tokenExpiresAt');

    if (!token || !expiresAt) return null;

    // Check if expired (with 1 hour buffer)
    if (new Date(expiresAt).getTime() - 3600000 < Date.now()) {
      return null;
    }

    return token;
  }

  private storeToken(token: string, machineId: string, expiresAt: string): void {
    store.set('machineToken', token);
    store.set('machineId', machineId);
    store.set('tokenExpiresAt', expiresAt);
  }

  getMachineId(): string | null {
    return store.get('machineId');
  }

  isRegistered(): boolean {
    return !!this.getStoredToken();
  }

  clearCredentials(): void {
    store.delete('machineToken');
    store.delete('machineId');
    store.delete('tokenExpiresAt');
    // Note: We preserve hardwareId and hardwareInfo for re-registration
  }

  /**
   * Clear all stored data including hardware info
   * Use this for complete reset
   */
  clearAllData(): void {
    store.clear();
  }

  /**
   * Get stored hardware info for re-registration
   */
  getStoredHardwareInfo(): { hardwareId: string | null; hardwareInfo: object | null } {
    return {
      hardwareId: store.get('hardwareId'),
      hardwareInfo: store.get('hardwareInfo'),
    };
  }

  /**
   * Store hardware info for future re-registration
   */
  storeHardwareInfo(hardwareId: string, hardwareInfo?: object): void {
    store.set('hardwareId', hardwareId);
    if (hardwareInfo) {
      store.set('hardwareInfo', hardwareInfo);
    }
  }

  // =========================================
  // HTTP Methods
  // =========================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    requiresAuth = true,
    isRetryAfterReregister = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = this.getStoredToken();
      if (!token) {
        // Try to re-register if we have stored hardware info
        if (!isRetryAfterReregister) {
          const reregistered = await this.attemptReregistration();
          if (reregistered) {
            return this.request<T>(method, path, body, requiresAuth, true);
          }
        }
        return {
          success: false,
          error: { code: 'NO_TOKEN', message: 'Not authenticated' },
        };
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await this.fetchWithRetry(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json() as ApiResponse<T>;
      this.isOnline = true;

      // Check if response indicates invalid/expired token
      if (!data.success && data.error && this.isInvalidTokenError(data.error.code)) {
        console.log('\n🔄 ═══════════════════════════════════════════════════');
        console.log('🔄  TOKEN INVALID - Attempting automatic re-registration');
        console.log(`🔄  Error: ${data.error.code} - ${data.error.message}`);
        console.log('🔄 ═══════════════════════════════════════════════════\n');

        // Don't retry infinitely
        if (!isRetryAfterReregister) {
          const reregistered = await this.attemptReregistration();
          if (reregistered) {
            // Retry the original request with new token
            return this.request<T>(method, path, body, requiresAuth, true);
          }
        }
      }

      return data;
    } catch (error) {
      this.isOnline = false;

      // Queue authenticated requests for later retry when back online
      if (requiresAuth) {
        this.offlineQueue.push({ method, path, body });
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  /**
   * Check if error code indicates an invalid/expired token
   */
  private isInvalidTokenError(code: string): boolean {
    return INVALID_TOKEN_ERRORS.includes(code) ||
           code.toLowerCase().includes('invalid') ||
           code.toLowerCase().includes('expired') ||
           code.toLowerCase().includes('unauthorized');
  }

  /**
   * Attempt to re-register with stored hardware info
   */
  private async attemptReregistration(): Promise<boolean> {
    // Prevent concurrent re-registration attempts
    if (this.isReregistering) {
      console.log('[CloudClient] Re-registration already in progress, waiting...');
      // Wait for current re-registration to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isReregistering) {
            clearInterval(checkInterval);
            resolve(this.isRegistered());
          }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 10000);
      });
    }

    this.isReregistering = true;

    try {
      const { hardwareId, hardwareInfo } = this.getStoredHardwareInfo();

      if (!hardwareId) {
        console.log('[CloudClient] No stored hardware info for re-registration');
        return false;
      }

      console.log('[CloudClient] Clearing old credentials...');
      this.clearCredentials();

      console.log('[CloudClient] Re-registering with stored hardware info...');
      const result = await this.register(hardwareId, hardwareInfo || undefined);

      if (result.success) {
        console.log('\n✅ ═══════════════════════════════════════════════════');
        console.log('✅  AUTO RE-REGISTRATION SUCCESSFUL');
        console.log(`✅  New Machine ID: ${result.data?.machineId}`);
        console.log('✅ ═══════════════════════════════════════════════════\n');

        // Emit event so other components can react
        this.emit('reregistered', result.data);
        return true;
      } else {
        console.error('[CloudClient] Re-registration failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[CloudClient] Re-registration error:', error);
      return false;
    } finally {
      this.isReregistering = false;
    }
  }

  /**
   * Listen for re-registration events
   */
  onReregistered(callback: (data: MachineRegistration) => void): () => void {
    this.on('reregistered', callback);
    return () => this.off('reregistered', callback);
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    delay = 1000
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);

        if (response.ok || response.status < 500) {
          return response;
        }

        // Server error, retry
        if (i < retries - 1) {
          await this.sleep(delay * Math.pow(2, i));
        }
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(delay * Math.pow(2, i));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =========================================
  // Public API Methods
  // =========================================

  async register(
    hardwareId: string,
    hardwareInfo?: object
  ): Promise<ApiResponse<MachineRegistration>> {
    // Store hardware info for future re-registration (before making request)
    this.storeHardwareInfo(hardwareId, hardwareInfo);

    const response = await this.request<MachineRegistration>(
      'POST',
      '/machines/register',
      {
        hardwareId,
        apiKey: this.config.apiKey,
        hardwareInfo,
      },
      false // No auth required for registration
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

  async getConfig(currentVersion?: string): Promise<ApiResponse<{
    version: string;
    config?: MachineConfig;
    changed: boolean;
    updatedAt?: string;
  }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    const query = currentVersion ? `?currentVersion=${currentVersion}` : '';
    return this.request('GET', `/machines/${machineId}/config${query}`);
  }

  async sendLogs(logs: LogEntry[]): Promise<ApiResponse<{ received: number; dropped: number }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('POST', `/machines/${machineId}/logs`, { logs });
  }

  async sendHeartbeat(status: HeartbeatStatus): Promise<ApiResponse<{
    acknowledged: boolean;
    serverTime: string;
    configUpdateAvailable?: boolean;
  }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('POST', `/machines/${machineId}/heartbeat`, status);
  }

  async getPendingCommands(): Promise<ApiResponse<{
    commands: Command[];
  }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('GET', `/machines/${machineId}/commands/pending`);
  }

  async acknowledgeCommand(
    commandId: string,
    ack: {
      status: 'received' | 'completed' | 'failed';
      result?: object;
      errorMessage?: string;
    }
  ): Promise<ApiResponse<{ acknowledged: boolean }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('POST', `/machines/${machineId}/commands/${commandId}/ack`, ack);
  }

  async createSession(session: SessionData): Promise<ApiResponse<{ sessionId: string; sessionCode: string }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('POST', `/machines/${machineId}/sessions`, session);
  }

  async updateSession(
    sessionId: string,
    update: SessionUpdate
  ): Promise<ApiResponse<{ sessionId: string; updated: boolean }>> {
    const machineId = this.getMachineId();
    if (!machineId) {
      return { success: false, error: { code: 'NOT_REGISTERED', message: 'Machine not registered' } };
    }

    return this.request('PATCH', `/machines/${machineId}/sessions/${sessionId}`, update);
  }

  // =========================================
  // Offline Queue
  // =========================================

  async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      await this.request(item.method, item.path, item.body);
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export default CloudClient;
