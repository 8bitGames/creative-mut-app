/**
 * Session Data Store
 * MUT Hologram Studio - Current Session State Management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Frame, ProcessingResult } from './types';

interface SessionState {
  // Session data
  capturedImages: string[];
  selectedFrame: Frame | null;
  processedResult: ProcessingResult | null;
  selectedPrintImage: string | null;
  sessionId: string;
  sessionStartTime: number;

  // Actions
  addCapturedImage: (imagePath: string) => void;
  setCapturedImages: (images: string[]) => void;
  setSelectedFrame: (frame: Frame | null) => void;
  setProcessedResult: (result: ProcessingResult | null) => void;
  setSelectedPrintImage: (imagePath: string | null) => void;
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
    selectedFrame: null,
    processedResult: null,
    selectedPrintImage: null,
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

    // Clear all session data and start fresh
    clearSession: () =>
      set((state) => {
        state.capturedImages = [];
        state.selectedFrame = null;
        state.processedResult = null;
        state.selectedPrintImage = null;
        state.sessionId = generateSessionId();
        state.sessionStartTime = Date.now();
      }),
  }))
);
