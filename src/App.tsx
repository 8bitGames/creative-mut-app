import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { IdleScreen } from '@/screens/01-IdleScreen';
import { StartScreen } from '@/screens/01-StartScreen';
import { FrameSelectionScreen } from '@/screens/03-FrameSelectionScreen';
import { ShootingGuideScreen } from '@/screens/04-ShootingGuideScreen';
import { CaptureScreen } from '@/screens/05-CaptureScreen';
import { ProcessingScreen } from '@/screens/06-ProcessingScreen';
import { ResultScreen } from '@/screens/07-ResultScreen';
import { ImageSelectionScreen } from '@/screens/08-ImageSelectionScreen';
import { PaymentScreen } from '@/screens/09-PaymentScreen';
import { PrintingScreen } from '@/screens/10-PrintingScreen';
import { HologramPage } from '@/pages/HologramPage';
import { DevDualMonitor } from '@/pages/DevDualMonitor';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ShadowEffectScreen } from '@/screens/ShadowEffectScreen';

function App() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);

  // Check display mode from environment variable
  const isSplitScreenMode = import.meta.env.VITE_SPLIT_SCREEN_MODE === 'true';

  // Check if this is the hologram window (Monitor 2)
  const isHologramWindow = window.location.hash === '#/hologram';

  // F12 shortcut for admin dashboard, F11 for shadow effect demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (currentScreen === 'admin-dashboard') {
          setScreen('idle');
        } else {
          setScreen('admin-dashboard');
        }
      }
      // F11 for shadow effect demo
      if (e.key === 'F11') {
        e.preventDefault();
        if (currentScreen === 'shadow-effect') {
          setScreen('idle');
        } else {
          setScreen('shadow-effect');
        }
      }
      // ESC to return to idle from dashboard or shadow effect
      if (e.key === 'Escape' && (currentScreen === 'admin-dashboard' || currentScreen === 'shadow-effect')) {
        setScreen('idle');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, setScreen]);

  // Notify main process when screen changes (for live config application)
  useEffect(() => {
    // Only notify for main window (not hologram window)
    if (!isHologramWindow && window.electron?.app?.notifyScreenChange) {
      console.log(`📱 [App] Notifying main process of screen change: ${currentScreen}`);
      window.electron.app.notifyScreenChange(currentScreen);
    }
  }, [currentScreen, isHologramWindow]);

  // ROBUST: Reset hologram to logo whenever main screen goes to idle
  // This ensures hologram resets regardless of how we got to idle (timeout, error, manual, etc.)
  useEffect(() => {
    // Only handle for main window (not hologram window)
    if (isHologramWindow) return;

    if (currentScreen === 'idle') {
      console.log('🔄 [App] Main screen is idle - resetting hologram to logo');
      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore
        window.electron.hologram.showLogo().catch((error: any) => {
          console.warn('⚠️ [App] Failed to reset hologram to logo:', error);
        });
      }
    }
  }, [currentScreen, isHologramWindow]);

  // Listen for config updates from cloud (optional - for UI awareness)
  useEffect(() => {
    if (!isHologramWindow && window.electron?.app?.onConfigUpdated) {
      const unsubscribe = window.electron.app.onConfigUpdated((config) => {
        console.log('☁️ [App] Config updated from cloud:', config);
        // UI could react to config changes here if needed
      });
      return unsubscribe;
    }
  }, [isHologramWindow]);

  console.log('🚀 [App] Rendering App component');
  console.log(`   Split-screen mode: ${isSplitScreenMode}`);
  console.log(`   Current screen: ${currentScreen}`);
  console.log(`   Is hologram window: ${isHologramWindow}`);

  // If split-screen mode is enabled, always show DevDualMonitor
  if (isSplitScreenMode) {
    console.log('🔀 [App] Rendering split-screen view');
    return <DevDualMonitor />;
  }

  // If this is the hologram window, only render HologramPage
  if (isHologramWindow) {
    console.log('🖥️ [App] Rendering HologramPage (Monitor 2)');
    return <HologramPage />;
  }

  console.log('📱 [App] Rendering main control interface (Monitor 1)');

  // Otherwise, render the main control interface (Monitor 1)
  return (
    <div className="fullscreen bg-black">
      <AnimatePresence mode="wait">
        {currentScreen === 'idle' && <IdleScreen key="idle" />}
        {currentScreen === 'start' && <StartScreen key="start" />}
        {currentScreen === 'frame-selection' && <FrameSelectionScreen key="frame-selection" />}
        {currentScreen === 'recording-guide' && <ShootingGuideScreen key="recording-guide" />}
        {currentScreen === 'recording' && <CaptureScreen key="recording" />}
        {currentScreen === 'processing' && <ProcessingScreen key="processing" />}
        {currentScreen === 'result' && <ResultScreen key="result" />}
        {currentScreen === 'image-selection' && <ImageSelectionScreen key="image-selection" />}
        {currentScreen === 'payment' && <PaymentScreen key="payment" />}
        {currentScreen === 'printing' && <PrintingScreen key="printing" />}
        {currentScreen === 'admin-dashboard' && <AdminDashboard key="admin-dashboard" />}
        {currentScreen === 'shadow-effect' && <ShadowEffectScreen key="shadow-effect" />}
      </AnimatePresence>
    </div>
  );
}

export default App;
