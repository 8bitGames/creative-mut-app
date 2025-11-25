/**
 * Analytics Database Module
 * Local SQLite storage for session and payment analytics
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export interface SessionRecord {
  id?: number;
  session_id: string;
  start_time: number;
  end_time?: number;
  duration_seconds?: number;
  frame_selected?: string;
  images_captured: number;
  completed: boolean;
  created_at?: string;
}

export interface PaymentRecord {
  id?: number;
  session_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' | 'error';
  payment_time: number;
  error_message?: string;
  created_at?: string;
}

export interface PrintRecord {
  id?: number;
  session_id: string;
  image_path: string;
  print_time: number;
  success: boolean;
  error_message?: string;
  created_at?: string;
}

export interface DashboardStats {
  // Today's stats
  todaySessions: number;
  todayRevenue: number;
  todaySuccessRate: number;

  // Total stats
  totalSessions: number;
  totalRevenue: number;
  totalSuccessRate: number;

  // Popular frames
  popularFrames: Array<{ frame: string; count: number }>;

  // Recent sessions
  recentSessions: Array<{
    session_id: string;
    start_time: number;
    duration_seconds: number;
    frame_selected: string;
    payment_status: string;
    amount: number;
  }>;

  // Hourly distribution (for chart)
  hourlyDistribution: Array<{ hour: number; count: number }>;

  // Daily revenue (last 7 days)
  dailyRevenue: Array<{ date: string; revenue: number; sessions: number }>;
}

/**
 * Initialize SQLite database
 */
export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'analytics.db');
  console.log(`📊 [Analytics] Initializing database at: ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_seconds INTEGER,
      frame_selected TEXT,
      images_captured INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      payment_time INTEGER NOT NULL,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS prints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      image_path TEXT,
      print_time INTEGER NOT NULL,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `);

  console.log('✅ [Analytics] Database initialized');
}

/**
 * Record a new session start
 */
export function recordSessionStart(sessionId: string, startTime: number): void {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (session_id, start_time, images_captured, completed)
    VALUES (?, ?, 0, 0)
  `);

  stmt.run(sessionId, startTime);
  console.log(`📊 [Analytics] Session started: ${sessionId}`);
}

/**
 * Update session with captured images count
 */
export function updateSessionImages(sessionId: string, imageCount: number): void {
  if (!db) return;

  const stmt = db.prepare(`
    UPDATE sessions SET images_captured = ? WHERE session_id = ?
  `);

  stmt.run(imageCount, sessionId);
}

/**
 * Update session with selected frame
 */
export function updateSessionFrame(sessionId: string, frameName: string): void {
  if (!db) return;

  const stmt = db.prepare(`
    UPDATE sessions SET frame_selected = ? WHERE session_id = ?
  `);

  stmt.run(frameName, sessionId);
}

/**
 * Complete a session
 */
export function recordSessionEnd(sessionId: string, endTime: number): void {
  if (!db) return;

  const stmt = db.prepare(`
    UPDATE sessions
    SET end_time = ?,
        duration_seconds = (? - start_time) / 1000,
        completed = 1
    WHERE session_id = ?
  `);

  stmt.run(endTime, endTime, sessionId);
  console.log(`📊 [Analytics] Session completed: ${sessionId}`);
}

/**
 * Record a payment attempt
 */
export function recordPayment(
  sessionId: string,
  amount: number,
  status: PaymentRecord['status'],
  errorMessage?: string
): void {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT INTO payments (session_id, amount, status, payment_time, error_message)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(sessionId, amount, status, Date.now(), errorMessage || null);
  console.log(`📊 [Analytics] Payment recorded: ${sessionId} - ${status} - ${amount}원`);
}

/**
 * Record a print job
 */
export function recordPrint(
  sessionId: string,
  imagePath: string,
  success: boolean,
  errorMessage?: string
): void {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT INTO prints (session_id, image_path, print_time, success, error_message)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(sessionId, imagePath, Date.now(), success ? 1 : 0, errorMessage || null);
  console.log(`📊 [Analytics] Print recorded: ${sessionId} - ${success ? 'success' : 'failed'}`);
}

/**
 * Get dashboard statistics
 */
export function getDashboardStats(): DashboardStats {
  if (!db) {
    return {
      todaySessions: 0,
      todayRevenue: 0,
      todaySuccessRate: 0,
      totalSessions: 0,
      totalRevenue: 0,
      totalSuccessRate: 0,
      popularFrames: [],
      recentSessions: [],
      hourlyDistribution: [],
      dailyRevenue: [],
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();

  // Today's sessions
  const todaySessions = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE start_time >= ?
  `).get(todayTimestamp) as { count: number };

  // Today's revenue
  const todayRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE status = 'approved' AND payment_time >= ?
  `).get(todayTimestamp) as { total: number };

  // Today's success rate
  const todayPayments = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM payments WHERE payment_time >= ?
  `).get(todayTimestamp) as { total: number; approved: number };

  // Total sessions
  const totalSessions = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
  `).get() as { count: number };

  // Total revenue
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'approved'
  `).get() as { total: number };

  // Total success rate
  const totalPayments = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM payments
  `).get() as { total: number; approved: number };

  // Popular frames
  const popularFrames = db.prepare(`
    SELECT frame_selected as frame, COUNT(*) as count
    FROM sessions
    WHERE frame_selected IS NOT NULL
    GROUP BY frame_selected
    ORDER BY count DESC
    LIMIT 5
  `).all() as Array<{ frame: string; count: number }>;

  // Recent sessions with payment info
  const recentSessions = db.prepare(`
    SELECT
      s.session_id,
      s.start_time,
      COALESCE(s.duration_seconds, 0) as duration_seconds,
      COALESCE(s.frame_selected, 'N/A') as frame_selected,
      COALESCE(p.status, 'N/A') as payment_status,
      COALESCE(p.amount, 0) as amount
    FROM sessions s
    LEFT JOIN payments p ON s.session_id = p.session_id
    ORDER BY s.start_time DESC
    LIMIT 20
  `).all() as Array<{
    session_id: string;
    start_time: number;
    duration_seconds: number;
    frame_selected: string;
    payment_status: string;
    amount: number;
  }>;

  // Hourly distribution (today)
  const hourlyDistribution = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(start_time/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
      COUNT(*) as count
    FROM sessions
    WHERE start_time >= ?
    GROUP BY hour
    ORDER BY hour
  `).all(todayTimestamp) as Array<{ hour: number; count: number }>;

  // Daily revenue (last 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const dailyRevenue = db.prepare(`
    SELECT
      date(payment_time/1000, 'unixepoch', 'localtime') as date,
      SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as revenue,
      COUNT(DISTINCT session_id) as sessions
    FROM payments
    WHERE payment_time >= ?
    GROUP BY date
    ORDER BY date DESC
  `).all(sevenDaysAgo) as Array<{ date: string; revenue: number; sessions: number }>;

  return {
    todaySessions: todaySessions.count,
    todayRevenue: todayRevenue.total,
    todaySuccessRate: todayPayments.total > 0
      ? Math.round((todayPayments.approved / todayPayments.total) * 100)
      : 0,
    totalSessions: totalSessions.count,
    totalRevenue: totalRevenue.total,
    totalSuccessRate: totalPayments.total > 0
      ? Math.round((totalPayments.approved / totalPayments.total) * 100)
      : 0,
    popularFrames,
    recentSessions,
    hourlyDistribution,
    dailyRevenue,
  };
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('📊 [Analytics] Database closed');
  }
}
