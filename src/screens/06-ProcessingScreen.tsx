// src/screens/06-ProcessingScreen.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
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

const messageVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.3,
    },
  },
};

export function ProcessingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const { capturedImages, selectedFrame, setProcessedResult } = useSessionStore();
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('처리 시작...');

  useEffect(() => {
    // Check if running in Electron
    // @ts-ignore
    if (!window.electron?.video) {
      console.warn('Running in browser - skipping video processing');
      // Mock progress for browser testing
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          // Mock result - use a data URL for QR code that works in browser
          // Generate a simple QR code data URL (this is a placeholder - will be replaced with actual generated QR)
          const mockQrDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0id2hpdGUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1vY2sgUVIgQ29kZTwvdGV4dD48L3N2Zz4=';
          setProcessedResult({
            videoPath: '/mock/video.mp4',
            s3Url: 'https://mock-s3.com/video.mp4',
            s3Key: 'mock-key',
            qrCodePath: mockQrDataUrl,
            compositionTime: 5000,
            totalTime: 5000,
          });
          setTimeout(() => setScreen('result'), 500);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    startProcessing();

    // Set up progress listener
    // @ts-ignore
    const removeProgressListener = window.electron.video.onProgress((progressData) => {
      setProgress(progressData.progress);
      setCurrentMessage(progressData.message);
    });

    // Set up completion listener
    // @ts-ignore
    const removeCompleteListener = window.electron.video.onComplete((result) => {
      if (result.success && result.result) {
        // Save the processing result to session store
        setProcessedResult(result.result);

        // Navigate to result screen
        setTimeout(() => {
          setScreen('result');
        }, 500);
      } else {
        console.error('Video processing failed:', result.error);
        // Show error and return to idle
        alert('비디오 처리 중 오류가 발생했습니다: ' + result.error);
        setTimeout(() => {
          setScreen('idle');
        }, 2000);
      }
    });

    return () => {
      removeProgressListener();
      removeCompleteListener();
    };
  }, [setScreen, capturedImages, selectedFrame, setProcessedResult]);

  const startProcessing = async () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 [ProcessingScreen] STARTING VIDEO PROCESSING`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Captured images: ${capturedImages.length}`);
    console.log(`   Selected frame: ${selectedFrame?.name || '(none)'}`);

    try {
      // Check if running in Electron
      // @ts-ignore
      if (!window.electron?.video || !window.electron?.image) {
        console.warn('⚠️ [ProcessingScreen] Electron API not available - running in browser mode');
        return;
      }

      if (capturedImages.length !== 3) {
        throw new Error(`Expected 3 captured images, got ${capturedImages.length}`);
      }

      if (!selectedFrame) {
        throw new Error('No frame selected');
      }

      setProgress(5);
      setCurrentMessage('이미지 저장 중...');

      // Step 1: Convert blob URLs to base64 and save as files
      console.log(`\n💾 [ProcessingScreen] Saving ${capturedImages.length} images to files...`);
      const imagePaths: string[] = [];

      for (let i = 0; i < capturedImages.length; i++) {
        const blobUrl = capturedImages[i];
        console.log(`\n📸 [ProcessingScreen] Processing image ${i + 1}/3:`);
        console.log(`   Blob URL: ${blobUrl}`);

        // Fetch blob and convert to base64
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        console.log(`   ✓ Blob size: ${(blob.size / 1024).toFixed(2)} KB`);

        // Convert to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        console.log(`   ✓ Base64 length: ${base64.length} chars`);

        // Save via Electron IPC
        const filename = `capture_${Date.now()}_${i + 1}.jpg`;
        console.log(`   → Saving as: ${filename}`);

        // @ts-ignore
        const saveResult = await window.electron.image.saveBlob(base64, filename);

        if (!saveResult.success) {
          throw new Error(`Failed to save image ${i + 1}: ${saveResult.error}`);
        }

        console.log(`   ✅ Saved to: ${saveResult.filePath}`);
        imagePaths.push(saveResult.filePath);
      }

      console.log(`\n✅ [ProcessingScreen] All images saved!`);
      imagePaths.forEach((path, i) => {
        console.log(`   Image ${i + 1}: ${path}`);
      });

      setProgress(15);
      setCurrentMessage('비디오 생성 중...');

      // Step 2: Process images through pipeline
      console.log(`\n🎬 [ProcessingScreen] Starting video processing...`);
      console.log(`   Frame template: ${selectedFrame.templatePath}`);

      // @ts-ignore
      await window.electron.video.processFromImages({
        imagePaths: imagePaths,
        frameTemplatePath: selectedFrame.templatePath,
        subtitleText: 'MUT 홀로그램 스튜디오',
        s3Folder: 'mut-hologram',
      });

      console.log(`✅ [ProcessingScreen] Video processing started successfully!`);
      console.log(`${'='.repeat(70)}\n`);

    } catch (error) {
      console.error(`❌ [ProcessingScreen] Failed to start video processing:`, error);
      console.log(`${'='.repeat(70)}\n`);

      alert('비디오 처리 시작 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => setScreen('idle'), 2000);
    }
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
        <h1 className="text-5xl font-bold mb-3">촬영 종료</h1>
        <p className="text-3xl text-gray-600 font-medium">홀로그램 제작 중</p>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-16 w-full max-w-3xl">
        {/* Logo */}
        <motion.div variants={logoVariants}>
          <Logo className="w-64" color="black" />
        </motion.div>

        {/* Spinner */}
        <motion.div variants={logoVariants}>
          <Loader2 className="w-32 h-32 text-black animate-spin" strokeWidth={2} />
        </motion.div>

        {/* Progress Bar */}
        <motion.div className="w-full space-y-6" variants={progressVariants}>
          <Progress value={progress} className="h-6" />
          <div className="flex justify-between text-2xl text-gray-600">
            <span>처리 중...</span>
            <span className="font-bold">{progress}%</span>
          </div>
        </motion.div>

        {/* Status Messages */}
        <motion.div className="h-24 flex items-center justify-center" variants={progressVariants}>
          <motion.p
            key={currentMessage}
            variants={messageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-3xl font-medium text-gray-700"
          >
            {currentMessage}
          </motion.p>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div className="text-center mb-12" variants={progressVariants}>
        <p className="text-2xl text-gray-500">클라우드 전송 시 대기화면</p>
      </motion.div>
    </motion.div>
  );
}
