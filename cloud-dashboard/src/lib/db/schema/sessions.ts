import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { machines } from './machines';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    machineId: uuid('machine_id')
      .references(() => machines.id, { onDelete: 'cascade' })
      .notNull(),
    sessionCode: varchar('session_code', { length: 50 }).unique().notNull(),
    status: varchar('status', { length: 50 }).default('started'),
    frameId: varchar('frame_id', { length: 255 }),
    processingMode: varchar('processing_mode', { length: 50 }),
    processingTimeMs: integer('processing_time_ms'),
    deliveryMethod: varchar('delivery_method', { length: 50 }),
    paymentAmount: decimal('payment_amount', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('KRW'),
    approvalNumber: varchar('approval_number', { length: 50 }),
    salesDate: varchar('sales_date', { length: 8 }),
    salesTime: varchar('sales_time', { length: 6 }),
    transactionMedia: varchar('transaction_media', { length: 10 }),
    cardNumber: varchar('card_number', { length: 20 }),
    rawImagesUrl: jsonb('raw_images_url').default([]),
    processedVideoUrl: varchar('processed_video_url', { length: 1000 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),
    qrCodeUrl: varchar('qr_code_url', { length: 1000 }),
    frameImagesUrl: jsonb('frame_images_url').default([]),
    metadata: jsonb('metadata').default({}),
    errorMessage: varchar('error_message', { length: 1000 }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_sessions_machine').on(table.machineId),
    index('idx_sessions_code').on(table.sessionCode),
    index('idx_sessions_started').on(table.startedAt),
    index('idx_sessions_status').on(table.status),
  ]
);
