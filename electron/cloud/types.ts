export interface CloudConfig {
  apiUrl: string;
  apiKey: string;
  organizationId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface MachineRegistration {
  machineId: string;
  machineToken: string;
  expiresAt: string;
  config: MachineConfig;
}

export interface MachineConfig {
  processing: {
    mode: 'cloud' | 'local' | 'hybrid' | 'auto';
    quality: 'low' | 'medium' | 'high' | 'ultra';
    faceEnhancement: boolean;
    maxProcessingTime: number;
    retryAttempts: number;
  };
  camera: {
    type: 'dslr' | 'webcam';
    resolution: { width: number; height: number };
    captureCount: number;
    captureInterval: number;
    countdown: number;
  };
  display: {
    splitScreenMode: boolean;
    swapDisplays: boolean;
    mainWidth: number;
    mainHeight: number;
    hologramWidth: number;
    hologramHeight: number;
    idleTimeout: number;
    showDebugInfo: boolean;
    language: 'en' | 'ko' | 'ja';
  };
  payment: {
    enabled: boolean;
    mockMode: boolean;
    currency: 'KRW' | 'USD' | 'JPY';
    defaultPrice: number;
    timeout: number;
  };
  printer: {
    enabled: boolean;
    mockMode: boolean;
    paperSize: '4x6' | '5x7' | '6x8';
    copies: number;
  };
  tl3600: {
    port: string;
    terminalId: string;
    timeout: number;
    retryCount: number;
  };
  demo: {
    enabled: boolean;
    videoPath: string;
  };
  debug: {
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    logToFile: boolean;
    logFilePath: string;
  };
}

export interface Command {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface HeartbeatStatus {
  status: 'online' | 'busy' | 'error';
  configVersion?: string;
  uptime?: number;
  peripheralStatus?: {
    camera: 'ok' | 'error' | 'offline';
    printer: 'ok' | 'error' | 'offline' | 'paper_low';
    cardReader: 'ok' | 'error' | 'offline';
  };
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    sessionsToday?: number;
  };
}

export interface SessionData {
  sessionCode: string;
  frameId?: string;
  processingMode?: string;
}

export interface SessionUpdate {
  status?: 'started' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processingTimeMs?: number;
  deliveryMethod?: string;
  paymentAmount?: number;
  currency?: string;
  processedVideoUrl?: string;
  thumbnailUrl?: string;
  qrCodeUrl?: string;
  rawImagesUrl?: string[];
  frameImagesUrl?: string[];
  errorMessage?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
  // TL3600 Payment Details
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionMedia?: 'ic' | 'rf' | 'ms';
  cardNumber?: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
