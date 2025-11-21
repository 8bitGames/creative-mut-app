/**
 * Type definitions for Zustand stores
 * MUT Hologram Studio - State Management Types
 */

// ============================================
// Screen Types
// ============================================

export type Screen =
  | 'idle'              // Screen 0
  | 'start'             // Screen 1 (NEW)
  | 'frame-selection'   // Screen 2
  | 'recording-guide'   // Screen 3 (was shooting-guide)
  | 'recording'         // Screen 4 (was capture)
  | 'processing'        // Screen 5
  | 'result'            // Screen 6
  | 'image-selection'   // Screen 7
  | 'payment'           // Screen 8
  | 'printing';         // Screen 9

// ============================================
// Frame Types
// ============================================

export interface Frame {
  id: string;
  name: string;
  thumbnailPath: string;
  templatePath: string;
  chromaVideoPath: string;
  description?: string;
}

// ============================================
// Session Data Types
// ============================================

export interface ProcessingResult {
  videoPath: string;
  s3Url: string;
  s3Key: string;
  qrCodePath: string;
  framePaths: string[];
  compositionTime: number;
  totalTime: number;
}

export interface SessionData {
  capturedImages: string[];
  selectedFrame: Frame | null;
  processedResult: ProcessingResult | null;
  selectedPrintImage: string | null;
  sessionStartTime: number;
  sessionId: string;
}

// ============================================
// Camera State Types
// ============================================

export type CameraStatus = 'idle' | 'connecting' | 'ready' | 'capturing' | 'error';

export interface CameraState {
  status: CameraStatus;
  isConnected: boolean;
  cameraModel: string | null;
  error: string | null;
  previewUrl: string | null;
}

// ============================================
// Processing Progress Types
// ============================================

export type ProcessingStep = 'compositing' | 'uploading' | 'generating-qr';

export interface ProcessingProgress {
  step: ProcessingStep;
  progress: number;
  message: string;
}

// ============================================
// Payment Types
// ============================================

export type PaymentStatus =
  | 'idle'
  | 'waiting'
  | 'card-inserted'
  | 'processing'
  | 'approved'
  | 'declined'
  | 'error'
  | 'cancelled'
  | 'timeout';

export interface PaymentState {
  status: PaymentStatus;
  message: string;
  transactionId?: string;
  amount?: number;
  error?: string;
}

// ============================================
// Print Types
// ============================================

export type PrintStatus = 'idle' | 'printing' | 'success' | 'error';

export interface PrintState {
  status: PrintStatus;
  progress: number;
  error: string | null;
}
