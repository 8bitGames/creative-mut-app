import { CloudClient } from './client';
import { LogEntry } from './types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'system'
  | 'camera'
  | 'printer'
  | 'payment'
  | 'processing'
  | 'session'
  | 'cloud'
  | 'command';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_QUEUE_SIZE = 100;
const MAX_LOCAL_QUEUE_SIZE = 1000; // When offline

export class LogStreamer {
  private client: CloudClient;
  private queue: LogEntry[] = [];
  private minLevel: LogLevel = 'info';
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private consoleOutput = true;

  constructor(client: CloudClient, options?: {
    minLevel?: LogLevel;
    consoleOutput?: boolean;
  }) {
    this.client = client;
    if (options?.minLevel) this.minLevel = options.minLevel;
    if (options?.consoleOutput !== undefined) this.consoleOutput = options.consoleOutput;

    this.startFlushInterval();
  }

  // =========================================
  // Logging Methods
  // =========================================

  log(
    level: LogLevel,
    category: LogCategory | string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    // Check level filter
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      category,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Output to console
    if (this.consoleOutput) {
      this.outputToConsole(entry);
    }

    // Add to queue
    this.queue.push(entry);

    // Flush if queue is full
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  debug(category: LogCategory | string, message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', category, message, metadata);
  }

  info(category: LogCategory | string, message: string, metadata?: Record<string, unknown>): void {
    this.log('info', category, message, metadata);
  }

  warn(category: LogCategory | string, message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', category, message, metadata);
  }

  error(category: LogCategory | string, message: string, metadata?: Record<string, unknown>): void {
    this.log('error', category, message, metadata);
  }

  // =========================================
  // Console Output
  // =========================================

  private outputToConsole(entry: LogEntry): void {
    const icons: Record<LogLevel, string> = {
      debug: '🔍',
      info: '📋',
      warn: '⚠️',
      error: '❌',
    };

    const categoryIcons: Record<string, string> = {
      system: '💻',
      camera: '📷',
      printer: '🖨️',
      payment: '💳',
      processing: '⚙️',
      session: '🎬',
      cloud: '☁️',
      command: '📡',
    };

    const icon = icons[entry.level];
    const catIcon = categoryIcons[entry.category] || '📌';
    const prefix = `${icon} [${entry.category.toUpperCase()}] ${catIcon}`;

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.metadata || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.metadata || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.metadata || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.metadata || '');
        break;
    }
  }

  // =========================================
  // Flush Logic
  // =========================================

  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    // Take up to MAX_QUEUE_SIZE logs
    const logsToSend = this.queue.splice(0, MAX_QUEUE_SIZE);

    try {
      const response = await this.client.sendLogs(logsToSend);

      if (!response.success) {
        // Put logs back in queue if failed (but respect max size)
        if (this.queue.length < MAX_LOCAL_QUEUE_SIZE) {
          this.queue.unshift(...logsToSend);
        }
        console.warn('[LogStreamer] Failed to send logs:', response.error);
      }
    } catch (error) {
      // Put logs back in queue
      if (this.queue.length < MAX_LOCAL_QUEUE_SIZE) {
        this.queue.unshift(...logsToSend);
      }
      console.warn('[LogStreamer] Error sending logs:', error);
    }
  }

  // =========================================
  // Lifecycle
  // =========================================

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    if (this.queue.length > 0) {
      await this.flush();
    }
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

// Singleton instance
let loggerInstance: LogStreamer | null = null;

export function initializeLogger(client: CloudClient, options?: {
  minLevel?: LogLevel;
  consoleOutput?: boolean;
}): LogStreamer {
  loggerInstance = new LogStreamer(client, options);
  return loggerInstance;
}

export function getLogger(): LogStreamer {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call initializeLogger first.');
  }
  return loggerInstance;
}

export default LogStreamer;
