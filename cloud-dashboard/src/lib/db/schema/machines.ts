import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { locations } from './locations';
import { organizations } from './organizations';

export const machines = pgTable(
  'machines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    hardwareId: varchar('hardware_id', { length: 255 }).unique().notNull(),
    name: varchar('name', { length: 255 }),
    status: varchar('status', { length: 50 }).default('offline'),
    processingMode: varchar('processing_mode', { length: 50 }).default('hybrid'),
    configVersion: varchar('config_version', { length: 50 }),
    lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }),
    hardwareInfo: jsonb('hardware_info').default({}),
    peripheralStatus: jsonb('peripheral_status').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_machines_org').on(table.organizationId),
    index('idx_machines_location').on(table.locationId),
    index('idx_machines_status').on(table.status),
  ]
);

export const machineConfigs = pgTable(
  'machine_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    machineId: uuid('machine_id')
      .references(() => machines.id, { onDelete: 'cascade' })
      .notNull(),
    version: varchar('version', { length: 50 }).notNull(),
    config: jsonb('config').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => [index('idx_configs_machine').on(table.machineId)]
);
