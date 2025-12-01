// src/screens/08-ImageSelectionScreen.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
    },
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
  tap: {
    scale: 0.95,
  },
};

export function ImageSelectionScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const capturedImages = useSessionStore((state) => state.capturedImages);
  const selectedPrintImage = useSessionStore((state) => state.selectedPrintImage);
  const setSelectedPrintImage = useSessionStore((state) => state.setSelectedPrintImage);
  const processedResult = useSessionStore((state) => state.processedResult);
  const clearSession = useSessionStore((state) => state.clearSession);

  // Use shared timer from sessionStore
  const selectionTimeRemaining = useSessionStore((state) => state.selectionTimeRemaining);
  const setSelectionTimeRemaining = useSessionStore((state) => state.setSelectionTimeRemaining);

  const [localSelection, setLocalSelection] = useState<string | null>(
    selectedPrintImage || (capturedImages.length > 0 ? capturedImages[0] : null)
  );

  // State for loading images as data URLs
  const [imageDataUrls, setImageDataUrls] = useState<{ [key: string]: string }>({});
  const [loadingImages, setLoadingImages] = useState(true);

  // CRITICAL: Ensure hologram display (video + QR) persists when entering this screen
  // Only poll if we have valid processedResult data
  useEffect(() => {
    console.log('🎭 [ImageSelectionScreen] Component mounted/updated - setting up hologram persistence');
    console.log(`   processedResult exists: ${!!processedResult}`);
    console.log(`   qrCodePath exists: ${!!processedResult?.qrCodePath}`);
    console.log(`   s3Url exists: ${!!processedResult?.s3Url}`);

    // CRITICAL: Only set up polling if we have valid processedResult
    // If processedResult is null or missing required fields, don't poll
    if (!processedResult || !processedResult.qrCodePath || !processedResult.s3Url) {
      console.warn('⚠️ [ImageSelectionScreen] Missing processedResult data - skipping hologram persistence');
      return;
    }

    const maintainHologram = () => {
      // Get the latest processedResult from the store to avoid stale closures
      const latestProcessedResult = useSessionStore.getState().processedResult;
      
      // Validate we still have valid data
      if (!latestProcessedResult || !latestProcessedResult.qrCodePath || !latestProcessedResult.s3Url) {
        console.warn('⚠️ [ImageSelectionScreen] processedResult became invalid during polling');
        return;
      }

      // @ts-ignore - Electron API
      if (!window.electron?.hologram) {
        return;
      }

      console.log('🔄 [ImageSelectionScreen] Maintaining hologram display (video + QR)');
      console.log(`   QR Code: ${latestProcessedResult.qrCodePath}`);
      console.log(`   Video: ${latestProcessedResult.s3Url}`);
      
      // @ts-ignore
      window.electron.hologram.showQR(
        latestProcessedResult.qrCodePath,
        latestProcessedResult.s3Url
      );
    };

    // Call immediately with current processedResult
    if (processedResult.qrCodePath && processedResult.s3Url) {
      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore
        window.electron.hologram.showQR(
          processedResult.qrCodePath,
          processedResult.s3Url
        );
      }
    }

    // Poll every 2 seconds (less aggressive) to ensure state persists
    // The interval callback will get the latest processedResult from the store
    const interval = setInterval(maintainHologram, 2000);

    return () => {
      console.log('🛑 [ImageSelectionScreen] Stopping hologram polling');
      clearInterval(interval);
    };
  }, [processedResult]);

  // Load images via IPC as data URLs
  useEffect(() => {
    const loadImages = async () => {
      console.log('🖼️ [ImageSelectionScreen] Loading images via IPC');
      console.log(`   Total images: ${capturedImages.length}`);
      console.log(`   Image paths:`, capturedImages);

      // CRITICAL: Validate that we have exactly 3 images
      // Skip validation if capturedImages is empty (session was intentionally cleared, e.g., timeout)
      const REQUIRED_IMAGES = 3;
      if (capturedImages.length === 0) {
        console.log('⏭️ [ImageSelectionScreen] No images (session cleared), skipping validation');
        setLoadingImages(false);
        return;
      }
      if (capturedImages.length !== REQUIRED_IMAGES) {
        console.error(`❌ [ImageSelectionScreen] Expected ${REQUIRED_IMAGES} images, got ${capturedImages.length}`);
        alert(`오류: ${REQUIRED_IMAGES}개의 사진이 필요하지만 ${capturedImages.length}개만 있습니다.\n처음부터 다시 시도해주세요.`);
        // Reset hologram to logo before going to start
        // @ts-ignore - Electron API
        if (window.electron?.hologram) {
          // @ts-ignore
          window.electron.hologram.showLogo();
        }
        // Clear session data
        clearSession();
        setTimeout(() => setScreen('start'), 2000);
        setLoadingImages(false);
        return;
      }

      const dataUrls: { [key: string]: string } = {};

      for (let i = 0; i < capturedImages.length; i++) {
        const imagePath = capturedImages[i];
        console.log(`   Loading image ${i + 1}/${capturedImages.length}: ${imagePath}`);

        try {
          // @ts-ignore
          if (window.electron?.file) {
            // @ts-ignore
            const result = await window.electron.file.readAsDataUrl(imagePath);
            if (result.success) {
              dataUrls[imagePath] = result.dataUrl;
              console.log(`   ✅ Image ${i + 1} loaded successfully`);
            } else {
              console.error(`   ❌ Failed to load image ${i + 1}:`, result.error);
            }
          } else {
            console.warn('⚠️ [ImageSelectionScreen] Electron API not available');
          }
        } catch (error) {
          console.error(`   ❌ Error loading image ${i + 1}:`, error);
        }
      }

      setImageDataUrls(dataUrls);
      setLoadingImages(false);
      console.log(`✅ [ImageSelectionScreen] Loaded ${Object.keys(dataUrls).length} images`);

      // Validate all images loaded successfully
      if (Object.keys(dataUrls).length !== REQUIRED_IMAGES) {
        console.error(`❌ [ImageSelectionScreen] Failed to load all images: ${Object.keys(dataUrls).length}/${REQUIRED_IMAGES}`);
        alert(`오류: 일부 사진을 불러올 수 없습니다.\n처음부터 다시 시도해주세요.`);
        // Reset hologram to logo before going to start
        // @ts-ignore - Electron API
        if (window.electron?.hologram) {
          // @ts-ignore
          window.electron.hologram.showLogo();
        }
        // Clear session data
        clearSession();
        setTimeout(() => setScreen('start'), 2000);
      }
    };

    loadImages();
  }, [capturedImages, setScreen, clearSession]);

  // Shared countdown timer (continues across screens)
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setSelectionTimeRemaining(Math.max(0, selectionTimeRemaining - 1));
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [selectionTimeRemaining, setSelectionTimeRemaining]);

  // Handle timeout expiry separately to avoid setState during render
  useEffect(() => {
    if (selectionTimeRemaining === 0) {
      console.log('⏱️ [ImageSelectionScreen] Time expired, returning to idle');
      // Reset hologram to logo before going to idle
      // @ts-ignore - Electron API
      if (window.electron?.hologram) {
        // @ts-ignore
        window.electron.hologram.showLogo();
      }
      // Clear session data to prevent stale data in next session
      clearSession();
      setScreen('idle');
    }
  }, [selectionTimeRemaining, setScreen, clearSession]);

  // Also handle error cases where we navigate back to start
  useEffect(() => {
    const handleErrorNavigation = () => {
      // If we're navigating away from this screen due to an error, clear session
      // This is a safety net in case errors occur
      return () => {
        // Only clear if we're actually leaving due to an error condition
        // (Don't clear on normal navigation to payment screen)
      };
    };
    return handleErrorNavigation();
  }, []);

  const handleImageSelect = (imagePath: string) => {
    setLocalSelection(imagePath);
  };

  const handleConfirm = () => {
    if (localSelection) {
      setSelectedPrintImage(localSelection);
      setScreen('result');
    }
  };

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header with Timer */}
      <motion.div className="text-center py-4 w-full" variants={itemVariants}>
        <div className="flex items-center justify-between max-w-4xl mx-auto px-8">
          <div className="flex-1" /> {/* Spacer */}
          <div className="flex-1 text-center">
            <h1 className="text-4xl font-bold mb-2">사진 선택</h1>
            <p className="text-xl text-gray-600">인쇄할 사진을 선택해주세요</p>
          </div>
          <div className="flex-1 flex justify-end">
            <div className={`text-3xl font-bold px-6 py-3 rounded-full ${
              selectionTimeRemaining <= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'
            }`}>
              {selectionTimeRemaining}초
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content - Large Preview + Thumbnails */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center w-full px-8 gap-6"
        variants={itemVariants}
      >
        {loadingImages ? (
          <div className="text-center">
            <p className="text-3xl text-gray-500">사진 불러오는 중...</p>
          </div>
        ) : capturedImages.length > 0 ? (
          <>
            {/* Large Preview - Selected Image */}
            <div className="flex-1 flex items-center justify-center w-full max-h-[60vh]">
              <Card className="relative overflow-hidden border-4 border-black shadow-2xl">
                {localSelection && imageDataUrls[localSelection] ? (
                  <img
                    src={imageDataUrls[localSelection]}
                    alt="Selected photo"
                    className="max-h-[55vh] w-auto object-contain"
                    onError={(e) => {
                      console.error('[ImageSelectionScreen] Failed to display selected image');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[55vh] w-[40vh] bg-gray-100">
                    <p className="text-2xl text-gray-400">사진을 선택해주세요</p>
                  </div>
                )}
                {/* Selected timestamp label */}
                {localSelection && (
                  <div className="absolute top-4 left-4 bg-black text-white rounded-full px-5 py-2">
                    <span className="text-xl font-bold">
                      {capturedImages.indexOf(localSelection) === 0 ? '5초' :
                       capturedImages.indexOf(localSelection) === 1 ? '10초' : '15초'}
                    </span>
                  </div>
                )}
              </Card>
            </div>

            {/* Thumbnails Row */}
            <div className="flex gap-4 justify-center">
              {capturedImages.map((imagePath, index) => (
                <motion.div
                  key={imagePath}
                  variants={imageVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Card
                    className={`relative overflow-hidden cursor-pointer transition-all ${
                      localSelection === imagePath
                        ? 'border-4 border-black ring-4 ring-black scale-105'
                        : 'border-2 border-gray-300 hover:border-gray-500 opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => handleImageSelect(imagePath)}
                  >
                    {imageDataUrls[imagePath] ? (
                      <img
                        src={imageDataUrls[imagePath]}
                        alt={`Photo ${index + 1}`}
                        className="h-32 w-auto object-contain"
                        onError={(e) => {
                          console.error(`[ImageSelectionScreen] Failed to display thumbnail ${index + 1}`);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-32 w-24 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400">...</span>
                      </div>
                    )}

                    {/* Thumbnail label */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-white bg-opacity-90 rounded-full px-3 py-1">
                      <span className="text-sm font-bold">
                        {index === 0 ? '5초' : index === 1 ? '10초' : '15초'}
                      </span>
                    </div>

                    {/* Selection check */}
                    <AnimatePresence>
                      {localSelection === imagePath && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute top-1 right-1 bg-black rounded-full p-1"
                        >
                          <Check className="w-5 h-5 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-3xl text-gray-500">촬영된 사진이 없습니다</p>
          </div>
        )}
      </motion.div>

      {/* Action Button - Confirm Only */}
      <motion.div className="flex justify-center w-full max-w-2xl py-4" variants={itemVariants}>
        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={!localSelection}
          className="w-full bg-black text-white hover:bg-gray-800 px-12 py-8 text-3xl font-bold touch-target border-3 border-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음
          <ArrowRight className="w-8 h-8 ml-3" strokeWidth={2.5} />
        </Button>
      </motion.div>

      {/* Footer - Smaller */}
      <motion.div className="text-center py-2" variants={itemVariants}>
        <p className="text-xl text-gray-500">
          인쇄할 사진을 선택해주세요
        </p>
      </motion.div>
    </motion.div>
  );
}
