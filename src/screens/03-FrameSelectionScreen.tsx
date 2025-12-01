// src/screens/03-FrameSelectionScreen.tsx
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import type { Frame } from '@/store/types';

// Demo config interface
interface DemoConfig {
  enabled: boolean;
  videoPath: string;
}

// Inactivity timeout in seconds - return to idle if no selection
const INACTIVITY_TIMEOUT = 30;

// Frame data - Served from public directory
const frames = [
  {
    id: '1',
    name: '프레임 1',
    description: '클래식 스타일',
    thumbnailPath: './frame1.png',
    templatePath: './frame1.png',
    chromaVideoPath: '',
  },
  {
    id: '2',
    name: '프레임 2',
    description: '모던 스타일',
    thumbnailPath: './frame2.png',
    templatePath: './frame2.png',
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
  const clearSession = useSessionStore((state) => state.clearSession);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const setSelectedFrame = useSessionStore((state) => state.setSelectedFrame);
  const setDemoVideo = useSessionStore((state) => state.setDemoVideo);
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT);
  const [demoConfig, setDemoConfig] = useState<DemoConfig | null>(null);

  // Load demo config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window as any).electron?.config?.get();
        if (result?.success && result?.config?.demo) {
          console.log('[FrameSelectionScreen] Demo config loaded:', result.config.demo);
          setDemoConfig(result.config.demo);
        }
      } catch (error) {
        console.error('[FrameSelectionScreen] Failed to load demo config:', error);
      }
    };
    loadConfig();
  }, []);

  // Handle demo video shooting - set demo mode and go to recording
  const handleDemoShoot = useCallback(() => {
    if (demoConfig) {
      console.log('🎬 [FrameSelectionScreen] Starting demo video shooting:', demoConfig.videoPath);
      // Set demo video mode in session
      setDemoVideo(true, demoConfig.videoPath);
      // Auto-select first frame (needed for the flow)
      if (frames.length > 0) {
        setSelectedFrame(frames[0] as Frame);
      }
      // Go to recording guide screen
      setScreen('recording-guide');
    }
  }, [demoConfig, setDemoVideo, setSelectedFrame, setScreen]);

  // Auto-select first frame if none is selected
  useEffect(() => {
    if (!selectedFrame && frames.length > 0) {
      console.log('🖼️ [FrameSelectionScreen] Auto-selecting first frame as default');
      setSelectedFrame(frames[0] as Frame);
    }
  }, [selectedFrame, setSelectedFrame]);

  // Inactivity timeout - return to idle after INACTIVITY_TIMEOUT seconds
  useEffect(() => {
    console.log('⏱️ [FrameSelectionScreen] Starting inactivity timer');

    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          console.log('⏰ [FrameSelectionScreen] Timeout - returning to idle');
          clearSession();
          setScreen('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [setScreen, clearSession]);

  const handleFrameSelect = (frame: Frame) => {
    // Disable demo mode when selecting a regular frame
    setDemoVideo(false);
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
        {/* Inactivity timer */}
        <p className="text-lg text-gray-400 mt-4">
          {timeRemaining}초 후 처음 화면으로 돌아갑니다
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

      {/* Demo Video Shooting Button - Only shown when demo.enabled is true */}
      {demoConfig?.enabled && (
        <motion.div
          className="mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleDemoShoot}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            🎬 데모 영상으로 촬영하기
          </button>
        </motion.div>
      )}

      <div className="h-8"></div>
    </motion.div>
  );
}
