// src/components/HologramWindow.tsx
// Second monitor display - Shows logo or video with QR code overlay
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HologramWindowProps {
  mode: 'logo' | 'result';
  qrCodePath?: string;
  videoPath?: string;
}

export function HologramWindow({ mode, qrCodePath, videoPath }: HologramWindowProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Log whenever props change
  useEffect(() => {
    console.log('');
    console.log('🔄 [HologramWindow] Props changed:');
    console.log(`   Mode: ${mode}`);
    console.log(`   QR Code Path: ${qrCodePath || 'undefined'}`);
    console.log(`   Video Path: ${videoPath || 'undefined'}`);
    console.log('');
  }, [mode, qrCodePath, videoPath]);

  // Load QR code via IPC when provided
  useEffect(() => {
    if (!qrCodePath) {
      setQrCodeDataUrl(null);
      return;
    }

    const loadQRCode = async () => {
      try {
        console.log(`📂 [HologramWindow] Loading QR code: ${qrCodePath}`);
        // @ts-ignore
        const result = await window.electron.file.readAsDataUrl(qrCodePath);
        if (result.success) {
          setQrCodeDataUrl(result.dataUrl);
          console.log('✅ [HologramWindow] QR code loaded successfully');
        } else {
          console.error('[HologramWindow] Failed to load QR code:', result.error);
        }
      } catch (error) {
        console.error('[HologramWindow] Error loading QR code:', error);
      }
    };

    loadQRCode();
  }, [qrCodePath]);

  // Load video via IPC when provided
  useEffect(() => {
    if (!videoPath) {
      setVideoDataUrl(null);
      return;
    }

    const loadVideo = async () => {
      try {
        console.log(`📹 [HologramWindow] Loading video: ${videoPath}`);

        // For S3 URLs, use directly
        if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
          console.log('   Using S3 URL directly:', videoPath);
          setVideoDataUrl(videoPath);
          console.log('✅ [HologramWindow] Video URL set successfully');
        } else {
          // For local files, load via IPC
          console.log('   Loading local file via IPC');
          // @ts-ignore
          const result = await window.electron.file.readAsDataUrl(videoPath);
          if (result.success) {
            setVideoDataUrl(result.dataUrl);
            console.log('✅ [HologramWindow] Video loaded successfully (data URL)');
          } else {
            console.error('[HologramWindow] Failed to load video:', result.error);
          }
        }
      } catch (error) {
        console.error('[HologramWindow] Error loading video:', error);
      }
    };

    loadVideo();
  }, [videoPath]);

  // Auto-play video when loaded - multiple attempts for reliability
  useEffect(() => {
    if (!videoRef.current || !videoDataUrl) return;

    const video = videoRef.current;

    console.log('🎬 [HologramWindow] Video element ready, attempting autoplay');
    console.log(`   Video source: ${videoDataUrl.substring(0, 100)}...`);

    // Function to attempt playback
    const attemptPlay = async () => {
      try {
        // Ensure video is loaded
        if (video.readyState >= 2) {
          console.log('   Video ready state:', video.readyState, '(>=2 means metadata loaded)');
          await video.play();
          console.log('✅ [HologramWindow] Video playing successfully!');
        } else {
          console.log('   Video not ready yet, readyState:', video.readyState);
          // Wait for video to be ready
          video.addEventListener('loadedmetadata', async () => {
            console.log('   Video metadata loaded, attempting play...');
            try {
              await video.play();
              console.log('✅ [HologramWindow] Video playing successfully after metadata load!');
            } catch (err) {
              console.error('❌ [HologramWindow] Play failed after metadata:', err);
            }
          }, { once: true });
        }
      } catch (error) {
        console.error('❌ [HologramWindow] Video autoplay failed:', error);
        console.error('   Error details:', error);

        // Retry after a short delay
        setTimeout(() => {
          console.log('   Retrying autoplay...');
          video.play().catch(err => {
            console.error('❌ [HologramWindow] Retry also failed:', err);
          });
        }, 500);
      }
    };

    // Attempt play immediately
    attemptPlay();

    // Also try when video can play
    const handleCanPlay = () => {
      console.log('📺 [HologramWindow] Video canplay event fired');
      video.play().catch(err => console.error('[HologramWindow] Canplay autoplay failed:', err));
    };

    video.addEventListener('canplay', handleCanPlay, { once: true });

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoDataUrl]);

  return (
    <div className="fullscreen bg-black relative overflow-hidden">
      <AnimatePresence mode="wait">
        {mode === 'logo' ? (
          // Logo Mode - Centered logo with breathing animation
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
              className="flex items-center justify-center"
            >
              <img
                src="/logo.jpg"
                alt="MUT Logo"
                className="w-96 h-96 object-contain"
                style={{ transform: 'scaleX(-1)' }} // Mirror the logo
                onLoad={() => console.log('✅ [HologramWindow] Logo loaded successfully')}
                onError={(e) => console.error('❌ [HologramWindow] Logo failed to load', e)}
              />
            </motion.div>
          </motion.div>
        ) : (
          // Result Mode - Full screen video with QR code overlay on top right
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full h-full"
          >
            {/* Background Video - Full Screen */}
            {videoDataUrl ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full"
              >
                <video
                  ref={videoRef}
                  src={videoDataUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                  onLoadStart={() => console.log('📹 [HologramWindow] Video load started')}
                  onLoadedMetadata={() => console.log('📊 [HologramWindow] Video metadata loaded')}
                  onLoadedData={() => {
                    console.log('✅ [HologramWindow] Video data loaded and ready to play');
                    // Force play when data is loaded
                    if (videoRef.current) {
                      videoRef.current.play().catch(err =>
                        console.error('[HologramWindow] Play on loadeddata failed:', err)
                      );
                    }
                  }}
                  onCanPlay={() => console.log('🎬 [HologramWindow] Video can play')}
                  onPlay={() => console.log('▶️  [HologramWindow] Video is now playing')}
                  onPause={() => console.log('⏸️  [HologramWindow] Video paused')}
                  onError={(e) => {
                    console.error('❌ [HologramWindow] Video error event:', e);
                    const video = e.currentTarget;
                    if (video.error) {
                      console.error('   Error code:', video.error.code);
                      console.error('   Error message:', video.error.message);
                      const errorMessages: { [key: number]: string } = {
                        1: 'MEDIA_ERR_ABORTED - Fetching was aborted',
                        2: 'MEDIA_ERR_NETWORK - Network error (check S3 CORS/connectivity)',
                        3: 'MEDIA_ERR_DECODE - Decoding error',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Format not supported',
                      };
                      console.error('   Error type:', errorMessages[video.error.code] || 'Unknown');
                      console.error('   Current video source:', videoDataUrl);

                      // Network error might be temporary - the local file is preserved as backup
                      if (video.error.code === 2) {
                        console.log('💡 Tip: S3 video failed to load. Local video file is preserved for backup use.');
                      }
                    }
                  }}
                  onStalled={() => console.warn('⚠️  [HologramWindow] Video stalled')}
                  onWaiting={() => console.log('⏳ [HologramWindow] Video waiting for data')}
                />

                {/* Dim Overlay */}
                <div className="absolute inset-0 bg-black/30" />
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-2xl">비디오 로딩 중...</div>
              </div>
            )}

            {/* QR Code - Top Right Corner (Smaller) */}
            {qrCodeDataUrl && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, x: 50, y: -50 }}
                animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 15 }}
                className="absolute top-8 right-8 z-10"
              >
                <div className="bg-white p-4 rounded-2xl shadow-2xl">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code"
                    className="w-48 h-48 object-contain"
                    onError={(e) => {
                      console.error('[HologramWindow] Failed to load QR code image');
                      console.error('[HologramWindow] Error event:', e);
                    }}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
