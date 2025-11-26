/**
 * TL3600/TL3500BP Payment Terminal Module
 *
 * This module provides integration with TL3600/TL3500BP payment terminals
 * using serial communication protocol (V10.1).
 *
 * @example
 * ```typescript
 * import { TL3600Controller } from './tl3600';
 *
 * const controller = new TL3600Controller({
 *   port: 'COM3',
 *   terminalId: '0000000000000000',
 * });
 *
 * // Connect and check device
 * const result = await controller.connect();
 * if (result.success) {
 *   // Enter payment mode
 *   await controller.enterPaymentMode({ amount: 5000 });
 *
 *   // Listen for card events
 *   controller.on('cardDetected', (event) => {
 *     console.log('Card detected:', event.type);
 *   });
 *
 *   controller.on('paymentApproved', (result) => {
 *     console.log('Payment approved:', result.approvalNumber);
 *   });
 * }
 * ```
 */

// Main Controller
export { TL3600Controller } from './controller';
export type {
  TL3600Config,
  ConnectionResult,
  PaymentRequest,
  PaymentResult,
  CancelRequest,
  CancelResult,
  CardEventType,
  CardEvent,
} from './controller';

// Serial Communication
export { TL3600Serial, listSerialPorts } from './serial';
export type { SerialConfig, SendResult } from './serial';

// Packet Builder/Parser
export {
  buildPacket,
  buildApprovalRequestData,
  buildCancelRequestData,
  parsePacket,
  parseDeviceCheckResponse,
  parseEventResponse,
  parseApprovalResponse,
  parseCardInquiryResponse,
  formatDateTime,
  formatAmount,
  calculateBCC,
} from './packet';
export type {
  PacketHeader,
  ParsedPacket,
  DeviceCheckResponse,
  EventResponse,
  ApprovalResponse,
  CardInquiryResponse,
} from './packet';

// Constants and Types
export {
  STX,
  ETX,
  ACK,
  NACK,
  HEADER_SIZE,
  TAIL_SIZE,
  OFFSET,
  JobCode,
  EventType,
  TransactionType,
  TransactionResponseType,
  TransactionMedia,
  CancelType,
  PrepaidCardType,
  DeviceStatus,
  SignatureRequired,
  PAYMENT_DEFAULTS,
  SERIAL_CONFIG,
  TIMEOUT,
  ERROR_CODES,
  FIELD_SIZE,
  RESPONSE_LENGTH,
} from './constants';
