// src/screens/04-ShootingGuideScreen.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';

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

const headingVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

const iconVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

const guideBoxVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

const countdownVariants = {
  initial: { scale: 0.5, opacity: 0 },
  animate: {
    scale: [0.5, 1.2, 1],
    opacity: [0, 1, 1],
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

export function ShootingGuideScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const [countdown, setCountdown] = useState<number | null>(10);

  // Show frame on hologram window when countdown starts
  useEffect(() => {
    console.log('📺 [ShootingGuideScreen] Component mounted - Setting up hologram display...');

    // @ts-ignore
    if (window.electron?.hologram && selectedFrame) {
      console.log(`🎭 [ShootingGuideScreen] Sending hologram update: recording-prep with frame ${selectedFrame.templatePath}`);
      // @ts-ignore
      window.electron.hologram.setMode('recording-prep', {
        framePath: selectedFrame.templatePath,
      });
    } else if (!window.electron?.hologram) {
      console.log('ℹ️ [ShootingGuideScreen] Electron hologram API not available (running in browser)');
    } else if (!selectedFrame) {
      console.warn('⚠️ [ShootingGuideScreen] No frame selected!');
    }

    // Don't reset to logo - let the hologram stay in recording-prep mode
    return () => {
      console.log('🎭 [ShootingGuideScreen] Cleanup - Keeping hologram in recording-prep mode');
    };
  }, [selectedFrame]);

  useEffect(() => {
    // Auto-start 10-second countdown
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          return null;
        }
        // TODO: Play sound effect here
        return prev - 1;
      });
    }, 1000);

    // Navigate to recording screen after countdown finishes
    const navigationTimer = setTimeout(() => {
      setScreen('recording');
    }, 11000); // 10 seconds countdown + 1 second buffer

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(navigationTimer);
    };
  }, [setScreen]);

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between py-12 px-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <motion.div className="text-center mt-8" variants={headingVariants}>
        <h1 className="text-5xl font-bold mb-3">촬영 가이드</h1>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full px-4">
        {/* Camera Icon */}
        <motion.div
          variants={iconVariants}
          className="w-40 h-40 bg-black rounded-full flex items-center justify-center shadow-2xl"
        >
          <Camera className="w-24 h-24 text-white" strokeWidth={1.5} />
        </motion.div>

        {/* Instructions */}
        <motion.div className="text-center px-6" variants={guideBoxVariants}>
          <p className="text-3xl font-medium mb-6">
            바닥의 발자국 위치로 이동하여
          </p>
          <p className="text-3xl font-medium">
            전신이 화면 안에 들어오도록 서주세요
          </p>
        </motion.div>

        {/* Visual Guide Box with Countdown Overlay */}
        <motion.div
          variants={guideBoxVariants}
          className="relative w-full"
        >
          {/* Standing Position Guide */}
          <div className="bg-gray-100 border-4 border-dashed border-gray-400 rounded-2xl py-12 px-8 flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="text-7xl mb-3">🧍</div>
              <p className="text-2xl text-gray-600 font-medium">
                이곳에 서주세요
              </p>
            </div>
          </div>

          {/* Corner Markers */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-6 border-l-6 border-black rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-6 border-r-6 border-black rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-6 border-l-6 border-black rounded-bl-2xl" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-6 border-r-6 border-black rounded-br-2xl" />
        </motion.div>

        {/* Countdown Display */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {countdown !== null && countdown > 0 && (
              <motion.div
                key={countdown}
                variants={countdownVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute"
              >
                <p className="text-[10rem] font-bold text-black leading-none">
                  {countdown}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-8"></div>
    </motion.div>
  );
}
