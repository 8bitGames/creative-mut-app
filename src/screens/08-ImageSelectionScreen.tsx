// src/screens/08-ImageSelectionScreen.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
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

  const handleImageSelect = (imagePath: string) => {
    setLocalSelection(imagePath);
  };

  const handleConfirm = () => {
    if (localSelection) {
      setSelectedPrintImage(localSelection);
      setScreen('payment');
    }
  };

  const handleBack = () => {
    setScreen('result');
  };

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-between p-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <motion.div className="text-center" variants={itemVariants}>
        <h1 className="text-5xl font-bold mb-3">사진 선택</h1>
        <p className="text-2xl text-gray-600">인쇄할 사진을 선택해주세요</p>
      </motion.div>

      {/* Image Grid */}
      <motion.div
        className="flex-1 flex items-center justify-center w-full max-w-7xl"
        variants={itemVariants}
      >
        {capturedImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-8 w-full">
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
                      ? 'border-8 border-black ring-8 ring-black'
                      : 'border-4 border-gray-300 hover:border-gray-500'
                  }`}
                  onClick={() => handleImageSelect(imagePath)}
                >
                  {/* Image */}
                  <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
                    {imagePath ? (
                      <img
                        src={`file://${imagePath}`}
                        alt={`Captured ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 text-2xl">Photo {index + 1}</div>
                    )}

                    {/* Selection Indicator */}
                    <AnimatePresence>
                      {localSelection === imagePath && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center"
                        >
                          <div className="bg-white rounded-full p-6">
                            <Check className="w-20 h-20 text-black" strokeWidth={3} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Image Number */}
                  <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-full w-16 h-16 flex items-center justify-center">
                    <span className="text-3xl font-bold">{index + 1}</span>
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

      {/* Action Buttons */}
      <motion.div className="flex gap-8 w-full max-w-3xl" variants={itemVariants}>
        <Button
          size="lg"
          variant="outline"
          onClick={handleBack}
          className="flex-1 border-4 border-black text-black hover:bg-black hover:text-white px-12 py-12 text-3xl font-bold touch-target transition-colors"
        >
          <ArrowLeft className="w-10 h-10 mr-3" strokeWidth={2.5} />
          이전으로
        </Button>

        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={!localSelection}
          className="flex-1 bg-black text-white hover:bg-gray-800 px-12 py-12 text-3xl font-bold touch-target border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          결제하기
          <ArrowRight className="w-10 h-10 ml-3" strokeWidth={2.5} />
        </Button>
      </motion.div>

      {/* Footer */}
      <motion.div className="text-center" variants={itemVariants}>
        <p className="text-2xl text-gray-500">
          인쇄 비용: <span className="font-bold text-black">5,000원</span>
        </p>
      </motion.div>
    </motion.div>
  );
}
