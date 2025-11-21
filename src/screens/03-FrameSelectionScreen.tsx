// src/screens/03-FrameSelectionScreen.tsx
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import type { Frame } from '@/store/types';

// Frame data - Served from public directory
const frames = [
  {
    id: '1',
    name: '프레임 1',
    description: '클래식 스타일',
    thumbnailPath: '/frame1.png',
    templatePath: '/frame1.png',
    chromaVideoPath: '',
  },
  {
    id: '2',
    name: '프레임 2',
    description: '모던 스타일',
    thumbnailPath: '/frame2.png',
    templatePath: '/frame2.png',
    chromaVideoPath: '',
  },
] as const satisfies readonly Frame[];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.15,
      delayChildren: 0.3,
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

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

export function FrameSelectionScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const setSelectedFrame = useSessionStore((state) => state.setSelectedFrame);

  const handleFrameSelect = (frame: Frame) => {
    setSelectedFrame(frame);
    setScreen('recording-guide');
  };

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between py-12 px-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Heading */}
      <motion.div className="text-center mt-6 mb-6" variants={headingVariants}>
        <h1 className="text-5xl font-bold mb-3">프레임 선택</h1>
        <p className="text-2xl text-gray-600">
          촬영 영상은 QR코드를 통해
          <br />
          무료 다운로드가 가능합니다.
        </p>
      </motion.div>

      {/* Frame Grid - 2 frames side by side */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="grid grid-cols-2 gap-6 w-full px-2">
          {frames.map((frame) => (
            <motion.div
              key={frame.id}
              className="flex flex-col items-center cursor-pointer touch-target"
              variants={cardVariants}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleFrameSelect(frame)}
            >
              {/* Card Container */}
              <div className="w-full bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-shadow p-4 border-2 border-gray-200 hover:border-black">
                {/* Preview Area - 9:16 aspect ratio */}
                <div className="w-full aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-300">
                  {frame.thumbnailPath ? (
                    <img
                      src={frame.thumbnailPath}
                      alt={frame.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-1">🖼️</div>
                        <p className="text-sm text-gray-500">미리보기</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="h-8"></div>
    </motion.div>
  );
}
