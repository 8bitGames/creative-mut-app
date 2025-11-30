import { CloudClient } from './client';
import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

const SYNC_INTERVAL = 30000; // 30 seconds

// Matches actual schema in electron/database/analytics.ts
interface LocalSession {
  id: number;
  session_id: string;              // e.g., "sample_session_123"
  start_time: number;              // Unix timestamp ms
  end_time?: number;
  duration_seconds?: number;
  frame_selected?: string;
  images_captured: number;
  completed: number;               // 0 or 1
  cloud_synced: number;            // 0 or 1
  cloud_session_id?: string;       // Cloud UUID
}

interface LocalPayment {
  id: number;
  session_id: string;              // References sessions(session_id)
  amount: number;
  status: string;
  payment_time: number;
  approval_number?: string;
  sales_date?: string;
  sales_time?: string;
  transaction_media?: string;
  card_number?: string;
}

/**
 * SessionSyncManager - Syncs local SQLite sessions to cloud
 *
 * This doesn't replace the existing analytics.ts database.
 * Instead, it reads from local DB and syncs to cloud.
 *
 * NOTE: Uses direct database access since analytics.ts exports functions,
 * not a class. We open a separate connection to the same database file.
 */
export class SessionSyncManager {
  private client: CloudClient;
  private db: Database.Database | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(client: CloudClient) {
    this.client = client;
  }

  private getDb(): Database.Database {
    if (!this.db) {
      const dbPath = path.join(app.getPath('userData'), 'analytics.db');
      this.db = new Database(dbPath);
    }
    return this.db;
  }

  /**
   * Initialize sync manager and start periodic sync
   */
  async initialize(): Promise<void> {
    // Add cloud sync columns if not exists
    this.ensureSyncColumns();

    // Start periodic sync
    this.startPeriodicSync();
  }

  /**
   * Add cloud_synced and cloud_session_id columns to sessions table
   */
  private ensureSyncColumns(): void {
    const db = this.getDb();
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN cloud_synced INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }

    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN cloud_session_id TEXT`);
    } catch (e) {
      // Column already exists
    }
  }

  /**
   * Sync unsynced sessions to cloud
   */
  async syncToCloud(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
      const db = this.getDb();

      // Get unsynced completed sessions (completed = 1)
      const unsyncedSessions = db.prepare(`
        SELECT * FROM sessions
        WHERE cloud_synced = 0
        AND completed = 1
        ORDER BY start_time ASC
        LIMIT 50
      `).all() as LocalSession[];

      for (const session of unsyncedSessions) {
        try {
          // Get payment details for this session
          const payment = db.prepare(`
            SELECT * FROM payments WHERE session_id = ?
          `).get(session.session_id) as LocalPayment | undefined;

          // Create or update cloud session
          const cloudData = this.mapToCloudFormat(session, payment);

          if (!session.cloud_session_id) {
            // Create new cloud session
            const response = await this.client.createSession({
              sessionCode: session.session_id,  // Use session_id as session code
              frameId: session.frame_selected,
            });

            if (response.success && response.data) {
              // Update with full data
              await this.client.updateSession(response.data.sessionId, cloudData);

              // Mark as synced
              db.prepare(`
                UPDATE sessions
                SET cloud_synced = 1, cloud_session_id = ?
                WHERE id = ?
              `).run(response.data.sessionId, session.id);

              synced++;
            } else {
              failed++;
            }
          } else {
            // Update existing cloud session
            await this.client.updateSession(session.cloud_session_id, cloudData);

            // Mark as synced
            db.prepare(`UPDATE sessions SET cloud_synced = 1 WHERE id = ?`).run(session.id);

            synced++;
          }
        } catch (error) {
          console.error(`[SessionSync] Failed to sync session ${session.session_id}:`, error);
          failed++;
        }
      }
    } finally {
      this.isSyncing = false;
    }

    if (synced > 0) {
      console.log(`[SessionSync] Synced ${synced} sessions to cloud`);
    }

    return { synced, failed };
  }

  /**
   * Map local session to cloud API format
   * NOTE: Local schema uses different field names than cloud
   */
  private mapToCloudFormat(session: LocalSession, payment?: LocalPayment): object {
    return {
      status: session.completed ? 'completed' : 'started',
      processingTimeMs: session.duration_seconds ? session.duration_seconds * 1000 : undefined,
      completedAt: session.end_time ? new Date(session.end_time).toISOString() : undefined,

      // Payment details
      paymentAmount: payment?.amount,
      currency: 'KRW',

      // TL3600 Payment Details
      approvalNumber: payment?.approval_number,
      salesDate: payment?.sales_date,
      salesTime: payment?.sales_time,
      transactionMedia: payment?.transaction_media,
      cardNumber: payment?.card_number,
    };
  }

  /**
   * Sync a specific session immediately (call after completion)
   */
  async syncSession(sessionId: string): Promise<boolean> {
    const db = this.getDb();
    const session = db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `).get(sessionId) as LocalSession | undefined;

    if (!session) {
      return false;
    }

    const payment = db.prepare(`
      SELECT * FROM payments WHERE session_id = ?
    `).get(sessionId) as LocalPayment | undefined;

    try {
      const cloudData = this.mapToCloudFormat(session, payment);

      if (!session.cloud_session_id) {
        const response = await this.client.createSession({
          sessionCode: session.session_id,
          frameId: session.frame_selected,
        });

        if (response.success && response.data) {
          await this.client.updateSession(response.data.sessionId, cloudData);

          db.prepare(`
            UPDATE sessions
            SET cloud_synced = 1, cloud_session_id = ?
            WHERE id = ?
          `).run(response.data.sessionId, session.id);

          return true;
        }
      } else {
        await this.client.updateSession(session.cloud_session_id, cloudData);
        db.prepare(`UPDATE sessions SET cloud_synced = 1 WHERE id = ?`).run(session.id);
        return true;
      }
    } catch (error) {
      console.error(`[SessionSync] Failed to sync session ${sessionId}:`, error);
    }

    return false;
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.syncToCloud();
    }, SYNC_INTERVAL);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { pending: number; synced: number } {
    const db = this.getDb();
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE cloud_synced = 0 AND completed = 1
    `).get() as { count: number };

    const synced = db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE cloud_synced = 1
    `).get() as { count: number };

    return {
      pending: pending?.count || 0,
      synced: synced?.count || 0,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.stopPeriodicSync();
  }
}

export default SessionSyncManager;
