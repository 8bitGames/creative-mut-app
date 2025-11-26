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

type CapturePhase = 'transition' | 'recording';

export function CaptureScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const setRecordedVideo = useSessionStore((state) => state.setRecordedVideo);

  const [phase, setPhase] = useState<CapturePhase>('transition');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [photoNumber, setPhotoNumber] = useState(0); // 0 means no photos yet
  const [showFlash, setShowFlash] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // Elapsed recording time in seconds

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shutterSoundRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize camera stream with canvas rotation (16:9 → 9:16)
  useEffect(() => {
    console.log('📷 [CaptureScreen] Component mounted - Initializing camera with rotation...');

    const startCamera = async () => {
      try {
        // Request 16:9 landscape from webcam (what most webcams output natively)
        console.log('🎥 [CaptureScreen] Requesting camera access (1920x1080, facingMode: user)...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          },
          audio: false
        });

        console.log('✅ [CaptureScreen] Camera access granted!');
        streamRef.current = stream;

        // Set up hidden video element to receive webcam stream
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

            console.log(`📐 [CaptureScreen] Video dimensions: ${videoWidth}x${videoHeight}`);

            // Canvas size = rotated dimensions (swap width/height for 90° rotation)
            canvas.width = videoHeight;  // 1080 → canvas width
            canvas.height = videoWidth;  // 1920 → canvas height

            console.log(`🔄 [CaptureScreen] Canvas dimensions (rotated): ${canvas.width}x${canvas.height}`);

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

            // Create stream from canvas for recording (30fps)
            canvasStreamRef.current = canvas.captureStream(30);
            console.log('🎬 [CaptureScreen] Canvas stream created for recording');
          };

          console.log('📺 [CaptureScreen] Stream assigned to video element');
        }
      } catch (error) {
        console.error('❌ [CaptureScreen] Failed to access camera:', error);
      }
    };

    startCamera();

    // Load shutter sound
    shutterSoundRef.current = new Audio('./sounds/camera-shutter.mp3');

    // Cleanup: Stop camera when component unmounts
    return () => {
      console.log('🛑 [CaptureScreen] Component unmounting - Stopping camera...');

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop original webcam stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Stop canvas stream
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Monitor 2 stays on logo throughout
  useEffect(() => {
    console.log('🎭 [CaptureScreen] Monitor 2 remains on logo');

    // @ts-ignore
    if (window.electron?.hologram) {
      console.log(`📺 [CaptureScreen] Keeping Monitor 2 in logo mode`);
      // @ts-ignore
      window.electron.hologram.setMode('logo');
    // @ts-ignore
    } else if (!window.electron?.hologram) {
      console.log('ℹ️ [CaptureScreen] Electron hologram API not available (running in browser)');
    }

    return () => {
      console.log('🎭 [CaptureScreen] Hologram control cleanup');
    };
  }, []);

  // Play photo effect (flash + sound) - no actual photo capture
  const playPhotoEffect = useCallback(() => {
    console.log(`📸 [CaptureScreen] Playing photo effect (flash + sound)`);

    // Play shutter sound
    if (shutterSoundRef.current) {
      shutterSoundRef.current.currentTime = 0;
      shutterSoundRef.current.play().catch(err => console.warn('Could not play shutter sound:', err));
    }

    // Show flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    console.log('✅ [CaptureScreen] Photo effect played (no actual capture)');
  }, []);

  // Start video recording (uses rotated canvas stream)
  const startVideoRecording = useCallback(() => {
    // Use canvas stream for rotated video recording
    if (!canvasStreamRef.current) {
      console.error('❌ [CaptureScreen] No canvas stream available for recording');
      return;
    }

    try {
      console.log('🎬 [CaptureScreen] Starting video recording (rotated canvas stream)...');
      recordedChunksRef.current = [];

      // Try different codecs in order of preference (MP4 first for better compatibility)
      let options;
      let mimeType = 'video/webm'; // fallback

      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        options = { mimeType: 'video/mp4' };
        console.log('   Using codec: MP4');
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4';
        options = { mimeType: 'video/mp4;codecs=avc1' };
        console.log('   Using codec: MP4 (H.264/AVC1)');
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm;codecs=vp9' };
        console.log('   Using codec: WebM (VP9)');
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm;codecs=vp8' };
        console.log('   Using codec: WebM (VP8)');
      } else {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm' };
        console.log('   Using codec: WebM (default)');
      }

      // Record from canvas stream (rotated 9:16 video)
      const mediaRecorder = new MediaRecorder(canvasStreamRef.current, options);

      // Handle data chunks as they become available
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`📦 [CaptureScreen] Received video chunk #${recordedChunksRef.current.length}: ${(event.data.size / 1024).toFixed(2)} KB`);

          // DEBUG: Check first chunk header
          if (recordedChunksRef.current.length === 1) {
            const arrayBuffer = await event.data.slice(0, 16).arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const hexHeader = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
            console.log(`   🔍 First chunk header: ${hexHeader}`);
            console.log(`   🔍 Expected EBML:      1A45DFA3...`);
            if (hexHeader.startsWith('1A45DFA3')) {
              console.log(`   ✅ Valid WebM EBML header detected!`);
            } else {
              console.warn(`   ⚠️  Invalid header - missing EBML!`);
            }
          }
        } else {
          console.warn('⚠️ [CaptureScreen] Received empty data chunk');
        }
      };

      // Handle recording errors
      mediaRecorder.onerror = (event) => {
        console.error('❌ [CaptureScreen] MediaRecorder error:', event);
      };

      // Handle recording start
      mediaRecorder.onstart = () => {
        console.log('▶️ [CaptureScreen] MediaRecorder started successfully');
        console.log(`   MIME type: ${mediaRecorder.mimeType}`);
        console.log(`   State: ${mediaRecorder.state}`);
      };

      mediaRecorder.onstop = () => {
        console.log('🎬 [CaptureScreen] Video recording stopped');

        // CRITICAL FIX: Wait for all pending ondataavailable events to complete
        // This ensures all chunks (including the EBML header) are collected
        setTimeout(() => {
          console.log(`   Total chunks received: ${recordedChunksRef.current.length}`);

          if (recordedChunksRef.current.length === 0) {
            console.error('❌ [CaptureScreen] No video data recorded!');
            return;
          }

          // Log chunk sizes for debugging
          const totalSize = recordedChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
          console.log(`   Total data size: ${(totalSize / 1024).toFixed(2)} KB`);

          // Log first chunk to verify header
          if (recordedChunksRef.current[0]) {
            console.log(`   First chunk size: ${(recordedChunksRef.current[0].size / 1024).toFixed(2)} KB`);
          }

          // Create blob with proper MIME type (use the detected mimeType)
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          console.log(`✅ [CaptureScreen] Video blob created: ${(blob.size / 1024).toFixed(2)} KB`);
          console.log(`   MIME type: ${mimeType}`);

          // Verify blob has data
          if (blob.size === 0) {
            console.error('❌ [CaptureScreen] Blob has zero size!');
            return;
          }

          // Store video in session
          const videoUrl = URL.createObjectURL(blob);
          setRecordedVideo(blob, videoUrl);
          console.log(`💾 [CaptureScreen] Video stored in session: ${videoUrl}`);
        }, 200); // 200ms delay to ensure all chunks are collected
      };

      // Start recording WITHOUT timeslice to ensure EBML header is in first chunk
      // Timeslice causes chunks to be split incorrectly, missing initialization segment
      mediaRecorder.start(); // No timeslice - data only emitted on stop()
      mediaRecorderRef.current = mediaRecorder;
      console.log('✅ [CaptureScreen] MediaRecorder started (no timeslice for header integrity)');
    } catch (error) {
      console.error('❌ [CaptureScreen] Failed to start video recording:', error);
    }
  }, [setRecordedVideo]);

  // Stop video recording
  const stopVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('⏹️ [CaptureScreen] Stopping video recording...');
      console.log(`   Current state: ${mediaRecorderRef.current.state}`);

      // Request any remaining data before stopping
      try {
        mediaRecorderRef.current.requestData();
        console.log('✅ [CaptureScreen] Requested final data from MediaRecorder');

        // CRITICAL FIX: Wait for final ondataavailable event before stopping
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            console.log('✅ [CaptureScreen] MediaRecorder stopped');
          }
        }, 100);
      } catch (err) {
        console.warn('⚠️ [CaptureScreen] Could not request final data:', err);
        // Still try to stop
        mediaRecorderRef.current.stop();
      }
    }
  }, []);

  // Main timer - controls phase transitions and recording flow
  useEffect(() => {
    console.log('⏱️ [CaptureScreen] Starting main timer...');

    let elapsedTime = 0;
    const mainTimer = setInterval(() => {
      elapsedTime++;
      console.log(`⏱️ [CaptureScreen] Elapsed: ${elapsedTime}s | Phase: ${phase}`);

      if (elapsedTime === 1) {
        // Start recording immediately (no transition delay)
        console.log('🎬 [CaptureScreen] Starting recording phase...');
        setPhase('recording');
        setRecordingTime(1);
        setCountdown(4); // 4 seconds until first photo
        setPhotoNumber(1);
        startVideoRecording();
      } else if (elapsedTime > 1 && elapsedTime <= 15) {
        // Recording phase (1-15s = 15 seconds of recording)
        const recordingElapsed = elapsedTime; // Time since recording started: 1-15
        setRecordingTime(recordingElapsed);

        // Calculate countdown for next photo
        // Photos at recordingElapsed = 5, 10, 15
        let nextPhotoTime: number;
        if (recordingElapsed < 5) {
          nextPhotoTime = 5;
        } else if (recordingElapsed < 10) {
          nextPhotoTime = 10;
        } else {
          nextPhotoTime = 15;
        }
        const timeUntilNextPhoto = nextPhotoTime - recordingElapsed;
        setCountdown(timeUntilNextPhoto);

        // Play photo effects at exactly 5s, 10s, 15s of recording time
        if (recordingElapsed === 5 || recordingElapsed === 10 || recordingElapsed === 15) {
          console.log(`📸 [CaptureScreen] Photo effect trigger at ${recordingElapsed}s of recording`);
          playPhotoEffect();

          // Update photo number for UI display
          if (recordingElapsed === 5) setPhotoNumber(2);
          if (recordingElapsed === 10) setPhotoNumber(3);
        }
      } else if (elapsedTime === 16) {
        // Stop recording and navigate (after 15s of recording + 1s buffer)
        console.log('🏁 [CaptureScreen] Recording complete, stopping...');
        stopVideoRecording();
        clearInterval(mainTimer);

        setTimeout(() => {
          setScreen('processing');
        }, 500);
      }
    }, 1000);

    return () => {
      console.log('🛑 [CaptureScreen] Clearing main timer');
      clearInterval(mainTimer);
    };
  }, [phase, setScreen, startVideoRecording, stopVideoRecording, playPhotoEffect]);

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
      />

      {/* Frame Overlay - Always visible at 100% opacity during both phases */}
      {selectedFrame && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={selectedFrame.templatePath}
            alt="Frame Overlay"
            className="w-full h-full object-contain opacity-100"
          />
        </div>
      )}

      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-20 pointer-events-none" />

      {/* TRANSITION PHASE UI - Removed to avoid flash effect */}

      {/* RECORDING PHASE UI */}
      {phase === 'recording' && (
        <div className="absolute inset-0 flex flex-col items-center justify-between py-10 px-8 z-10">
          {/* Top Section - Recording Indicator + Instructions */}
          <div className="w-full flex flex-col items-center gap-6">
            {/* Recording Indicator Bar */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3 bg-black bg-opacity-50 px-4 py-2 rounded-full">
                <motion.div
                  className="w-6 h-6 bg-red-500 rounded-full"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <p className="text-xl font-medium">REC {recordingTime}s</p>
              </div>

              <div className="bg-white text-black px-5 py-2 rounded-full">
                <p className="text-lg font-bold">
                  사진 {photoNumber}/3
                </p>
              </div>
            </div>

            {/* Instructions - Top - Hide after 3 seconds */}
            <AnimatePresence>
              {recordingTime <= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <h2 className="text-4xl font-bold leading-tight drop-shadow-2xl bg-black bg-opacity-50 px-8 py-4 rounded-2xl">
                    5초에 한 번, 원하시는 포즈로<br />
                    촬영을 진행해주세요!
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center - Empty (just camera feed) */}
          <div className="flex-1"></div>

          {/* Bottom Section - Countdown */}
          <div className="w-full flex items-center justify-center pb-12">
            <div className="relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {countdown !== null && countdown > 0 && (
                  <motion.div
                    key={countdown}
                    variants={countdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <p className="text-[16rem] font-bold text-white leading-none drop-shadow-2xl">
                      {countdown}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

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
