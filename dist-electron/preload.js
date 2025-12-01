"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const cameraAPI = {
  startPreview: () => ipcRenderer.invoke("camera:start-preview"),
  stopPreview: () => ipcRenderer.invoke("camera:stop-preview"),
  capture: () => ipcRenderer.invoke("camera:capture")
};
const printerAPI = {
  getStatus: () => ipcRenderer.invoke("printer:get-status"),
  print: (options) => ipcRenderer.invoke("printer:print", options)
};
const imageAPI = {
  saveBlob: (blobData, filename) => ipcRenderer.invoke("image:save-blob", blobData, filename)
};
const videoAPI = {
  saveBuffer: (byteArray, filename) => ipcRenderer.invoke("video:save-buffer", byteArray, filename),
  process: (params) => ipcRenderer.invoke("video:process", params),
  processFromImages: (params) => ipcRenderer.invoke("video:process-from-images", params),
  extractFrames: (videoPath, timestamps) => ipcRenderer.invoke("video:extract-frames", videoPath, timestamps),
  cancel: (taskId) => ipcRenderer.invoke("video:cancel", taskId),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("video:progress", listener);
    return () => ipcRenderer.removeListener("video:progress", listener);
  },
  onComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("video:complete", listener);
    return () => ipcRenderer.removeListener("video:complete", listener);
  }
};
const paymentAPI = {
  process: (params) => ipcRenderer.invoke("payment:process", params),
  cancel: () => ipcRenderer.invoke("payment:cancel"),
  getStatus: () => ipcRenderer.invoke("payment:get-status"),
  // Cancel a previous transaction (for dashboard manual cancellation)
  cancelTransaction: (params) => ipcRenderer.invoke("payment:cancel-transaction", params),
  // List available COM ports for TL3600 configuration
  listPorts: () => ipcRenderer.invoke("payment:list-ports"),
  // Payment status events
  onStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("payment:status", listener);
    return () => ipcRenderer.removeListener("payment:status", listener);
  },
  // Payment completion event
  onComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("payment:complete", listener);
    return () => ipcRenderer.removeListener("payment:complete", listener);
  },
  // Card removed event (TL3600 only)
  onCardRemoved: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("payment:card-removed", listener);
    return () => ipcRenderer.removeListener("payment:card-removed", listener);
  },
  // Payment error event
  onError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("payment:error", listener);
    return () => ipcRenderer.removeListener("payment:error", listener);
  },
  // Terminal disconnected event
  onDisconnected: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("payment:disconnected", listener);
    return () => ipcRenderer.removeListener("payment:disconnected", listener);
  }
};
const fileAPI = {
  readAsDataUrl: (filePath) => ipcRenderer.invoke("file:read-as-data-url", filePath),
  delete: (filePath) => ipcRenderer.invoke("file:delete", filePath)
};
const analyticsAPI = {
  sessionStart: (sessionId, startTime) => ipcRenderer.invoke("analytics:session-start", sessionId, startTime),
  sessionEnd: (sessionId, endTime) => ipcRenderer.invoke("analytics:session-end", sessionId, endTime),
  updateFrame: (sessionId, frameName) => ipcRenderer.invoke("analytics:update-frame", sessionId, frameName),
  updateImages: (sessionId, imageCount) => ipcRenderer.invoke("analytics:update-images", sessionId, imageCount),
  recordPayment: (sessionId, amount, status, errorMessage, details) => ipcRenderer.invoke("analytics:record-payment", sessionId, amount, status, errorMessage, details),
  recordPrint: (sessionId, imagePath, success, errorMessage) => ipcRenderer.invoke("analytics:record-print", sessionId, imagePath, success, errorMessage),
  getDashboardStats: () => ipcRenderer.invoke("analytics:get-dashboard-stats"),
  getFlowStatistics: () => ipcRenderer.invoke("analytics:get-flow-statistics"),
  insertSampleData: () => ipcRenderer.invoke("analytics:insert-sample-data")
};
const configAPI = {
  // Get current configuration
  get: () => ipcRenderer.invoke("config:get"),
  // Update full configuration
  update: (updates) => ipcRenderer.invoke("config:update", updates),
  // Update TL3600 settings only
  updateTL3600: (updates) => ipcRenderer.invoke("config:update-tl3600", updates),
  // Update payment settings only
  updatePayment: (updates) => ipcRenderer.invoke("config:update-payment", updates),
  // Update camera settings only
  updateCamera: (updates) => ipcRenderer.invoke("config:update-camera", updates),
  // Update display settings only
  updateDisplay: (updates) => ipcRenderer.invoke("config:update-display", updates),
  // Reset to default configuration
  reset: () => ipcRenderer.invoke("config:reset"),
  // Get config file path (for user reference)
  getPath: () => ipcRenderer.invoke("config:get-path")
};
const hologramAPI = {
  setMode: (mode, data) => ipcRenderer.invoke("hologram:set-mode", mode, data),
  showQR: (qrCodePath, videoPath) => ipcRenderer.invoke("hologram:show-qr", qrCodePath, videoPath),
  showLogo: () => ipcRenderer.invoke("hologram:show-logo"),
  getState: () => ipcRenderer.invoke("hologram:get-state")
};
const ipcRendererAPI = {
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
};
contextBridge.exposeInMainWorld("electron", {
  camera: cameraAPI,
  printer: printerAPI,
  image: imageAPI,
  video: videoAPI,
  payment: paymentAPI,
  file: fileAPI,
  analytics: analyticsAPI,
  config: configAPI,
  hologram: hologramAPI,
  ipcRenderer: ipcRendererAPI
});
