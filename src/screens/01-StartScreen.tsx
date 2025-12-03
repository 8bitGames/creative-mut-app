// src/screens/01-StartScreen.tsx
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

// Auto-return timeout in milliseconds (10 seconds)
const AUTO_RETURN_TIMEOUT = 10000;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.2,
      delayChildren: 0.2,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

const buttonVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.8,
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

export function StartScreen() {
  console.log('🏁 [StartScreen] Component mounted/rendered');

  const setScreen = useAppStore((state) => state.setScreen);
  const setCameraStream = useAppStore((state) => state.setCameraStream);
  const cameraStream = useAppStore((state) => state.cameraStream);
  const clearSession = useSessionStore((state) => state.clearSession);

  // Reset hologram to logo and clear session when entering start screen
  useEffect(() => {
    console.log('🔄 [StartScreen] Resetting hologram to logo and clearing session');
    // Reset hologram to logo
    // @ts-ignore - Electron API
    if (window.electron?.hologram) {
      // @ts-ignore
      window.electron.hologram.showLogo();
    }
    // Clear any stale session data
    clearSession();
  }, [clearSession]);

  // Start webcam IMMEDIATELY when user sees Start screen - keep it running GLOBALLY across all screens
  useEffect(() => {
    console.log('🎬 [StartScreen] Camera initialization useEffect triggered');

    // Only start camera if not already running AND active
    if (cameraStream) {
      if (cameraStream.active) {
        console.log('📹 [StartScreen] Camera already running from previous session, skipping initialization');
        console.log(`   Active tracks: ${cameraStream.getVideoTracks().length}`);
        return;
      } else {
        console.warn('⚠️ [StartScreen] Camera stream exists but is inactive, will reinitialize');
      }
    }

    console.log('📷 [StartScreen] Starting webcam IMMEDIATELY in background...');

    const startBackgroundCamera = async () => {
      try {
        // Enumerate cameras to find Canon EOS or other DSLR
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log('📹 [StartScreen] Available cameras:');
        videoDevices.forEach((device, index) => {
          console.log(`  ${index + 1}. ${device.label || 'Unknown Camera'}`);
        });

        // Priority: 1st camera (index 0) - default camera
        let deviceId: string | undefined;
        let selectedCamera: MediaDeviceInfo | undefined;

        if (videoDevices.length >= 1) {
          // Use 1st camera (index 0) - default camera
          selectedCamera = videoDevices[0];
          deviceId = selectedCamera.deviceId;
          console.log(`✅ [StartScreen] Using 1st camera: ${selectedCamera.label || 'Camera 1'}`);
        } else {
          console.error('❌ [StartScreen] No cameras found!');
          return;
        }

        // Start camera stream and KEEP IT RUNNING in background
        // Request 4K resolution for high-quality output (3840x2160 landscape, rotated to 2160x3840 portrait)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 3840 },
            height: { ideal: 2160 }
          }
        });

        // Store stream in GLOBAL store (persists across screens!)
        setCameraStream(stream);

        console.log('✅ [StartScreen] Camera is now RUNNING in GLOBAL background stream');
        console.log('   ✓ Stream will persist across FrameSelectionScreen → ShootingGuideScreen');
        console.log('   ✓ No preview shown - camera warming up continuously');
        console.log('   ✓ Will only stop when app resets to idle');

      } catch (error) {
        console.warn('⚠️ [StartScreen] Camera background startup failed (non-critical):', error);
      }
    };

    // Start camera immediately (no delay)
    startBackgroundCamera();

    // NO CLEANUP - stream persists in global store!
  }, [cameraStream, setCameraStream]);

  // Auto-return to idle screen after 10 seconds of inactivity
  useEffect(() => {
    console.log('⏱️ [StartScreen] Starting 10-second auto-return timer');

    const timeoutId = setTimeout(() => {
      console.log('⏱️ [StartScreen] Auto-return timeout reached - returning to idle');
      setScreen('idle');
    }, AUTO_RETURN_TIMEOUT);

    // Cleanup on unmount or when user interacts
    return () => {
      console.log('⏱️ [StartScreen] Auto-return timer cancelled');
      clearTimeout(timeoutId);
    };
  }, [setScreen]);

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between py-16 px-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Top spacer */}
      <div className="h-16"></div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8">
        <motion.div variants={itemVariants} className="text-center">
          <p className="text-4xl font-bold leading-relaxed whitespace-nowrap">
            홀로그램 촬영을 시작하시려면<br/>
            아래 START 버튼을 눌러주세요
          </p>
        </motion.div>

        {/* START Button */}
        <motion.div variants={buttonVariants} className="w-full px-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              size="lg"
              className="w-full py-12 text-5xl font-bold bg-black text-white hover:bg-gray-800 rounded-2xl touch-target transition-all shadow-2xl border-2 border-black"
              onClick={() => setScreen('frame-selection')}
            >
              START
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom - Logo and branding */}
      <div className="flex flex-col items-center mb-12">
        <Logo className="w-40 mb-4" color="black" />
        <p className="text-2xl font-light tracking-wide">MUT 홀로그램 스튜디오</p>
      </div>
    </motion.div>
  );
}
