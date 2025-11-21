/**
 * Main App State Store
 * MUT Hologram Studio - Application State Management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Screen } from './types';

interface AppState {
  // Current screen
  currentScreen: Screen;

  // Actions
  setScreen: (screen: Screen) => void;
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

    // Navigate to a different screen
    setScreen: (screen) =>
      set((state) => {
        console.log(`🔀 [AppStore] Screen transition: ${state.currentScreen} → ${screen}`);
        state.currentScreen = screen;
        console.log(`✅ [AppStore] Current screen updated to: ${screen}`);
      }),

    // Reset app to idle state
    resetApp: () =>
      set((state) => {
        console.log(`🔄 [AppStore] Resetting app to idle state (from ${state.currentScreen})`);
        state.currentScreen = 'idle';
        console.log('✅ [AppStore] App reset complete');
      }),
  }))
);
