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

// Removed: messageVariants (not showing messages anymore)

export function ProcessingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const recordedVideoBlob = useSessionStore((state) => state.recordedVideoBlob);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const setProcessedResult = useSessionStore((state) => state.setProcessedResult);
  const setCapturedImages = useSessionStore((state) => state.setCapturedImages);
  const [progress, setProgress] = useState(0);
  // Removed: currentMessage state (showing only progress bar now)

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
          // Mock result
          const mockQrDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0id2hpdGUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1vY2sgUVIgQ29kZTwvdGV4dD48L3N2Zz4=';
          setProcessedResult({
            videoPath: '/mock/video.mp4',
            s3Url: 'https://mock-s3.com/video.mp4',
            s3Key: 'mock-key',
            qrCodePath: mockQrDataUrl,
            framePaths: [],
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
      // Progress message removed - only showing progress bar
    });

    // Set up completion listener
    // @ts-ignore
    const removeCompleteListener = window.electron.video.onComplete((result) => {
      if (result.success && result.result) {
        // Save the processing result to session store
        setProcessedResult(result.result);

        // CRITICAL: Validate that exactly 3 frames were extracted
        const REQUIRED_FRAMES = 3;
        if (result.result.framePaths && result.result.framePaths.length === REQUIRED_FRAMES) {
          console.log(`✅ [ProcessingScreen] Received ${result.result.framePaths.length} extracted frames from pipeline`);
          console.log(`   Frame paths:`, result.result.framePaths);
          setCapturedImages(result.result.framePaths);

          // Navigate to result screen
          setTimeout(() => {
            setScreen('result');
          }, 500);
        } else {
          // Frame extraction failed - show error
          const frameCount = result.result.framePaths ? result.result.framePaths.length : 0;
          const errorMsg = `프레임 추출 오류: ${REQUIRED_FRAMES}개의 사진이 필요하지만 ${frameCount}개만 추출되었습니다.`;
          console.error(`❌ [ProcessingScreen] ${errorMsg}`);
          console.error(`   Expected ${REQUIRED_FRAMES} frames, got ${frameCount}`);
          if (result.result.framePaths) {
            console.error(`   Received frames:`, result.result.framePaths);
          }

          alert(errorMsg + '\n처음부터 다시 시도해주세요.');
          setTimeout(() => {
            setScreen('idle');
          }, 2000);
        }
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
  }, [setScreen, recordedVideoBlob, selectedFrame, setProcessedResult, setCapturedImages]);

  const startProcessing = async () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 [ProcessingScreen] STARTING VIDEO PROCESSING`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Recorded video blob: ${recordedVideoBlob ? `${(recordedVideoBlob.size / 1024).toFixed(2)} KB` : '(none)'}`);
    console.log(`   Selected frame: ${selectedFrame?.name || '(none)'}`);

    try {
      // Check if running in Electron
      // @ts-ignore
      if (!window.electron?.video || !window.electron?.image) {
        console.warn('⚠️ [ProcessingScreen] Electron API not available - running in browser mode');
        return;
      }

      if (!recordedVideoBlob) {
        throw new Error('No recorded video blob found');
      }

      if (!selectedFrame) {
        throw new Error('No frame selected');
      }

      setProgress(80);
      // Message removed

      // Step 1: Convert video blob to base64 and save as file
      console.log(`\n💾 [ProcessingScreen] Saving video to file...`);
      console.log(`   Blob size: ${(recordedVideoBlob.size / 1024).toFixed(2)} KB`);
      console.log(`   Blob type: ${recordedVideoBlob.type}`);

      // Validate blob
      if (recordedVideoBlob.size === 0) {
        throw new Error('Video blob has zero size');
      }

      // Convert blob to array buffer
      const arrayBuffer = await recordedVideoBlob.arrayBuffer();
      console.log(`   ✓ ArrayBuffer size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

      // Check first 16 bytes to verify WebM header
      const bytes = new Uint8Array(arrayBuffer);
      const hexHeader = Array.from(bytes.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');
      console.log(`   Blob header (hex): ${hexHeader}`);
      console.log(`   Expected WebM header: 1A45DFA3...`);

      // Convert to array for IPC transfer (avoiding base64 conversion issues)
      const byteArray = Array.from(bytes);
      console.log(`   ✓ Byte array length: ${byteArray.length} bytes`);

      // Determine file extension based on blob type
      const extension = recordedVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const filename = `recording_${Date.now()}.${extension}`;
      console.log(`   → Saving as: ${filename} (type: ${recordedVideoBlob.type})`);

      // @ts-ignore
      const saveResult = await window.electron.video.saveBuffer(byteArray, filename);

      if (!saveResult.success) {
        throw new Error(`Failed to save video: ${saveResult.error}`);
      }

      console.log(`   ✅ Saved to: ${saveResult.filePath}`);
      const videoPath = saveResult.filePath;

      setProgress(85);
      // Message removed

      // Step 2: Process video - extract screenshots, upload to AWS, generate QR
      console.log(`\n🎬 [ProcessingScreen] Starting video processing...`);
      console.log(`   Video path: ${videoPath}`);
      console.log(`   Frame template: ${selectedFrame.templatePath}`);
      console.log(`   Screenshots will be extracted at: 5s, 10s, 15s`);

      // Call video processing with the recorded video file
      // The Python pipeline will:
      // 1. Apply frame overlay to video
      // 2. Upload the video to AWS S3
      // 3. Generate QR code

      // Convert frame template URL to filesystem path
      let frameFilesystemPath = selectedFrame.templatePath;
      if (selectedFrame.templatePath.startsWith('/')) {
        // URL path like "/frame1.png" needs to be converted to filesystem path
        // This will be handled by the Python bridge, but we need to pass the URL
        frameFilesystemPath = selectedFrame.templatePath;
      }

      console.log(`   Frame template path: ${frameFilesystemPath}`);

      // @ts-ignore
      await window.electron.video.process({
        inputVideo: videoPath,
        chromaVideo: frameFilesystemPath, // Pass frame template path (will be mapped to frameOverlay)
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
        {/* Progress message removed - showing only progress bar */}
      </div>
    </motion.div>
  );
}
