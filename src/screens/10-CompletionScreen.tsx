// src/screens/10-CompletionScreen.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Printer, Download, Heart, Sparkles, Star } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Logo } from '@/components/Logo';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.2,
      delayChildren: 0.3,
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

const iconVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      duration: 0.8,
    },
  },
};

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export function CompletionScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const { selectedPrintImage, clearSession } = useSessionStore();
  const [countdown, setCountdown] = useState(5);

  const isPrintSession = selectedPrintImage !== null;

  useEffect(() => {
    // Countdown timer to return to idle
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Clear session and return to idle
          clearSession();
          setScreen('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [clearSession, setScreen]);

  return (
    <motion.div
      className="fullscreen bg-black text-white flex flex-col items-center justify-between p-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 right-20 w-64 h-64 border-4 border-white opacity-10 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 border-4 border-white opacity-5 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => {
          const randomX = Math.random() * 100;
          const randomDelay = Math.random() * 2;
          const randomDuration = 3 + Math.random() * 3;
          const randomRotation = Math.random() * 360;
          const shapes = [Sparkles, Star];
          const Shape = shapes[Math.floor(Math.random() * shapes.length)];
          const colors = ['text-yellow-400', 'text-blue-400', 'text-pink-400', 'text-green-400', 'text-purple-400'];
          const color = colors[Math.floor(Math.random() * colors.length)];

          return (
            <motion.div
              key={i}
              className={`absolute ${color}`}
              style={{
                left: `${randomX}%`,
                top: '-10%',
              }}
              initial={{ y: 0, opacity: 1, rotate: randomRotation }}
              animate={{
                y: window.innerHeight + 100,
                opacity: [1, 0.8, 0],
                rotate: randomRotation + 360,
              }}
              transition={{
                duration: randomDuration,
                delay: randomDelay,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <Shape className="w-8 h-8" strokeWidth={2} />
            </motion.div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-12 relative z-10">
        {/* Success Icon */}
        <motion.div variants={iconVariants}>
          <motion.div
            variants={pulseVariants}
            animate="animate"
            className="relative"
          >
            <CheckCircle className="w-40 h-40 text-white" strokeWidth={1.5} />

            {/* Pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-8 border-white"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Burst effect - 8 sparkles around icon */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * 360) / 8;
              const radius = 140;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;

              return (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    x: -12,
                    y: -12,
                  }}
                  animate={{
                    x: [x / 4, x, x / 4],
                    y: [y / 4, y, y / 4],
                    opacity: [0.8, 0.3, 0.8],
                    scale: [0.8, 1.2, 0.8],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.15,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Sparkles className="w-6 h-6 text-yellow-300" strokeWidth={2} />
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Logo */}
        <motion.div variants={itemVariants}>
          <Logo className="w-72 mb-8" color="white" />
        </motion.div>

        {/* Messages */}
        <motion.div variants={itemVariants} className="text-center space-y-6">
          <h1 className="text-8xl font-bold">감사합니다!</h1>

          {isPrintSession ? (
            <>
              <div className="flex items-center justify-center gap-4 text-4xl text-gray-300">
                <Printer className="w-12 h-12" />
                <p>사진 인쇄가 완료되었습니다</p>
              </div>
              <p className="text-2xl text-gray-400">
                인쇄물을 수령해주세요
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 text-4xl text-gray-300">
                <Download className="w-12 h-12" />
                <p>영상 다운로드 링크가 생성되었습니다</p>
              </div>
              <p className="text-2xl text-gray-400">
                QR 코드로 영상을 다운로드하세요
              </p>
            </>
          )}
        </motion.div>

        {/* Decorative heart */}
        <motion.div
          variants={itemVariants}
          className="mt-8"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Heart className="w-20 h-20 text-white fill-white" />
          </motion.div>
        </motion.div>

        {/* Thank you message */}
        <motion.div
          variants={itemVariants}
          className="text-center space-y-4 mt-8"
        >
          <p className="text-4xl font-light">MUT 홀로그램 스튜디오를</p>
          <p className="text-4xl font-light">이용해 주셔서 감사합니다</p>
        </motion.div>
      </div>

      {/* Countdown */}
      <motion.div
        variants={itemVariants}
        className="text-center space-y-4 relative z-10"
      >
        <div className="flex items-center justify-center gap-4">
          <motion.div
            className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center"
            animate={{
              borderColor: ['#ffffff', '#666666', '#ffffff'],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
            }}
          >
            <span className="text-4xl font-bold">{countdown}</span>
          </motion.div>
        </div>
        <p className="text-2xl text-gray-400">
          {countdown}초 후 처음 화면으로 돌아갑니다
        </p>
      </motion.div>
    </motion.div>
  );
}
