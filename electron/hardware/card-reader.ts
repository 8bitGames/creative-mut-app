/**
 * Card Reader Hardware Integration
 * MUT Hologram Studio - Payment Card Reader Controller
 *
 * This module provides card reader control for payment processing.
 * Supports both TL3600 real hardware and mock mode for testing.
 *
 * Environment Variables:
 * - MOCK_CARD_READER: Set to 'false' to use real hardware
 * - TL3600_PORT: COM port for TL3600 (e.g., 'COM3')
 * - TL3600_TERMINAL_ID: Terminal ID (16 chars, default: '0000000000000000')
 */

import { EventEmitter } from 'events';
import {
  TL3600Controller,
  PaymentResult as TL3600PaymentResult,
  CardEvent,
} from './tl3600';

// =============================================================================
// Types
// =============================================================================

export interface CardReaderConfig {
  mockMode?: boolean;
  readerPort?: string;
  terminalId?: string;
  mockApprovalRate?: number;
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
  cardType?: 'visa' | 'mastercard' | 'amex' | 'unknown' | 'rf' | 'ic' | 'ms';
  cardLast4?: string;
  cardNumber?: string;
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionMedia?: string;
  error?: string;
  rejectCode?: string;
  rejectMessage?: string;
}

export interface CancelOptions {
  approvalNumber: string;
  originalDate: string;
  originalTime: string;
  amount: number;
  transactionType: string;
}

// =============================================================================
// Card Reader Controller
// =============================================================================

export class CardReaderController extends EventEmitter {
  private mockMode: boolean;
  private mockApprovalRate: number;
  private readerPort: string;
  private terminalId: string;
  private isConnected: boolean = false;
  private currentTransaction: string | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  // TL3600 controller (for real hardware mode)
  private tl3600: TL3600Controller | null = null;

  constructor(config: CardReaderConfig = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_CARD_READER !== 'false';
    this.mockApprovalRate = config.mockApprovalRate ?? 0.8;
    this.readerPort = config.readerPort ?? process.env.TL3600_PORT ?? 'COM3';
    this.terminalId = config.terminalId ?? process.env.TL3600_TERMINAL_ID ?? '0000000000000000';

    if (this.mockMode) {
      console.log('💳 Card reader initialized in MOCK mode');
    } else {
      console.log(`💳 Card reader configured for TL3600 on ${this.readerPort}`);
    }
  }

  /**
   * Initialize card reader connection
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.mockMode) {
      return this.mockConnect();
    }

    return this.tl3600Connect();
  }

  /**
   * Connect to TL3600 hardware
   */
  private async tl3600Connect(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔌 [CardReader] Connecting to TL3600 on ${this.readerPort}...`);

      this.tl3600 = new TL3600Controller({
        port: this.readerPort,
        terminalId: this.terminalId,
      });

      // Set up event handlers
      this.setupTL3600Events();

      // Connect
      const result = await this.tl3600.connect();

      if (!result.success) {
        console.error('❌ [CardReader] TL3600 connection failed:', result.error);
        return { success: false, error: result.error };
      }

      this.isConnected = true;
      console.log('✅ [CardReader] TL3600 connected successfully');
      this.emit('connected', { model: 'TL3600/TL3500BP' });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [CardReader] TL3600 connection error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Set up TL3600 event handlers
   */
  private setupTL3600Events(): void {
    if (!this.tl3600) return;

    this.tl3600.on('cardDetected', (event: CardEvent) => {
      console.log(`💳 [CardReader] Card detected: ${event.type}`);
      this.emit('status', {
        status: PaymentStatus.CARD_INSERTED,
        message: '카드가 감지되었습니다',
        cardType: event.type,
      });
    });

    this.tl3600.on('cardRemoved', () => {
      console.log('💳 [CardReader] Card removed');
      this.emit('cardRemoved');
    });

    this.tl3600.on('processingPayment', () => {
      console.log('💳 [CardReader] Processing payment...');
      this.emit('status', {
        status: PaymentStatus.PROCESSING,
        message: '결제 처리 중...',
      });
    });

    this.tl3600.on('paymentApproved', (result: TL3600PaymentResult) => {
      console.log('✅ [CardReader] Payment approved');
      const paymentResult = this.convertTL3600Result(result, true);
      this.emit('status', {
        status: PaymentStatus.APPROVED,
        message: '결제가 완료되었습니다!',
      });
      this.emit('paymentComplete', paymentResult);
    });

    this.tl3600.on('paymentRejected', (result: TL3600PaymentResult) => {
      console.log('❌ [CardReader] Payment rejected:', result.error);
      const paymentResult = this.convertTL3600Result(result, false);
      this.emit('status', {
        status: PaymentStatus.DECLINED,
        message: result.rejectMessage || result.error || '결제가 거부되었습니다',
      });
      this.emit('paymentComplete', paymentResult);
    });

    this.tl3600.on('error', (error: Error) => {
      console.error('❌ [CardReader] TL3600 error:', error.message);
      this.emit('error', error);
    });

    this.tl3600.on('disconnected', () => {
      console.log('🔌 [CardReader] TL3600 disconnected');
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  /**
   * Convert TL3600 result to PaymentResult format
   */
  private convertTL3600Result(result: TL3600PaymentResult, success: boolean): PaymentResult {
    let cardType: PaymentResult['cardType'] = 'unknown';
    if (result.transactionMedia) {
      switch (result.transactionMedia) {
        case '1': cardType = 'ic'; break;
        case '2': cardType = 'ms'; break;
        case '3': cardType = 'rf'; break;
      }
    }

    // Extract last 4 digits from masked card number
    const cardLast4 = result.cardNumber
      ? result.cardNumber.replace(/\D/g, '').slice(-4)
      : undefined;

    return {
      success,
      status: success ? PaymentStatus.APPROVED : PaymentStatus.DECLINED,
      transactionId: result.transactionId,
      amount: result.approvedAmount,
      timestamp: new Date().toISOString(),
      cardType,
      cardLast4,
      cardNumber: result.cardNumber,
      approvalNumber: result.approvalNumber,
      salesDate: result.salesDate,
      salesTime: result.salesTime,
      transactionMedia: result.transactionMedia,
      error: result.error,
      rejectCode: result.rejectCode,
      rejectMessage: result.rejectMessage,
    };
  }

  /**
   * Disconnect card reader
   */
  async disconnect(): Promise<void> {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.tl3600) {
      await this.tl3600.disconnect();
      this.tl3600 = null;
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

    return this.tl3600ProcessPayment(options);
  }

  /**
   * Process payment using TL3600
   */
  private async tl3600ProcessPayment(options: PaymentOptions): Promise<PaymentResult> {
    if (!this.tl3600) {
      return {
        success: false,
        status: PaymentStatus.ERROR,
        error: 'TL3600 not initialized',
      };
    }

    console.log(`💳 [CardReader] Starting TL3600 payment: ${options.amount}원`);

    this.emit('status', {
      status: PaymentStatus.WAITING,
      message: `카드를 삽입해주세요\n금액: ${options.amount.toLocaleString()}원`,
    });

    // Enter payment mode (terminal will emit events when card is detected)
    const success = await this.tl3600.enterPaymentMode({
      amount: options.amount,
    });

    if (!success) {
      return {
        success: false,
        status: PaymentStatus.ERROR,
        error: 'Failed to enter payment mode',
      };
    }

    // The actual result will come through events (paymentApproved/paymentRejected)
    // Return a pending result - the caller should listen for events
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners('paymentComplete');
        resolve({
          success: false,
          status: PaymentStatus.TIMEOUT,
          error: '결제 시간이 초과되었습니다',
        });
      }, 30000);

      this.once('paymentComplete', (result: PaymentResult) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }

  /**
   * Cancel a previous transaction
   */
  async cancelTransaction(options: CancelOptions): Promise<PaymentResult> {
    if (this.mockMode) {
      console.log('💳 [CardReader] Mock cancel - always succeeds');
      return {
        success: true,
        status: PaymentStatus.APPROVED,
        transactionId: `CANCEL_${Date.now()}`,
        amount: options.amount,
        timestamp: new Date().toISOString(),
      };
    }

    if (!this.tl3600) {
      return {
        success: false,
        status: PaymentStatus.ERROR,
        error: 'TL3600 not initialized',
      };
    }

    console.log(`🚫 [CardReader] Cancelling transaction: ${options.approvalNumber}`);

    const result = await this.tl3600.requestCancel({
      approvalNumber: options.approvalNumber,
      originalDate: options.originalDate,
      originalTime: options.originalTime,
      amount: options.amount,
      transactionType: options.transactionType,
    });

    if (result.success) {
      return {
        success: true,
        status: PaymentStatus.APPROVED,
        transactionId: result.response?.transactionId,
        amount: options.amount,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      status: PaymentStatus.ERROR,
      error: result.error || 'Cancellation failed',
    };
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
  getStatus(): { connected: boolean; mode: 'mock' | 'tl3600' } {
    return {
      connected: this.isConnected,
      mode: this.mockMode ? 'mock' : 'tl3600',
    };
  }

  /**
   * Get available COM ports (for configuration)
   */
  static async listPorts(): Promise<{ path: string; manufacturer?: string }[]> {
    return TL3600Controller.listPorts();
  }

  // ===========================================================================
  // Mock Mode Methods
  // ===========================================================================

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
        approvalNumber: Math.random().toString(36).substr(2, 8).toUpperCase(),
        salesDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        salesTime: new Date().toTimeString().slice(0, 8).replace(/:/g, ''),
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
