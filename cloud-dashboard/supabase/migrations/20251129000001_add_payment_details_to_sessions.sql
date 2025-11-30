-- Migration: Add TL3600 payment details to sessions table
-- Phase 3.5.2: Cloud Sessions Schema Update
--
-- These fields store payment transaction details from TL3600 card reader
-- for cancellation support and transaction tracking.

-- Add payment detail columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS approval_number VARCHAR(50);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sales_date VARCHAR(8);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sales_time VARCHAR(6);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS transaction_media VARCHAR(10);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);

-- Add comments for documentation
COMMENT ON COLUMN sessions.approval_number IS 'TL3600 VAN approval number (승인번호) for cancellation';
COMMENT ON COLUMN sessions.sales_date IS 'Transaction date in YYYYMMDD format (매출일)';
COMMENT ON COLUMN sessions.sales_time IS 'Transaction time in HHMMSS format (매출시간)';
COMMENT ON COLUMN sessions.transaction_media IS 'Card type: 1=IC, 2=MS, 3=RF (거래매체)';
COMMENT ON COLUMN sessions.card_number IS 'Masked card number (카드번호 마스킹)';

-- Create index for payment lookup (useful for cancellation queries)
CREATE INDEX IF NOT EXISTS idx_sessions_approval_number ON sessions(approval_number) WHERE approval_number IS NOT NULL;
