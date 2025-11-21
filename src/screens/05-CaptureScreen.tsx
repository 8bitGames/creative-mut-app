// src/screens/05-CaptureScreen.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  exit: { opacity: 0 },
};

const countdownVariants = {
  initial: { scale: 0.5, opacity: 0 },
  animate: {
    scale: [0.5, 1.2, 1],
    opacity: [0, 1, 1],
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const flashVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: [0, 1, 0],
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

export function CaptureScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const addCapturedImage = useSessionStore((state) => state.addCapturedImage);
  const [countdown, setCountdown] = useState<number | null>(5);
  const [photoNumber, setPhotoNumber] = useState(1);
  const [showFlash, setShowFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipCountdownRef = useRef<() => void>(() => {});
  const currentCountdownRef = useRef(5);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    console.log('📸 [CaptureScreen] capturePhoto() called - Photo #' + photoNumber);

    if (!videoRef.current || !canvasRef.current) {
      console.warn('⚠️ [CaptureScreen] Missing video or canvas ref');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.warn('⚠️ [CaptureScreen] No canvas context');
      return;
    }

    console.log(`📐 [CaptureScreen] Video dimensions: ${video.videoWidth}x${video.videoHeight}`);

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas (mirrored)
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

    console.log('🎨 [CaptureScreen] Frame drawn to canvas, converting to blob...');

    // Convert canvas to blob and store
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        addCapturedImage(imageUrl);
        console.log(`✅ [CaptureScreen] Photo ${photoNumber} captured successfully!`);
        console.log(`   📊 Blob size: ${(blob.size / 1024).toFixed(2)} KB`);
        console.log(`   🔗 Image URL: ${imageUrl}`);
      } else {
        console.error('❌ [CaptureScreen] Failed to create blob from canvas');
      }
    }, 'image/jpeg', 0.95);
  }, [photoNumber, addCapturedImage]);

  // Initialize camera stream
  useEffect(() => {
    console.log('📷 [CaptureScreen] Component mounted - Initializing camera...');

    const startCamera = async () => {
      try {
        console.log('🎥 [CaptureScreen] Requesting camera access (1080x1920, facingMode: user)...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            facingMode: 'user'
          },
          audio: false
        });

        console.log('✅ [CaptureScreen] Camera access granted!');
        console.log(`   📊 Stream tracks: ${stream.getTracks().length}`);
        stream.getTracks().forEach(track => {
          console.log(`   🎬 Track: ${track.kind} - ${track.label} (${track.enabled ? 'enabled' : 'disabled'})`);
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('📺 [CaptureScreen] Stream assigned to video element');
        } else {
          console.warn('⚠️ [CaptureScreen] Video ref not available yet');
        }
      } catch (error) {
        console.error('❌ [CaptureScreen] Failed to access camera:', error);
        if (error instanceof Error) {
          console.error(`   Error name: ${error.name}`);
          console.error(`   Error message: ${error.message}`);
        }
      }
    };

    startCamera();

    // Cleanup: Stop camera when component unmounts
    return () => {
      console.log('🛑 [CaptureScreen] Component unmounting - Stopping camera...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`   ⏹️ Stopped track: ${track.kind} - ${track.label}`);
        });
      }
    };
  }, []);

  // Control hologram display during recording
  useEffect(() => {
    console.log('🎭 [CaptureScreen] Setting up hologram display...');

    // @ts-ignore
    if (window.electron?.hologram && selectedFrame) {
      console.log(`📺 [CaptureScreen] Sending hologram update: mode=recording-prep, frame=${selectedFrame.templatePath}`);
      // @ts-ignore
      window.electron.hologram.setMode('recording-prep', {
        framePath: selectedFrame.templatePath,
      });
    } else if (!window.electron?.hologram) {
      console.log('ℹ️ [CaptureScreen] Electron hologram API not available (running in browser)');
    } else if (!selectedFrame) {
      console.warn('⚠️ [CaptureScreen] No frame selected!');
    }

    return () => {
      console.log('🎭 [CaptureScreen] Hologram control cleanup (not resetting to logo)');
    };
  }, [selectedFrame]);

  useEffect(() => {
    console.log('⏱️ [CaptureScreen] Starting countdown timer...');

    let currentPhoto = 1;
    let currentCountdown = 5;
    let mainTimer: NodeJS.Timeout | null = null;

    console.log(`📸 [CaptureScreen] Photo ${currentPhoto}/3 - Countdown starting from ${currentCountdown}`);

    // Function to start/restart the countdown timer
    const startCountdown = () => {
      console.log(`⏱️ [CaptureScreen] Starting countdown from ${currentCountdown} for photo ${currentPhoto}/3`);

      // Clear any existing timer to prevent overlaps
      if (mainTimer) {
        clearInterval(mainTimer);
      }

      mainTimer = setInterval(() => {
        currentCountdown--;
        currentCountdownRef.current = currentCountdown; // Keep ref in sync
        console.log(`⏱️ [CaptureScreen] Countdown: ${currentCountdown} (Photo ${currentPhoto}/3)`);

        if (currentCountdown === 0) {
          // Clear the timer immediately when we hit 0 to prevent timing issues
          if (mainTimer) {
            clearInterval(mainTimer);
            mainTimer = null;
          }

          console.log(`\n${'='.repeat(70)}`);
          console.log(`📸 PHOTO CAPTURE ${currentPhoto}/3 STARTING`);
          console.log(`${'='.repeat(70)}`);
          console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
          console.log(`📷 Photo number: ${currentPhoto}`);

          // Hide countdown number
          setCountdown(null);

          // Trigger camera flash effect
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 300);

          // Inline photo capture logic with detailed logging
          if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
              console.log(`\n📹 VIDEO STREAM STATUS:`);
              console.log(`   ✓ Video element ready: true`);
              console.log(`   ✓ Video width: ${video.videoWidth}px`);
              console.log(`   ✓ Video height: ${video.videoHeight}px`);
              console.log(`   ✓ Video aspect ratio: ${(video.videoWidth / video.videoHeight).toFixed(2)}`);
              console.log(`   ✓ Video ready state: ${video.readyState} (4 = HAVE_ENOUGH_DATA)`);
              console.log(`   ✓ Video paused: ${video.paused}`);
              console.log(`   ✓ Video current time: ${video.currentTime.toFixed(2)}s`);

              console.log(`\n🖼️ CANVAS PREPARATION:`);
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              console.log(`   ✓ Canvas width set to: ${canvas.width}px`);
              console.log(`   ✓ Canvas height set to: ${canvas.height}px`);

              console.log(`\n🎨 DRAWING TO CANVAS:`);
              console.log(`   → Applying mirror transform (scaleX: -1)`);
              context.translate(canvas.width, 0);
              context.scale(-1, 1);
              console.log(`   → Drawing video frame to canvas...`);
              const drawStart = performance.now();
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const drawEnd = performance.now();
              console.log(`   ✓ Frame drawn in ${(drawEnd - drawStart).toFixed(2)}ms`);
              context.setTransform(1, 0, 0, 1, 0, 0);
              console.log(`   ✓ Transform reset`);

              console.log(`\n💾 BLOB CONVERSION:`);
              console.log(`   → Converting canvas to JPEG blob (quality: 95%)...`);
              const blobStart = performance.now();

              canvas.toBlob((blob) => {
                const blobEnd = performance.now();

                if (blob) {
                  console.log(`   ✓ Blob created in ${(blobEnd - blobStart).toFixed(2)}ms`);
                  console.log(`   ✓ Blob size: ${(blob.size / 1024).toFixed(2)} KB`);
                  console.log(`   ✓ Blob type: ${blob.type}`);

                  const imageUrl = URL.createObjectURL(blob);
                  console.log(`\n🔗 BLOB URL CREATED:`);
                  console.log(`   → ${imageUrl}`);

                  console.log(`\n💿 STORING IMAGE:`);
                  addCapturedImage(imageUrl);
                  console.log(`   ✓ Image added to session store`);
                  console.log(`   ✓ Total images in store: ${currentPhoto}`);

                  console.log(`\n✅ PHOTO ${currentPhoto}/3 CAPTURED SUCCESSFULLY!`);
                  console.log(`${'='.repeat(70)}\n`);
                } else {
                  console.error(`\n❌ BLOB CREATION FAILED`);
                  console.error(`   → Canvas toBlob returned null`);
                  console.error(`${'='.repeat(70)}\n`);
                }
              }, 'image/jpeg', 0.95);
            } else {
              console.error(`\n❌ CANVAS CONTEXT NOT AVAILABLE`);
              console.error(`${'='.repeat(70)}\n`);
            }
          } else {
            console.error(`\n❌ VIDEO OR CANVAS REF NOT AVAILABLE`);
            console.error(`   Video ref: ${videoRef.current ? 'available' : 'NULL'}`);
            console.error(`   Canvas ref: ${canvasRef.current ? 'available' : 'NULL'}`);
            console.error(`${'='.repeat(70)}\n`);
          }

          setTimeout(() => {
            if (currentPhoto < 3) {
              // Prepare for next photo
              currentPhoto++;
              setPhotoNumber(currentPhoto); // Update UI to show next photo number
              currentCountdown = 5;
              setCountdown(5);
              console.log(`\n🔄 PREPARING FOR NEXT PHOTO:`);
              console.log(`   → Moving to photo ${currentPhoto}/3`);
              console.log(`   → Countdown reset to ${currentCountdown} seconds`);
              console.log(`   → Restarting countdown timer...\n`);

              // Start a fresh countdown timer for the next photo
              startCountdown();
            } else {
              // All photos captured, navigate to processing
              console.log(`\n${'='.repeat(70)}`);
              console.log(`🎉 ALL PHOTOS CAPTURED!`);
              console.log(`${'='.repeat(70)}`);
              console.log(`✓ Total photos: 3`);
              console.log(`✓ Session complete`);
              console.log(`→ Navigating to processing screen...`);
              console.log(`${'='.repeat(70)}\n`);

              setTimeout(() => {
                setScreen('processing');
              }, 500);
            }
          }, 200); // Brief pause before next photo
        } else {
          setCountdown(currentCountdown);
        }
      }, 1000);
    };

    // Start the initial countdown
    startCountdown();

    // Expose skip function - force immediate capture by clearing timer and setting countdown to 0
    skipCountdownRef.current = () => {
      console.log('⏩ [CaptureScreen] Skipping countdown via spacebar - forcing immediate capture');

      // Clear the current timer
      if (mainTimer) {
        clearInterval(mainTimer);
        mainTimer = null;
      }

      // Hide countdown and trigger flash immediately
      setCountdown(null);

      // Force countdown to 0 to trigger capture
      currentCountdown = 0;
      currentCountdownRef.current = 0;

      // Manually trigger the capture logic by restarting the timer
      // which will immediately hit the countdown === 0 condition
      startCountdown();
    };

    return () => {
      console.log('🛑 [CaptureScreen] Clearing countdown timer');
      if (mainTimer) {
        clearInterval(mainTimer);
      }
    };
  }, [setScreen, addCapturedImage]);

  // Keyboard listener for spacebar to skip countdown
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && countdown !== null && countdown > 0) {
        event.preventDefault();
        skipCountdownRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [countdown]);

  return (
    <motion.div
      className="fullscreen bg-black text-white flex flex-col items-center justify-between py-10 px-8 relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between">
        <p className="text-xl font-medium text-gray-300">촬영 중입니다...</p>
        <div className="bg-white text-black px-5 py-2 rounded-full">
          <p className="text-lg font-bold">
            사진 {photoNumber}/3
          </p>
        </div>
      </div>

      {/* Main Content Area - Centered Countdown */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Countdown Display */}
        <AnimatePresence mode="wait">
          {countdown !== null && countdown > 0 && (
            <motion.div
              key={countdown}
              variants={countdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <p className="text-[12rem] font-bold text-white leading-none">
                {countdown}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden video element for camera capture - not displayed on screen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Flash Effect */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            className="absolute inset-0 bg-white pointer-events-none z-50"
            variants={flashVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
