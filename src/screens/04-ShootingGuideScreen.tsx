// src/screens/04-ShootingGuideScreen.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';

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

export function ShootingGuideScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const cameraStream = useAppStore((state) => state.cameraStream);
  const setCameraStream = useAppStore((state) => state.setCameraStream);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const useDemoVideo = useSessionStore((state) => state.useDemoVideo);
  const demoVideoPath = useSessionStore((state) => state.demoVideoPath);
  const [countdown, setCountdown] = useState<number | null>(10);
  const [showInstructions, setShowInstructions] = useState(true);
  const [videoReady, setVideoReady] = useState(false); // Track when video is ready
  const [demoVideoReady, setDemoVideoReady] = useState(false); // Track demo video ready state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Monitor 2 stays on logo - ensure it's set to logo mode
  useEffect(() => {
    console.log('📺 [ShootingGuideScreen] Monitor 2 will show logo');

    // @ts-ignore
    if (window.electron?.hologram) {
      console.log(`🎭 [ShootingGuideScreen] Setting Monitor 2 to logo mode`);
      // @ts-ignore
      window.electron.hologram.setMode('logo');
    // @ts-ignore
    } else if (!window.electron?.hologram) {
      console.log('ℹ️ [ShootingGuideScreen] Electron hologram API not available (running in browser)');
    }

    return () => {
      console.log('🎭 [ShootingGuideScreen] Cleanup - Monitor 2 remains on logo');
    };
  }, []);

  // Initialize camera for Monitor 1 with canvas rotation (16:9 → 9:16)
  useEffect(() => {
    console.log('📷 [ShootingGuideScreen] Setting up camera display with rotation...');

    const setupCameraWithRotation = (stream: MediaStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video metadata to load
        videoRef.current.onloadedmetadata = () => {
          const video = videoRef.current!;
          const canvas = canvasRef.current!;
          const ctx = canvas.getContext('2d')!;

          // Get actual video dimensions
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          console.log(`📐 [ShootingGuideScreen] Video dimensions: ${videoWidth}x${videoHeight}`);

          // Canvas size = rotated dimensions (swap width/height for 90° rotation)
          canvas.width = videoHeight;  // 1080 → canvas width
          canvas.height = videoWidth;  // 1920 → canvas height

          console.log(`🔄 [ShootingGuideScreen] Canvas dimensions (rotated): ${canvas.width}x${canvas.height}`);

          // Draw rotated frames to canvas
          const drawRotatedFrame = () => {
            if (!video.paused && !video.ended) {
              // Save context state
              ctx.save();

              // Move to center of canvas
              ctx.translate(canvas.width / 2, canvas.height / 2);

              // Rotate 90 degrees clockwise
              ctx.rotate(90 * Math.PI / 180);

              // Mirror horizontally (for selfie mode) and draw
              ctx.scale(-1, 1);

              // Draw video centered (note: dimensions are swapped due to rotation)
              ctx.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);

              // Restore context state
              ctx.restore();
            }

            // Continue animation loop
            animationFrameRef.current = requestAnimationFrame(drawRotatedFrame);
          };

          // Start drawing loop
          drawRotatedFrame();
          setVideoReady(true);
          console.log('🎬 [ShootingGuideScreen] Canvas rotation started');
        };

        console.log('📺 [ShootingGuideScreen] Stream assigned to video element');
      }
    };

    // Use global camera stream from StartScreen (already running!)
    if (cameraStream && cameraStream.active) {
      console.log('✅ [ShootingGuideScreen] Using GLOBAL camera stream (instant connection!)');
      console.log(`   Active tracks: ${cameraStream.getVideoTracks().length}`);
      setupCameraWithRotation(cameraStream);
    } else {
      // Fallback: Start new camera if global stream not available
      console.warn('⚠️ [ShootingGuideScreen] Global camera stream not available, starting new...');

      const startCamera = async () => {
        try {
          // Enumerate cameras to find Canon EOS or other DSLR
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');

          console.log('📹 [ShootingGuideScreen] Available cameras:');
          videoDevices.forEach((device, index) => {
            console.log(`  ${index + 1}. ${device.label || 'Unknown Camera'}`);
          });

          // Priority: 2nd camera (index 1) > 1st camera (index 0)
          // This is because the 2nd camera is typically the external/DSLR camera
          let deviceId: string | undefined;
          let selectedCamera: MediaDeviceInfo | undefined;

          if (videoDevices.length >= 2) {
            // Use 2nd camera (index 1) - typically external camera
            selectedCamera = videoDevices[1];
            deviceId = selectedCamera.deviceId;
            console.log(`✅ [ShootingGuideScreen] Using 2nd camera: ${selectedCamera.label || 'Camera 2'}`);
          } else if (videoDevices.length === 1) {
            // Fallback to 1st camera (index 0)
            selectedCamera = videoDevices[0];
            deviceId = selectedCamera.deviceId;
            console.log(`⚠️ [ShootingGuideScreen] Only 1 camera available, using: ${selectedCamera.label || 'Camera 1'}`);
          } else {
            console.error('❌ [ShootingGuideScreen] No cameras found!');
            setVideoReady(true); // Show UI anyway
            return;
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: deviceId ? { exact: deviceId } : undefined,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });

          console.log('✅ [ShootingGuideScreen] Camera access granted!');

          // Store in global store for persistence
          setCameraStream(stream);

          setupCameraWithRotation(stream);
        } catch (error) {
          console.error('❌ [ShootingGuideScreen] Failed to access camera:', error);
          // Still show UI even if camera fails (for testing)
          setVideoReady(true);
        }
      };

      startCamera();
    }

    // Cleanup: Stop animation frame but NOT the global camera stream
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraStream, setCameraStream]);


  useEffect(() => {
    // Auto-start 10-second countdown
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // Hide instructions after 5 seconds
    const instructionsTimer = setTimeout(() => {
      setShowInstructions(false);
    }, 5000);

    // Navigate to recording screen after countdown finishes
    const navigationTimer = setTimeout(() => {
      setScreen('recording');
    }, 11000); // 10 seconds countdown + 1 second buffer

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(instructionsTimer);
      clearTimeout(navigationTimer);
    };
  }, [setScreen]);

  return (
    <motion.div
      className="fullscreen bg-black text-white flex items-center justify-center relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Hidden video element - source for canvas rotation */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Live Camera Feed - Rotated Canvas (9:16 portrait) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 0.3s ease-in'
        }}
      />

      {/* Frame Overlay - Show frame image OR demo video when camera is ready */}
      {videoReady && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Demo Video Overlay - Alpha channel video plays on top of camera */}
          {useDemoVideo && demoVideoPath ? (
            <video
              ref={demoVideoRef}
              src={demoVideoPath}
              className="w-full h-full object-contain"
              style={{
                // Transparent background for alpha channel support
                backgroundColor: 'transparent',
              }}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => {
                console.log('🎬 [ShootingGuideScreen] Demo video loaded and ready');
                setDemoVideoReady(true);
              }}
              onError={(e) => {
                console.error('❌ [ShootingGuideScreen] Demo video error:', e);
              }}
            />
          ) : (
            /* Regular Frame Image Overlay */
            selectedFrame && (
              <img
                src={selectedFrame.templatePath}
                alt="Frame Overlay"
                className="w-full h-full object-contain opacity-100"
              />
            )
          )}
        </motion.div>
      )}

      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-30 pointer-events-none" />

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full py-12 px-10 w-full">
        {/* Header - Combined Instructions - Show only for first 5 seconds */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              className="text-center w-full"
              variants={headingVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20, transition: { duration: 0.5 } }}
            >
              <div className="bg-black bg-opacity-80 px-10 py-8 rounded-3xl inline-block">
                <h1 className="text-5xl font-bold mb-6 drop-shadow-lg leading-tight">
                  홀로그램 촬영을 시작합니다.
                </h1>
                <p className="text-3xl drop-shadow-lg leading-relaxed">
                  바닥의 발자국 위치에서<br />
                  프레임 안에 전신이 들어오도록 서주세요.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center - Empty space */}
        <div className="flex-1"></div>

        {/* Bottom - Countdown */}
        <div className="flex flex-col items-center gap-8">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {countdown !== null && countdown > 0 && (
                <motion.div
                  key={countdown}
                  variants={countdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute"
                >
                  <p className="text-[10rem] font-bold text-white leading-none drop-shadow-2xl">
                    {countdown}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
