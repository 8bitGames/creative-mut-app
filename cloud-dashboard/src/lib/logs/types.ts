export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'system'
  | 'camera'
  | 'processing'
  | 'payment'
  | 'printer'
  | 'network'
  | 'session';

export interface LogEntry {
  id: string;
  machineId: string;
  level: LogLevel;
  category: LogCategory | null;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface LogFilters {
  level?: LogLevel[];
  category?: LogCategory[];
  search?: string;
  from?: Date;
  to?: Date;
}
