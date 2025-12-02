/**
 * One-time script to mark the last transaction as cancelled in the database
 *
 * Usage: node scripts/mark-last-cancelled.cjs
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Database path for Windows
const appName = 'creative-mut-app';
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
const dbPath = path.join(userDataPath, 'analytics.db');

console.log(`[DB] Opening database at: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // Find the last approved payment
  const lastPayment = db.prepare(`
    SELECT id, session_id, amount, status, approval_number, sales_date, transaction_id
    FROM payments
    WHERE status = 'approved'
    ORDER BY payment_time DESC
    LIMIT 1
  `).get();

  if (!lastPayment) {
    console.log('[DB] No approved payments found.');
    process.exit(0);
  }

  console.log('[DB] Last approved payment:');
  console.log(`  - ID: ${lastPayment.id}`);
  console.log(`  - Session: ${lastPayment.session_id}`);
  console.log(`  - Amount: ${lastPayment.amount}`);
  console.log(`  - Approval Number: ${lastPayment.approval_number || 'N/A'}`);
  console.log(`  - Sales Date: ${lastPayment.sales_date || 'N/A'}`);
  console.log(`  - Transaction ID: ${lastPayment.transaction_id || 'N/A'}`);

  // Update the status to cancelled
  const result = db.prepare(`
    UPDATE payments SET status = 'cancelled' WHERE id = ?
  `).run(lastPayment.id);

  if (result.changes > 0) {
    console.log(`\n[OK] Successfully marked payment #${lastPayment.id} as cancelled.`);
  } else {
    console.log('\n[WARN] No changes made.');
  }

  db.close();
} catch (error) {
  console.error('[ERROR] Failed to update database:', error.message);
  process.exit(1);
}
