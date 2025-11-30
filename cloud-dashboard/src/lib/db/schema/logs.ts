import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { machines } from './machines';

export const machineLogs = pgTable(
  'machine_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    machineId: uuid('machine_id')
      .references(() => machines.id, { onDelete: 'cascade' })
      .notNull(),
    level: varchar('level', { length: 20 }).notNull(),
    category: varchar('category', { length: 100 }),
    message: text('message').notNull(),
    metadata: jsonb('metadata').default({}),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_logs_machine').on(table.machineId),
    index('idx_logs_level').on(table.level),
    index('idx_logs_timestamp').on(table.timestamp),
    index('idx_logs_category').on(table.category),
  ]
);
