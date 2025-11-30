import { z } from 'zod';

export const processingConfigSchema = z.object({
  mode: z.enum(['cloud', 'local', 'hybrid', 'auto']).default('hybrid'),
  quality: z.enum(['low', 'medium', 'high', 'ultra']).default('high'),
  faceEnhancement: z.boolean().default(true),
  maxProcessingTime: z.number().min(10).max(300).default(60),
  retryAttempts: z.number().min(0).max(5).default(2),
});

export const resolutionSchema = z.object({
  width: z.number().min(640).max(4096).default(1920),
  height: z.number().min(480).max(2160).default(1080),
});

export const cameraConfigSchema = z.object({
  type: z.enum(['dslr', 'webcam']).default('dslr'),
  resolution: resolutionSchema.default({ width: 1920, height: 1080 }),
  captureCount: z.number().min(1).max(10).default(4),
  captureInterval: z.number().min(500).max(5000).default(1000),
  countdown: z.number().min(0).max(10).default(3),
});

export const displayConfigSchema = z.object({
  splitScreenMode: z.boolean().default(false),
  swapDisplays: z.boolean().default(false),
  mainWidth: z.number().min(640).max(4096).default(1080),
  mainHeight: z.number().min(480).max(4096).default(1920),
  hologramWidth: z.number().min(640).max(4096).default(1080),
  hologramHeight: z.number().min(480).max(4096).default(1920),
  idleTimeout: z.number().min(30).max(600).default(120),
  showDebugInfo: z.boolean().default(false),
  language: z.enum(['en', 'ko', 'ja']).default('ko'),
});

export const paymentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mockMode: z.boolean().default(true),
  currency: z.enum(['KRW', 'USD', 'JPY']).default('KRW'),
  defaultPrice: z.number().min(0).default(5000),
  timeout: z.number().min(30).max(300).default(60),
});

export const printerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mockMode: z.boolean().default(true),
  paperSize: z.enum(['4x6', '5x7', '6x8']).default('4x6'),
  copies: z.number().min(1).max(5).default(1),
});

export const tl3600ConfigSchema = z.object({
  port: z.string().default('COM3'),
  terminalId: z.string().length(16).default('0000000000000000'),
  timeout: z.number().min(1000).max(30000).default(3000),
  retryCount: z.number().min(0).max(5).default(3),
});

export const demoConfigSchema = z.object({
  enabled: z.boolean().default(false),
  videoPath: z.string().default('demo.mov'),
});

export const debugConfigSchema = z.object({
  enableLogging: z.boolean().default(true),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logToFile: z.boolean().default(false),
  logFilePath: z.string().default('debug.log'),
});

// Default values for each config section
const defaultProcessing = {
  mode: 'hybrid' as const,
  quality: 'high' as const,
  faceEnhancement: true,
  maxProcessingTime: 60,
  retryAttempts: 2,
};

const defaultCamera = {
  type: 'dslr' as const,
  resolution: { width: 1920, height: 1080 },
  captureCount: 4,
  captureInterval: 1000,
  countdown: 3,
};

const defaultDisplay = {
  splitScreenMode: false,
  swapDisplays: false,
  mainWidth: 1080,
  mainHeight: 1920,
  hologramWidth: 1080,
  hologramHeight: 1920,
  idleTimeout: 120,
  showDebugInfo: false,
  language: 'ko' as const,
};

const defaultPayment = {
  enabled: true,
  mockMode: true,
  currency: 'KRW' as const,
  defaultPrice: 5000,
  timeout: 60,
};

const defaultPrinter = {
  enabled: true,
  mockMode: true,
  paperSize: '4x6' as const,
  copies: 1,
};

const defaultTl3600 = {
  port: 'COM3',
  terminalId: '0000000000000000',
  timeout: 3000,
  retryCount: 3,
};

const defaultDemo = {
  enabled: false,
  videoPath: 'demo.mov',
};

const defaultDebug = {
  enableLogging: true,
  logLevel: 'info' as const,
  logToFile: false,
  logFilePath: 'debug.log',
};

export const machineConfigSchema = z.object({
  processing: processingConfigSchema.default(defaultProcessing),
  camera: cameraConfigSchema.default(defaultCamera),
  display: displayConfigSchema.default(defaultDisplay),
  payment: paymentConfigSchema.default(defaultPayment),
  printer: printerConfigSchema.default(defaultPrinter),
  tl3600: tl3600ConfigSchema.default(defaultTl3600),
  demo: demoConfigSchema.default(defaultDemo),
  debug: debugConfigSchema.default(defaultDebug),
});

export type MachineConfigData = z.infer<typeof machineConfigSchema>;
export type ProcessingConfig = z.infer<typeof processingConfigSchema>;
export type CameraConfig = z.infer<typeof cameraConfigSchema>;
export type DisplayConfig = z.infer<typeof displayConfigSchema>;
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;
export type PrinterConfig = z.infer<typeof printerConfigSchema>;
export type TL3600Config = z.infer<typeof tl3600ConfigSchema>;
export type DemoConfig = z.infer<typeof demoConfigSchema>;
export type DebugConfig = z.infer<typeof debugConfigSchema>;

// Default config for new machines
export const defaultMachineConfig: MachineConfigData = {
  processing: defaultProcessing,
  camera: defaultCamera,
  display: defaultDisplay,
  payment: defaultPayment,
  printer: defaultPrinter,
  tl3600: defaultTl3600,
  demo: defaultDemo,
  debug: defaultDebug,
};
