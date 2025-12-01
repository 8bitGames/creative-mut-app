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

  const [localSelection, setLocalSelection] = useState<string | null>(
    selectedPrintImage || (capturedImages.length > 0 ? capturedImages[0] : null)
  );

  // State for loading images as data URLs
  const [imageDataUrls, setImageDataUrls] = useState<{ [key: string]: string }>({});
  const [loadingImages, setLoadingImages] = useState(true);

  // 60-second countdown timer
  const [timeRemaining, setTimeRemaining] = useState(60);

  // Note: Hologram display is handled by ResultScreen after photo selection
  // This screen comes BEFORE the result screen, so no hologram persistence needed here

  // Load images via IPC as data URLs
  useEffect(() => {
    const loadImages = async () => {
      console.log('🖼️ [ImageSelectionScreen] Loading images via IPC');
      console.log(`   Total images: ${capturedImages.length}`);
      console.log(`   Image paths:`, capturedImages);

      // CRITICAL: Validate that we have exactly 3 images
      const REQUIRED_IMAGES = 3;
      if (capturedImages.length !== REQUIRED_IMAGES) {
        console.error(`❌ [ImageSelectionScreen] Expected ${REQUIRED_IMAGES} images, got ${capturedImages.length}`);
        alert(`오류: ${REQUIRED_IMAGES}개의 사진이 필요하지만 ${capturedImages.length}개만 있습니다.\n처음부터 다시 시도해주세요.`);
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
        setTimeout(() => setScreen('start'), 2000);
      }
    };

    loadImages();
  }, [capturedImages, setScreen]);

  // 60-second countdown timer
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  // Handle timeout expiry separately to avoid setState during render
  useEffect(() => {
    if (timeRemaining === 0) {
      console.log('⏱️ [ImageSelectionScreen] Time expired, returning to start');
      setScreen('start');
    }
  }, [timeRemaining, setScreen]);

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
              timeRemaining <= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'
            }`}>
              {timeRemaining}초
            </div>
          </div>
        </div>
      </motion.div>

      {/* Image Grid - Much Bigger */}
      <motion.div
        className="flex-1 flex items-center justify-center w-full px-8"
        variants={itemVariants}
      >
        {loadingImages ? (
          <div className="text-center">
            <p className="text-3xl text-gray-500">사진 불러오는 중...</p>
          </div>
        ) : capturedImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-6 w-full h-full">
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
                      ? 'border-4 border-black ring-4 ring-black'
                      : 'border-2 border-gray-300 hover:border-gray-500'
                  }`}
                  onClick={() => handleImageSelect(imagePath)}
                >
                  {/* Image - Natural aspect ratio preserved */}
                  <div className="bg-gray-100 flex items-center justify-center relative w-full">
                    {imageDataUrls[imagePath] ? (
                      <img
                        src={imageDataUrls[imagePath]}
                        alt={`Photo from ${index === 0 ? '5' : index === 1 ? '10' : '15'} seconds`}
                        className="w-full h-auto object-contain"
                        onError={(e) => {
                          console.error(`[ImageSelectionScreen] Failed to display image ${index + 1}`);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-center p-4">
                        <div className="text-gray-400 text-2xl mb-2">Photo {index + 1}</div>
                        <div className="text-gray-400 text-lg">Loading...</div>
                      </div>
                    )}

                    {/* Selection Indicator - Smaller */}
                    <AnimatePresence>
                      {localSelection === imagePath && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center"
                        >
                          <div className="bg-white rounded-full p-3">
                            <Check className="w-12 h-12 text-black" strokeWidth={3} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Image Timestamp Label - Smaller */}
                  <div className="absolute top-3 left-3 bg-white bg-opacity-90 rounded-full px-4 py-2 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {index === 0 ? '5s' : index === 1 ? '10s' : '15s'}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
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
