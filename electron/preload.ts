const { contextBridge, ipcRenderer } = require('electron');

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
};

// Image API
const imageAPI = {
  saveBlob: (blobData: string, filename: string) =>
    ipcRenderer.invoke('image:save-blob', blobData, filename),
};

// Video Processing API
const videoAPI = {
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
        compositionTime: number;
        totalTime: number;
      };
      error?: string;
    }) => callback(data);
    ipcRenderer.on('video:complete', listener);
    return () => ipcRenderer.removeListener('video:complete', listener);
  },
};

// Payment API
const paymentAPI = {
  process: (params: {
    amount: number;
    currency: string;
    method: 'card' | 'cash';
  }) => ipcRenderer.invoke('payment:process', params),

  cancel: (paymentId: string) => ipcRenderer.invoke('payment:cancel', paymentId),

  getStatus: (paymentId: string) => ipcRenderer.invoke('payment:get-status', paymentId),

  onStatus: (callback: (status: { status: string; message?: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { status: string; message?: string }) => callback(data);
    ipcRenderer.on('payment:status', listener);
    return () => ipcRenderer.removeListener('payment:status', listener);
  },

  onComplete: (callback: (result: {
    success: boolean;
    transactionId?: string;
    receiptUrl?: string;
    error?: string;
  }) => void) => {
    const listener = (_event: IpcRendererEvent, data: {
      success: boolean;
      transactionId?: string;
      receiptUrl?: string;
      error?: string;
    }) => callback(data);
    ipcRenderer.on('payment:complete', listener);
    return () => ipcRenderer.removeListener('payment:complete', listener);
  },
};

// File API
const fileAPI = {
  readAsDataUrl: (filePath: string) => ipcRenderer.invoke('file:read-as-data-url', filePath),
};

// Hologram API
const hologramAPI = {
  setMode: (mode: 'logo' | 'result', data?: { qrCodePath?: string; videoPath?: string }) =>
    ipcRenderer.invoke('hologram:set-mode', mode, data),

  showQR: (qrCodePath: string, videoPath?: string) =>
    ipcRenderer.invoke('hologram:show-qr', qrCodePath, videoPath),

  showLogo: () => ipcRenderer.invoke('hologram:show-logo'),
};

// IPC Renderer API for hologram window
const ipcRendererAPI = {
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  camera: cameraAPI,
  printer: printerAPI,
  image: imageAPI,
  video: videoAPI,
  payment: paymentAPI,
  file: fileAPI,
  hologram: hologramAPI,
  ipcRenderer: ipcRendererAPI,
});
