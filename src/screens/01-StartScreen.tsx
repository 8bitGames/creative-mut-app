// src/screens/01-StartScreen.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

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

  // Start Canon webcam IMMEDIATELY when user clicks Start - keep it running GLOBALLY across all screens
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

    console.log('📷 [StartScreen] Starting Canon webcam IMMEDIATELY in background...');

    const startBackgroundCamera = async () => {
      try {
        // Enumerate cameras to find Canon EOS
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log('📹 [StartScreen] Available cameras:');
        videoDevices.forEach((device, index) => {
          console.log(`  ${index + 1}. ${device.label || 'Unknown Camera'}`);
        });

        // Find Canon EOS webcam
        const canonCamera = videoDevices.find(device =>
          device.label.toLowerCase().includes('canon') ||
          device.label.toLowerCase().includes('eos')
        );

        let deviceId: string | undefined;
        if (canonCamera) {
          deviceId = canonCamera.deviceId;
          console.log(`✅ [StartScreen] Canon camera found: ${canonCamera.label}`);
          console.log('   Starting camera in background (no preview)...');
        } else {
          // Fallback to built-in MacBook camera (usually first device)
          console.warn('⚠️ [StartScreen] Canon camera not found, using MacBook camera (first device)');
          deviceId = videoDevices[0]?.deviceId; // Use first device (built-in camera)
          if (videoDevices[0]) {
            console.log(`   📱 Using: ${videoDevices[0].label || 'Built-in Camera'}`);
          }
        }

        // Start camera stream and KEEP IT RUNNING in background
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
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
