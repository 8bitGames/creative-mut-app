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

// Payment API Types
export type PaymentMethod = 'card' | 'cash';

export interface PaymentProcessParams {
  amount: number;
  currency: string;
  method: PaymentMethod;
}

export interface PaymentProcessResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface PaymentStatus {
  success: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentId: string;
  error?: string;
}

export interface PaymentStatusUpdate {
  status: string;
  message?: string;
}

export interface PaymentCompleteResult {
  success: boolean;
  transactionId?: string;
  receiptUrl?: string;
  error?: string;
}

export interface PaymentAPI {
  process: (params: PaymentProcessParams) => Promise<PaymentProcessResult>;
  cancel: (paymentId: string) => Promise<{ success: boolean }>;
  getStatus: (paymentId: string) => Promise<PaymentStatus>;
  onStatus: (callback: (status: PaymentStatusUpdate) => void) => () => void;
  onComplete: (callback: (result: PaymentCompleteResult) => void) => () => void;
}

// Main Electron API Interface
export interface ElectronAPI {
  camera: CameraAPI;
  printer: PrinterAPI;
  video: VideoAPI;
  payment: PaymentAPI;
}

// Extend Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
