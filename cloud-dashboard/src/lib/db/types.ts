import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type {
  alerts,
  locations,
  machineCommands,
  machineConfigs,
  machineLogs,
  machines,
  organizationMembers,
  organizations,
  sessions,
} from './schema';

// Select types
export type Organization = InferSelectModel<typeof organizations>;
export type OrganizationMember = InferSelectModel<typeof organizationMembers>;
export type Location = InferSelectModel<typeof locations>;
export type Machine = InferSelectModel<typeof machines>;
export type MachineConfig = InferSelectModel<typeof machineConfigs>;
export type Session = InferSelectModel<typeof sessions>;
export type Alert = InferSelectModel<typeof alerts>;
export type MachineCommand = InferSelectModel<typeof machineCommands>;
export type MachineLog = InferSelectModel<typeof machineLogs>;

// Insert types
export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewMachine = InferInsertModel<typeof machines>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewAlert = InferInsertModel<typeof alerts>;
export type NewMachineCommand = InferInsertModel<typeof machineCommands>;
export type NewMachineLog = InferInsertModel<typeof machineLogs>;

// Enum types
export type MachineStatus = 'online' | 'offline' | 'busy' | 'error' | 'maintenance';
export type ProcessingMode = 'cloud' | 'local' | 'hybrid' | 'auto';
export type SessionStatus =
  | 'started'
  | 'capturing'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type MemberRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type CommandStatus =
  | 'pending'
  | 'sent'
  | 'received'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'system'
  | 'camera'
  | 'processing'
  | 'payment'
  | 'printer'
  | 'network'
  | 'session';
