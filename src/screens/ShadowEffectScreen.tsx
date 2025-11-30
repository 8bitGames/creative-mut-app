// src/screens/ShadowEffectScreen.tsx
// Real-time shadow effect using MediaPipe Selfie Segmentation
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';

// Shadow effect configuration interface
interface ShadowConfig {
  color: string;        // Shadow color (hex or rgba)
  offsetX: number;      // X offset in pixels
  offsetY: number;      // Y offset in pixels
  blur: number;         // Blur radius in pixels
  opacity: number;      // Shadow opacity (0-1)
  spread: number;       // Shadow spread/expansion in pixels (dilates the mask)
  enabled: boolean;     // Enable/disable shadow effect
}

// Default shadow configuration
const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  color: '#000000',
  offsetX: 20,
  offsetY: 40,
  blur: 30,
  opacity: 0.6,
  spread: 10,           // Default spread for softer edges
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

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('MediaPipe loading...');
  const [fps, setFps] = useState(0);
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>(DEFAULT_SHADOW_CONFIG);
  const [showControls, setShowControls] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null); // Temp canvas for mask processing
  const selfieSegmentationRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsCountRef = useRef({ frames: 0, lastTime: performance.now() });
  const frameCountRef = useRef(0);


  // Ref to store current shadow config (avoids recreating callbacks)
  const shadowConfigRef = useRef(shadowConfig);
  shadowConfigRef.current = shadowConfig;

  // Process segmentation results and render shadow
  // Shadow is drawn BEHIND the person - shadow first, then video on top
  const onResults = useCallback((results: any) => {
    frameCountRef.current++;

    const canvas = canvasRef.current;
    const shadowCanvas = shadowCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const video = videoRef.current;
    const config = shadowConfigRef.current;

    // Log first few frames for debugging
    if (frameCountRef.current <= 3) {
      console.log(`[ShadowEffect] Frame ${frameCountRef.current}:`, {
        hasCanvas: !!canvas,
        hasShadowCanvas: !!shadowCanvas,
        hasTempCanvas: !!tempCanvas,
        hasVideo: !!video,
        hasSegMask: !!results?.segmentationMask,
        hasImage: !!results?.image,
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight
      });
    }

    // Check for required elements
    if (!canvas || !shadowCanvas || !tempCanvas || !video) {
      if (frameCountRef.current <= 5) {
        console.log('[ShadowEffect] Missing canvas or video');
      }
      return;
    }

    // MediaPipe returns segmentationMask
    if (!results.segmentationMask) {
      if (frameCountRef.current <= 5) {
        console.log('[ShadowEffect] No segmentation mask in results, keys:', Object.keys(results || {}));
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    const shadowCtx = shadowCanvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d');

    if (!ctx || !shadowCtx || !tempCtx) {
      console.log('[ShadowEffect] Could not get canvas context');
      return;
    }

    // Update canvas dimensions if needed (check video has valid dimensions)
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (vw === 0 || vh === 0) {
      console.log('[ShadowEffect] Video dimensions not ready:', vw, vh);
      return;
    }

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
      shadowCanvas.width = vw;
      shadowCanvas.height = vh;
      tempCanvas.width = vw;
      tempCanvas.height = vh;
      console.log('[ShadowEffect] Canvas resized to:', vw, vh);
    }

    // Clear canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shadowCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Shadow rendering: Create shadow BEHIND person using RGB-based mask
    // MediaPipe mask: person=WHITE (RGB 255,255,255), background=BLACK (RGB 0,0,0)
    // Note: Alpha channel is always 255 (opaque), so we must work with RGB values
    //
    // Strategy using multiply blend:
    //   1. Create inverted mask: person=BLACK, bg=WHITE
    //   2. Multiply inverted mask with shadow color to get colored shadow
    //   3. Fill shadow canvas white, then multiply with offset shadow
    //   4. Draw mask directly (person=white) to erase shadow under person
    //   5. Apply final shadow with multiply blend to video

    // CLEANER APPROACH: Create shadow, cut out person area, then composite
    // Strategy:
    // 1. Create shadow shape on shadowCanvas
    // 2. Use destination-out to remove person area from shadow
    // 3. Draw video on main canvas
    // 4. Draw shadow (with person hole) on top of video

    if (config.enabled) {
      // Debug: Check mask type
      if (frameCountRef.current <= 5) {
        const mask = results.segmentationMask;
        console.log('[ShadowEffect] Mask:', mask?.constructor?.name,
          'size:', mask?.width, 'x', mask?.height);
      }

      // Calculate spread scale for shadow expansion
      const spreadScale = 1 + (config.spread / 100);
      const spreadOffsetX = (canvas.width * (spreadScale - 1)) / 2;
      const spreadOffsetY = (canvas.height * (spreadScale - 1)) / 2;

      // STEP 1: Create shadow shape on temp canvas
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw inverted mask (person=black silhouette) with offset and blur
      tempCtx.save();
      tempCtx.globalCompositeOperation = 'multiply';
      tempCtx.filter = `grayscale(1) invert(1) blur(${config.blur}px)`;
      tempCtx.drawImage(
        results.segmentationMask,
        config.offsetX - spreadOffsetX,
        config.offsetY - spreadOffsetY,
        tempCanvas.width * spreadScale,
        tempCanvas.height * spreadScale
      );
      tempCtx.filter = 'none';
      tempCtx.restore();

      // STEP 2: Convert shadow to alpha-based on shadowCanvas
      const shadowImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const shadowData = shadowImageData.data;

      for (let i = 0; i < shadowData.length; i += 4) {
        const brightness = (shadowData[i] + shadowData[i + 1] + shadowData[i + 2]) / 3;
        const alpha = Math.round((255 - brightness) * config.opacity);
        shadowData[i] = 0;
        shadowData[i + 1] = 0;
        shadowData[i + 2] = 0;
        shadowData[i + 3] = alpha;
      }

      shadowCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
      shadowCtx.putImageData(shadowImageData, 0, 0);

      // STEP 3: Cut out person area from shadow using destination-out
      // This ensures shadow NEVER appears on top of person
      // Use blur(5px) to slightly expand the cutout for clean edges
      shadowCtx.globalCompositeOperation = 'destination-out';
      shadowCtx.filter = 'grayscale(1) blur(5px)';
      shadowCtx.drawImage(results.segmentationMask, 0, 0, shadowCanvas.width, shadowCanvas.height);
      shadowCtx.filter = 'none';
      shadowCtx.globalCompositeOperation = 'source-over';

      // STEP 4: Draw video on main canvas
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      // STEP 5: Draw shadow (with person hole) on top of video
      ctx.drawImage(shadowCanvas, 0, 0);

      // Debug: Log success on first frames
      if (frameCountRef.current <= 5) {
        console.log('[ShadowEffect] Shadow created with person cutout');
      }
    } else {
      // No shadow - just draw video
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    // Debug: Draw previews to diagnose mask and shadow rendering
    if (frameCountRef.current <= 200 && config.enabled) {
      ctx.save();
      const previewSize = 160;
      const previewHeight = Math.floor(previewSize * (canvas.height / canvas.width));

      // Preview 1: Raw segmentation mask (bottom-left)
      // Shows: white=person, black=background (if RGB mask) OR person shape with alpha
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#333333';
      ctx.fillRect(8, canvas.height - previewHeight - 12, previewSize + 4, previewHeight + 4);
      ctx.drawImage(results.segmentationMask, 10, canvas.height - previewHeight - 10, previewSize, previewHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.fillText('Raw Mask', 12, canvas.height - previewHeight - 14);

      // Preview 2: Processed shadow (tempCanvas) - next to mask
      // Shows: what we're using as shadow
      ctx.fillStyle = '#333333';
      ctx.fillRect(previewSize + 18, canvas.height - previewHeight - 12, previewSize + 4, previewHeight + 4);
      ctx.drawImage(tempCanvas, previewSize + 20, canvas.height - previewHeight - 10, previewSize, previewHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Shadow Mask', previewSize + 22, canvas.height - previewHeight - 14);

      // Preview 3: Shadow canvas with blur applied
      ctx.fillStyle = '#333333';
      ctx.fillRect(previewSize * 2 + 28, canvas.height - previewHeight - 12, previewSize + 4, previewHeight + 4);
      ctx.drawImage(shadowCanvas, previewSize * 2 + 30, canvas.height - previewHeight - 10, previewSize, previewHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Final Shadow', previewSize * 2 + 32, canvas.height - previewHeight - 14);

      ctx.restore();
    }

    // Update FPS counter
    fpsCountRef.current.frames++;
    const now = performance.now();
    if (now - fpsCountRef.current.lastTime >= 1000) {
      setFps(fpsCountRef.current.frames);
      fpsCountRef.current.frames = 0;
      fpsCountRef.current.lastTime = now;
    }
  }, []); // No dependencies - uses refs

  // Initialize on mount (runs only once)
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

        // Start camera
        setLoadingMessage('Starting camera...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        console.log('[ShadowEffect] Available cameras:', videoDevices.map(d => d.label));

        const deviceId = videoDevices.length >= 2 ? videoDevices[1].deviceId : videoDevices[0]?.deviceId;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
          console.log('[ShadowEffect] Camera started, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
        }

        if (!isMounted) return;

        // Set up processing
        setLoadingMessage('Starting segmentation...');

        // Register the results callback
        selfieSegmentationRef.current.onResults((results: any) => {
          // Call our onResults function
          onResults(results);
        });

        console.log('[ShadowEffect] onResults callback registered');
        if (isMounted) setDebugInfo('Segmentation ready');

        const processFrame = async () => {
          if (!isMounted) return;

          if (videoRef.current && selfieSegmentationRef.current && videoRef.current.readyState >= 2) {
            try {
              await selfieSegmentationRef.current.send({ image: videoRef.current });
            } catch (e) {
              console.error('[ShadowEffect] Frame processing error:', e);
            }
          }

          if (isMounted) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        };

        // Start processing loop
        console.log('[ShadowEffect] Starting frame processing loop');
        processFrame();
        setIsLoading(false);

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

  // Update shadow config handler
  const updateConfig = (key: keyof ShadowConfig, value: any) => {
    setShadowConfig(prev => ({ ...prev, [key]: value }));
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

      {/* Main output canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
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
              Offset X: {shadowConfig.offsetX}px
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              value={shadowConfig.offsetX}
              onChange={(e) => updateConfig('offsetX', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Offset Y */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Offset Y: {shadowConfig.offsetY}px
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              value={shadowConfig.offsetY}
              onChange={(e) => updateConfig('offsetY', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
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
            onClick={() => setShadowConfig(DEFAULT_SHADOW_CONFIG)}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Reset to Default
          </button>

          {/* Keyboard Shortcuts */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-sm text-gray-400 mb-2">Keyboard Shortcuts</h3>
            <ul className="text-xs text-gray-500 space-y-1">
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
