import { app, BrowserWindow } from 'electron';
import { CloudClient } from './client';
import { Command } from './types';

type CommandType =
  | 'restart'
  | 'update-config'
  | 'capture-screenshot'
  | 'run-diagnostics'
  | 'clear-cache'
  | 'force-idle';

interface CommandResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

type CommandHandlerFn = (payload: Record<string, unknown>) => Promise<CommandResult>;

const POLL_INTERVAL = 30000; // 30 seconds

export class CommandHandler {
  private client: CloudClient;
  private handlers: Map<CommandType, CommandHandlerFn> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private logger: { info: Function; warn: Function; error: Function } | null = null;

  constructor(client: CloudClient, logger?: { info: Function; warn: Function; error: Function }) {
    this.client = client;
    this.logger = logger || null;
    this.registerDefaultHandlers();
  }

  // =========================================
  // Handler Registration
  // =========================================

  registerHandler(type: CommandType, handler: CommandHandlerFn): void {
    this.handlers.set(type, handler);
  }

  private registerDefaultHandlers(): void {
    // Restart command
    this.registerHandler('restart', async (payload) => {
      const delay = (payload.delay as number) || 3000;

      this.log('info', 'command', `Restarting app in ${delay}ms`);

      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, delay);

      return { success: true, data: { scheduledRestart: true, delay } };
    });

    // Force idle command
    this.registerHandler('force-idle', async () => {
      this.log('info', 'command', 'Forcing return to idle screen');

      // Send IPC to renderer
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('command:force-idle');
      }

      return { success: true };
    });

    // Clear cache command
    this.registerHandler('clear-cache', async (payload) => {
      const types = (payload.types as string[]) || ['all'];

      this.log('info', 'command', 'Clearing cache', { types });

      // Implementation depends on what caches exist
      // This is a placeholder

      return { success: true, data: { clearedTypes: types } };
    });
  }

  private log(level: 'info' | 'warn' | 'error', category: string, message: string, metadata?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger[level](category, message, metadata);
    } else {
      console[level](`[${category}] ${message}`, metadata || '');
    }
  }

  // =========================================
  // Polling
  // =========================================

  startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Initial poll
    this.poll();

    // Start interval
    this.pollInterval = setInterval(() => {
      this.poll();
    }, POLL_INTERVAL);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const response = await this.client.getPendingCommands();

      if (!response.success || !response.data) {
        return;
      }

      const { commands } = response.data;

      if (commands.length === 0) {
        return;
      }

      this.log('info', 'command', `Received ${commands.length} pending commands`);

      // Process each command
      for (const command of commands) {
        await this.executeCommand(command);
      }
    } catch (error) {
      this.log('warn', 'command', 'Error polling for commands', { error });
    } finally {
      this.isPolling = false;
    }
  }

  // =========================================
  // Command Execution
  // =========================================

  async executeCommand(command: Command): Promise<void> {
    this.log('info', 'command', `Executing command: ${command.type}`, {
      commandId: command.id,
      payload: command.payload,
    });

    // Acknowledge receipt
    await this.client.acknowledgeCommand(command.id, { status: 'received' });

    const handler = this.handlers.get(command.type as CommandType);

    if (!handler) {
      this.log('warn', 'command', `Unknown command type: ${command.type}`);
      await this.client.acknowledgeCommand(command.id, {
        status: 'failed',
        errorMessage: `Unknown command type: ${command.type}`,
      });
      return;
    }

    try {
      const result = await handler(command.payload);

      await this.client.acknowledgeCommand(command.id, {
        status: result.success ? 'completed' : 'failed',
        result: result.data,
        errorMessage: result.error,
      });

      this.log('info', 'command', `Command ${command.type} ${result.success ? 'completed' : 'failed'}`, {
        commandId: command.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.client.acknowledgeCommand(command.id, {
        status: 'failed',
        errorMessage,
      });

      this.log('error', 'command', `Command ${command.type} threw error`, {
        commandId: command.id,
        error: errorMessage,
      });
    }
  }

  // =========================================
  // External Handler Registration
  // =========================================

  setConfigUpdateHandler(handler: () => Promise<boolean>): void {
    this.registerHandler('update-config', async () => {
      console.log('\n🎯 ═══════════════════════════════════════════════════');
      console.log('🎯  COMMAND RECEIVED: update-config');
      console.log('🎯  Source: Cloud Dashboard');
      console.log('🎯  Time:', new Date().toLocaleString());
      console.log('🎯  Executing config sync...');
      console.log('🎯 ═══════════════════════════════════════════════════\n');

      const success = await handler();

      if (success) {
        console.log('🎯 ✅ Config update command completed successfully\n');
      } else {
        console.log('🎯 ⚠️  Config update command: no changes detected\n');
      }

      return { success };
    });
  }

  setScreenshotHandler(handler: () => Promise<string>): void {
    this.registerHandler('capture-screenshot', async () => {
      const screenshotPath = await handler();
      return { success: true, data: { path: screenshotPath } };
    });
  }

  setDiagnosticsHandler(handler: (tests: string[]) => Promise<Record<string, unknown>>): void {
    this.registerHandler('run-diagnostics', async (payload) => {
      const tests = (payload.tests as string[]) || ['all'];
      const results = await handler(tests);
      return { success: true, data: results };
    });
  }
}

export default CommandHandler;
