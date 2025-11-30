import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(), // SHA-256 hash
    keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // First 8 chars for identification
    permissions: varchar('permissions', { length: 50 }).default('machine'), // 'machine' | 'admin'
    isActive: boolean('is_active').default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_api_keys_org').on(table.organizationId),
    index('idx_api_keys_prefix').on(table.keyPrefix),
  ]
);
