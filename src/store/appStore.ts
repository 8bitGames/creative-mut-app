/**
 * Main App State Store
 * MUT Hologram Studio - Application State Management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Screen, ShadowConfig } from './types';

// Default shadow configuration
const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  color: '#000000',
  offsetX: 20,
  offsetY: 40,
  blur: 30,
  opacity: 0.6,
  spread: 10,
  enabled: true,
};

interface AppState {
  // Current screen
  currentScreen: Screen;

  // Global camera stream (persists across screens)
  cameraStream: MediaStream | null;

  // Shadow effect configuration (persists across screens, applied to actual camera)
  shadowConfig: ShadowConfig;

  // Actions
  setScreen: (screen: Screen) => void;
  setCameraStream: (stream: MediaStream | null) => void;
  setShadowConfig: (config: Partial<ShadowConfig>) => void;
  resetShadowConfig: () => void;
  resetApp: () => void;
}

/**
 * Main app store managing current screen and app-wide state
 * Uses Zustand with Immer for immutable state updates
 */
export const useAppStore = create<AppState>()(
  immer((set) => ({
    // Initial state
    currentScreen: 'idle',
    cameraStream: null,
    shadowConfig: DEFAULT_SHADOW_CONFIG,

    // Navigate to a different screen
    setScreen: (screen) =>
      set((state) => {
        console.log(`🔀 [AppStore] Screen transition: ${state.currentScreen} → ${screen}`);
        state.currentScreen = screen;
        console.log(`✅ [AppStore] Current screen updated to: ${screen}`);
      }),

    // Set global camera stream (persists across screens)
    setCameraStream: (stream) =>
      set((state) => {
        if (stream) {
          console.log('📹 [AppStore] Global camera stream stored (will persist across screens)');
          state.cameraStream = stream;
        } else {
          console.log('🛑 [AppStore] Global camera stream cleared');
          // Stop all tracks before clearing
          if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
          }
          state.cameraStream = null;
        }
      }),

    // Update shadow configuration (partial update supported)
    setShadowConfig: (config) =>
      set((state) => {
        console.log('🎨 [AppStore] Updating shadow config:', config);
        state.shadowConfig = { ...state.shadowConfig, ...config };
      }),

    // Reset shadow configuration to default
    resetShadowConfig: () =>
      set((state) => {
        console.log('🔄 [AppStore] Resetting shadow config to default');
        state.shadowConfig = DEFAULT_SHADOW_CONFIG;
      }),

    // Reset app to idle state
    resetApp: () =>
      set((state) => {
        console.log(`🔄 [AppStore] Resetting app to idle state (from ${state.currentScreen})`);
        // Stop camera stream when resetting
        if (state.cameraStream) {
          console.log('🛑 [AppStore] Stopping camera stream during reset');
          state.cameraStream.getTracks().forEach(track => track.stop());
          state.cameraStream = null;
        }
        state.currentScreen = 'idle';
        console.log('✅ [AppStore] App reset complete');
      }),
  }))
);
