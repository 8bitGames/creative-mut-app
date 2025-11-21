/**
 * Hardware Type Definitions
 * MUT Hologram Studio - Shared types for hardware modules
 */

// Re-export types from hardware modules for convenience
export type { CameraConfig, CaptureResult, CameraInfo } from './camera';
export type { PrinterConfig, PrintOptions, PrintResult, PrinterStatus } from './printer';
export type { CardReaderConfig, PaymentOptions, PaymentResult } from './card-reader';
export { PaymentStatus } from './card-reader';
