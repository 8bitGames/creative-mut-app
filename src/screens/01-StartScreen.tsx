// src/screens/01-StartScreen.tsx
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
  const setScreen = useAppStore((state) => state.setScreen);

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
