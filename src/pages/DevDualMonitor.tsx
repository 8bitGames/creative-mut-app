// src/pages/DevDualMonitor.tsx
// Development-only view to test dual-monitor setup in browser
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { IdleScreen } from '@/screens/01-IdleScreen';
import { StartScreen } from '@/screens/01-StartScreen';
import { FrameSelectionScreen } from '@/screens/03-FrameSelectionScreen';
import { ShootingGuideScreen } from '@/screens/04-ShootingGuideScreen';
import { CaptureScreen } from '@/screens/05-CaptureScreen';
import { ProcessingScreen } from '@/screens/06-ProcessingScreen';
import { ResultScreen } from '@/screens/07-ResultScreen';
import { ImageSelectionScreen } from '@/screens/08-ImageSelectionScreen';
import { PaymentScreen } from '@/screens/09-PaymentScreen';
import { HologramWindow } from '@/components/HologramWindow';

export function DevDualMonitor() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const { selectedFrame, processedResult } = useSessionStore();

  // Determine hologram mode based on current screen
  let hologramMode: 'logo' | 'result' | 'recording-prep' = 'logo';
  let hologramProps: any = {};

  if (currentScreen === 'recording-guide' && selectedFrame) {
    hologramMode = 'recording-prep';
    hologramProps.framePath = selectedFrame.templatePath;
  } else if (currentScreen === 'recording' && selectedFrame) {
    hologramMode = 'recording-prep';
    hologramProps.framePath = selectedFrame.templatePath;
  } else if (currentScreen === 'result' && processedResult) {
    hologramMode = 'result';
    hologramProps.qrCodePath = processedResult.qrCodePath;
    hologramProps.videoPath = processedResult.videoPath;
  }

  return (
    <div className="w-screen h-screen bg-gray-900 flex items-center justify-center gap-4 p-4">
      {/* Monitor 1 - User Control */}
      <div className="bg-white rounded-lg overflow-hidden shadow-2xl relative" style={{ width: '540px', height: '960px' }}>
        <div className="absolute top-2 left-2 z-50 bg-black text-white px-3 py-1 rounded text-xs font-bold">
          MONITOR 1 - USER CONTROL (9:16)
        </div>
        <div className="w-full h-full">
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
          </AnimatePresence>
        </div>
      </div>

      {/* Monitor 2 - Hologram Display */}
      <div className="bg-black rounded-lg overflow-hidden shadow-2xl relative" style={{ width: '540px', height: '960px' }}>
        <div className="absolute top-2 left-2 z-50 bg-white text-black px-3 py-1 rounded text-xs font-bold">
          MONITOR 2 - HOLOGRAM DISPLAY (9:16)
        </div>
        <div className="w-full h-full">
          <HologramWindow
            mode={hologramMode}
            {...hologramProps}
          />
        </div>
      </div>
    </div>
  );
}
