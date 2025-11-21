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
  console.log('🚀 [App] Rendering App component in split-screen mode');

  // Always render split-screen view for testing
  return <DevDualMonitor />;
}

export default App;
