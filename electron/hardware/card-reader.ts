/**
 * Card Reader Hardware Integration
 * MUT Hologram Studio - Payment Card Reader Controller
 *
 * This module provides card reader control for payment processing.
 * For testing without hardware, set MOCK_CARD_READER=true.
 *
 * This is a DUMMY implementation for testing purposes.
 * Replace with actual card reader SDK when hardware is available.
 */

import { EventEmitter } from 'events';

export interface CardReaderConfig {
  mockMode?: boolean;
  readerPort?: string;
  mockApprovalRate?: number; // 0-1, chance of approval in mock mode
}

export interface PaymentOptions {
  amount: number;
  currency?: string;
  description?: string;
}

export enum PaymentStatus {
  WAITING = 'waiting',
  CARD_INSERTED = 'card_inserted',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  DECLINED = 'declined',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface PaymentResult {
  success: boolean;
  status: PaymentStatus;
  transactionId?: string;
  amount?: number;
  timestamp?: string;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'unknown';
  cardLast4?: string;
  error?: string;
}

export class CardReaderController extends EventEmitter {
  private mockMode: boolean;
  private mockApprovalRate: number;
  private readerPort: string;
  private isConnected: boolean = false;
  private currentTransaction: string | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(config: CardReaderConfig = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_CARD_READER !== 'false'; // Default to mock
    this.mockApprovalRate = config.mockApprovalRate ?? 0.8; // 80% approval rate by default
    this.readerPort = config.readerPort ?? 'COM1'; // Stored for future real implementation

    // Log configuration in non-mock mode
    if (!this.mockMode) {
      console.log(`Card reader configured on port: ${this.readerPort}`);
    }
  }

  /**
   * Initialize card reader connection
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.mockMode) {
      return this.mockConnect();
    }

    try {
      // TODO: Replace with actual card reader SDK initialization
      // Example:
      // await cardReaderSDK.connect(this.readerPort);
      // this.isConnected = true;

      throw new Error('Real card reader not implemented. Set MOCK_CARD_READER=true for testing.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Card reader connection failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Disconnect card reader
   */
  async disconnect(): Promise<void> {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.isConnected = false;
    this.currentTransaction = null;
    this.emit('disconnected');

    console.log('💳 Card reader disconnected');
  }

  /**
   * Process a payment
   */
  async processPayment(options: PaymentOptions): Promise<PaymentResult> {
    if (!this.isConnected && !this.mockMode) {
      return {
        success: false,
        status: PaymentStatus.ERROR,
        error: 'Card reader not connected',
      };
    }

    if (this.mockMode) {
      return this.mockProcessPayment(options);
    }

    try {
      // TODO: Replace with actual card reader SDK payment processing
      // Example:
      // const result = await cardReaderSDK.processPayment(options);
      // return this.formatPaymentResult(result);

      throw new Error('Real card reader not implemented. Set MOCK_CARD_READER=true for testing.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Payment processing failed:', errorMessage);

      return {
        success: false,
        status: PaymentStatus.ERROR,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel current payment
   */
  async cancelPayment(): Promise<{ success: boolean }> {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.currentTransaction = null;

    this.emit('status', {
      status: PaymentStatus.CANCELLED,
      message: '결제가 취소되었습니다',
    });

    console.log('💳 Payment cancelled');

    return { success: true };
  }

  /**
   * Get reader status
   */
  getStatus(): { connected: boolean } {
    return {
      connected: this.isConnected,
    };
  }

  /**
   * Mock mode: Simulate card reader connection
   */
  private async mockConnect(): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isConnected = true;

    console.log('✅ Mock card reader connected (Dummy Mode)');
    console.log(`   - Approval rate: ${(this.mockApprovalRate * 100).toFixed(0)}%`);

    this.emit('connected', { model: 'Mock Card Reader (Test Device)' });

    return { success: true };
  }

  /**
   * Mock mode: Simulate payment processing
   */
  private async mockProcessPayment(options: PaymentOptions): Promise<PaymentResult> {
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    this.currentTransaction = transactionId;

    console.log('💳 Starting mock payment:', transactionId);
    console.log(`   Amount: ${options.amount.toLocaleString()} ${options.currency || 'KRW'}`);

    // Emit: Waiting for card
    this.emit('status', {
      status: PaymentStatus.WAITING,
      message: `카드를 삽입해주세요\n금액: ${options.amount.toLocaleString()}원`,
    });

    // Simulate 30-second timeout
    this.timeoutTimer = setTimeout(() => {
      if (this.currentTransaction === transactionId) {
        this.emit('status', {
          status: PaymentStatus.TIMEOUT,
          message: '시간이 초과되었습니다',
        });

        this.currentTransaction = null;
      }
    }, 30000);

    // Simulate card insertion delay (2-4 seconds)
    const insertDelay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, insertDelay));

    if (this.currentTransaction !== transactionId) {
      // Payment was cancelled
      return {
        success: false,
        status: PaymentStatus.CANCELLED,
        error: 'Payment cancelled',
      };
    }

    // Emit: Card inserted
    this.emit('status', {
      status: PaymentStatus.CARD_INSERTED,
      message: '카드가 감지되었습니다',
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    // Emit: Processing
    this.emit('status', {
      status: PaymentStatus.PROCESSING,
      message: '결제 처리 중...',
    });

    // Simulate processing delay (1-2 seconds)
    const processingDelay = 1000 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // Clear timeout
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    // Determine approval/decline based on mock approval rate
    const isApproved = Math.random() < this.mockApprovalRate;

    if (isApproved) {
      // Generate mock card details
      const cardTypes: Array<'visa' | 'mastercard' | 'amex'> = ['visa', 'mastercard', 'amex'];
      const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
      const cardLast4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

      const result: PaymentResult = {
        success: true,
        status: PaymentStatus.APPROVED,
        transactionId,
        amount: options.amount,
        timestamp: new Date().toISOString(),
        cardType,
        cardLast4,
      };

      this.emit('status', {
        status: PaymentStatus.APPROVED,
        message: '결제가 완료되었습니다!',
      });

      console.log('✅ Mock payment approved:', transactionId);
      console.log(`   Card: ${cardType.toUpperCase()} ****${cardLast4}`);

      this.currentTransaction = null;

      return result;
    } else {
      // Simulate decline reasons
      const declineReasons = [
        '잔액 부족',
        '카드 승인 거부',
        '한도 초과',
        '카드 정보 오류',
      ];
      const declineReason = declineReasons[Math.floor(Math.random() * declineReasons.length)];

      const result: PaymentResult = {
        success: false,
        status: PaymentStatus.DECLINED,
        transactionId,
        error: declineReason,
      };

      this.emit('status', {
        status: PaymentStatus.DECLINED,
        message: `결제가 거부되었습니다\n사유: ${declineReason}`,
      });

      console.log('❌ Mock payment declined:', transactionId);
      console.log(`   Reason: ${declineReason}`);

      this.currentTransaction = null;

      return result;
    }
  }
}

/**
 * Create a card reader instance with configuration
 */
export function createCardReader(config?: CardReaderConfig): CardReaderController {
  return new CardReaderController(config);
}
