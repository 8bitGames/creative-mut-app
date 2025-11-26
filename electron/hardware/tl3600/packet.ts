/**
 * TL3600/TL3500BP Packet Builder and Parser
 * Handles packet construction and parsing for serial communication
 */

import {
  STX,
  ETX,
  HEADER_SIZE,
  OFFSET,
  JobCode,
  EventType,
  TransactionResponseType,
  TransactionMedia,
  DeviceStatus,
  FIELD_SIZE,
  ERROR_CODES,
} from './constants';

// =============================================================================
// Types
// =============================================================================

export interface PacketHeader {
  terminalId: string;
  dateTime: string;
  jobCode: string;
  responseCode: number;
  dataLength: number;
}

export interface ParsedPacket {
  header: PacketHeader;
  data: Buffer;
  bcc: number;
  isValid: boolean;
}

// Response Types
export interface DeviceCheckResponse {
  cardModuleStatus: DeviceStatus;
  rfModuleStatus: DeviceStatus;
  vanServerStatus: DeviceStatus;
  linkServerStatus: DeviceStatus;
}

export interface EventResponse {
  eventType: EventType;
}

export interface ApprovalResponse {
  transactionType: TransactionResponseType;
  transactionMedia: TransactionMedia;
  cardNumber: string;
  approvedAmount: number;
  tax: number;
  serviceCharge: number;
  installment: string;
  approvalNumber: string;
  salesDate: string;
  salesTime: string;
  transactionId: string;
  merchantId: string;
  terminalNumber: string;
  issuerCode: string;
  issuerName: string;
  acquirerCode: string;
  acquirerName: string;
  // Rejection info
  isRejected: boolean;
  rejectCode?: string;
  rejectMessage?: string;
}

export interface CardInquiryResponse {
  transactionMedia: TransactionMedia;
  cardType: string;
  cardNumber: string;
  lastTransactionDateTime: string;
  lastTransactionAmount: number;
  cardBalance: number;
  transactionStatus: '0' | 'O' | 'X'; // 0: 없음, O: 마지막 거래, X: 마지막 취소
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format current date/time as YYYYMMDDhhmmss
 */
export function formatDateTime(date: Date = new Date()): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Format number as right-aligned string with leading zeros
 */
export function formatAmount(amount: number, length: number): string {
  return amount.toString().padStart(length, '0');
}

/**
 * Pad string to specified length (left-aligned, padded with 0x00 or space)
 */
export function padString(str: string, length: number, padChar: number = 0x00): Buffer {
  const buf = Buffer.alloc(length, padChar);
  const strBuf = Buffer.from(str, 'ascii');
  strBuf.copy(buf, 0, 0, Math.min(strBuf.length, length));
  return buf;
}

/**
 * Calculate BCC (XOR of all bytes from STX to ETX inclusive)
 */
export function calculateBCC(data: Buffer): number {
  let bcc = 0;
  for (let i = 0; i < data.length; i++) {
    bcc ^= data[i];
  }
  return bcc;
}

/**
 * Extract trimmed string from buffer, removing null bytes and trailing spaces
 */
export function extractString(buf: Buffer, start: number, length: number): string {
  const slice = buf.slice(start, start + length);
  // Remove null bytes and trim spaces
  return slice.toString('ascii').replace(/\x00/g, '').trim();
}

/**
 * Extract number from buffer (ASCII digits)
 */
export function extractNumber(buf: Buffer, start: number, length: number): number {
  const str = extractString(buf, start, length);
  return parseInt(str, 10) || 0;
}

// =============================================================================
// Packet Builder
// =============================================================================

export interface BuildPacketOptions {
  terminalId: string;
  jobCode: JobCode;
  data?: Buffer;
}

/**
 * Build a complete packet with header, data, and tail
 */
export function buildPacket(options: BuildPacketOptions): Buffer {
  const { terminalId, jobCode, data = Buffer.alloc(0) } = options;
  const dataLength = data.length;

  // Allocate buffer: Header(35) + Data(N) + ETX(1) + BCC(1)
  const packetLength = HEADER_SIZE + dataLength + 2;
  const packet = Buffer.alloc(packetLength);

  let offset = 0;

  // STX (1 byte)
  packet.writeUInt8(STX, offset);
  offset += 1;

  // Terminal ID (16 bytes, left-aligned, padded with 0x00)
  const terminalIdBuf = padString(terminalId, FIELD_SIZE.TERMINAL_ID);
  terminalIdBuf.copy(packet, offset);
  offset += FIELD_SIZE.TERMINAL_ID;

  // DateTime (14 bytes, YYYYMMDDhhmmss)
  const dateTimeBuf = Buffer.from(formatDateTime(), 'ascii');
  dateTimeBuf.copy(packet, offset);
  offset += FIELD_SIZE.DATE_TIME;

  // Job Code (1 byte)
  packet.write(jobCode, offset, 1, 'ascii');
  offset += 1;

  // Response Code (1 byte, unused - 0x00)
  packet.writeUInt8(0x00, offset);
  offset += 1;

  // Data Length (2 bytes, Little Endian USHORT)
  packet.writeUInt16LE(dataLength, offset);
  offset += 2;

  // Data (N bytes)
  if (dataLength > 0) {
    data.copy(packet, offset);
    offset += dataLength;
  }

  // ETX (1 byte)
  packet.writeUInt8(ETX, offset);
  offset += 1;

  // BCC (1 byte) - XOR from STX to ETX
  const bcc = calculateBCC(packet.slice(0, offset));
  packet.writeUInt8(bcc, offset);

  return packet;
}

// =============================================================================
// Request Data Builders
// =============================================================================

/**
 * Build Transaction Approval Request Data (Job Code: B)
 * Total: 30 bytes
 */
export function buildApprovalRequestData(
  transactionType: string,
  amount: number,
  tax: number = 0,
  serviceCharge: number = 0,
  installment: string = '00',
  signature: string = '1'
): Buffer {
  const data = Buffer.alloc(30);
  let offset = 0;

  // 거래구분코드 (1 byte): "1" 승인, "7" 무료주차, "M" 장치가맹점
  data.write(transactionType, offset, 1, 'ascii');
  offset += 1;

  // 승인금액 (10 bytes): 우측 정렬, 좌측 "0" 채움
  data.write(formatAmount(amount, 10), offset, 10, 'ascii');
  offset += 10;

  // 세금 (8 bytes)
  data.write(formatAmount(tax, 8), offset, 8, 'ascii');
  offset += 8;

  // 봉사료 (8 bytes)
  data.write(formatAmount(serviceCharge, 8), offset, 8, 'ascii');
  offset += 8;

  // 할부개월 (2 bytes): "00" ~ "12"
  data.write(installment.padStart(2, '0'), offset, 2, 'ascii');
  offset += 2;

  // 서명여부 (1 byte): "1" 비서명, "2" 서명
  data.write(signature, offset, 1, 'ascii');

  return data;
}

/**
 * Build Transaction Cancel Request Data (Job Code: C)
 * For VAN No-Card Cancel (취소구분코드 "3")
 */
export function buildCancelRequestData(
  cancelType: string,
  transactionType: string,
  amount: number,
  tax: number,
  serviceCharge: number,
  installment: string,
  signature: string,
  approvalNumber: string,
  originalDate: string,
  originalTime: string
): Buffer {
  // Base: 57 bytes (without additional info)
  const data = Buffer.alloc(59); // 57 + 2 for length field
  let offset = 0;

  // 취소구분코드 (1 byte)
  data.write(cancelType, offset, 1, 'ascii');
  offset += 1;

  // 거래구분코드 (1 byte): "1" IC신용, "2" RF/MS신용
  data.write(transactionType, offset, 1, 'ascii');
  offset += 1;

  // 승인금액 (10 bytes)
  data.write(formatAmount(amount, 10), offset, 10, 'ascii');
  offset += 10;

  // 세금 (8 bytes)
  data.write(formatAmount(tax, 8), offset, 8, 'ascii');
  offset += 8;

  // 봉사료 (8 bytes)
  data.write(formatAmount(serviceCharge, 8), offset, 8, 'ascii');
  offset += 8;

  // 할부개월 (2 bytes)
  data.write(installment.padStart(2, '0'), offset, 2, 'ascii');
  offset += 2;

  // 서명여부 (1 byte)
  data.write(signature, offset, 1, 'ascii');
  offset += 1;

  // 승인번호 (12 bytes, left-aligned, space padded)
  const approvalBuf = Buffer.alloc(12, 0x20); // space
  Buffer.from(approvalNumber, 'ascii').copy(approvalBuf);
  approvalBuf.copy(data, offset);
  offset += 12;

  // 원거래일자 (8 bytes, YYYYMMDD)
  data.write(originalDate.padEnd(8, '0'), offset, 8, 'ascii');
  offset += 8;

  // 원거래시간 (6 bytes, hhmmss or transaction serial number last 6 digits for no-card cancel)
  data.write(originalTime.padEnd(6, '0'), offset, 6, 'ascii');
  offset += 6;

  // 부가정보 길이 (2 bytes): "00" for no additional info
  data.write('00', offset, 2, 'ascii');

  return data;
}

// =============================================================================
// Packet Parser
// =============================================================================

/**
 * Parse raw packet buffer into structured data
 */
export function parsePacket(buffer: Buffer): ParsedPacket | null {
  if (buffer.length < HEADER_SIZE + 2) {
    console.error('Packet too short:', buffer.length);
    return null;
  }

  // Verify STX
  if (buffer[0] !== STX) {
    console.error('Invalid STX:', buffer[0]);
    return null;
  }

  // Parse header
  const terminalId = extractString(buffer, OFFSET.TERMINAL_ID, FIELD_SIZE.TERMINAL_ID);
  const dateTime = extractString(buffer, OFFSET.DATE_TIME, FIELD_SIZE.DATE_TIME);
  const jobCode = String.fromCharCode(buffer[OFFSET.JOB_CODE]);
  const responseCode = buffer[OFFSET.RESPONSE_CODE];
  const dataLength = buffer.readUInt16LE(OFFSET.DATA_LENGTH);

  // Verify packet length
  const expectedLength = HEADER_SIZE + dataLength + 2; // header + data + ETX + BCC
  if (buffer.length < expectedLength) {
    console.error('Packet length mismatch. Expected:', expectedLength, 'Got:', buffer.length);
    return null;
  }

  // Extract data
  const data = buffer.slice(OFFSET.DATA_START, OFFSET.DATA_START + dataLength);

  // Verify ETX
  const etxIndex = OFFSET.DATA_START + dataLength;
  if (buffer[etxIndex] !== ETX) {
    console.error('Invalid ETX at index', etxIndex, ':', buffer[etxIndex]);
    return null;
  }

  // Verify BCC
  const receivedBcc = buffer[etxIndex + 1];
  const calculatedBcc = calculateBCC(buffer.slice(0, etxIndex + 1));
  const isValid = receivedBcc === calculatedBcc;

  if (!isValid) {
    console.error('BCC mismatch. Received:', receivedBcc, 'Calculated:', calculatedBcc);
  }

  return {
    header: {
      terminalId,
      dateTime,
      jobCode,
      responseCode,
      dataLength,
    },
    data,
    bcc: receivedBcc,
    isValid,
  };
}

// =============================================================================
// Response Parsers
// =============================================================================

/**
 * Parse Device Check Response (Job Code: a)
 * Data Length: 4 bytes
 */
export function parseDeviceCheckResponse(data: Buffer): DeviceCheckResponse {
  return {
    cardModuleStatus: data.toString('ascii', 0, 1) as DeviceStatus,
    rfModuleStatus: data.toString('ascii', 1, 2) as DeviceStatus,
    vanServerStatus: data.toString('ascii', 2, 3) as DeviceStatus,
    linkServerStatus: data.toString('ascii', 3, 4) as DeviceStatus,
  };
}

/**
 * Parse Event Response (Job Code: @)
 * Data Length: 1 byte
 */
export function parseEventResponse(data: Buffer): EventResponse {
  return {
    eventType: data.toString('ascii', 0, 1) as EventType,
  };
}

/**
 * Parse Transaction Approval Response (Job Code: b)
 * Data Length: 157 bytes
 */
export function parseApprovalResponse(data: Buffer): ApprovalResponse {
  let offset = 0;

  const transactionType = data.toString('ascii', offset, offset + 1) as TransactionResponseType;
  offset += 1;

  const transactionMedia = data.toString('ascii', offset, offset + 1) as TransactionMedia;
  offset += 1;

  const cardNumber = extractString(data, offset, 20);
  offset += 20;

  const approvedAmount = extractNumber(data, offset, 10);
  offset += 10;

  const tax = extractNumber(data, offset, 8);
  offset += 8;

  const serviceCharge = extractNumber(data, offset, 8);
  offset += 8;

  const installment = extractString(data, offset, 2);
  offset += 2;

  const approvalNumber = extractString(data, offset, 12);
  offset += 12;

  const salesDate = extractString(data, offset, 8);
  offset += 8;

  const salesTime = extractString(data, offset, 6);
  offset += 6;

  const transactionId = extractString(data, offset, 12);
  offset += 12;

  const merchantId = extractString(data, offset, 15);
  offset += 15;

  const terminalNumber = extractString(data, offset, 14);
  offset += 14;

  // Issuer/Reject info (20 bytes)
  const issuerOrRejectData = extractString(data, offset, 20);
  offset += 20;

  // Acquirer info (20 bytes)
  const acquirerData = extractString(data, offset, 20);

  // Check if rejected
  const isRejected = transactionType === TransactionResponseType.REJECTED;

  let issuerCode = '';
  let issuerName = '';
  let acquirerCode = '';
  let acquirerName = '';
  let rejectCode: string | undefined;
  let rejectMessage: string | undefined;

  if (isRejected) {
    // Parse rejection info from issuer field
    // Format: Response message (may contain error code)
    rejectMessage = issuerOrRejectData;
    // Try to extract error code from acquirer field (format: "-XX+message")
    if (acquirerData.startsWith('-')) {
      rejectCode = acquirerData.substring(1, 3);
      const errorInfo = ERROR_CODES[rejectCode];
      if (errorInfo) {
        rejectMessage = errorInfo.userMessage;
      }
    }
  } else {
    // Normal approval - parse issuer/acquirer
    issuerCode = issuerOrRejectData.substring(0, 4);
    issuerName = issuerOrRejectData.substring(4).trim();
    acquirerCode = acquirerData.substring(0, 4);
    acquirerName = acquirerData.substring(4).trim();
  }

  return {
    transactionType,
    transactionMedia,
    cardNumber,
    approvedAmount,
    tax,
    serviceCharge,
    installment,
    approvalNumber,
    salesDate,
    salesTime,
    transactionId,
    merchantId,
    terminalNumber,
    issuerCode,
    issuerName,
    acquirerCode,
    acquirerName,
    isRejected,
    rejectCode,
    rejectMessage,
  };
}

/**
 * Parse Card Inquiry Response (Job Code: d)
 * Data Length: 53 bytes
 */
export function parseCardInquiryResponse(data: Buffer): CardInquiryResponse {
  let offset = 0;

  const transactionMedia = data.toString('ascii', offset, offset + 1) as TransactionMedia;
  offset += 1;

  const cardType = data.toString('ascii', offset, offset + 1);
  offset += 1;

  const cardNumber = extractString(data, offset, 20);
  offset += 20;

  const lastTransactionDateTime = extractString(data, offset, 14);
  offset += 14;

  const lastTransactionAmount = extractNumber(data, offset, 8);
  offset += 8;

  const cardBalance = extractNumber(data, offset, 8);
  offset += 8;

  const transactionStatus = data.toString('ascii', offset, offset + 1) as '0' | 'O' | 'X';

  return {
    transactionMedia,
    cardType,
    cardNumber,
    lastTransactionDateTime,
    lastTransactionAmount,
    cardBalance,
    transactionStatus,
  };
}

// =============================================================================
// Packet Validation
// =============================================================================

/**
 * Check if buffer contains a complete packet
 * Returns the packet length if complete, 0 otherwise
 */
export function findCompletePacket(buffer: Buffer): number {
  if (buffer.length < HEADER_SIZE + 2) {
    return 0;
  }

  // Find STX
  const stxIndex = buffer.indexOf(STX);
  if (stxIndex === -1) {
    return 0;
  }

  // Check if we have enough bytes for header
  if (buffer.length - stxIndex < HEADER_SIZE + 2) {
    return 0;
  }

  // Read data length
  const dataLength = buffer.readUInt16LE(stxIndex + OFFSET.DATA_LENGTH);
  const expectedLength = HEADER_SIZE + dataLength + 2;

  // Check if we have complete packet
  if (buffer.length - stxIndex >= expectedLength) {
    // Verify ETX
    const etxIndex = stxIndex + HEADER_SIZE + dataLength;
    if (buffer[etxIndex] === ETX) {
      return expectedLength;
    }
  }

  return 0;
}
