// src/screens/02-UserGuideScreen.tsx
import { motion } from 'framer-motion';
import { Camera, Frame, User, Video, type LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';

interface GuideStep {
  icon: LucideIcon;
  text: string;
}

const guideSteps: GuideStep[] = [
  {
    icon: Frame,
    text: '프레임을 선택하세요',
  },
  {
    icon: User,
    text: '촬영 위치에 서세요',
  },
  {
    icon: Camera,
    text: '카메라를 보고 포즈를 취하세요',
  },
  {
    icon: Video,
    text: '완성된 영상을 받으세요',
  },
];

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

const stepVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
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
      delay: 1,
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

export function UserGuideScreen() {
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between py-12 px-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <motion.div className="text-center mt-8" variants={stepVariants}>
        <h1 className="text-5xl font-bold mb-3">사용 방법</h1>
        <p className="text-2xl text-gray-600">간단한 4단계로 완성하세요</p>
      </motion.div>

      {/* Steps */}
      <div className="flex-1 flex flex-col justify-center items-center w-full px-4">
        <div className="grid grid-cols-1 gap-6 w-full">
          {guideSteps.map((step, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-5 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
              variants={stepVariants}
            >
              {/* Number Badge */}
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-2xl font-bold">
                {index + 1}
              </div>

              {/* Icon */}
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white flex items-center justify-center shadow-md">
                <step.icon className="w-9 h-9 text-black" strokeWidth={1.5} />
              </div>

              {/* Text */}
              <p className="text-2xl font-medium flex-1 leading-tight">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <motion.div className="w-full px-4 mb-8" variants={buttonVariants}>
        <Button
          size="lg"
          className="w-full py-10 text-4xl font-bold bg-black text-white hover:bg-gray-800 rounded-2xl touch-target transition-all hover:scale-105 active:scale-95 shadow-xl"
          onClick={() => setScreen('frame-selection')}
        >
          시작하기
        </Button>
      </motion.div>
    </motion.div>
  );
}
