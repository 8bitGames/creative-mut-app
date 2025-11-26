/**
 * Session Data Store
 * MUT Hologram Studio - Current Session State Management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Frame, ProcessingResult, LastPaymentResult } from './types';

interface SessionState {
  // Session data
  capturedImages: string[];
  recordedVideoBlob: Blob | null;
  recordedVideoUrl: string | null;
  selectedFrame: Frame | null;
  processedResult: ProcessingResult | null;
  selectedPrintImage: string | null;
  lastPaymentResult: LastPaymentResult | null;
  sessionId: string;
  sessionStartTime: number;

  // Actions
  addCapturedImage: (imagePath: string) => void;
  setCapturedImages: (images: string[]) => void;
  setRecordedVideo: (blob: Blob, url: string) => void;
  setSelectedFrame: (frame: Frame | null) => void;
  setProcessedResult: (result: ProcessingResult | null) => void;
  setSelectedPrintImage: (imagePath: string | null) => void;
  setLastPaymentResult: (result: LastPaymentResult | null) => void;
  cleanupSessionFiles: () => Promise<void>;
  clearSession: () => void;
}

/**
 * Generates a unique session ID
 */
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Session store managing current photo session data
 * Tracks captured images, frame selection, processing results, and print selection
 */
export const useSessionStore = create<SessionState>()(
  immer((set) => ({
    // Initial state
    capturedImages: [],
    recordedVideoBlob: null,
    recordedVideoUrl: null,
    selectedFrame: null,
    processedResult: null,
    selectedPrintImage: null,
    lastPaymentResult: null,
    sessionId: generateSessionId(),
    sessionStartTime: Date.now(),

    // Add a single captured image to the list
    addCapturedImage: (imagePath) =>
      set((state) => {
        state.capturedImages.push(imagePath);
      }),

    // Set all captured images at once (replaces existing)
    setCapturedImages: (images) =>
      set((state) => {
        state.capturedImages = images;
      }),

    // Set the recorded video blob and URL
    setRecordedVideo: (blob, url) =>
      set((state) => {
        state.recordedVideoBlob = blob;
        state.recordedVideoUrl = url;
      }),

    // Set the selected frame template
    setSelectedFrame: (frame) =>
      set((state) => {
        state.selectedFrame = frame;
      }),

    // Set the video processing result
    setProcessedResult: (result) =>
      set((state) => {
        state.processedResult = result;
      }),

    // Set the image selected for printing
    setSelectedPrintImage: (imagePath) =>
      set((state) => {
        state.selectedPrintImage = imagePath;
      }),

    // Set the last payment result for potential cancellation
    setLastPaymentResult: (result) =>
      set((state) => {
        state.lastPaymentResult = result;
      }),

    // Cleanup all session files (videos, frames, QR codes)
    cleanupSessionFiles: async () => {
      const state = useSessionStore.getState();

      console.log('🗑️ [SessionStore] Cleaning up session files...');

      // @ts-ignore - Electron API
      if (!window.electron?.file) {
        console.warn('⚠️ [SessionStore] Electron file API not available - skipping cleanup');
        return;
      }

      const filesToDelete: string[] = [];

      // Add processed video file
      if (state.processedResult?.videoPath) {
        filesToDelete.push(state.processedResult.videoPath);
      }

      // Add QR code file
      if (state.processedResult?.qrCodePath) {
        filesToDelete.push(state.processedResult.qrCodePath);
      }

      // Note: Frame images are NOT deleted - they are preserved in /frames directory

      console.log(`   Found ${filesToDelete.length} files to delete`);

      // Delete each file
      for (const filePath of filesToDelete) {
        try {
          console.log(`   Deleting: ${filePath}`);
          // @ts-ignore
          const result = await window.electron.file.delete(filePath);
          if (result.success) {
            console.log(`   ✅ Deleted: ${filePath}`);
          } else {
            console.warn(`   ⚠️ Failed to delete ${filePath}: ${result.error}`);
          }
        } catch (error) {
          console.error(`   ❌ Error deleting ${filePath}:`, error);
        }
      }

      console.log('✅ [SessionStore] File cleanup complete');
    },

    // Clear all session data and start fresh
    clearSession: () =>
      set((state) => {
        state.capturedImages = [];
        state.recordedVideoBlob = null;
        state.recordedVideoUrl = null;
        state.selectedFrame = null;
        state.processedResult = null;
        state.selectedPrintImage = null;
        state.lastPaymentResult = null;
        state.sessionId = generateSessionId();
        state.sessionStartTime = Date.now();
      }),
  }))
);
