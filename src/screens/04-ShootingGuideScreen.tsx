// src/screens/04-ShootingGuideScreen.tsx
import { useEffect, useState, useRef } from 'react';
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
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const cameraStream = useAppStore((state) => state.cameraStream); // Get global camera stream
  const setCameraStream = useAppStore((state) => state.setCameraStream);
  const [countdown, setCountdown] = useState<number | null>(10);
  const [showInstructions, setShowInstructions] = useState(true);
  const [videoReady, setVideoReady] = useState(false); // Track when webcam preview is ready
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Use existing global camera stream OR start a new one (fallback)
  useEffect(() => {
    const initializeCamera = async () => {
      // Check if global camera stream already exists AND is active
      if (cameraStream && cameraStream.active) {
        console.log('⚡ [ShootingGuideScreen] Using EXISTING global camera stream (instant startup!)');
        console.log('   ✓ Camera was already running in background from StartScreen');

        // Connect existing stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              console.warn('Video play error (can be ignored):', err);
            });
          };
        }

        setVideoReady(true);
        console.log('✅ [ShootingGuideScreen] Camera feed connected INSTANTLY!');
        return;
      }

      // Stream exists but is inactive - clear it and start fresh
      if (cameraStream && !cameraStream.active) {
        console.warn('⚠️ [ShootingGuideScreen] Existing stream is inactive, clearing and starting fresh');
        setCameraStream(null);
      }

      // Fallback: Start new camera stream if global one doesn't exist
      console.log('📷 [ShootingGuideScreen] No global stream found, starting Canon webcam...');

      try {
        // Enumerate all video devices to find Canon camera
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log('📹 Available cameras:');
        videoDevices.forEach((device, index) => {
          console.log(`  ${index + 1}. ${device.label || 'Unknown Camera'} (${device.deviceId})`);
        });

        // Find Canon EOS webcam (look for "Canon" in the label)
        const canonCamera = videoDevices.find(device =>
          device.label.toLowerCase().includes('canon') ||
          device.label.toLowerCase().includes('eos')
        );

        let deviceId: string | undefined;
        if (canonCamera) {
          deviceId = canonCamera.deviceId;
          console.log(`✅ Found Canon camera: ${canonCamera.label}`);
        } else {
          // Fallback to built-in MacBook camera (usually first device)
          console.warn('⚠️ Canon camera not found, using MacBook camera (first device)');
          deviceId = videoDevices[0]?.deviceId; // Use first device (built-in camera)
          if (videoDevices[0]) {
            console.log(`   📱 Using: ${videoDevices[0].label || 'Built-in Camera'}`);
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        console.log('✅ [ShootingGuideScreen] Canon webcam started!');

        // Store in global store for future use
        setCameraStream(stream);

        // Connect stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              console.warn('Video play error (can be ignored):', err);
            });
          };
        }

        setVideoReady(true);

      } catch (error) {
        console.error('❌ [ShootingGuideScreen] Failed to access Canon webcam:', error);
        setVideoReady(true);
      }
    };

    initializeCamera();

    // NO CLEANUP - stream persists in global store!
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
      {/* Canon Webcam Live Preview - Full Screen Background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: 'scaleX(-1)', // Mirror the video
          opacity: videoReady ? 1 : 0, // Hide until ready
          transition: 'opacity 0.3s ease-in'
        }}
      />

      {/* Frame Overlay - Show only when video is ready */}
      {selectedFrame && videoReady && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={selectedFrame.templatePath}
            alt="Frame Overlay"
            className="w-full h-full object-contain opacity-100"
          />
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
