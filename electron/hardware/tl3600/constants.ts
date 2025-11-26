/**
 * TL3600/TL3500BP Payment Terminal Protocol Constants
 * Based on Protocol Design Document V10.1 (2022-02-15)
 */

// =============================================================================
// Protocol Control Characters
// =============================================================================

export const STX = 0x02;  // Start of Text
export const ETX = 0x03;  // End of Text
export const ACK = 0x06;  // Acknowledge
export const NACK = 0x15; // Negative Acknowledge

// =============================================================================
// Packet Structure Sizes
// =============================================================================

export const HEADER_SIZE = 35;  // STX(1) + TerminalID(16) + DateTime(14) + JobCode(1) + ResponseCode(1) + DataLength(2)
export const TAIL_SIZE = 2;     // ETX(1) + BCC(1)

// Header Field Offsets
export const OFFSET = {
  STX: 0,
  TERMINAL_ID: 1,
  DATE_TIME: 17,
  JOB_CODE: 31,
  RESPONSE_CODE: 32,
  DATA_LENGTH: 33,
  DATA_START: 35,
} as const;

// =============================================================================
// Job Codes (Request: A-Z, Response: a-z)
// =============================================================================

export enum JobCode {
  // Requests (연동장치 → 결제기)
  DEVICE_CHECK = 'A',           // 장치체크 요청
  TRANSACTION_APPROVAL = 'B',   // 거래승인 요청
  TRANSACTION_CANCEL = 'C',     // 거래취소 요청
  CARD_INQUIRY = 'D',           // 카드조회 요청
  PAYMENT_STANDBY = 'E',        // 결제대기 요청
  CARD_UID_READ = 'F',          // 카드 UID 읽기 요청
  ADDITIONAL_APPROVAL = 'G',    // 부가정보 추가 거래승인 요청
  APPROVAL_CONFIRM = 'H',       // 거래승인 응답 확인
  MEMORY_WRITE = 'K',           // 설정 정보 메모리 WRITING
  LAST_APPROVAL = 'L',          // 마지막 승인 응답 요청
  IC_CARD_CHECK = 'M',          // IC 카드 체크 요청
  TRANSIT_INQUIRY = 'N',        // 교통카드 이용 일시 조회
  BARCODE_APPROVAL = 'Q',       // 바코드 및 현금영수증 승인
  TERMINAL_RESET = 'R',         // 단말기 리셋 요청
  DISPLAY_SETTINGS = 'S',       // 화면&음성 설정
  TRANSIT_DISCOUNT = 'T',       // 교통카드 환승 할인 결제
  VERSION_CHECK = 'V',          // 버전 체크 요청
  BARCODE_INQUIRY = 'W',        // 바코드 조회 요청
  SETTINGS_SET = 'X',           // 설정 정보 세팅
  SETTINGS_GET = 'Y',           // 설정 정보 요청
  DISCOUNT_APPROVAL = 'Z',      // 할인권 & 교통카드 환승 할인

  // Responses (결제기 → 연동장치)
  DEVICE_CHECK_RESPONSE = 'a',
  TRANSACTION_APPROVAL_RESPONSE = 'b',
  TRANSACTION_CANCEL_RESPONSE = 'c',
  CARD_INQUIRY_RESPONSE = 'd',
  PAYMENT_STANDBY_RESPONSE = 'e',
  CARD_UID_READ_RESPONSE = 'f',
  ADDITIONAL_APPROVAL_RESPONSE = 'g',
  MEMORY_WRITE_RESPONSE = 'k',
  LAST_APPROVAL_RESPONSE = 'l',
  IC_CARD_CHECK_RESPONSE = 'm',
  TRANSIT_INQUIRY_RESPONSE = 'n',
  BARCODE_APPROVAL_RESPONSE = 'q',
  DISPLAY_SETTINGS_RESPONSE = 's',
  TRANSIT_DISCOUNT_RESPONSE = 't',
  VERSION_CHECK_RESPONSE = 'v',
  BARCODE_INQUIRY_RESPONSE = 'w',
  SETTINGS_SET_RESPONSE = 'x',
  SETTINGS_GET_RESPONSE = 'y',
  DISCOUNT_APPROVAL_RESPONSE = 'z',
  EVENT_RESPONSE = '@',
}

// =============================================================================
// Event Types (이벤트 응답 @)
// =============================================================================

export enum EventType {
  MS_CARD = 'M',        // MS 카드 인식
  RF_CARD = 'R',        // RF 카드 인식
  IC_CARD = 'I',        // IC 카드 인식
  IC_CARD_REMOVED = 'O', // IC 카드 제거
  IC_FALLBACK = 'F',    // IC 카드 FallBack
  BARCODE = 'Q',        // 바코드 인식
}

// =============================================================================
// Transaction Types
// =============================================================================

export enum TransactionType {
  APPROVAL = '1',       // 승인
  FREE_PARKING = '7',   // 무료주차 승인
  DEVICE_MERCHANT = 'M', // 장치 가맹점 승인
}

export enum TransactionResponseType {
  CREDIT = '1',         // 신용승인
  CASH_RECEIPT = '2',   // 현금영수증
  PREPAID = '3',        // 선불카드
  ZERO_PAY = '4',       // 제로페이
  KAKAO_MONEY = '5',    // 카카오페이(머니)
  KAKAO_CREDIT = '6',   // 카카오페이(신용)
  NAVER_PAY = '8',      // 네이버페이
  REJECTED = 'X',       // 거래거절
}

export enum TransactionMedia {
  IC = '1',
  MS = '2',
  RF = '3',
  BARCODE = '4',
  KEYIN = '5',
}

// =============================================================================
// Cancel Types
// =============================================================================

export enum CancelType {
  REQUEST_CANCEL = '1',     // 요청전문 취소
  LAST_TRANSACTION = '2',   // 결제기 마지막 거래 취소
  VAN_NO_CARD = '3',        // VAN 무카드 취소
  PG_NO_CARD = '4',         // PG 무카드 취소
  PG_PARTIAL = '5',         // PG 부분 취소
  DIRECT_PREV = '6',        // 직전거래 무카드 취소 (VAN만)
}

// =============================================================================
// Card Types (선불카드)
// =============================================================================

export enum PrepaidCardType {
  T_MONEY = 'T',
  CASHBEE = 'E',
  MYBI = 'M',
  U_PAY = 'U',
  HAN_PAY = 'H',
  KORAIL = 'K',
  POSTPAID = 'P',
  T_MONEY_POSTPAID = 'A',
  UNKNOWN = 'X',
  BARCODE = 'Q',
}

// =============================================================================
// Device Status
// =============================================================================

export enum DeviceStatus {
  NOT_INSTALLED = 'N',
  OK = 'O',
  ERROR = 'X',
  FAIL = 'F',
}

// =============================================================================
// Signature
// =============================================================================

export enum SignatureRequired {
  NO = '1',
  YES = '2',
}

// =============================================================================
// Default Payment Settings (5,000원 고정, 일시불, 비서명)
// =============================================================================

export const PAYMENT_DEFAULTS = {
  AMOUNT: 5000,
  TAX: 0,
  SERVICE_CHARGE: 0,
  INSTALLMENT: '00',
  SIGNATURE: SignatureRequired.NO,
  TRANSACTION_TYPE: TransactionType.APPROVAL,
} as const;

// =============================================================================
// Serial Configuration
// =============================================================================

export const SERIAL_CONFIG = {
  BAUD_RATE: 115200,
  DATA_BITS: 8 as const,
  STOP_BITS: 1 as const,
  PARITY: 'none' as const,
} as const;

// =============================================================================
// Timeout Settings
// =============================================================================

export const TIMEOUT = {
  ACK_WAIT: 3000,         // ACK 대기 3초
  RESPONSE_WAIT: 30000,   // 응답 대기 30초
  MAX_RETRY: 3,           // 최대 재시도 3회
  PAYMENT_TIMEOUT: 30000, // 결제 타임아웃 30초
} as const;

// =============================================================================
// Error Codes (거래거절)
// =============================================================================

export const ERROR_CODES: Record<string, { message: string; userMessage: string }> = {
  '6B': { message: '카드 잔액 부족', userMessage: '잔액이 부족합니다' },
  '0A': { message: '네트워크 오류', userMessage: '네트워크 오류, 다시 시도해주세요' },
  '0C': { message: '서버 타임아웃', userMessage: '서버 응답 없음, 다시 시도해주세요' },
  '6D': { message: '선불 카드 이상', userMessage: '사용할 수 없는 카드입니다' },
  '69': { message: '사용 불가 카드', userMessage: '사용할 수 없는 카드입니다' },
  '71': { message: '미등록 카드', userMessage: '사용할 수 없는 카드입니다' },
  '6F': { message: '재시도 요청', userMessage: '다시 시도해주세요' },
  '7A': { message: 'Tmoney 서비스 불가', userMessage: 'Tmoney 서비스 불가, 관리자에게 문의하세요' },
  '74': { message: '카드 변경', userMessage: '거래 중 카드가 변경되었습니다' },
  'B3': { message: '포맷오류', userMessage: '시스템 오류, 다시 시도해주세요' },
} as const;

// =============================================================================
// Data Field Sizes
// =============================================================================

export const FIELD_SIZE = {
  TERMINAL_ID: 16,
  DATE_TIME: 14,
  TRANSACTION_TYPE: 1,
  AMOUNT: 10,
  TAX: 8,
  SERVICE_CHARGE: 8,
  INSTALLMENT: 2,
  SIGNATURE: 1,
  CARD_NUMBER: 20,
  APPROVAL_NUMBER: 12,
  SALES_DATE: 8,
  SALES_TIME: 6,
  TRANSACTION_ID: 12,
  MERCHANT_ID: 15,
  TERMINAL_NUMBER: 14,
  ISSUER_INFO: 20,
  ACQUIRER_INFO: 20,
} as const;

// =============================================================================
// Response Data Lengths
// =============================================================================

export const RESPONSE_LENGTH = {
  DEVICE_CHECK: 4,
  TRANSACTION_APPROVAL: 157,
  TRANSACTION_CANCEL: 157,
  CARD_INQUIRY: 53,
  PAYMENT_STANDBY: 0,
  IC_CARD_CHECK: 1,
  VERSION_CHECK: 45,
} as const;
