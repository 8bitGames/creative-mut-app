import type { ElementType } from 'react';

export type CommandType =
  | 'restart'
  | 'shutdown'
  | 'update'
  | 'sync-config'
  | 'clear-cache'
  | 'run-diagnostics'
  | 'capture-screenshot'
  | 'toggle-maintenance';

export type CommandStatus =
  | 'pending'
  | 'sent'
  | 'received'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface Command {
  id: string;
  machineId: string;
  type: CommandType;
  payload?: Record<string, unknown>;
  status: CommandStatus;
  result?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  sentAt?: Date;
  receivedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface CommandDefinition {
  type: CommandType;
  label: string;
  description: string;
  icon: ElementType;
  requiresConfirmation: boolean;
  dangerous?: boolean;
  timeout: number;
}
