// src/screens/ShadowEffectScreen.tsx
// Real-time shadow effect using MediaPipe Selfie Segmentation
// F10 to open this screen - shadow settings are saved and applied to actual camera capture
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import type { ShadowConfig } from '@/store/types';

// Default shadow configuration (same as appStore default)
const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  color: '#000000',
  offsetX: 20,
  offsetY: 40,
  blur: 30,
  opacity: 0.6,
  spread: 10,
  enabled: true,
};

// MediaPipe types (loaded from CDN)
declare global {
  interface Window {
    SelfieSegmentation: any;
    Camera: any;
  }
}

// SVG Filter ID for converting luminosity to alpha
const LUMINOSITY_TO_ALPHA_FILTER_ID = 'shadow-luma-to-alpha';

export function ShadowEffectScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const cameraStream = useAppStore((state) => state.cameraStream);
  const setCameraStream = useAppStore((state) => state.setCameraStream);
  // Get shadow config from store (persisted across screens)
  const storeShadowConfig = useAppStore((state) => state.shadowConfig);
  const setStoreShadowConfig = useAppStore((state) => state.setShadowConfig);

  // State - initialize from store
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('MediaPipe loading...');
  const [fps, setFps] = useState(0);
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>(storeShadowConfig);
  const [showControls, setShowControls] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null); // Temp canvas for mask processing
  const processedCanvasRef = useRef<HTMLCanvasElement>(null); // Shadow-processed output (before rotation)
  const cachedShadowCanvasRef = useRef<HTMLCanvasElement>(null); // Cached shadow for performance
  const selfieSegmentationRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsCountRef = useRef({ frames: 0, lastTime: performance.now() });
  const frameCountRef = useRef(0);
  const lastMaskRef = useRef<any>(null);
  const latestMaskRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);


  // Ref to store current shadow config (avoids recreating callbacks)
  const shadowConfigRef = useRef(shadowConfig);
  shadowConfigRef.current = shadowConfig;

  // Store segmentation mask for use in render loop (same pattern as CaptureScreen)
  const onResults = useCallback((results: any) => {
    if (results.segmentationMask) {
      latestMaskRef.current = results.segmentationMask;
    }
  }, []);

  // Initialize on mount (runs only once)
  // Uses SAME settings as CaptureScreen: 4K resolution, 90° rotation, low-res shadow processing
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Load scripts
        setLoadingMessage('Loading MediaPipe library...');
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
              script.onload = () => resolve();
              script.onerror = () => reject(new Error(`Failed to load: ${src}`));
              document.head.appendChild(script);
            });
          }
        }
        console.log('[ShadowEffect] MediaPipe scripts loaded');

        if (!isMounted) return;

        // Initialize MediaPipe
        setLoadingMessage('Initializing segmentation model...');
        let attempts = 0;
        while (!window.SelfieSegmentation && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.SelfieSegmentation) {
          throw new Error('SelfieSegmentation not loaded');
        }

        const selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          }
        });

        selfieSegmentation.setOptions({
          modelSelection: 1,
          selfieMode: true,
        });

        selfieSegmentationRef.current = selfieSegmentation;
        console.log('[ShadowEffect] MediaPipe initialized');

        if (!isMounted) return;

        // Start camera - USE 4K RESOLUTION (same as CaptureScreen)
        setLoadingMessage('Starting 4K camera...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        console.log('[ShadowEffect] Available cameras:', videoDevices.map(d => d.label));

        const deviceId = videoDevices[0]?.deviceId;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 3840 },  // 4K - same as CaptureScreen
            height: { ideal: 2160 }, // 4K - same as CaptureScreen
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        setCameraStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video metadata to load before starting
          await new Promise<void>((resolve) => {
            const video = videoRef.current!;
            if (video.readyState >= 2) {
              resolve();
            } else {
              video.onloadeddata = () => resolve();
            }
          });

          await videoRef.current.play();

          const video = videoRef.current;
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          console.log('[ShadowEffect] Camera started at 4K:', videoWidth, 'x', videoHeight);

          // Set up canvas with ROTATION (same as CaptureScreen)
          // Canvas size = rotated dimensions (swap width/height for 90° rotation)
          const canvas = canvasRef.current!;
          const ctx = canvas.getContext('2d')!;
          canvas.width = videoHeight;  // Swapped for 90° rotation
          canvas.height = videoWidth;  // Swapped for 90° rotation
          console.log('[ShadowEffect] Canvas dimensions (rotated):', canvas.width, 'x', canvas.height);

          // Create processed canvas at full resolution (for shadow compositing before rotation)
          const processedCanvas = document.createElement('canvas');
          processedCanvas.width = videoWidth;
          processedCanvas.height = videoHeight;
          processedCanvasRef.current = processedCanvas;

          // LOW RESOLUTION shadow processing (same as CaptureScreen)
          const SHADOW_SCALE = 0.125; // 1/8 resolution for performance
          const shadowWidth = Math.floor(videoWidth * SHADOW_SCALE);
          const shadowHeight = Math.floor(videoHeight * SHADOW_SCALE);

          const shadowCanvas = shadowCanvasRef.current!;
          shadowCanvas.width = shadowWidth;
          shadowCanvas.height = shadowHeight;

          const tempCanvas = tempCanvasRef.current!;
          tempCanvas.width = shadowWidth;
          tempCanvas.height = shadowHeight;

          // Cached shadow canvas at low resolution
          const cachedShadow = document.createElement('canvas');
          cachedShadow.width = shadowWidth;
          cachedShadow.height = shadowHeight;
          cachedShadowCanvasRef.current = cachedShadow;

          console.log('[ShadowEffect] Shadow processing at LOW RES:', shadowWidth, 'x', shadowHeight);

          // Register the results callback
          selfieSegmentationRef.current.onResults(onResults);

          // Send frames to MediaPipe (throttled to ~10fps to avoid WebGL crash)
          let lastSendTime = 0;
          const sendToMediaPipe = () => {
            if (isProcessingRef.current || video.paused || video.ended || !selfieSegmentationRef.current) {
              return;
            }
            const now = performance.now();
            if (now - lastSendTime < 100) return; // ~10fps
            lastSendTime = now;
            isProcessingRef.current = true;
            selfieSegmentationRef.current.send({ image: video })
              .then(() => { isProcessingRef.current = false; })
              .catch((e: any) => {
                isProcessingRef.current = false;
                if (e && !String(e).includes('abort')) {
                  console.warn('[ShadowEffect] MediaPipe error:', e);
                }
              });
          };

          // Shadow computation function (same algorithm as CaptureScreen)
          const computeShadow = (mask: any, config: ShadowConfig) => {
            const shadowCtx = shadowCanvas.getContext('2d')!;
            const tempCtx = tempCanvas.getContext('2d')!;
            const cachedCtx = cachedShadow.getContext('2d')!;

            shadowCtx.imageSmoothingEnabled = false;
            tempCtx.imageSmoothingEnabled = false;
            cachedCtx.imageSmoothingEnabled = false;

            // Scale factors - shadow config values work directly at shadow resolution
            const scaleX = shadowWidth / videoWidth;
            const scaleY = shadowHeight / videoHeight;
            // Use positive offsetX - the flip transform will handle direction
            const scaledOffsetX = config.offsetX * scaleX;
            const scaledOffsetY = config.offsetY * scaleY;
            const scaledBlur = Math.max(1, config.blur * Math.min(scaleX, scaleY));

            shadowCtx.clearRect(0, 0, shadowWidth, shadowHeight);
            tempCtx.clearRect(0, 0, shadowWidth, shadowHeight);

            const spreadScale = 1 + (config.spread / 100);
            const spreadOffsetX = (shadowWidth * (spreadScale - 1)) / 2;
            const spreadOffsetY = (shadowHeight * (spreadScale - 1)) / 2;

            // STEP 1: Create shadow shape
            // Draw inverted mask (person=black silhouette) with offset and blur
            // Apply horizontal flip to mask so shadow matches mirrored view
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, shadowWidth, shadowHeight);
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

            // STEP 2: Convert to alpha
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

            // STEP 3: Cut out person area from shadow - also flipped
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

            // STEP 4: Cache
            cachedCtx.clearRect(0, 0, shadowWidth, shadowHeight);
            cachedCtx.drawImage(shadowCanvas, 0, 0);
          };

          // Main render loop with ROTATION (same as CaptureScreen)
          // OPTIMIZED: Skip MediaPipe and processedCanvas when shadow is disabled
          const drawRotatedFrame = () => {
            if (!isMounted) return;

            if (!video.paused && !video.ended) {
              const config = shadowConfigRef.current;

              // Apply 90° rotation + mirror
              ctx.save();
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(90 * Math.PI / 180);
              ctx.scale(-1, 1); // Mirror for selfie

              if (config.enabled) {
                // Shadow enabled: Use MediaPipe + processedCanvas pipeline
                sendToMediaPipe();
                const mask = latestMaskRef.current;
                const processedCtx = processedCanvas.getContext('2d')!;

                if (mask) {
                  if (mask !== lastMaskRef.current) {
                    lastMaskRef.current = mask;
                    computeShadow(mask, config);
                  }
                  processedCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
                  processedCtx.drawImage(cachedShadow, 0, 0, videoWidth, videoHeight);
                } else {
                  processedCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
                }
                ctx.drawImage(processedCanvas, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
              } else {
                // Shadow disabled: Draw video directly (skip MediaPipe and processedCanvas)
                // This is MUCH faster - direct video to canvas
                ctx.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
              }

              ctx.restore();

              // Update FPS counter
              fpsCountRef.current.frames++;
              const now = performance.now();
              if (now - fpsCountRef.current.lastTime >= 1000) {
                setFps(fpsCountRef.current.frames);
                fpsCountRef.current.frames = 0;
                fpsCountRef.current.lastTime = now;
              }
            }

            animationFrameRef.current = requestAnimationFrame(drawRotatedFrame);
          };

          // Start render loop
          console.log('[ShadowEffect] Starting render loop (4K + rotation + low-res shadow)');
          drawRotatedFrame();
          setIsLoading(false);
          setDebugInfo('4K + 90° rotation active');
        }

      } catch (error) {
        console.error('[ShadowEffect] Initialization error:', error);
        if (isMounted) {
          setLoadingMessage(`Error: ${error}`);
        }
      }
    };

    initialize();

    // Cleanup
    return () => {
      isMounted = false;
      isProcessingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (selfieSegmentationRef.current) {
        try {
          selfieSegmentationRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScreen('idle');
      }
      if (e.key === 'h' || e.key === 'H') {
        setShowControls(prev => !prev);
      }
      if (e.key === 's' || e.key === 'S') {
        setShadowConfig(prev => ({ ...prev, enabled: !prev.enabled }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setScreen]);

  // Sync shadow config to store whenever it changes (for persistence)
  useEffect(() => {
    setStoreShadowConfig(shadowConfig);
  }, [shadowConfig, setStoreShadowConfig]);

  // Update shadow config handler
  const updateConfig = (key: keyof ShadowConfig, value: any) => {
    setShadowConfig(prev => ({ ...prev, [key]: value }));
  };

  // Reset to default and sync to store
  const handleReset = () => {
    setShadowConfig(DEFAULT_SHADOW_CONFIG);
    // Store will be updated via the useEffect sync above
  };

  // Preset shadow styles
  const presets = {
    natural: { color: '#000000', offsetX: 20, offsetY: 35, blur: 25, opacity: 0.5, spread: 5 },
    dramatic: { color: '#000000', offsetX: 40, offsetY: 60, blur: 35, opacity: 0.7, spread: 15 },
    soft: { color: '#000000', offsetX: 15, offsetY: 25, blur: 50, opacity: 0.4, spread: 20 },
    neon: { color: '#00ffff', offsetX: 0, offsetY: 0, blur: 40, opacity: 0.8, spread: 25 },
    red: { color: '#ff0000', offsetX: 10, offsetY: 20, blur: 30, opacity: 0.6, spread: 15 },
    gold: { color: '#ffd700', offsetX: 5, offsetY: 15, blur: 35, opacity: 0.7, spread: 20 },
  };

  return (
    <div className="fullscreen bg-black text-white relative overflow-hidden">
      {/* SVG Filter for converting luminosity to alpha channel */}
      {/* This allows us to use the grayscale mask as proper transparency */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id={LUMINOSITY_TO_ALPHA_FILTER_ID}>
            {/* Use feColorMatrix to transfer RGB luminosity to alpha */}
            {/* Matrix: R, G, B channels go to Alpha (row 4), RGB becomes the shadow color */}
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0.299 0.587 0.114 0 0"
            />
          </filter>
        </defs>
      </svg>

      {/* Hidden video element for camera input */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
      />

      {/* Hidden canvas for shadow processing */}
      <canvas ref={shadowCanvasRef} className="hidden" />

      {/* Hidden temp canvas for mask color processing */}
      <canvas ref={tempCanvasRef} className="hidden" />

      {/* Main output canvas - 90° rotated portrait view (same as CaptureScreen) */}
      {/* Mirror is applied in code via ctx.scale(-1, 1), no CSS transform needed */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xl">{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* FPS Counter and Debug Info */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-3 py-2 rounded-lg z-40">
        <div className="text-sm font-mono">{fps} FPS</div>
        {shadowConfig.enabled && (
          <div className="text-green-400 text-sm">Shadow ON</div>
        )}
        <div className="text-xs text-gray-400 mt-1">Frames: {frameCountRef.current}</div>
        {debugInfo && <div className="text-xs text-yellow-400">{debugInfo}</div>}
      </div>

      {/* Control Panel */}
      {showControls && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-4 top-4 bottom-4 w-72 bg-black bg-opacity-80 rounded-2xl p-4 overflow-y-auto z-40"
        >
          <h2 className="text-xl font-bold mb-4">Shadow Controls</h2>

          {/* Enable/Disable Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shadowConfig.enabled}
                onChange={(e) => updateConfig('enabled', e.target.checked)}
                className="w-5 h-5 accent-blue-500"
              />
              <span className="text-lg">Enable Shadow</span>
            </label>
          </div>

          {/* Presets */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Presets</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(presets).map(([name, preset]) => (
                <button
                  key={name}
                  onClick={() => setShadowConfig(prev => ({ ...prev, ...preset, enabled: true }))}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm capitalize transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Shadow Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={shadowConfig.color}
                onChange={(e) => updateConfig('color', e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0"
              />
              <span className="font-mono text-sm">{shadowConfig.color}</span>
            </div>
          </div>

          {/* Offset X */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Offset X (좌우): {shadowConfig.offsetX}px
            </label>
            <input
              type="range"
              min="-300"
              max="300"
              value={shadowConfig.offsetX}
              onChange={(e) => updateConfig('offsetX', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>왼쪽</span>
              <span>오른쪽</span>
            </div>
          </div>

          {/* Offset Y */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Offset Y (상하): {shadowConfig.offsetY}px
            </label>
            <input
              type="range"
              min="-300"
              max="300"
              value={shadowConfig.offsetY}
              onChange={(e) => updateConfig('offsetY', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>위</span>
              <span>아래</span>
            </div>
          </div>

          {/* Blur */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Blur: {shadowConfig.blur}px
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={shadowConfig.blur}
              onChange={(e) => updateConfig('blur', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Opacity */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Opacity: {Math.round(shadowConfig.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={shadowConfig.opacity * 100}
              onChange={(e) => updateConfig('opacity', Number(e.target.value) / 100)}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Spread - expands the shadow beyond person's silhouette */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              Spread (확장): {shadowConfig.spread}%
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={shadowConfig.spread}
              onChange={(e) => updateConfig('spread', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              그림자가 사람 실루엣보다 얼마나 더 퍼질지 조절
            </p>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Reset to Default
          </button>

          {/* Save Note */}
          <div className="mt-4 p-3 bg-green-900 bg-opacity-30 rounded-lg border border-green-700">
            <p className="text-xs text-green-400">
              Settings are automatically saved and will be applied to the actual camera capture.
            </p>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-sm text-gray-400 mb-2">Keyboard Shortcuts</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li><kbd className="bg-gray-700 px-1 rounded">F10</kbd> Open/Close this screen</li>
              <li><kbd className="bg-gray-700 px-1 rounded">F11</kbd> Toggle fullscreen</li>
              <li><kbd className="bg-gray-700 px-1 rounded">ESC</kbd> Exit</li>
              <li><kbd className="bg-gray-700 px-1 rounded">H</kbd> Toggle controls</li>
              <li><kbd className="bg-gray-700 px-1 rounded">S</kbd> Toggle shadow</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(prev => !prev)}
        className="absolute bottom-4 right-4 px-4 py-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full z-40 transition-colors"
      >
        {showControls ? 'Hide Controls' : 'Show Controls'}
      </button>

      {/* Exit Button */}
      <button
        onClick={() => setScreen('idle')}
        className="absolute top-4 right-80 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full z-40 transition-colors"
        style={{ display: showControls ? 'block' : 'none' }}
      >
        Exit (ESC)
      </button>
    </div>
  );
}
