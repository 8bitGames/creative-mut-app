const { contextBridge, ipcRenderer } = require("electron");
const cameraAPI = {
  startPreview: () => ipcRenderer.invoke("camera:start-preview"),
  stopPreview: () => ipcRenderer.invoke("camera:stop-preview"),
  capture: () => ipcRenderer.invoke("camera:capture"),
  onPreviewFrame: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("camera:preview-frame", listener);
    return () => ipcRenderer.removeListener("camera:preview-frame", listener);
  }
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
  cancel: (paymentId) => ipcRenderer.invoke("payment:cancel", paymentId),
  getStatus: (paymentId) => ipcRenderer.invoke("payment:get-status", paymentId),
  onStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("payment:status", listener);
    return () => ipcRenderer.removeListener("payment:status", listener);
  },
  onComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("payment:complete", listener);
    return () => ipcRenderer.removeListener("payment:complete", listener);
  }
};
const fileAPI = {
  readAsDataUrl: (filePath) => ipcRenderer.invoke("file:read-as-data-url", filePath),
  delete: (filePath) => ipcRenderer.invoke("file:delete", filePath)
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
  hologram: hologramAPI,
  ipcRenderer: ipcRendererAPI
});
