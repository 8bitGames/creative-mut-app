const { contextBridge, ipcRenderer } = require('electron');
import type { IpcRendererEvent } from 'electron';

// Camera API
const cameraAPI = {
  startPreview: () => ipcRenderer.invoke('camera:start-preview'),
  stopPreview: () => ipcRenderer.invoke('camera:stop-preview'),
  capture: () => ipcRenderer.invoke('camera:capture'),
};

// Printer API
const printerAPI = {
  getStatus: () => ipcRenderer.invoke('printer:get-status'),
  print: (options: { imagePath: string; copies?: number }) =>
    ipcRenderer.invoke('printer:print', options),
  // Progress listener for print jobs
  onProgress: (callback: (data: { jobId: string; progress: number; message?: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { jobId: string; progress: number; message?: string }) => callback(data);
    ipcRenderer.on('printer:progress', listener);
    return () => ipcRenderer.removeListener('printer:progress', listener);
  },
};

// Image API
const imageAPI = {
  saveBlob: (blobData: string, filename: string) =>
    ipcRenderer.invoke('image:save-blob', blobData, filename),
};

// Video Processing API
const videoAPI = {
  saveBuffer: (data: Uint8Array | number[], filename: string) =>
    ipcRenderer.invoke('video:save-buffer', data, filename),

  process: (params: {
    inputVideo: string;
    chromaVideo: string;
    subtitleText?: string;
    s3Folder?: string;
  }) => ipcRenderer.invoke('video:process', params),

  processFromImages: (params: {
    imagePaths: string[];
    frameTemplatePath: string;
    subtitleText?: string;
    s3Folder?: string;
  }) => ipcRenderer.invoke('video:process-from-images', params),

  extractFrames: (videoPath: string, timestamps: number[]) =>
    ipcRenderer.invoke('video:extract-frames', videoPath, timestamps),

  cancel: (taskId: string) => ipcRenderer.invoke('video:cancel', taskId),

  onProgress: (callback: (progress: {
    step: 'compositing' | 'uploading' | 'generating-qr';
    progress: number;
    message: string;
  }) => void) => {
    const listener = (_event: IpcRendererEvent, data: {
      step: 'compositing' | 'uploading' | 'generating-qr';
      progress: number;
      message: string;
    }) => callback(data);
    ipcRenderer.on('video:progress', listener);
    return () => ipcRenderer.removeListener('video:progress', listener);
  },

  onComplete: (callback: (result: {
    success: boolean;
    result?: {
      videoPath: string;
      s3Url: string;
      s3Key: string;
      qrCodePath: string;
      framePaths: string[];
      compositionTime: number;
      totalTime: number;
    };
    error?: string;
  }) => void) => {
    const listener = (_event: IpcRendererEvent, data: {
      success: boolean;
      result?: {
        videoPath: string;
        s3Url: string;
        s3Key: string;
        qrCodePath: string;
        framePaths: string[];
        compositionTime: number;
        totalTime: number;
      };
      error?: string;
    }) => callback(data);
    ipcRenderer.on('video:complete', listener);
    return () => ipcRenderer.removeListener('video:complete', listener);
  },
};

// Payment API - supports both mock mode and TL3600 hardware
const paymentAPI = {
  process: (params: {
    amount: number;
    currency?: string;
    description?: string;
  }) => ipcRenderer.invoke('payment:process', params),

  cancel: () => ipcRenderer.invoke('payment:cancel'),

  getStatus: () => ipcRenderer.invoke('payment:get-status'),

  // Cancel a previous transaction (for dashboard manual cancellation)
  cancelTransaction: (params: {
    approvalNumber: string;
    originalDate: string;   // YYYYMMDD
    originalTime: string;   // hhmmss
    amount: number;
    transactionType: string; // '1' IC, '2' RF/MS
  }) => ipcRenderer.invoke('payment:cancel-transaction', params),

  // List available COM ports for TL3600 configuration
  listPorts: () => ipcRenderer.invoke('payment:list-ports'),

  // Payment status events
  onStatus: (callback: (status: {
    status: string;
    message?: string;
    cardType?: string;
  }) => void) => {
    const listener = (_event: IpcRendererEvent, data: {
      status: string;
      message?: string;
      cardType?: string;
    }) => callback(data);
    ipcRenderer.on('payment:status', listener);
    return () => ipcRenderer.removeListener('payment:status', listener);
  },

  // Payment completion event
  onComplete: (callback: (result: {
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
  }) => void) => {
    const listener = (_event: IpcRendererEvent, data: {
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
    }) => callback(data);
    ipcRenderer.on('payment:complete', listener);
    return () => ipcRenderer.removeListener('payment:complete', listener);
  },

  // Card removed event (TL3600 only)
  onCardRemoved: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('payment:card-removed', listener);
    return () => ipcRenderer.removeListener('payment:card-removed', listener);
  },

  // Payment error event
  onError: (callback: (error: { message: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { message: string }) => callback(data);
    ipcRenderer.on('payment:error', listener);
    return () => ipcRenderer.removeListener('payment:error', listener);
  },

  // Terminal disconnected event
  onDisconnected: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('payment:disconnected', listener);
    return () => ipcRenderer.removeListener('payment:disconnected', listener);
  },
};

// File API
const fileAPI = {
  readAsDataUrl: (filePath: string) => ipcRenderer.invoke('file:read-as-data-url', filePath),
  delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
  exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
};

// Analytics API
const analyticsAPI = {
  sessionStart: (sessionId: string, startTime: number) =>
    ipcRenderer.invoke('analytics:session-start', sessionId, startTime),
  sessionEnd: (sessionId: string, endTime: number) =>
    ipcRenderer.invoke('analytics:session-end', sessionId, endTime),
  updateFrame: (sessionId: string, frameName: string) =>
    ipcRenderer.invoke('analytics:update-frame', sessionId, frameName),
  updateImages: (sessionId: string, imageCount: number) =>
    ipcRenderer.invoke('analytics:update-images', sessionId, imageCount),
  recordPayment: (sessionId: string, amount: number, status: string, errorMessage?: string, details?: {
    approvalNumber?: string;
    salesDate?: string;
    salesTime?: string;
    transactionMedia?: string;
    cardNumber?: string;
  }) =>
    ipcRenderer.invoke('analytics:record-payment', sessionId, amount, status, errorMessage, details),
  recordPrint: (sessionId: string, imagePath: string, success: boolean, errorMessage?: string) =>
    ipcRenderer.invoke('analytics:record-print', sessionId, imagePath, success, errorMessage),
  getDashboardStats: () => ipcRenderer.invoke('analytics:get-dashboard-stats'),
  getFlowStatistics: () => ipcRenderer.invoke('analytics:get-flow-statistics'),
  insertSampleData: () => ipcRenderer.invoke('analytics:insert-sample-data'),
};

// Configuration API - allows runtime configuration changes without rebuilding
const configAPI = {
  // Get current configuration
  get: () => ipcRenderer.invoke('config:get'),

  // Update full configuration
  update: (updates: {
    tl3600?: {
      port?: string;
      terminalId?: string;
      timeout?: number;
      retryCount?: number;
    };
    payment?: {
      useMockMode?: boolean;
      defaultAmount?: number;
      mockApprovalRate?: number;
    };
    camera?: {
      useWebcam?: boolean;
      mockMode?: boolean;
    };
    printer?: {
      mockMode?: boolean;
    };
    display?: {
      splitScreenMode?: boolean;
      mainWidth?: number;
      mainHeight?: number;
      hologramWidth?: number;
      hologramHeight?: number;
    };
    demo?: {
      enabled?: boolean;
      videoPath?: string;
    };
    debug?: {
      enableLogging?: boolean;
      logLevel?: 'error' | 'warn' | 'info' | 'debug';
    };
  }) => ipcRenderer.invoke('config:update', updates),

  // Update TL3600 settings only
  updateTL3600: (updates: {
    port?: string;
    terminalId?: string;
    timeout?: number;
    retryCount?: number;
  }) => ipcRenderer.invoke('config:update-tl3600', updates),

  // Update payment settings only
  updatePayment: (updates: {
    useMockMode?: boolean;
    defaultAmount?: number;
    mockApprovalRate?: number;
  }) => ipcRenderer.invoke('config:update-payment', updates),

  // Update camera settings only
  updateCamera: (updates: {
    useWebcam?: boolean;
    mockMode?: boolean;
  }) => ipcRenderer.invoke('config:update-camera', updates),

  // Update display settings only
  updateDisplay: (updates: {
    splitScreenMode?: boolean;
    mainWidth?: number;
    mainHeight?: number;
    hologramWidth?: number;
    hologramHeight?: number;
  }) => ipcRenderer.invoke('config:update-display', updates),

  // Reset to default configuration
  reset: () => ipcRenderer.invoke('config:reset'),

  // Get config file path (for user reference)
  getPath: () => ipcRenderer.invoke('config:get-path'),
};

// Hologram API
const hologramAPI = {
  setMode: (mode: 'logo' | 'result', data?: { qrCodePath?: string; videoPath?: string }) =>
    ipcRenderer.invoke('hologram:set-mode', mode, data),

  showQR: (qrCodePath: string, videoPath?: string) =>
    ipcRenderer.invoke('hologram:show-qr', qrCodePath, videoPath),

  showLogo: () => ipcRenderer.invoke('hologram:show-logo'),

  getState: () => ipcRenderer.invoke('hologram:get-state'),
};

// Store listener wrappers for proper cleanup
const listenerMap = new Map<(...args: any[]) => void, (...args: any[]) => void>();

// IPC Renderer API for hologram window
const ipcRendererAPI = {
  on: (channel: string, callback: (...args: any[]) => void) => {
    // Create wrapper that strips the event parameter
    const wrapper = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    // Store mapping so we can remove the correct listener later
    listenerMap.set(callback, wrapper);
    ipcRenderer.on(channel, wrapper);
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    // Get the wrapper function we stored
    const wrapper = listenerMap.get(callback);
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper);
      listenerMap.delete(callback);
    }
  },
};

// App API - for screen state communication and live config updates
const appAPI = {
  // Notify main process when screen changes (for live config application)
  notifyScreenChange: (screen: string) => {
    ipcRenderer.send('app:screen-changed', screen);
  },

  // Listen for config updates from cloud (main → renderer)
  onConfigUpdated: (callback: (config: {
    camera?: { useWebcam?: boolean; mockMode?: boolean };
    payment?: { useMockMode?: boolean; defaultAmount?: number };
    tl3600?: { port?: string; terminalId?: string };
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
    debug?: { enableLogging?: boolean; logLevel?: string };
  }) => void) => {
    const listener = (_event: IpcRendererEvent, config: any) => callback(config);
    ipcRenderer.on('app:config-updated', listener);
    return () => ipcRenderer.removeListener('app:config-updated', listener);
  },

  // Listen for config apply notification (when config is about to be applied)
  onConfigApplying: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:config-applying', listener);
    return () => ipcRenderer.removeListener('app:config-applying', listener);
  },

  // Listen for config applied notification (when config has been applied)
  onConfigApplied: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:config-applied', listener);
    return () => ipcRenderer.removeListener('app:config-applied', listener);
  },

  // Get current screen state (for debugging)
  getCurrentScreen: () => ipcRenderer.invoke('app:get-current-screen'),
};

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  camera: cameraAPI,
  printer: printerAPI,
  image: imageAPI,
  video: videoAPI,
  payment: paymentAPI,
  file: fileAPI,
  analytics: analyticsAPI,
  config: configAPI,
  hologram: hologramAPI,
  ipcRenderer: ipcRendererAPI,
  app: appAPI,
});
