// src/screens/05-CaptureScreen.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import type { ShadowConfig } from '@/store/types';

// MediaPipe types (loaded from CDN)
declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

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
  const cameraStream = useAppStore((state) => state.cameraStream);
  const setCameraStream = useAppStore((state) => state.setCameraStream);
  const shadowConfig = useAppStore((state) => state.shadowConfig);
  const selectedFrame = useSessionStore((state) => state.selectedFrame);
  const setRecordedVideo = useSessionStore((state) => state.setRecordedVideo);

  const [phase, setPhase] = useState<CapturePhase>('transition');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [photoNumber, setPhotoNumber] = useState(0); // 0 means no photos yet
  const [showFlash, setShowFlash] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // Elapsed recording time in seconds
  const [mediaPipeReady, setMediaPipeReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shutterSoundRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // MediaPipe shadow effect refs
  const selfieSegmentationRef = useRef<any>(null);
  const shadowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null); // Shadow-processed output (before rotation)
  const shadowConfigRef = useRef<ShadowConfig>(shadowConfig);
  shadowConfigRef.current = shadowConfig;
  const latestSegmentationMaskRef = useRef<ImageBitmap | HTMLCanvasElement | null>(null);
  const latestVideoFrameRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef<boolean>(false); // Prevent overlapping MediaPipe sends
  const cachedShadowCanvasRef = useRef<HTMLCanvasElement | null>(null); // Cached shadow (only update when mask changes)
  const lastMaskRef = useRef<any>(null); // Track if mask changed

  // Load MediaPipe scripts on mount
  useEffect(() => {
    console.log('🎭 [CaptureScreen] Loading MediaPipe scripts for shadow effect...');

    const loadScripts = async () => {
      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js',
      ];

      for (const src of scripts) {
        if (!document.querySelector(`script[src="${src}"]`)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
              console.log(`✅ [CaptureScreen] Loaded: ${src.split('/').pop()}`);
              resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
          });
        }
      }

      // Wait for SelfieSegmentation to be available
      let attempts = 0;
      while (!window.SelfieSegmentation && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.SelfieSegmentation) {
        console.error('❌ [CaptureScreen] SelfieSegmentation not loaded');
        return;
      }

      // Initialize SelfieSegmentation model
      console.log('🎭 [CaptureScreen] Initializing SelfieSegmentation model...');
      const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0 = general, 1 = landscape (better for full-body)
        selfieMode: true,
      });

      // Set up results callback - stores segmentation mask for use in render loop
      selfieSegmentation.onResults((results: any) => {
        if (results.segmentationMask) {
          latestSegmentationMaskRef.current = results.segmentationMask;
          latestVideoFrameRef.current = results.image;
        }
      });

      selfieSegmentationRef.current = selfieSegmentation;
      setMediaPipeReady(true);
      console.log('✅ [CaptureScreen] MediaPipe SelfieSegmentation ready!');
    };

    loadScripts().catch(err => {
      console.error('❌ [CaptureScreen] Failed to load MediaPipe:', err);
    });

    return () => {
      // Reset processing flag on cleanup
      isProcessingRef.current = false;
      if (selfieSegmentationRef.current) {
        try {
          selfieSegmentationRef.current.close();
          selfieSegmentationRef.current = null;
        } catch (e) {
          // Ignore close errors
        }
      }
    };
  }, []);

  // Initialize camera stream with canvas rotation (16:9 → 9:16)
  // Uses GLOBAL camera stream from appStore (started in StartScreen)
  useEffect(() => {
    console.log('📷 [CaptureScreen] Component mounted - Setting up camera with rotation...');

    const setupCameraWithRotation = (stream: MediaStream) => {
      console.log('✅ [CaptureScreen] Using camera stream for recording');
      streamRef.current = stream;

      // Set up hidden video element to receive stream
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

          // Create processed canvas at full resolution (for final output)
          const processedCanvas = document.createElement('canvas');
          processedCanvas.width = videoWidth;
          processedCanvas.height = videoHeight;
          processedCanvasRef.current = processedCanvas;

          // OPTIMIZATION: Process shadow at LOW RESOLUTION for performance
          // 4K (3840x2160) -> 480x270 = 97% less pixels to process!
          const SHADOW_SCALE = 0.125; // 1/8 resolution
          const shadowWidth = Math.floor(videoWidth * SHADOW_SCALE);
          const shadowHeight = Math.floor(videoHeight * SHADOW_SCALE);

          const shadowCanvas = document.createElement('canvas');
          shadowCanvas.width = shadowWidth;
          shadowCanvas.height = shadowHeight;
          shadowCanvasRef.current = shadowCanvas;

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = shadowWidth;
          tempCanvas.height = shadowHeight;
          tempCanvasRef.current = tempCanvas;

          console.log(`🎭 [CaptureScreen] Shadow processing at LOW RES: ${shadowWidth}x${shadowHeight} (scale: ${SHADOW_SCALE})`);

          // Send frames to MediaPipe for segmentation (async, stores result in ref)
          // CRITICAL: Uses isProcessingRef to prevent overlapping sends that crash WebGL
          let lastSendTime = 0;
          const sendToMediaPipe = () => {
            // Skip if already processing, video not ready, or model not loaded
            if (isProcessingRef.current || video.paused || video.ended || !selfieSegmentationRef.current) {
              return;
            }

            const now = performance.now();
            // Limit MediaPipe processing to ~10fps (100ms) to avoid overloading WebGL
            if (now - lastSendTime < 100) {
              return;
            }

            lastSendTime = now;
            isProcessingRef.current = true;

            // Send frame and wait for completion before allowing next send
            selfieSegmentationRef.current.send({ image: video })
              .then(() => {
                isProcessingRef.current = false;
              })
              .catch((e: any) => {
                // Reset flag on error so we can try again
                isProcessingRef.current = false;
                // Only log non-abort errors
                if (e && !String(e).includes('abort')) {
                  console.warn('[CaptureScreen] MediaPipe send error:', e);
                }
              });
          };

          // Create cached shadow canvas at LOW RESOLUTION (same as shadow canvas)
          const cachedShadow = document.createElement('canvas');
          cachedShadow.width = shadowWidth;
          cachedShadow.height = shadowHeight;
          cachedShadowCanvasRef.current = cachedShadow;

          // Function to compute shadow at LOW RESOLUTION (expensive - only call when mask changes)
          // Uses same algorithm as ShadowEffectScreen for consistent results
          const computeShadow = (mask: any, config: ShadowConfig) => {
            const shadowCtx = shadowCanvas.getContext('2d')!;
            const tempCtx = tempCanvas.getContext('2d')!;
            const cachedCtx = cachedShadow.getContext('2d')!;

            // Disable image smoothing for faster canvas operations (we're scaling up anyway)
            shadowCtx.imageSmoothingEnabled = false;
            tempCtx.imageSmoothingEnabled = false;
            cachedCtx.imageSmoothingEnabled = false;

            // Scale config values from video resolution to shadow canvas resolution
            // This matches ShadowEffectScreen which now uses same 4K + low-res approach
            const scaleX = shadowWidth / videoWidth;
            const scaleY = shadowHeight / videoHeight;
            // Use positive offsetX (mask is flipped to match final mirrored view)
            const scaledOffsetX = config.offsetX * scaleX;
            const scaledOffsetY = config.offsetY * scaleY;
            const scaledBlur = Math.max(1, config.blur * Math.min(scaleX, scaleY));

            // Clear canvases at LOW RESOLUTION
            shadowCtx.clearRect(0, 0, shadowWidth, shadowHeight);
            tempCtx.clearRect(0, 0, shadowWidth, shadowHeight);

            // Calculate spread scale for shadow expansion
            const spreadScale = 1 + (config.spread / 100);
            const spreadOffsetX = (shadowWidth * (spreadScale - 1)) / 2;
            const spreadOffsetY = (shadowHeight * (spreadScale - 1)) / 2;

            // STEP 1: Create shadow shape on temp canvas (LOW RES)
            // IMPORTANT: Flip mask horizontally to match final mirrored selfie view
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, shadowWidth, shadowHeight);

            // Draw inverted mask (person=black silhouette) with offset and blur
            // Apply horizontal flip to mask so shadow matches mirrored view
            tempCtx.save();
            tempCtx.globalCompositeOperation = 'multiply';
            tempCtx.filter = `grayscale(1) invert(1) blur(${scaledBlur}px)`;
            // Flip mask horizontally: translate to right edge, then scale -1 on X
            tempCtx.translate(shadowWidth, 0);
            tempCtx.scale(-1, 1);
            // After flip: positive offsetX = shadow moves RIGHT, negative = LEFT
            tempCtx.drawImage(
              mask,
              scaledOffsetX - spreadOffsetX,
              scaledOffsetY - spreadOffsetY,
              shadowWidth * spreadScale,
              shadowHeight * spreadScale
            );
            tempCtx.filter = 'none';
            tempCtx.restore();

            // STEP 2: Convert shadow to alpha-based on shadowCanvas (LOW RES = 97% less pixels!)
            const shadowImageData = tempCtx.getImageData(0, 0, shadowWidth, shadowHeight);
            const shadowData = shadowImageData.data;

            for (let i = 0; i < shadowData.length; i += 4) {
              const brightness = (shadowData[i] + shadowData[i + 1] + shadowData[i + 2]) / 3;
              const alpha = Math.round((255 - brightness) * config.opacity);
              shadowData[i] = 0;
              shadowData[i + 1] = 0;
              shadowData[i + 2] = 0;
              shadowData[i + 3] = alpha;
            }

            shadowCtx.putImageData(shadowImageData, 0, 0);

            // STEP 3: Cut out person area from shadow using destination-out
            // Also flip mask horizontally for cutout to match
            shadowCtx.globalCompositeOperation = 'destination-out';
            const scaledCutBlur = Math.max(1, 5 * Math.min(scaleX, scaleY));
            shadowCtx.filter = `grayscale(1) blur(${scaledCutBlur}px)`;
            shadowCtx.save();
            shadowCtx.translate(shadowWidth, 0);
            shadowCtx.scale(-1, 1);
            shadowCtx.drawImage(mask, 0, 0, shadowWidth, shadowHeight);
            shadowCtx.restore();
            shadowCtx.filter = 'none';
            shadowCtx.globalCompositeOperation = 'source-over';

            // STEP 4: Cache the computed shadow at LOW RESOLUTION
            cachedCtx.clearRect(0, 0, shadowWidth, shadowHeight);
            cachedCtx.drawImage(shadowCanvas, 0, 0);
          };

          // Draw rotated frames to canvas with shadow effect
          // OPTIMIZED: Only recompute shadow when mask changes (~10fps), draw at 60fps
          const drawRotatedFrame = () => {
            if (!video.paused && !video.ended) {
              const config = shadowConfigRef.current;
              const mask = latestSegmentationMaskRef.current;
              const processedCtx = processedCanvas.getContext('2d')!;

              // Send current frame to MediaPipe (async, result will be available next frame)
              sendToMediaPipe();

              // Apply shadow effect if enabled and mask is available
              if (config.enabled && mask) {
                // OPTIMIZATION: Only recompute shadow when mask changes
                if (mask !== lastMaskRef.current) {
                  lastMaskRef.current = mask;
                  computeShadow(mask, config);
                }

                // Fast path: Just draw video + cached shadow (60fps)
                // Shadow is computed at low-res, then scaled up to full resolution for smooth appearance
                processedCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
                processedCtx.drawImage(cachedShadow, 0, 0, videoWidth, videoHeight); // Scale up from shadowWidth/shadowHeight
              } else {
                // No shadow effect - just draw video to processed canvas
                processedCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
              }

              // Now rotate the processed canvas and draw to main canvas
              ctx.save();

              // Move to center of canvas
              ctx.translate(canvas.width / 2, canvas.height / 2);

              // Rotate 90 degrees clockwise
              ctx.rotate(90 * Math.PI / 180);

              // Mirror horizontally (for selfie mode)
              ctx.scale(-1, 1);

              // Draw the shadow-processed video (note: dimensions are swapped due to rotation)
              ctx.drawImage(processedCanvas, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);

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
          console.log('🎬 [CaptureScreen] Canvas stream created for recording (with shadow effect)');
        };

        console.log('📺 [CaptureScreen] Stream assigned to video element');
      }
    };

    // Use global camera stream from StartScreen (already running!)
    if (cameraStream && cameraStream.active) {
      console.log('✅ [CaptureScreen] Using GLOBAL camera stream (instant connection!)');
      console.log(`   Active tracks: ${cameraStream.getVideoTracks().length}`);
      setupCameraWithRotation(cameraStream);
    } else {
      // Fallback: Start new camera if global stream not available
      console.warn('⚠️ [CaptureScreen] Global camera stream not available, starting new...');

      const startCamera = async () => {
        try {
          // Enumerate all video devices
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');

          console.log('📹 [CaptureScreen] Available cameras:');
          videoDevices.forEach((device, index) => {
            console.log(`  ${index + 1}. ${device.label || 'Unknown Camera'}`);
          });

          if (videoDevices.length === 0) {
            console.error('❌ [CaptureScreen] No cameras found!');
            return;
          }

          // Robust camera selection: Try each camera until one works
          let stream: MediaStream | null = null;

          for (let i = 0; i < videoDevices.length; i++) {
            const device = videoDevices[i];
            console.log(`🔄 [CaptureScreen] Trying camera ${i + 1}/${videoDevices.length}: ${device.label || 'Unknown'}`);

            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: device.deviceId },
                  width: { ideal: 3840 },
                  height: { ideal: 2160 }
                },
                audio: false
              });
              console.log(`✅ [CaptureScreen] Successfully connected to: ${device.label || 'Camera ' + (i + 1)}`);
              break;
            } catch (err) {
              console.warn(`⚠️ [CaptureScreen] Camera ${i + 1} failed:`, err);
            }
          }

          if (!stream) {
            // Last resort: try without specifying deviceId
            console.log('🔄 [CaptureScreen] Trying default camera...');
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 3840 }, height: { ideal: 2160 } },
                audio: false
              });
              console.log('✅ [CaptureScreen] Connected to default camera');
            } catch (err) {
              console.error('❌ [CaptureScreen] All camera attempts failed:', err);
              return;
            }
          }

          // Store in global store for persistence
          setCameraStream(stream);
          setupCameraWithRotation(stream);
        } catch (error) {
          console.error('❌ [CaptureScreen] Failed to access camera:', error);
        }
      };

      startCamera();
    }

    // Load shutter sound
    shutterSoundRef.current = new Audio('./sounds/camera-shutter.mp3');

    // Cleanup: Only stop animation frame and canvas stream (NOT the global camera stream!)
    return () => {
      console.log('🛑 [CaptureScreen] Component unmounting - Cleaning up...');

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop canvas stream (for recording) but NOT the original camera stream
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // NOTE: Global camera stream is NOT stopped here - it persists in appStore
      // and will be stopped when app resets to idle
    };
  }, [cameraStream, setCameraStream]);

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
      // Use very high bitrate (100 Mbps) for maximum quality preservation
      const videoBitrate = 100000000; // 100 Mbps for near-lossless capture
      let options: MediaRecorderOptions;
      let mimeType = 'video/webm'; // fallback

      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        options = { mimeType: 'video/mp4', videoBitsPerSecond: videoBitrate };
        console.log('   Using codec: MP4 @ 100 Mbps');
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4';
        options = { mimeType: 'video/mp4;codecs=avc1', videoBitsPerSecond: videoBitrate };
        console.log('   Using codec: MP4 (H.264/AVC1) @ 100 Mbps');
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: videoBitrate };
        console.log('   Using codec: WebM (VP9) @ 100 Mbps');
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: videoBitrate };
        console.log('   Using codec: WebM (VP8) @ 100 Mbps');
      } else {
        mimeType = 'video/webm';
        options = { mimeType: 'video/webm', videoBitsPerSecond: videoBitrate };
        console.log('   Using codec: WebM (default) @ 100 Mbps');
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
      } else if (elapsedTime > 1 && elapsedTime <= 16) {
        // Recording phase (1-16s = 16 seconds total to ensure 15s+ video for frame extraction at 5s, 10s, 15s)
        const recordingElapsed = elapsedTime - 1; // Actual recording time (0-15s)
        setRecordingTime(Math.min(recordingElapsed, 15)); // Cap display at 15s

        // Calculate countdown for next photo
        // Photos at recordingElapsed = 5, 10, 15
        let nextPhotoTime: number;
        if (recordingElapsed < 5) {
          nextPhotoTime = 5;
        } else if (recordingElapsed < 10) {
          nextPhotoTime = 10;
        } else if (recordingElapsed < 15) {
          nextPhotoTime = 15;
        } else {
          nextPhotoTime = 15; // Already at 15s
        }
        const timeUntilNextPhoto = nextPhotoTime - recordingElapsed;
        setCountdown(timeUntilNextPhoto > 0 ? timeUntilNextPhoto : 0);

        // Play photo effects at exactly 5s, 10s, 15s of recording time
        if (recordingElapsed === 5 || recordingElapsed === 10 || recordingElapsed === 15) {
          console.log(`📸 [CaptureScreen] Photo effect trigger at ${recordingElapsed}s of recording`);
          playPhotoEffect();

          // Update photo number for UI display
          if (recordingElapsed === 5) setPhotoNumber(2);
          if (recordingElapsed === 10) setPhotoNumber(3);
        }

        // Stop recording at 16s elapsed (15s of actual recording) to ensure we have frames at 15s
        if (elapsedTime === 16) {
          console.log('🏁 [CaptureScreen] Recording complete (16s elapsed, 15s video), stopping...');
          stopVideoRecording();
          clearInterval(mainTimer);

          setTimeout(() => {
            setScreen('processing');
          }, 500);
        }
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
      {/* CSS Filter matches Python face enhancement: brightness +5%, contrast +12%, saturation +10% */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // No live filter - enhancement applied by Python pipeline during video processing
        }}
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
