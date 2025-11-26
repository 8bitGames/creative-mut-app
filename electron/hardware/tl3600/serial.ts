/**
 * TL3600/TL3500BP Serial Communication Module
 * Handles low-level serial port communication with ACK/NACK protocol
 */

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import {
  STX,
  ACK,
  NACK,
  SERIAL_CONFIG,
  TIMEOUT,
  JobCode,
} from './constants';
import {
  parsePacket,
  findCompletePacket,
  ParsedPacket,
} from './packet';

// =============================================================================
// Types
// =============================================================================

export interface SerialConfig {
  port: string;
  baudRate?: number;
}

export interface SendResult {
  success: boolean;
  response?: ParsedPacket;
  error?: string;
}

// =============================================================================
// TL3600 Serial Communication Class
// =============================================================================

export class TL3600Serial extends EventEmitter {
  private port: SerialPort | null = null;
  private portPath: string;
  private baudRate: number;
  private isConnected: boolean = false;
  private receiveBuffer: Buffer = Buffer.alloc(0);
  private pendingResponse: {
    resolve: (value: ParsedPacket | null) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(config: SerialConfig) {
    super();
    this.portPath = config.port;
    this.baudRate = config.baudRate || SERIAL_CONFIG.BAUD_RATE;
  }

  /**
   * Connect to serial port
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    if (this.isConnected && this.port?.isOpen) {
      return { success: true };
    }

    return new Promise((resolve) => {
      try {
        this.port = new SerialPort({
          path: this.portPath,
          baudRate: this.baudRate,
          dataBits: SERIAL_CONFIG.DATA_BITS,
          stopBits: SERIAL_CONFIG.STOP_BITS,
          parity: SERIAL_CONFIG.PARITY,
          autoOpen: false,
        });

        this.port.on('error', (err) => {
          console.error('❌ [TL3600] Serial port error:', err.message);
          this.emit('error', err);
        });

        this.port.on('close', () => {
          console.log('🔌 [TL3600] Serial port closed');
          this.isConnected = false;
          this.emit('disconnected');
        });

        this.port.on('data', (data: Buffer) => {
          this.handleIncomingData(data);
        });

        this.port.open((err) => {
          if (err) {
            console.error('❌ [TL3600] Failed to open port:', err.message);
            resolve({ success: false, error: err.message });
            return;
          }

          console.log(`✅ [TL3600] Connected to ${this.portPath} at ${this.baudRate} baud`);
          this.isConnected = true;
          this.emit('connected');
          resolve({ success: true });
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ [TL3600] Connection error:', errorMessage);
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  /**
   * Disconnect from serial port
   */
  async disconnect(): Promise<void> {
    if (this.pendingResponse) {
      clearTimeout(this.pendingResponse.timeout);
      this.pendingResponse.reject(new Error('Disconnecting'));
      this.pendingResponse = null;
    }

    if (this.port?.isOpen) {
      return new Promise((resolve) => {
        this.port!.close((err) => {
          if (err) {
            console.error('❌ [TL3600] Error closing port:', err.message);
          }
          this.isConnected = false;
          this.port = null;
          resolve();
        });
      });
    }

    this.isConnected = false;
    this.port = null;
  }

  /**
   * Check if connected
   */
  isPortConnected(): boolean {
    return this.isConnected && (this.port?.isOpen ?? false);
  }

  /**
   * Send packet and wait for response with ACK/NACK handling
   */
  async sendPacket(packet: Buffer, expectResponse: boolean = true): Promise<SendResult> {
    if (!this.isPortConnected()) {
      return { success: false, error: 'Not connected' };
    }

    let retryCount = 0;

    while (retryCount < TIMEOUT.MAX_RETRY) {
      try {
        // Send packet
        console.log(`📤 [TL3600] Sending packet (attempt ${retryCount + 1}/${TIMEOUT.MAX_RETRY})`);
        console.log(`   Data: ${packet.toString('hex').toUpperCase()}`);

        await this.writeToPort(packet);

        // Wait for ACK (for serial, not ethernet)
        const ackResult = await this.waitForAck();

        if (!ackResult.success) {
          if (ackResult.nack) {
            console.warn(`⚠️ [TL3600] Received NACK, retrying...`);
            retryCount++;
            continue;
          }
          // ACK timeout
          console.warn(`⚠️ [TL3600] ACK timeout, retrying...`);
          retryCount++;
          continue;
        }

        console.log(`✅ [TL3600] ACK received`);

        // If no response expected, we're done
        if (!expectResponse) {
          return { success: true };
        }

        // Wait for response
        const response = await this.waitForResponse();

        if (response) {
          // Send ACK for received response
          await this.sendAck();
          return { success: true, response };
        }

        console.warn(`⚠️ [TL3600] Response timeout`);
        return { success: false, error: 'Response timeout' };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [TL3600] Send error:`, errorMessage);
        retryCount++;
      }
    }

    return { success: false, error: `Max retries (${TIMEOUT.MAX_RETRY}) exceeded` };
  }

  /**
   * Send ACK
   */
  async sendAck(): Promise<void> {
    if (this.port?.isOpen) {
      await this.writeToPort(Buffer.from([ACK]));
      console.log(`📤 [TL3600] ACK sent`);
    }
  }

  /**
   * Send NACK
   */
  async sendNack(): Promise<void> {
    if (this.port?.isOpen) {
      await this.writeToPort(Buffer.from([NACK]));
      console.log(`📤 [TL3600] NACK sent`);
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Write data to serial port
   */
  private writeToPort(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) {
        reject(new Error('Port not open'));
        return;
      }

      this.port.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port!.drain((drainErr) => {
          if (drainErr) {
            reject(drainErr);
            return;
          }
          resolve();
        });
      });
    });
  }

  /**
   * Wait for ACK/NACK response
   */
  private waitForAck(): Promise<{ success: boolean; nack?: boolean }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners('ack');
        this.removeAllListeners('nack');
        resolve({ success: false });
      }, TIMEOUT.ACK_WAIT);

      this.once('ack', () => {
        clearTimeout(timeout);
        this.removeAllListeners('nack');
        resolve({ success: true });
      });

      this.once('nack', () => {
        clearTimeout(timeout);
        this.removeAllListeners('ack');
        resolve({ success: false, nack: true });
      });
    });
  }

  /**
   * Wait for response packet
   */
  private waitForResponse(): Promise<ParsedPacket | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponse = null;
        resolve(null);
      }, TIMEOUT.RESPONSE_WAIT);

      this.pendingResponse = {
        resolve: (packet) => {
          clearTimeout(timeout);
          this.pendingResponse = null;
          resolve(packet);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.pendingResponse = null;
          reject(error);
        },
        timeout,
      };
    });
  }

  /**
   * Handle incoming data from serial port
   */
  private handleIncomingData(data: Buffer): void {
    console.log(`📥 [TL3600] Received: ${data.toString('hex').toUpperCase()}`);

    // Check for single-byte responses (ACK/NACK)
    if (data.length === 1) {
      if (data[0] === ACK) {
        this.emit('ack');
        return;
      }
      if (data[0] === NACK) {
        this.emit('nack');
        return;
      }
    }

    // Append to receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    // Try to find complete packet
    this.processReceiveBuffer();
  }

  /**
   * Process receive buffer to extract complete packets
   */
  private processReceiveBuffer(): void {
    // Find STX
    const stxIndex = this.receiveBuffer.indexOf(STX);
    if (stxIndex === -1) {
      // No STX found, clear buffer
      this.receiveBuffer = Buffer.alloc(0);
      return;
    }

    // Remove any data before STX
    if (stxIndex > 0) {
      this.receiveBuffer = this.receiveBuffer.slice(stxIndex);
    }

    // Check for complete packet
    const packetLength = findCompletePacket(this.receiveBuffer);
    if (packetLength === 0) {
      // Incomplete packet, wait for more data
      return;
    }

    // Extract complete packet
    const packetBuffer = this.receiveBuffer.slice(0, packetLength);
    this.receiveBuffer = this.receiveBuffer.slice(packetLength);

    // Parse packet
    const packet = parsePacket(packetBuffer);

    if (!packet) {
      console.error('❌ [TL3600] Failed to parse packet');
      return;
    }

    if (!packet.isValid) {
      console.error('❌ [TL3600] Invalid BCC, sending NACK');
      this.sendNack();
      return;
    }

    console.log(`✅ [TL3600] Valid packet received: Job Code = ${packet.header.jobCode}`);

    // Handle event responses (no ACK needed, emit directly)
    if (packet.header.jobCode === JobCode.EVENT_RESPONSE) {
      this.emit('event', packet);
      return;
    }

    // If waiting for response, resolve it
    if (this.pendingResponse) {
      this.pendingResponse.resolve(packet);
    } else {
      // Unexpected packet
      console.warn('⚠️ [TL3600] Unexpected packet received');
      this.emit('packet', packet);
    }

    // Process remaining buffer
    if (this.receiveBuffer.length > 0) {
      this.processReceiveBuffer();
    }
  }
}

// =============================================================================
// Utility: List available COM ports
// =============================================================================

export async function listSerialPorts(): Promise<{ path: string; manufacturer?: string }[]> {
  try {
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
    }));
  } catch (error) {
    console.error('Failed to list serial ports:', error);
    return [];
  }
}
