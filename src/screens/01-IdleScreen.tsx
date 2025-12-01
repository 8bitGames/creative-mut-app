// src/screens/01-IdleScreen.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { Logo } from '@/components/Logo';

export function IdleScreen() {
  const setScreen = useAppStore((state) => state.setScreen);

  // Reset hologram to logo when entering idle screen
  useEffect(() => {
    // @ts-ignore - Electron API
    window.electron?.hologram?.showLogo();
  }, []);

  return (
    <motion.div
      className="fullscreen bg-black text-white flex flex-col items-center justify-between py-16 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setScreen('start')}
    >
      {/* Center - Click Here */}
      <div className="flex-1 flex items-center justify-center">
        <motion.h1
          className="text-7xl font-bold text-white"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          CLICK HERE
        </motion.h1>
      </div>

      {/* Bottom - Logo and branding */}
      <div className="flex flex-col items-center mb-12">
        <Logo className="w-40 mb-4" color="white" />
        <p className="text-2xl font-light tracking-wide">MUT 홀로그램 스튜디오</p>
      </div>
    </motion.div>
  );
}
