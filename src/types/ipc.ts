// Type definitions for Electron IPC communication

// Camera API Types
export interface CameraAPI {
  startPreview: () => Promise<{ success: boolean }>;
  stopPreview: () => Promise<{ success: boolean }>;
  capture: () => Promise<{ success: boolean; imagePath?: string; error?: string }>;
}

// Printer API Types
export interface PrinterStatus {
  success: boolean;
  status: 'ready' | 'busy' | 'error' | 'offline';
  paperLevel: number;
  error?: string;
}

export interface PrintOptions {
  imagePath: string;
  copies?: number;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface PrinterAPI {
  getStatus: () => Promise<PrinterStatus>;
  print: (options: PrintOptions) => Promise<PrintResult>;
}

// Video Processing API Types
export interface VideoProcessParams {
  inputVideo: string;
  chromaVideo: string;
  subtitleText?: string;
  s3Folder?: string;
}

export interface VideoProcessingResult {
  videoPath: string;
  s3Url: string;
  s3Key: string;
  qrCodePath: string;
  framePaths: string[];
  compositionTime: number;
  totalTime: number;
}

export interface VideoProcessResult {
  success: boolean;
  result?: VideoProcessingResult;
  error?: string;
}

export interface VideoProgress {
  step: 'compositing' | 'uploading' | 'generating-qr';
  progress: number;
  message: string;
}

export interface VideoCompleteResult {
  success: boolean;
  result?: VideoProcessingResult;
  error?: string;
}

export interface VideoAPI {
  process: (params: VideoProcessParams) => Promise<VideoProcessResult>;
  cancel: (taskId: string) => Promise<{ success: boolean }>;
  onProgress: (callback: (progress: VideoProgress) => void) => () => void;
  onComplete: (callback: (result: VideoCompleteResult) => void) => () => void;
}

// Payment API Types - supports both mock mode and TL3600 hardware
export interface PaymentProcessParams {
  amount: number;
  currency?: string;
  description?: string;
}

export interface PaymentProcessResult {
  success: boolean;
  status?: string;
  transactionId?: string;
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  status: string;
  mode?: 'mock' | 'tl3600';
  error?: string;
}

export interface PaymentStatusUpdate {
  status: string;
  message?: string;
  cardType?: string;
}

export interface PaymentCompleteResult {
  success: boolean;
  status: string;
  transactionId?: string;
  amount?: number;
  timestamp?: string;
  cardType?: string;
  cardLast4?: string;
  cardNumber?: string;
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionMedia?: string;
  error?: string;
  rejectCode?: string;
  rejectMessage?: string;
}

export interface CancelTransactionParams {
  approvalNumber: string;
  originalDate: string;   // YYYYMMDD
  originalTime: string;   // hhmmss
  amount: number;
  transactionType: string; // '1' IC, '2' RF/MS
}

export interface PortInfo {
  path: string;
  manufacturer?: string;
}

export interface ListPortsResult {
  success: boolean;
  ports: PortInfo[];
  error?: string;
}

export interface PaymentAPI {
  process: (params: PaymentProcessParams) => Promise<PaymentProcessResult>;
  cancel: () => Promise<{ success: boolean }>;
  getStatus: () => Promise<PaymentStatusResult>;
  cancelTransaction: (params: CancelTransactionParams) => Promise<PaymentProcessResult>;
  listPorts: () => Promise<ListPortsResult>;
  onStatus: (callback: (status: PaymentStatusUpdate) => void) => () => void;
  onComplete: (callback: (result: PaymentCompleteResult) => void) => () => void;
  onCardRemoved: (callback: () => void) => () => void;
  onError: (callback: (error: { message: string }) => void) => () => void;
  onDisconnected: (callback: () => void) => () => void;
}

// Configuration API Types
export interface TL3600Config {
  port: string;
  terminalId: string;
  timeout: number;
  retryCount: number;
}

export interface PaymentConfigSettings {
  useMockMode: boolean;
  defaultAmount: number;
  mockApprovalRate: number;
}

export interface DebugConfig {
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface AppConfig {
  tl3600: TL3600Config;
  payment: PaymentConfigSettings;
  debug: DebugConfig;
}

export interface ConfigGetResult {
  success: boolean;
  config?: AppConfig;
  configPath?: string;
  error?: string;
}

export interface ConfigUpdateResult {
  success: boolean;
  config?: AppConfig | TL3600Config | PaymentConfigSettings;
  error?: string;
}

export interface ConfigAPI {
  get: () => Promise<ConfigGetResult>;
  update: (updates: Partial<AppConfig>) => Promise<ConfigUpdateResult>;
  updateTL3600: (updates: Partial<TL3600Config>) => Promise<ConfigUpdateResult>;
  updatePayment: (updates: Partial<PaymentConfigSettings>) => Promise<ConfigUpdateResult>;
  reset: () => Promise<ConfigUpdateResult>;
  getPath: () => Promise<{ success: boolean; path: string }>;
}

// Live Config Update Types
export interface LiveConfigUpdate {
  camera?: { useWebcam?: boolean; mockMode?: boolean };
  payment?: { useMockMode?: boolean; defaultAmount?: number; mockApprovalRate?: number };
  tl3600?: { port?: string; terminalId?: string; timeout?: number; retryCount?: number };
  display?: {
    splitScreenMode?: boolean;
    swapDisplays?: boolean;
    mainWidth?: number;
    mainHeight?: number;
    hologramWidth?: number;
    hologramHeight?: number;
  };
  printer?: { mockMode?: boolean };
  demo?: { enabled?: boolean; videoPath?: string };
  debug?: { enableLogging?: boolean; logLevel?: string; logToFile?: boolean; logFilePath?: string };
}

// App API Types - for screen state communication and live config updates
export interface AppAPI {
  // Notify main process when screen changes (for live config application)
  notifyScreenChange: (screen: string) => void;

  // Listen for config updates from cloud (main → renderer)
  onConfigUpdated: (callback: (config: LiveConfigUpdate) => void) => () => void;

  // Listen for config apply notification (when config is about to be applied)
  onConfigApplying: (callback: () => void) => () => void;

  // Listen for config applied notification (when config has been applied)
  onConfigApplied: (callback: () => void) => () => void;

  // Get current screen state (for debugging)
  getCurrentScreen: () => Promise<{ screen: string }>;
}

// Main Electron API Interface
export interface ElectronAPI {
  camera: CameraAPI;
  printer: PrinterAPI;
  video: VideoAPI;
  payment: PaymentAPI;
  config: ConfigAPI;
  app: AppAPI;
}

// Extend Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
