// src/screens/07-ResultScreen.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.15,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
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

const buttonVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
  tap: {
    scale: 0.95,
  },
};

export function ResultScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const processedResult = useSessionStore((state) => state.processedResult);
  const [timeRemaining, setTimeRemaining] = useState(60);
  // const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  // const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);

  // Auto-redirect to idle if no result
  useEffect(() => {
    if (!processedResult) {
      console.error('No processed result found, returning to idle');
      setTimeout(() => setScreen('idle'), 2000);
    }
  }, [processedResult, setScreen]);

  // Load QR code and video as data URLs via IPC
  // useEffect(() => {
  //   if (!processedResult) return;
  //
  //   const loadFiles = async () => {
  //     // Load QR code
  //     if (processedResult.qrCodePath) {
  //       try {
  //         // @ts-ignore
  //         const result = await window.electron.file.readAsDataUrl(processedResult.qrCodePath);
  //         if (result.success) {
  //           setQrCodeDataUrl(result.dataUrl);
  //         } else {
  //           console.error('Failed to load QR code:', result.error);
  //         }
  //       } catch (error) {
  //         console.error('Error loading QR code:', error);
  //       }
  //     }
  //
  //     // Load video
  //     if (processedResult.videoPath) {
  //       try {
  //         // @ts-ignore
  //         const result = await window.electron.file.readAsDataUrl(processedResult.videoPath);
  //         if (result.success) {
  //           setVideoDataUrl(result.dataUrl);
  //         } else {
  //           console.error('Failed to load video:', result.error);
  //         }
  //       } catch (error) {
  //         console.error('Error loading video:', error);
  //       }
  //     }
  //   };
  //
  //   loadFiles();
  // }, [processedResult]);

  // Update hologram window to show QR code with video background
  useEffect(() => {
    if (processedResult && processedResult.qrCodePath && processedResult.s3Url) {
      console.log('📺 [ResultScreen] Sending video and QR to hologram window');
      console.log(`   QR Code: ${processedResult.qrCodePath}`);
      console.log(`   Video (S3): ${processedResult.s3Url}`);

      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore - Use S3 URL for video (local file is deleted)
        window.electron.hologram.showQR(
          processedResult.qrCodePath,
          processedResult.s3Url  // Use S3 URL instead of local path
        );
      }
    }

    // Don't reset to logo - keep video + QR visible through photo selection, payment, and printing
    // Only reset when going back to start/idle (handled in PrintingScreen)
  }, [processedResult]);

  // 60-second timeout
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          setScreen('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
    };
  }, [setScreen]);

  // const handleSelect = () => {
  //   setScreen('image-selection');
  // };

  const handlePay = () => {
    // CRITICAL: Ensure hologram stays in result mode before navigating
    if (processedResult && processedResult.qrCodePath && processedResult.s3Url) {
      console.log('🎭 [ResultScreen] Ensuring hologram persists before navigation to image-selection');
      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore - Re-send to ensure state persists
        window.electron.hologram.showQR(
          processedResult.qrCodePath,
          processedResult.s3Url
        );
      }
    }

    // Navigate to image selection screen to choose which photo to print
    setScreen('image-selection');
  };

  if (!processedResult) {
    return (
      <div className="fullscreen bg-white text-black flex items-center justify-center">
        <p className="text-3xl">결과를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between py-8 px-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Top - Countdown Timer */}
      <motion.div className="w-full flex justify-end" variants={itemVariants}>
        <div className="flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-full border-2 border-black">
          <Clock className="w-8 h-8 text-gray-800" />
          <span className="text-3xl font-bold text-gray-800">{timeRemaining}</span>
        </div>
      </motion.div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 max-h-[calc(100vh-12rem)] overflow-hidden">
        {/* Logo */}
        <motion.div variants={itemVariants}>
          <Logo className="w-48 max-w-[12rem]" color="black" />
        </motion.div>

        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
        >
          <CheckCircle2 className="w-24 h-24 text-green-600" strokeWidth={2.5} />
        </motion.div>

        {/* Main Message */}
        <motion.div className="text-center space-y-2 px-4" variants={itemVariants}>
          <h1 className="text-4xl font-bold leading-tight">
            홀로그램 촬영이 종료되었습니다!
          </h1>
          <p className="text-2xl text-gray-700 leading-relaxed">
            우측 기기에서 결과물을 확인하고, QR 코드로 영상을 다운로드 하세요.
          </p>
        </motion.div>

        {/* Print Section */}
        <motion.div
          className="bg-gray-50 rounded-2xl p-6 border-4 border-black shadow-2xl max-w-2xl"
          variants={itemVariants}
        >
          <div className="text-center space-y-4">
            <p className="text-2xl font-bold leading-snug">
              포토 인쇄(1매)를 희망하시면<br/>
              아래 버튼을 눌러주세요.
            </p>
            <p className="text-xl text-gray-600">*유료 서비스</p>

            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <Button
                size="lg"
                onClick={handlePay}
                className="bg-black text-white hover:bg-gray-800 px-16 py-8 text-3xl font-bold touch-target border-2 border-black shadow-2xl"
              >
                ₩5,000 (1매)
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Bottom - Branding */}
      <motion.div className="text-center" variants={itemVariants}>
        <p className="text-xl font-light text-gray-600">MUT 홀로그램 스튜디오</p>
      </motion.div>
    </motion.div>
  );
}
