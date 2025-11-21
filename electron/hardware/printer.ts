/**
 * Printer Hardware Integration
 * MUT Hologram Studio - Photo Printer Controller
 *
 * This module provides printer control for photo printing.
 * For testing without hardware, set MOCK_PRINTER=true.
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as fs from 'fs';

export interface PrinterConfig {
  mockMode?: boolean;
  printerName?: string;
}

export interface PrintOptions {
  imagePath: string;
  copies?: number;
  paperSize?: 'A4' | '4x6' | '5x7';
  quality?: 'draft' | 'normal' | 'high';
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface PrinterStatus {
  available: boolean;
  status: 'idle' | 'printing' | 'error' | 'offline';
  paperLevel: number; // 0-100
  inkLevel: {
    cyan: number;
    magenta: number;
    yellow: number;
    black: number;
  };
  error?: string;
}

export class PrinterController extends EventEmitter {
  private mockMode: boolean;
  private printerName: string;
  private currentJob: string | null = null;
  private mockPaperLevel: number = 100;
  private mockInkLevels = {
    cyan: 85,
    magenta: 90,
    yellow: 75,
    black: 88,
  };

  constructor(config: PrinterConfig = {}) {
    super();
    this.mockMode = config.mockMode ?? process.env.MOCK_PRINTER === 'true';
    this.printerName = config.printerName ?? 'Default';
  }

  /**
   * Initialize printer connection
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.mockMode) {
      return this.mockConnect();
    }

    try {
      // Check if printer is available using lpstat (Unix/macOS)
      const printers = await this.listPrinters();

      if (printers.length === 0) {
        return {
          success: false,
          error: 'No printers found. Please connect a printer.',
        };
      }

      console.log('✅ Printer connected:', printers[0]);

      this.emit('connected', { name: printers[0] });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Printer connection failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get printer status
   */
  async getStatus(): Promise<PrinterStatus> {
    if (this.mockMode) {
      return this.mockGetStatus();
    }

    try {
      const status = await this.executePrinterCommand(['lpstat', '-p', this.printerName]);

      const isPrinting = status.includes('printing');
      const hasError = status.includes('error');

      return {
        available: true,
        status: hasError ? 'error' : isPrinting ? 'printing' : 'idle',
        paperLevel: 100, // Real implementation would query actual level
        inkLevel: {
          cyan: 85,
          magenta: 90,
          yellow: 75,
          black: 88,
        },
      };
    } catch (error) {
      return {
        available: false,
        status: 'offline',
        paperLevel: 0,
        inkLevel: {
          cyan: 0,
          magenta: 0,
          yellow: 0,
          black: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Print a photo
   */
  async print(options: PrintOptions): Promise<PrintResult> {
    if (this.mockMode) {
      return this.mockPrint(options);
    }

    try {
      // Validate image exists
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Image file not found: ${options.imagePath}`);
      }

      const jobId = `job_${Date.now()}`;
      this.currentJob = jobId;

      console.log('🖨️  Starting print job:', jobId);
      this.emit('printing', { jobId, options });

      // Execute print command (lp for Unix/macOS)
      const args = [
        '-d', this.printerName,
        '-n', String(options.copies || 1),
        '-o', 'media=4x6',
        '-o', 'fit-to-page',
        options.imagePath,
      ];

      const result = await this.executePrinterCommand(['lp', ...args]);

      // Extract job ID from output
      const jobIdMatch = result.match(/request id is (.+)/);
      const actualJobId = jobIdMatch ? jobIdMatch[1] : jobId;

      this.emit('printed', { jobId: actualJobId });
      console.log('✅ Print job completed:', actualJobId);

      this.currentJob = null;

      return {
        success: true,
        jobId: actualJobId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Print failed:', errorMessage);

      this.currentJob = null;

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel current print job
   */
  async cancelPrint(jobId: string): Promise<{ success: boolean }> {
    if (this.mockMode) {
      return this.mockCancelPrint(jobId);
    }

    try {
      await this.executePrinterCommand(['cancel', jobId]);

      this.emit('cancelled', { jobId });
      console.log('✅ Print job cancelled:', jobId);

      return { success: true };
    } catch (error) {
      console.error('❌ Cancel failed:', error);
      return { success: false };
    }
  }

  /**
   * List available printers
   */
  private async listPrinters(): Promise<string[]> {
    const output = await this.executePrinterCommand(['lpstat', '-p']);

    const printers: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/printer (.+) is/);
      if (match) {
        printers.push(match[1]);
      }
    }

    return printers;
  }

  /**
   * Execute printer command
   */
  private async executePrinterCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const [command, ...cmdArgs] = args;
      const process = spawn(command, cmdArgs);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Mock mode: Simulate printer connection
   */
  private async mockConnect(): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('✅ Mock printer connected');

    this.emit('connected', { name: 'Mock Photo Printer (Canon SELPHY CP1300)' });

    return { success: true };
  }

  /**
   * Mock mode: Get printer status
   */
  private async mockGetStatus(): Promise<PrinterStatus> {
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      available: true,
      status: this.currentJob ? 'printing' : 'idle',
      paperLevel: this.mockPaperLevel,
      inkLevel: this.mockInkLevels,
    };
  }

  /**
   * Mock mode: Simulate printing
   */
  private async mockPrint(options: PrintOptions): Promise<PrintResult> {
    const jobId = `mock_job_${Date.now()}`;
    this.currentJob = jobId;

    console.log('🖨️  Starting mock print job:', jobId);
    this.emit('printing', { jobId, options });

    // Simulate printing progress
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.emit('progress', { jobId, progress: i });
      console.log(`🖨️  Print progress: ${i}%`);
    }

    // Decrease paper level
    this.mockPaperLevel = Math.max(0, this.mockPaperLevel - 1);

    this.emit('printed', { jobId });
    console.log('✅ Mock print job completed:', jobId);

    this.currentJob = null;

    return {
      success: true,
      jobId,
    };
  }

  /**
   * Mock mode: Cancel print
   */
  private async mockCancelPrint(jobId: string): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 200));

    this.currentJob = null;
    this.emit('cancelled', { jobId });
    console.log('✅ Mock print job cancelled:', jobId);

    return { success: true };
  }
}
