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
  // Cancellation-related fields (from TL3600)
  approval_number?: string;      // 승인번호 (12자리)
  sales_date?: string;           // 매출일 (YYYYMMDD, 8자리)
  sales_time?: string;           // 매출시간 (hhmmss)
  transaction_id?: string;       // 거래일련번호 (12자리, 취소시 뒷 6자리 사용)
  transaction_media?: string;    // 거래매체: '1' IC, '2' RF/MS, '3' RF
  card_number?: string;          // 카드번호 (마스킹)
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

/**
 * Flow statistics for user journey tracking
 */
export interface FlowStatistics {
  // Step counts
  sessionsStarted: number;
  frameSelected: number;
  recordingCompleted: number;
  processingCompleted: number;
  paymentAttempted: number;
  paymentApproved: number;
  printCompleted: number;

  // Conversion rates (percentage)
  frameSelectionRate: number;      // frameSelected / sessionsStarted
  recordingCompletionRate: number; // recordingCompleted / frameSelected
  processingCompletionRate: number;// processingCompleted / recordingCompleted
  paymentAttemptRate: number;      // paymentAttempted / processingCompleted
  paymentSuccessRate: number;      // paymentApproved / paymentAttempted
  printCompletionRate: number;     // printCompleted / paymentApproved
  overallConversionRate: number;   // printCompleted / sessionsStarted

  // Drop-off analysis
  dropOffPoints: Array<{
    step: string;
    dropped: number;
    dropRate: number;
  }>;
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
    // Cancellation-related fields
    approval_number?: string;
    sales_date?: string;
    sales_time?: string;
    transaction_id?: string;       // 거래일련번호 (12자리, 취소시 뒷 6자리 사용)
    transaction_media?: string;
    card_number?: string;
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
      approval_number TEXT,
      sales_date TEXT,
      sales_time TEXT,
      transaction_media TEXT,
      card_number TEXT,
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

  // Migration: Add new columns to existing payments table if they don't exist
  migratePaymentsTable();

  console.log('✅ [Analytics] Database initialized');
}

/**
 * Migrate payments table to add new cancellation-related columns
 */
function migratePaymentsTable(): void {
  if (!db) return;

  // Check if columns exist and add them if not
  const tableInfo = db.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>;
  const columnNames = tableInfo.map(col => col.name);

  const newColumns = [
    { name: 'approval_number', type: 'TEXT' },
    { name: 'sales_date', type: 'TEXT' },
    { name: 'sales_time', type: 'TEXT' },
    { name: 'transaction_id', type: 'TEXT' },
    { name: 'transaction_media', type: 'TEXT' },
    { name: 'card_number', type: 'TEXT' },
  ];

  for (const column of newColumns) {
    if (!columnNames.includes(column.name)) {
      try {
        db.exec(`ALTER TABLE payments ADD COLUMN ${column.name} ${column.type}`);
        console.log(`📊 [Analytics] Added column: payments.${column.name}`);
      } catch (error) {
        // Column might already exist, ignore error
        console.log(`📊 [Analytics] Column ${column.name} already exists or error:`, error);
      }
    }
  }
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
 * Payment details for cancellation support
 */
export interface PaymentDetails {
  approvalNumber?: string;      // 승인번호 (12자리)
  salesDate?: string;           // 매출일 (YYYYMMDD, 8자리)
  salesTime?: string;           // 매출시간 (hhmmss)
  transactionId?: string;       // 거래일련번호 (12자리, 취소시 뒷 6자리 사용)
  transactionMedia?: string;    // 거래매체: '1' IC, '2' RF/MS, '3' RF
  cardNumber?: string;          // 카드번호 (마스킹)
}

/**
 * Record a payment attempt
 */
export function recordPayment(
  sessionId: string,
  amount: number,
  status: PaymentRecord['status'],
  errorMessage?: string,
  details?: PaymentDetails
): void {
  if (!db) return;

  // Ensure session exists before recording payment (prevents foreign key constraint failure)
  const checkSession = db.prepare('SELECT session_id FROM sessions WHERE session_id = ?');
  const existingSession = checkSession.get(sessionId);

  if (!existingSession) {
    // Auto-create session if it doesn't exist
    console.log(`[Analytics] Auto-creating session for payment: ${sessionId}`);
    const createSession = db.prepare(`
      INSERT OR IGNORE INTO sessions (session_id, start_time, images_captured, completed)
      VALUES (?, ?, 0, 0)
    `);
    createSession.run(sessionId, Date.now());
  }

  const stmt = db.prepare(`
    INSERT INTO payments (session_id, amount, status, payment_time, error_message, approval_number, sales_date, sales_time, transaction_id, transaction_media, card_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    sessionId,
    amount,
    status,
    Date.now(),
    errorMessage || null,
    details?.approvalNumber || null,
    details?.salesDate || null,
    details?.salesTime || null,
    details?.transactionId || null,
    details?.transactionMedia || null,
    details?.cardNumber || null
  );
  console.log(`📊 [Analytics] Payment recorded: ${sessionId} - ${status} - ${amount}원 (approval: ${details?.approvalNumber || 'N/A'}, txId: ${details?.transactionId || 'N/A'})`);
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
 * Update payment status (e.g., mark as cancelled)
 */
export function updatePaymentStatus(
  sessionId: string,
  newStatus: PaymentRecord['status']
): boolean {
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      UPDATE payments SET status = ? WHERE session_id = ?
    `);
    const result = stmt.run(newStatus, sessionId);
    console.log(`📊 [Analytics] Payment status updated: ${sessionId} -> ${newStatus}`);
    return result.changes > 0;
  } catch (error) {
    console.error(`📊 [Analytics] Failed to update payment status:`, error);
    return false;
  }
}

/**
 * Update payment status by approval number (for cancellation from dashboard)
 */
export function updatePaymentStatusByApproval(
  approvalNumber: string,
  newStatus: PaymentRecord['status']
): boolean {
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      UPDATE payments SET status = ? WHERE approval_number = ?
    `);
    const result = stmt.run(newStatus, approvalNumber);
    console.log(`📊 [Analytics] Payment status updated by approval: ${approvalNumber} -> ${newStatus}`);
    return result.changes > 0;
  } catch (error) {
    console.error(`📊 [Analytics] Failed to update payment status by approval:`, error);
    return false;
  }
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

  // Recent sessions with payment info (including cancellation fields)
  // Use subquery to get only the latest payment record per session
  const recentSessions = db.prepare(`
    SELECT
      s.session_id,
      s.start_time,
      COALESCE(s.duration_seconds, 0) as duration_seconds,
      COALESCE(s.frame_selected, 'N/A') as frame_selected,
      COALESCE(p.status, 'N/A') as payment_status,
      COALESCE(p.amount, 0) as amount,
      p.approval_number,
      p.sales_date,
      p.sales_time,
      p.transaction_id,
      p.transaction_media,
      p.card_number
    FROM sessions s
    LEFT JOIN (
      SELECT * FROM payments p1
      WHERE p1.id = (
        SELECT p2.id FROM payments p2
        WHERE p2.session_id = p1.session_id
        ORDER BY p2.payment_time DESC
        LIMIT 1
      )
    ) p ON s.session_id = p.session_id
    ORDER BY s.start_time DESC
    LIMIT 20
  `).all() as Array<{
    session_id: string;
    start_time: number;
    duration_seconds: number;
    frame_selected: string;
    payment_status: string;
    amount: number;
    approval_number?: string;
    sales_date?: string;
    sales_time?: string;
    transaction_id?: string;
    transaction_media?: string;
    card_number?: string;
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
 * Get flow statistics for user journey analysis
 */
export function getFlowStatistics(): FlowStatistics {
  if (!db) {
    return {
      sessionsStarted: 0,
      frameSelected: 0,
      recordingCompleted: 0,
      processingCompleted: 0,
      paymentAttempted: 0,
      paymentApproved: 0,
      printCompleted: 0,
      frameSelectionRate: 0,
      recordingCompletionRate: 0,
      processingCompletionRate: 0,
      paymentAttemptRate: 0,
      paymentSuccessRate: 0,
      printCompletionRate: 0,
      overallConversionRate: 0,
      dropOffPoints: [],
    };
  }

  // Step 1: Total sessions started
  const sessionsStarted = (db.prepare(`
    SELECT COUNT(*) as count FROM sessions
  `).get() as { count: number }).count;

  // Step 2: Sessions with frame selected
  const frameSelected = (db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE frame_selected IS NOT NULL
  `).get() as { count: number }).count;

  // Step 3: Sessions with recording completed (images_captured > 0)
  const recordingCompleted = (db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE images_captured > 0
  `).get() as { count: number }).count;

  // Step 4: Sessions that completed processing (completed = 1)
  const processingCompleted = (db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE completed = 1
  `).get() as { count: number }).count;

  // Step 5: Sessions with payment attempted
  const paymentAttempted = (db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM payments
  `).get() as { count: number }).count;

  // Step 6: Sessions with payment approved
  const paymentApproved = (db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM payments WHERE status = 'approved'
  `).get() as { count: number }).count;

  // Step 7: Sessions with print completed
  const printCompleted = (db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM prints WHERE success = 1
  `).get() as { count: number }).count;

  // Calculate conversion rates
  const calcRate = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  };

  const frameSelectionRate = calcRate(frameSelected, sessionsStarted);
  const recordingCompletionRate = calcRate(recordingCompleted, frameSelected);
  const processingCompletionRate = calcRate(processingCompleted, recordingCompleted);
  const paymentAttemptRate = calcRate(paymentAttempted, processingCompleted);
  const paymentSuccessRate = calcRate(paymentApproved, paymentAttempted);
  const printCompletionRate = calcRate(printCompleted, paymentApproved);
  const overallConversionRate = calcRate(printCompleted, sessionsStarted);

  // Calculate drop-offs
  const dropOffPoints = [
    {
      step: '프레임 선택',
      dropped: sessionsStarted - frameSelected,
      dropRate: calcRate(sessionsStarted - frameSelected, sessionsStarted),
    },
    {
      step: '녹화 완료',
      dropped: frameSelected - recordingCompleted,
      dropRate: calcRate(frameSelected - recordingCompleted, frameSelected),
    },
    {
      step: '처리 완료',
      dropped: recordingCompleted - processingCompleted,
      dropRate: calcRate(recordingCompleted - processingCompleted, recordingCompleted),
    },
    {
      step: '결제 시도',
      dropped: processingCompleted - paymentAttempted,
      dropRate: calcRate(processingCompleted - paymentAttempted, processingCompleted),
    },
    {
      step: '결제 승인',
      dropped: paymentAttempted - paymentApproved,
      dropRate: calcRate(paymentAttempted - paymentApproved, paymentAttempted),
    },
    {
      step: '인쇄 완료',
      dropped: paymentApproved - printCompleted,
      dropRate: calcRate(paymentApproved - printCompleted, paymentApproved),
    },
  ];

  return {
    sessionsStarted,
    frameSelected,
    recordingCompleted,
    processingCompleted,
    paymentAttempted,
    paymentApproved,
    printCompleted,
    frameSelectionRate,
    recordingCompletionRate,
    processingCompletionRate,
    paymentAttemptRate,
    paymentSuccessRate,
    printCompletionRate,
    overallConversionRate,
    dropOffPoints,
  };
}

/**
 * Insert sample data for testing the dashboard
 */
export function insertSampleData(): { success: boolean; stats: { sessionsStarted: number; frameSelected: number; recordingCompleted: number; processingCompleted: number; paymentAttempted: number; paymentApproved: number; printCompleted: number } } {
  if (!db) {
    return { success: false, stats: { sessionsStarted: 0, frameSelected: 0, recordingCompleted: 0, processingCompleted: 0, paymentAttempted: 0, paymentApproved: 0, printCompleted: 0 } };
  }

  console.log('📊 [Analytics] Inserting sample data...');

  // Clear existing data first
  db.exec('DELETE FROM prints');
  db.exec('DELETE FROM payments');
  db.exec('DELETE FROM sessions');

  // Sample frames
  const frames = ['프레임A', '프레임B', '프레임C', '프레임D', '프레임E'];

  // Generate sample sessions (100 sessions over the past 7 days)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const insertSession = db.prepare(`
    INSERT INTO sessions (session_id, start_time, end_time, duration_seconds, frame_selected, images_captured, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (session_id, amount, status, payment_time, approval_number, sales_date, sales_time, transaction_media, card_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPrint = db.prepare(`
    INSERT INTO prints (session_id, image_path, print_time, success)
    VALUES (?, ?, ?, ?)
  `);

  // Statistics for the funnel
  const stats = {
    sessionsStarted: 0,
    frameSelected: 0,
    recordingCompleted: 0,
    processingCompleted: 0,
    paymentAttempted: 0,
    paymentApproved: 0,
    printCompleted: 0
  };

  // Create 100 sessions with realistic drop-off rates
  for (let i = 0; i < 100; i++) {
    const sessionId = `sample_session_${now}_${i}`;
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const startTime = now - (daysAgo * dayMs) - (hoursAgo * 60 * 60 * 1000);

    stats.sessionsStarted++;

    // 85% select a frame
    const selectedFrame = Math.random() < 0.85;
    const frameName = selectedFrame ? frames[Math.floor(Math.random() * frames.length)] : null;

    if (selectedFrame) stats.frameSelected++;

    // 90% of those who selected frame complete recording
    const recordingDone = selectedFrame && Math.random() < 0.90;
    const imagesCaptured = recordingDone ? Math.floor(Math.random() * 3) + 1 : 0;

    if (recordingDone) stats.recordingCompleted++;

    // 95% of those who recorded complete processing
    const processingDone = recordingDone && Math.random() < 0.95;

    if (processingDone) stats.processingCompleted++;

    // Duration: 2-8 minutes
    const durationSeconds = processingDone ? Math.floor(Math.random() * 360) + 120 : Math.floor(Math.random() * 60);
    const endTime = processingDone ? startTime + (durationSeconds * 1000) : null;

    // Insert session
    insertSession.run(
      sessionId,
      startTime,
      endTime,
      durationSeconds,
      frameName,
      imagesCaptured,
      processingDone ? 1 : 0
    );

    // 85% of those who completed processing attempt payment
    const paymentAttemptedFlag = processingDone && Math.random() < 0.85;

    if (paymentAttemptedFlag) {
      stats.paymentAttempted++;

      // 80% payment success rate
      const paymentApprovedFlag = Math.random() < 0.80;
      const paymentTime = startTime + (durationSeconds * 1000) + 5000;

      if (paymentApprovedFlag) {
        stats.paymentApproved++;

        // Generate approval details
        const salesDate = new Date(paymentTime).toISOString().slice(0, 10).replace(/-/g, '');
        const salesTime = new Date(paymentTime).toTimeString().slice(0, 8).replace(/:/g, '');
        const approvalNumber = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const transactionMedia = ['1', '2', '3'][Math.floor(Math.random() * 3)];
        const cardLast4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

        insertPayment.run(
          sessionId,
          5000,
          'approved',
          paymentTime,
          approvalNumber,
          salesDate,
          salesTime,
          transactionMedia,
          `****-****-****-${cardLast4}`
        );

        // 95% of approved payments result in successful print
        const printDone = Math.random() < 0.95;

        if (printDone) {
          stats.printCompleted++;

          insertPrint.run(
            sessionId,
            `/frames/${sessionId}_print.jpg`,
            paymentTime + 30000,
            1
          );
        } else {
          // Print failed
          insertPrint.run(
            sessionId,
            `/frames/${sessionId}_print.jpg`,
            paymentTime + 30000,
            0
          );
        }
      } else {
        // Payment declined
        insertPayment.run(
          sessionId,
          5000,
          'declined',
          paymentTime,
          null,
          null,
          null,
          null,
          null
        );
      }
    }
  }

  console.log('✅ [Analytics] Sample data inserted');
  console.log(`   Sessions Started: ${stats.sessionsStarted}`);
  console.log(`   Frame Selected: ${stats.frameSelected}`);
  console.log(`   Recording Completed: ${stats.recordingCompleted}`);
  console.log(`   Processing Completed: ${stats.processingCompleted}`);
  console.log(`   Payment Attempted: ${stats.paymentAttempted}`);
  console.log(`   Payment Approved: ${stats.paymentApproved}`);
  console.log(`   Print Completed: ${stats.printCompleted}`);

  return { success: true, stats };
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
