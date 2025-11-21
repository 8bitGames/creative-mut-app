// src/components/HologramWindow.tsx
// Second monitor display for QR code and logo
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';

interface HologramWindowProps {
  mode: 'logo' | 'result' | 'recording-prep';
  qrCodePath?: string;
  videoPath?: string;
  framePath?: string;
}

export function HologramWindow({ mode, qrCodePath, videoPath, framePath }: HologramWindowProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Load QR code via IPC when provided
  useEffect(() => {
    if (!qrCodePath) {
      setQrCodeDataUrl(null);
      return;
    }

    const loadQRCode = async () => {
      try {
        // @ts-ignore
        const result = await window.electron.file.readAsDataUrl(qrCodePath);
        if (result.success) {
          setQrCodeDataUrl(result.dataUrl);
        } else {
          console.error('[HologramWindow] Failed to load QR code:', result.error);
        }
      } catch (error) {
        console.error('[HologramWindow] Error loading QR code:', error);
      }
    };

    loadQRCode();
  }, [qrCodePath]);

  // Start camera when in recording-prep mode
  useEffect(() => {
    console.log(`🎭 [HologramWindow] Mode changed to: ${mode}`);

    if (mode === 'recording-prep') {
      console.log('📷 [HologramWindow] Entering recording-prep mode - Starting camera...');

      const startCamera = async () => {
        try {
          console.log('🎥 [HologramWindow] Requesting camera access for hologram display...');

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              facingMode: 'user'
            },
            audio: false
          });

          console.log('✅ [HologramWindow] Camera access granted for hologram!');
          console.log(`   📊 Stream tracks: ${stream.getTracks().length}`);
          stream.getTracks().forEach(track => {
            console.log(`   🎬 Track: ${track.kind} - ${track.label} (${track.enabled ? 'enabled' : 'disabled'})`);
          });

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log('📺 [HologramWindow] Stream assigned to hologram video element');
          } else {
            console.warn('⚠️ [HologramWindow] Video ref not available yet');
          }
        } catch (error) {
          console.error('❌ [HologramWindow] Failed to access camera for hologram display:', error);
          if (error instanceof Error) {
            console.error(`   Error name: ${error.name}`);
            console.error(`   Error message: ${error.message}`);
          }
        }
      };

      startCamera();
    } else {
      console.log(`ℹ️ [HologramWindow] Mode is ${mode}, not starting camera`);
    }

    // Cleanup: Stop camera when leaving recording-prep mode
    return () => {
      if (streamRef.current) {
        console.log('🛑 [HologramWindow] Stopping hologram camera stream...');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`   ⏹️ Stopped hologram track: ${track.kind} - ${track.label}`);
        });
        streamRef.current = null;
      }
    };
  }, [mode]);

  return (
    <div className="fullscreen bg-black flex items-center justify-center">
      <AnimatePresence mode="wait">
        {mode === 'recording-prep' ? (
          <motion.div
            key="recording-prep"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            {/* Live Camera Preview with Frame Overlay - Full Screen */}
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Live Camera Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
              />

              {/* Frame Overlay */}
              {framePath && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                  <div className="relative h-full max-w-full aspect-[9/16]">
                    <img
                      src={framePath}
                      alt="Frame Overlay"
                      className="w-full h-full object-contain opacity-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : mode === 'logo' ? (
          <motion.div
            key="logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Logo className="w-80" color="white" />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center h-full w-full"
          >
            {/* QR Code Display - Centered, No Design */}
            {qrCodeDataUrl && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex items-center justify-center"
              >
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="w-auto h-auto max-w-[80vh] max-h-[80vh] object-contain"
                  onError={(e) => {
                    console.error('[HologramWindow] Failed to load QR code image');
                    console.error('[HologramWindow] Error event:', e);
                  }}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
