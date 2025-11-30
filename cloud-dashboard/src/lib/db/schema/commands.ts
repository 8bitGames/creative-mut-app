import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { machines } from './machines';

export const machineCommands = pgTable(
  'machine_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    machineId: uuid('machine_id')
      .references(() => machines.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    payload: jsonb('payload').default({}),
    status: varchar('status', { length: 50 }).default('pending'),
    result: jsonb('result'),
    errorMessage: varchar('error_message', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
  },
  (table) => [
    index('idx_commands_machine').on(table.machineId),
    index('idx_commands_status').on(table.status),
    index('idx_commands_created').on(table.createdAt),
  ]
);
