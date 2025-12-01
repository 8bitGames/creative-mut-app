// src/screens/09-PaymentScreen.tsx
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/sessionStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Payment amount is fixed at 5,000원
const PAYMENT_AMOUNT = 5000;

enum PaymentStatus {
  IDLE = 'idle',
  WAITING = 'waiting',
  CARD_INSERTED = 'card_inserted',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  DECLINED = 'declined',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

interface PaymentResultData {
  success: boolean;
  status: string;
  transactionId?: string;
  amount?: number;
  cardType?: string;
  cardLast4?: string;
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionMedia?: string;
  error?: string;
  rejectCode?: string;
  rejectMessage?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
  exit: { opacity: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -50,
    transition: {
      duration: 0.3,
    },
  },
};

export function PaymentScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const processedResult = useSessionStore((state) => state.processedResult);
  const setLastPaymentResult = useSessionStore((state) => state.setLastPaymentResult);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.WAITING);
  const [timeLeft, setTimeLeft] = useState(30);
  const [message, setMessage] = useState('');
  const cleanupRef = useRef<(() => void)[]>([]);
  const paymentStartedRef = useRef(false);

  // Show hologram display once when entering this screen
  useEffect(() => {
    if (processedResult?.qrCodePath && processedResult?.s3Url) {
      // @ts-ignore - Electron API
      window.electron?.hologram?.showQR(
        processedResult.qrCodePath,
        processedResult.s3Url
      );
    }
  }, [processedResult]);

  useEffect(() => {
    console.log('💳 [PaymentScreen] useEffect running, paymentStartedRef:', paymentStartedRef.current);

    // Prevent double-starting payment
    if (paymentStartedRef.current) {
      console.log('💳 [PaymentScreen] Payment already started, skipping...');
      return;
    }
    paymentStartedRef.current = true;

    // Start payment process
    console.log('💳 [PaymentScreen] Starting payment process...');
    startPayment();

    // 30-second timeout timer
    console.log('💳 [PaymentScreen] Starting 30s countdown timer...');
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        console.log(`💳 [PaymentScreen] Timer tick: ${prev}s -> ${prev - 1}s`);
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      // Cleanup event listeners
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
      // Reset ref for StrictMode re-runs
      paymentStartedRef.current = false;
    };
  }, []);

  const startPayment = async () => {
    setPaymentStatus(PaymentStatus.WAITING);
    setMessage('카드를 삽입해주세요');

    // @ts-ignore - Electron API
    const electron = window.electron;
    if (!electron?.payment) {
      console.error('❌ [PaymentScreen] Electron payment API not available');
      setPaymentStatus(PaymentStatus.ERROR);
      setMessage('결제 시스템을 초기화할 수 없습니다');
      return;
    }

    // Set up event listeners for real-time payment updates
    const unsubscribeStatus = electron.payment.onStatus((status: { status: string; message?: string; cardType?: string }) => {
      console.log('💳 [PaymentScreen] Payment status update:', status);

      switch (status.status) {
        case 'waiting':
          setPaymentStatus(PaymentStatus.WAITING);
          setMessage(status.message || '카드를 삽입해주세요');
          break;
        case 'card_inserted':
          setPaymentStatus(PaymentStatus.CARD_INSERTED);
          setMessage(status.message || '카드가 감지되었습니다');
          break;
        case 'processing':
          setPaymentStatus(PaymentStatus.PROCESSING);
          setMessage(status.message || '결제 처리 중...');
          break;
        case 'approved':
          setPaymentStatus(PaymentStatus.APPROVED);
          setMessage(status.message || '결제가 완료되었습니다!');
          break;
        case 'declined':
          setPaymentStatus(PaymentStatus.DECLINED);
          setMessage(status.message || '결제가 거부되었습니다');
          break;
        case 'cancelled':
          setPaymentStatus(PaymentStatus.CANCELLED);
          setMessage(status.message || '결제가 취소되었습니다');
          break;
        case 'timeout':
          setPaymentStatus(PaymentStatus.TIMEOUT);
          setMessage(status.message || '시간이 초과되었습니다');
          break;
        default:
          console.warn('⚠️ [PaymentScreen] Unknown payment status:', status.status);
      }
    });
    cleanupRef.current.push(unsubscribeStatus);

    const unsubscribeComplete = electron.payment.onComplete((result: PaymentResultData) => {
      console.log('💳 [PaymentScreen] Payment complete:', result);
      const sessionId = useSessionStore.getState().sessionId;

      if (result.success) {
        setPaymentStatus(PaymentStatus.APPROVED);
        setMessage('결제가 완료되었습니다!');

        // Store payment result for potential cancellation later
        setLastPaymentResult({
          transactionId: result.transactionId,
          approvalNumber: result.approvalNumber,
          salesDate: result.salesDate,
          salesTime: result.salesTime,
          amount: result.amount || PAYMENT_AMOUNT,
          transactionMedia: result.transactionMedia,
          cardType: result.cardType,
          cardLast4: result.cardLast4,
        });

        // Record payment to analytics with cancellation details
        // @ts-ignore - Electron API
        if (window.electron?.analytics?.recordPayment) {
          // @ts-ignore
          window.electron.analytics.recordPayment(
            sessionId,
            result.amount || PAYMENT_AMOUNT,
            'approved',
            undefined,
            {
              approvalNumber: result.approvalNumber,
              salesDate: result.salesDate,
              salesTime: result.salesTime,
              transactionMedia: result.transactionMedia,
              cardNumber: result.cardLast4 ? `****-****-****-${result.cardLast4}` : undefined,
            }
          );
          console.log('📊 [PaymentScreen] Payment recorded to analytics with cancellation details');
        }

        console.log('✅ [PaymentScreen] Payment approved - will navigate to printing in 1 second');
      } else {
        setPaymentStatus(PaymentStatus.DECLINED);
        setMessage(result.rejectMessage || result.error || '결제가 거부되었습니다');

        // Record failed payment to analytics
        // @ts-ignore - Electron API
        if (window.electron?.analytics?.recordPayment) {
          // @ts-ignore
          window.electron.analytics.recordPayment(
            sessionId,
            PAYMENT_AMOUNT,
            'declined',
            result.rejectMessage || result.error
          );
        }
      }
    });
    cleanupRef.current.push(unsubscribeComplete);

    const unsubscribeError = electron.payment.onError((error: { message: string }) => {
      console.error('❌ [PaymentScreen] Payment error:', error);
      setPaymentStatus(PaymentStatus.ERROR);
      setMessage(error.message || '결제 오류가 발생했습니다');
    });
    cleanupRef.current.push(unsubscribeError);

    // Start the actual payment process
    try {
      console.log(`💳 [PaymentScreen] Starting payment: ${PAYMENT_AMOUNT}원`);
      const result = await electron.payment.process({
        amount: PAYMENT_AMOUNT,
        currency: 'KRW',
        description: 'MUT 홀로그램 사진 인쇄',
      });

      // Handle immediate result (for mock mode or quick responses)
      if (result && result.success !== undefined) {
        console.log('💳 [PaymentScreen] Immediate payment result:', result);
        // The event listeners will handle the UI update
      }
    } catch (error) {
      console.error('❌ [PaymentScreen] Payment request failed:', error);
      setPaymentStatus(PaymentStatus.ERROR);
      setMessage('결제 요청에 실패했습니다');
    }
  };

  const handleTimeout = () => {
    if (paymentStatus !== PaymentStatus.APPROVED) {
      setPaymentStatus(PaymentStatus.TIMEOUT);
      setMessage('시간이 초과되었습니다');
      setTimeout(() => setScreen('idle'), 2000);
    }
  };

  const handleCancel = async () => {
    // @ts-ignore - Electron API
    const electron = window.electron;
    if (electron?.payment) {
      await electron.payment.cancel();
    }
    setPaymentStatus(PaymentStatus.CANCELLED);
    setTimeout(() => setScreen('idle'), 500);
  };

  const handleRetry = () => {
    setTimeLeft(30);
    paymentStartedRef.current = false;
    // Cleanup previous listeners
    cleanupRef.current.forEach(cleanup => cleanup());
    cleanupRef.current = [];
    startPayment();
  };

  // Auto-proceed on success - navigate to printing screen
  useEffect(() => {
    if (paymentStatus === PaymentStatus.APPROVED) {
      console.log('💳 [PaymentScreen] Payment approved! Navigating to printing screen...');
      setTimeout(() => {
        console.log('📄 [PaymentScreen] Navigating to printing screen NOW');
        setScreen('printing');
      }, 1000);
    }
  }, [paymentStatus, setScreen]);

  return (
    <motion.div
      className="fullscreen bg-white text-black flex flex-col items-center justify-center py-12 px-10 gap-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold mb-8"
      >
        결제
      </motion.h1>

      {/* Payment Card */}
      <Card className="w-full max-w-3xl p-16 border-4 border-black">
        <AnimatePresence mode="wait">
          {/* Waiting for Card */}
          {paymentStatus === PaymentStatus.WAITING && (
            <motion.div
              key="waiting"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <div className="relative mb-12">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CreditCard className="w-32 h-32" strokeWidth={1.5} />
                </motion.div>

                {/* Pulsing rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 border-4 border-blue-500 rounded-2xl"
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.6,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}

                {/* Corner sparkles */}
                {[0, 1, 2, 3].map((i) => {
                  const positions = [
                    { top: -20, left: -20 },
                    { top: -20, right: -20 },
                    { bottom: -20, left: -20 },
                    { bottom: -20, right: -20 },
                  ];
                  return (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={positions[i]}
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        rotate: [0, 180, 360],
                        scale: [0.8, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.4,
                        repeat: Infinity,
                      }}
                    >
                      <Sparkles className="w-8 h-8 text-blue-500" strokeWidth={2} />
                    </motion.div>
                  );
                })}
              </div>

              <h2 className="text-4xl font-bold mb-6">카드를 삽입해주세요</h2>
              <p className="text-2xl text-gray-600 mb-12">
                결제 금액: <span className="font-bold text-black">5,000원</span>
              </p>

              <div className="w-full space-y-4">
                <div className="flex justify-between text-2xl">
                  <span className="text-gray-600">남은 시간</span>
                  <span className="font-bold">{timeLeft}초</span>
                </div>
                <Progress value={(timeLeft / 30) * 100} className="h-4" />
              </div>
            </motion.div>
          )}

          {/* Card Inserted */}
          {paymentStatus === PaymentStatus.CARD_INSERTED && (
            <motion.div
              key="card-inserted"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <div className="relative mb-12">
                <motion.div
                  animate={{ scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <CheckCircle className="w-32 h-32 text-green-600" strokeWidth={1.5} />
                </motion.div>

                {/* Expanding ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-green-500"
                  animate={{
                    scale: [1, 1.3],
                    opacity: [0.8, 0],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              </div>

              <h2 className="text-4xl font-bold mb-6 text-green-600">카드 확인</h2>
              <p className="text-2xl text-gray-600">잠시만 기다려주세요...</p>
            </motion.div>
          )}

          {/* Processing */}
          {paymentStatus === PaymentStatus.PROCESSING && (
            <motion.div
              key="processing"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <Loader2 className="w-32 h-32 mb-12 animate-spin" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold mb-6">결제 처리 중...</h2>
              <p className="text-2xl text-gray-600">잠시만 기다려주세요</p>
            </motion.div>
          )}

          {/* Approved */}
          {paymentStatus === PaymentStatus.APPROVED && (
            <motion.div
              key="approved"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <div className="relative mb-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                >
                  <CheckCircle className="w-32 h-32 text-green-600" strokeWidth={2} />
                </motion.div>

                {/* Success burst effect */}
                {[...Array(6)].map((_, i) => {
                  const angle = (i * 360) / 6;
                  const radius = 100;
                  const x = Math.cos((angle * Math.PI) / 180) * radius;
                  const y = Math.sin((angle * Math.PI) / 180) * radius;

                  return (
                    <motion.div
                      key={i}
                      className="absolute top-1/2 left-1/2"
                      style={{ x: -16, y: -16 }}
                      initial={{ x: 0, y: 0, opacity: 0 }}
                      animate={{
                        x: [0, x, x * 0.8],
                        y: [0, y, y * 0.8],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                      }}
                    >
                      <Sparkles className="w-8 h-8 text-green-500" strokeWidth={2} />
                    </motion.div>
                  );
                })}

                {/* Glowing ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-8 border-green-500"
                  animate={{
                    scale: [1, 1.5],
                    opacity: [0.8, 0],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              </div>

              <h2 className="text-4xl font-bold mb-6 text-green-600">결제 완료!</h2>
              <p className="text-2xl text-gray-700">사진을 인쇄합니다...</p>
            </motion.div>
          )}

          {/* Declined */}
          {paymentStatus === PaymentStatus.DECLINED && (
            <motion.div
              key="declined"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <motion.div
                className="mb-12"
                animate={{ x: [-10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <XCircle className="w-32 h-32 text-red-600" strokeWidth={1.5} />
              </motion.div>

              <h2 className="text-4xl font-bold mb-6 text-red-600">결제 거부</h2>
              <p className="text-2xl text-gray-600 mb-12">{message}</p>

              <div className="flex gap-6">
                <Button
                  size="lg"
                  onClick={handleRetry}
                  className="bg-black text-white px-12 py-8 text-2xl font-bold"
                >
                  다시 시도
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCancel}
                  className="border-4 border-black px-12 py-8 text-2xl font-bold"
                >
                  취소
                </Button>
              </div>
            </motion.div>
          )}

          {/* Timeout */}
          {paymentStatus === PaymentStatus.TIMEOUT && (
            <motion.div
              key="timeout"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center"
            >
              <Clock className="w-32 h-32 mb-12 text-orange-600" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold mb-6 text-orange-600">시간 초과</h2>
              <p className="text-2xl text-gray-600">이전 화면으로 돌아갑니다...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Cancel Button (only show when waiting or processing) */}
      {(paymentStatus === PaymentStatus.WAITING ||
        paymentStatus === PaymentStatus.PROCESSING ||
        paymentStatus === PaymentStatus.CARD_INSERTED) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="lg"
            variant="outline"
            onClick={handleCancel}
            className="border-4 border-black px-16 py-8 text-2xl font-bold hover:bg-black hover:text-white"
          >
            취소
          </Button>
        </motion.div>
      )}

      {/* Footer Info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl text-gray-500 text-center"
      >
        {paymentStatus === PaymentStatus.APPROVED
          ? '잠시 후 인쇄가 시작됩니다'
          : paymentStatus === PaymentStatus.WAITING
          ? '미결제 시 30초 후 자동으로 취소됩니다'
          : ''}
      </motion.p>
    </motion.div>
  );
}
