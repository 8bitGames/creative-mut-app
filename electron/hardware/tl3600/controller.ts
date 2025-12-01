/**
 * TL3600/TL3500BP Controller
 * High-level business logic for payment terminal operations
 */

import { EventEmitter } from 'events';
import { TL3600Serial, listSerialPorts } from './serial';
import {
  JobCode,
  EventType,
  TransactionType,
  CancelType,
  DeviceStatus,
  PAYMENT_DEFAULTS,
  SignatureRequired,
} from './constants';
import {
  buildPacket,
  buildApprovalRequestData,
  buildCancelRequestData,
  parseDeviceCheckResponse,
  parseEventResponse,
  parseApprovalResponse,
  parseCardInquiryResponse,
  ParsedPacket,
  ApprovalResponse,
  DeviceCheckResponse,
  CardInquiryResponse,
} from './packet';

// =============================================================================
// Types
// =============================================================================

export interface TL3600Config {
  port: string;
  terminalId: string;
  baudRate?: number;
}

export interface ConnectionResult {
  success: boolean;
  error?: string;
  deviceStatus?: DeviceCheckResponse;
}

export interface PaymentRequest {
  amount?: number;  // Default: 5000
  tax?: number;
  serviceCharge?: number;
  installment?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionType?: string;
  cardNumber?: string;
  approvedAmount?: number;
  approvalNumber?: string;
  salesDate?: string;
  salesTime?: string;
  transactionId?: string;
  transactionMedia?: string;
  error?: string;
  rejectCode?: string;
  rejectMessage?: string;
}

export interface CancelRequest {
  approvalNumber: string;
  originalDate: string;      // YYYYMMDD
  originalTime: string;      // hhmmss or transaction serial (last 6 digits)
  amount: number;
  transactionType: string;   // '1' IC, '2' RF/MS
}

export interface CancelResult {
  success: boolean;
  error?: string;
  response?: ApprovalResponse;
}

export type CardEventType = 'ms' | 'rf' | 'ic' | 'barcode';

export interface CardEvent {
  type: CardEventType;
  timestamp: number;
}

// =============================================================================
// TL3600 Controller Class
// =============================================================================

export class TL3600Controller extends EventEmitter {
  private serial: TL3600Serial;
  private terminalId: string;
  private isConnected: boolean = false;
  private isInPaymentMode: boolean = false;
  private currentPaymentRequest: PaymentRequest | null = null;

  constructor(config: TL3600Config) {
    super();
    this.terminalId = config.terminalId;
    this.serial = new TL3600Serial({
      port: config.port,
      baudRate: config.baudRate,
    });

    // Forward serial events
    this.serial.on('error', (error) => this.emit('error', error));
    this.serial.on('disconnected', () => {
      this.isConnected = false;
      this.isInPaymentMode = false;
      this.emit('disconnected');
    });

    // Handle card events
    this.serial.on('event', (packet: ParsedPacket) => {
      this.handleEvent(packet);
    });
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to payment terminal and check device status
   */
  async connect(): Promise<ConnectionResult> {
    console.log(`🔌 [TL3600] Connecting to terminal...`);

    // Connect serial port
    const connectResult = await this.serial.connect();
    if (!connectResult.success) {
      return { success: false, error: connectResult.error };
    }

    // Check device status
    const deviceStatus = await this.checkDevice();
    if (!deviceStatus) {
      await this.serial.disconnect();
      return { success: false, error: 'Device check failed' };
    }

    // Verify RF module is OK
    if (deviceStatus.rfModuleStatus !== DeviceStatus.OK) {
      console.warn(`⚠️ [TL3600] RF module status: ${deviceStatus.rfModuleStatus}`);
    }

    this.isConnected = true;
    console.log(`✅ [TL3600] Connected successfully`);
    console.log(`   Card Module: ${deviceStatus.cardModuleStatus}`);
    console.log(`   RF Module: ${deviceStatus.rfModuleStatus}`);
    console.log(`   VAN Server: ${deviceStatus.vanServerStatus}`);

    return { success: true, deviceStatus };
  }

  /**
   * Disconnect from terminal
   */
  async disconnect(): Promise<void> {
    console.log(`🔌 [TL3600] Disconnecting...`);
    this.isConnected = false;
    this.isInPaymentMode = false;
    await this.serial.disconnect();
  }

  /**
   * Check if connected
   */
  isTerminalConnected(): boolean {
    return this.isConnected && this.serial.isPortConnected();
  }

  // ===========================================================================
  // Device Operations
  // ===========================================================================

  /**
   * Check device status (Job Code: A)
   */
  async checkDevice(): Promise<DeviceCheckResponse | null> {
    console.log(`🔍 [TL3600] Checking device status...`);

    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.DEVICE_CHECK,
    });

    const result = await this.serial.sendPacket(packet);

    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Device check failed:`, result.error);
      return null;
    }

    if (result.response.header.jobCode !== JobCode.DEVICE_CHECK_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return null;
    }

    return parseDeviceCheckResponse(result.response.data);
  }

  // ===========================================================================
  // Payment Operations
  // ===========================================================================

  /**
   * Enter payment standby mode (Job Code: E)
   * Terminal will wait for card input and emit events
   */
  async enterPaymentMode(request?: PaymentRequest): Promise<boolean> {
    if (!this.isConnected) {
      console.error(`❌ [TL3600] Not connected`);
      return false;
    }

    console.log(`💳 [TL3600] Entering payment standby mode...`);

    this.currentPaymentRequest = request || {};

    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.PAYMENT_STANDBY,
    });

    const result = await this.serial.sendPacket(packet);

    if (!result.success) {
      console.error(`❌ [TL3600] Failed to enter payment mode:`, result.error);
      return false;
    }

    this.isInPaymentMode = true;
    this.emit('paymentModeEntered');
    console.log(`✅ [TL3600] Payment standby mode active`);

    return true;
  }

  /**
   * Request transaction approval (Job Code: B)
   * Called internally when card is detected
   */
  async requestApproval(request?: PaymentRequest): Promise<PaymentResult> {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    const amount = request?.amount ?? PAYMENT_DEFAULTS.AMOUNT;
    const tax = request?.tax ?? PAYMENT_DEFAULTS.TAX;
    const serviceCharge = request?.serviceCharge ?? PAYMENT_DEFAULTS.SERVICE_CHARGE;
    const installment = request?.installment ?? PAYMENT_DEFAULTS.INSTALLMENT;

    console.log(`💳 [TL3600] Requesting approval for ${amount}원...`);

    const data = buildApprovalRequestData(
      TransactionType.APPROVAL,
      amount,
      tax,
      serviceCharge,
      installment,
      SignatureRequired.NO
    );

    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.TRANSACTION_APPROVAL,
      data,
    });

    const result = await this.serial.sendPacket(packet);

    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Approval request failed:`, result.error);
      return { success: false, error: result.error || 'Request failed' };
    }

    if (result.response.header.jobCode !== JobCode.TRANSACTION_APPROVAL_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return { success: false, error: 'Unexpected response' };
    }

    const response = parseApprovalResponse(result.response.data);

    if (response.isRejected) {
      console.error(`❌ [TL3600] Transaction rejected: ${response.rejectMessage}`);
      return {
        success: false,
        error: response.rejectMessage || 'Transaction rejected',
        rejectCode: response.rejectCode,
        rejectMessage: response.rejectMessage,
      };
    }

    console.log(`✅ [TL3600] Transaction approved!`);
    console.log(`   Approval Number: ${response.approvalNumber}`);
    console.log(`   Amount: ${response.approvedAmount}원`);
    console.log(`   Card: ${response.cardNumber}`);

    return {
      success: true,
      transactionType: response.transactionType,
      cardNumber: response.cardNumber,
      approvedAmount: response.approvedAmount,
      approvalNumber: response.approvalNumber,
      salesDate: response.salesDate,
      salesTime: response.salesTime,
      transactionId: response.transactionId,
      transactionMedia: response.transactionMedia,
    };
  }

  /**
   * Request transaction cancel (Job Code: C)
   * For dashboard manual cancellation
   */
  async requestCancel(request: CancelRequest): Promise<CancelResult> {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    console.log(`🚫 [TL3600] Requesting cancellation...`);
    console.log(`   Original Approval: ${request.approvalNumber}`);
    console.log(`   Original Date: ${request.originalDate}`);
    console.log(`   Amount: ${request.amount}원`);

    const data = buildCancelRequestData(
      CancelType.VAN_NO_CARD,           // 무카드 취소
      request.transactionType,           // '1' IC or '2' RF/MS
      request.amount,
      PAYMENT_DEFAULTS.TAX,
      PAYMENT_DEFAULTS.SERVICE_CHARGE,
      PAYMENT_DEFAULTS.INSTALLMENT,
      SignatureRequired.NO,
      request.approvalNumber,
      request.originalDate,
      request.originalTime
    );

    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.TRANSACTION_CANCEL,
      data,
    });

    const result = await this.serial.sendPacket(packet);

    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Cancel request failed:`, result.error);
      return { success: false, error: result.error || 'Request failed' };
    }

    // Handle card inquiry response (d) when no transaction history or already cancelled
    if (result.response.header.jobCode === JobCode.CARD_INQUIRY_RESPONSE) {
      console.error(`❌ [TL3600] Card inquiry response received - no cancellable transaction`);
      const cardInfo = parseCardInquiryResponse(result.response.data);
      if (cardInfo.transactionStatus === '0') {
        return { success: false, error: '취소 가능한 거래 내역이 없습니다' };
      } else if (cardInfo.transactionStatus === 'X') {
        return { success: false, error: '이미 취소된 거래입니다' };
      }
      return { success: false, error: '취소할 수 없는 카드입니다' };
    }

    if (result.response.header.jobCode !== JobCode.TRANSACTION_CANCEL_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return { success: false, error: 'Unexpected response' };
    }

    const response = parseApprovalResponse(result.response.data);

    if (response.isRejected) {
      console.error(`❌ [TL3600] Cancellation rejected: ${response.rejectMessage}`);
      return {
        success: false,
        error: response.rejectMessage || 'Cancellation rejected',
      };
    }

    console.log(`✅ [TL3600] Cancellation successful!`);

    return { success: true, response };
  }

  /**
   * Inquire card information (Job Code: D)
   */
  async inquireCard(): Promise<CardInquiryResponse | null> {
    if (!this.isConnected) {
      return null;
    }

    console.log(`🔍 [TL3600] Inquiring card...`);

    const packet = buildPacket({
      terminalId: this.terminalId,
      jobCode: JobCode.CARD_INQUIRY,
    });

    const result = await this.serial.sendPacket(packet);

    if (!result.success || !result.response) {
      console.error(`❌ [TL3600] Card inquiry failed:`, result.error);
      return null;
    }

    if (result.response.header.jobCode !== JobCode.CARD_INQUIRY_RESPONSE) {
      console.error(`❌ [TL3600] Unexpected response: ${result.response.header.jobCode}`);
      return null;
    }

    return parseCardInquiryResponse(result.response.data);
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Handle incoming event from terminal
   */
  private async handleEvent(packet: ParsedPacket): Promise<void> {
    const event = parseEventResponse(packet.data);
    console.log(`📨 [TL3600] Event received: ${event.eventType}`);

    let cardEventType: CardEventType;

    switch (event.eventType) {
      case EventType.MS_CARD:
        cardEventType = 'ms';
        console.log(`💳 [TL3600] MS card detected`);
        break;

      case EventType.RF_CARD:
        cardEventType = 'rf';
        console.log(`💳 [TL3600] RF card detected`);
        break;

      case EventType.IC_CARD:
        cardEventType = 'ic';
        console.log(`💳 [TL3600] IC card inserted`);
        break;

      case EventType.IC_CARD_REMOVED:
        console.log(`💳 [TL3600] IC card removed`);
        this.emit('cardRemoved');
        return;

      case EventType.IC_FALLBACK:
        cardEventType = 'ms';  // Fallback to MS
        console.log(`💳 [TL3600] IC fallback, treating as MS`);
        break;

      case EventType.BARCODE:
        cardEventType = 'barcode';
        console.log(`📊 [TL3600] Barcode detected`);
        break;

      default:
        console.warn(`⚠️ [TL3600] Unknown event type: ${event.eventType}`);
        return;
    }

    // Emit card detected event
    const cardEvent: CardEvent = {
      type: cardEventType,
      timestamp: Date.now(),
    };
    this.emit('cardDetected', cardEvent);

    // If in payment mode, automatically request approval
    if (this.isInPaymentMode) {
      this.isInPaymentMode = false;  // Exit payment mode

      this.emit('processingPayment');

      const result = await this.requestApproval(this.currentPaymentRequest || undefined);

      if (result.success) {
        this.emit('paymentApproved', result);
      } else {
        this.emit('paymentRejected', result);
      }

      this.currentPaymentRequest = null;
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get available COM ports
   */
  static async listPorts(): Promise<{ path: string; manufacturer?: string }[]> {
    return listSerialPorts();
  }

  /**
   * Get current status
   */
  getStatus(): {
    connected: boolean;
    inPaymentMode: boolean;
    terminalId: string;
  } {
    return {
      connected: this.isConnected,
      inPaymentMode: this.isInPaymentMode,
      terminalId: this.terminalId,
    };
  }
}
