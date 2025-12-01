// src/screens/10-PrintingScreen.tsx
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Progress } from '@/components/ui/progress';
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

const logoVariants = {
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

const progressVariants = {
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

export function PrintingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const selectedPrintImage = useSessionStore((state) => state.selectedPrintImage);
  const processedResult = useSessionStore((state) => state.processedResult);
  const cleanupSessionFiles = useSessionStore((state) => state.cleanupSessionFiles);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('인쇄 준비 중...');

  // Ref to track if we're transitioning (to stop hologram polling)
  const isTransitioningRef = useRef(false);
  const hologramIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Maintain hologram display during printing
  useEffect(() => {
    console.log('🎭 [PrintingScreen] Setting up hologram persistence during printing');

    if (!processedResult || !processedResult.qrCodePath || !processedResult.s3Url) {
      console.warn('⚠️ [PrintingScreen] No processedResult - hologram will show logo');
      return;
    }

    const maintainHologram = () => {
      // Don't update hologram if we're transitioning out
      if (isTransitioningRef.current) {
        return;
      }

      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore
        window.electron.hologram.showQR(
          processedResult.qrCodePath,
          processedResult.s3Url
        );
      }
    };

    // Call immediately
    maintainHologram();

    // Poll every 500ms to ensure state persists
    hologramIntervalRef.current = setInterval(maintainHologram, 500);

    return () => {
      console.log('🛑 [PrintingScreen] Stopping hologram polling');
      if (hologramIntervalRef.current) {
        clearInterval(hologramIntervalRef.current);
        hologramIntervalRef.current = null;
      }
    };
  }, [processedResult]);

  useEffect(() => {
    startPrinting();
  }, []);

  const startPrinting = async () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🖨️ [PrintingScreen] STARTING PRINT JOB`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Selected image: ${selectedPrintImage}`);

    try {
      // Check if running in Electron
      // @ts-ignore
      if (!window.electron?.printer) {
        console.warn('⚠️ [PrintingScreen] Electron API not available - running in browser mode');
        // Mock printing for browser testing
        simulatePrinting();
        return;
      }

      if (!selectedPrintImage) {
        throw new Error('No image selected for printing');
      }

      setProgress(10);
      setStatus('프린터 연결 중...');

      // Check printer status
      // @ts-ignore
      const printerStatus = await window.electron.printer.getStatus();
      console.log(`   Printer status:`, printerStatus);

      if (!printerStatus.success || printerStatus.status !== 'ready') {
        throw new Error('프린터가 준비되지 않았습니다');
      }

      setProgress(30);
      setStatus('사진 인쇄 중...');

      // Set up progress listener BEFORE starting print
      let removeProgressListener: (() => void) | undefined;
      // @ts-ignore
      if (window.electron.printer?.onProgress) {
        // @ts-ignore
        removeProgressListener = window.electron.printer.onProgress((progressData: any) => {
          console.log(`🖨️ [PrintingScreen] Print progress: ${progressData.progress}%`);
          setProgress(30 + (progressData.progress * 0.7)); // Map 0-100% to 30-100%
          if (progressData.message) {
            setStatus(progressData.message);
          }
        });
      }

      // Start printing and wait for completion
      // @ts-ignore
      const printResult = await window.electron.printer.print({
        imagePath: selectedPrintImage,
        copies: 1,
      });

      // Clean up progress listener
      if (removeProgressListener) {
        removeProgressListener();
      }

      if (!printResult.success) {
        throw new Error(printResult.error || '인쇄 실패');
      }

      setProgress(100);
      setStatus('인쇄 완료!');

      console.log(`✅ [PrintingScreen] Print job completed successfully`);
      console.log(`${'='.repeat(70)}\n`);

      // Clear session, reset hologram to logo, and return to start
      setTimeout(async () => {
        // CRITICAL: Stop hologram polling BEFORE resetting to logo
        isTransitioningRef.current = true;
        if (hologramIntervalRef.current) {
          clearInterval(hologramIntervalRef.current);
          hologramIntervalRef.current = null;
          console.log('🛑 [PrintingScreen] Hologram polling stopped before transition');
        }

        // Reset hologram window back to logo
        // @ts-ignore
        if (window.electron?.hologram) {
          // @ts-ignore
          window.electron.hologram.showLogo();
          console.log('🎭 [PrintingScreen] Hologram reset to logo');
        }

        // Cleanup session files before clearing session
        await cleanupSessionFiles();
        clearSession();
        setScreen('idle');
      }, 2000);

    } catch (error) {
      console.error(`❌ [PrintingScreen] Print job failed:`, error);
      console.log(`${'='.repeat(70)}\n`);

      setStatus('인쇄 오류 발생');
      alert('인쇄 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));

      setTimeout(async () => {
        // CRITICAL: Stop hologram polling BEFORE resetting to logo
        isTransitioningRef.current = true;
        if (hologramIntervalRef.current) {
          clearInterval(hologramIntervalRef.current);
          hologramIntervalRef.current = null;
          console.log('🛑 [PrintingScreen] Hologram polling stopped before transition (error)');
        }

        // Reset hologram window back to logo
        // @ts-ignore
        if (window.electron?.hologram) {
          // @ts-ignore
          window.electron.hologram.showLogo();
          console.log('🎭 [PrintingScreen] Hologram reset to logo');
        }

        // Cleanup session files before clearing session
        await cleanupSessionFiles();
        clearSession();
        setScreen('idle');
      }, 2000);
    }
  };

  const simulatePrinting = () => {
    console.log('🖨️ [PrintingScreen] Simulating printing (browser mode)');

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);

      if (currentProgress >= 30 && currentProgress < 60) {
        setStatus('사진 인쇄 중...');
      } else if (currentProgress >= 60 && currentProgress < 90) {
        setStatus('인쇄 진행 중...');
      } else if (currentProgress >= 90) {
        setStatus('인쇄 완료!');
        clearInterval(interval);

        setTimeout(async () => {
          // CRITICAL: Stop hologram polling BEFORE resetting to logo
          isTransitioningRef.current = true;
          if (hologramIntervalRef.current) {
            clearInterval(hologramIntervalRef.current);
            hologramIntervalRef.current = null;
            console.log('🛑 [PrintingScreen] Hologram polling stopped before transition (simulated)');
          }

          // Reset hologram window back to logo
          // @ts-ignore
          if (window.electron?.hologram) {
            // @ts-ignore
            window.electron.hologram.showLogo();
          }

          // Cleanup session files before clearing session
          await cleanupSessionFiles();
          clearSession();
          setScreen('idle');
        }, 1500);
      }
    }, 500);
  };

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between p-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <motion.div className="text-center mt-12" variants={headingVariants}>
        <h1 className="text-5xl font-bold mb-3">사진 인쇄</h1>
        <p className="text-3xl text-gray-600 font-medium">잠시만 기다려주세요</p>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-16 w-full max-w-3xl">
        {/* Logo */}
        <motion.div variants={logoVariants}>
          <Logo className="w-64" color="black" />
        </motion.div>

        {/* Printer Icon with Animation */}
        <motion.div variants={logoVariants} className="relative">
          <motion.div
            animate={{
              y: [-5, 5, -5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Printer className="w-32 h-32 text-black" strokeWidth={2} />
          </motion.div>

          {/* Spinning loader overlay */}
          <motion.div
            className="absolute -top-4 -right-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-16 h-16 text-black" strokeWidth={2} />
          </motion.div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div className="w-full space-y-6" variants={progressVariants}>
          <Progress value={progress} className="h-6" />
          <div className="flex justify-between text-2xl text-gray-600">
            <span>{status}</span>
            <span className="font-bold">{Math.round(progress)}%</span>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div className="text-center" variants={headingVariants}>
        <p className="text-2xl text-gray-500">
          인쇄가 완료되면 자동으로 처음 화면으로 돌아갑니다
        </p>
      </motion.div>
    </motion.div>
  );
}
