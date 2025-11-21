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

function App() {
  const currentScreen = useAppStore((state) => state.currentScreen);

  // Check display mode from environment variable
  const isSplitScreenMode = import.meta.env.VITE_SPLIT_SCREEN_MODE === 'true';

  // Check if this is the hologram window (Monitor 2)
  const isHologramWindow = window.location.hash === '#/hologram';

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
      </AnimatePresence>
    </div>
  );
}

export default App;
