/**
 * Insert sample data into analytics database for testing
 */
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the database path (same as in analytics.ts)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'mutui-hologram-studio');
const dbPath = path.join(userDataPath, 'analytics.db');

console.log(`Opening database at: ${dbPath}`);

const db = new Database(dbPath);

// Clear existing data first
console.log('Clearing existing sample data...');
db.exec('DELETE FROM prints');
db.exec('DELETE FROM payments');
db.exec('DELETE FROM sessions');

// Sample frames
const frames = ['프레임A', '프레임B', '프레임C', '프레임D', '프레임E'];

// Generate sample sessions (100 sessions over the past 7 days)
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

console.log('Inserting sample data...');

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
let stats = {
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
  const sessionId = `sample_session_${Date.now()}_${i}`;
  const daysAgo = Math.floor(Math.random() * 7);
  const hoursAgo = Math.floor(Math.random() * 24);
  const startTime = now - (daysAgo * dayMs) - (hoursAgo * 60 * 60 * 1000);

  stats.sessionsStarted++;

  // 85% select a frame
  const selectedFrame = Math.random() < 0.85;
  const frameName = selectedFrame ? frames[Math.floor(Math.random() * frames.length)] : null;

  if (selectedFrame) stats.frameSelected++;

  // 90% of those who selected frame complete recording
  const recordingCompleted = selectedFrame && Math.random() < 0.90;
  const imagesCaptured = recordingCompleted ? Math.floor(Math.random() * 3) + 1 : 0;

  if (recordingCompleted) stats.recordingCompleted++;

  // 95% of those who recorded complete processing
  const processingCompleted = recordingCompleted && Math.random() < 0.95;

  if (processingCompleted) stats.processingCompleted++;

  // Duration: 2-8 minutes
  const durationSeconds = processingCompleted ? Math.floor(Math.random() * 360) + 120 : Math.floor(Math.random() * 60);
  const endTime = processingCompleted ? startTime + (durationSeconds * 1000) : null;

  // Insert session
  insertSession.run(
    sessionId,
    startTime,
    endTime,
    durationSeconds,
    frameName,
    imagesCaptured,
    processingCompleted ? 1 : 0
  );

  // 85% of those who completed processing attempt payment
  const paymentAttempted = processingCompleted && Math.random() < 0.85;

  if (paymentAttempted) {
    stats.paymentAttempted++;

    // 80% payment success rate
    const paymentApproved = Math.random() < 0.80;
    const paymentTime = startTime + (durationSeconds * 1000) + 5000;

    if (paymentApproved) {
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
      const printCompleted = Math.random() < 0.95;

      if (printCompleted) {
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

db.close();

console.log('\n=== Sample Data Statistics ===');
console.log(`Sessions Started: ${stats.sessionsStarted}`);
console.log(`Frame Selected: ${stats.frameSelected} (${Math.round(stats.frameSelected / stats.sessionsStarted * 100)}%)`);
console.log(`Recording Completed: ${stats.recordingCompleted} (${Math.round(stats.recordingCompleted / stats.frameSelected * 100)}%)`);
console.log(`Processing Completed: ${stats.processingCompleted} (${Math.round(stats.processingCompleted / stats.recordingCompleted * 100)}%)`);
console.log(`Payment Attempted: ${stats.paymentAttempted} (${Math.round(stats.paymentAttempted / stats.processingCompleted * 100)}%)`);
console.log(`Payment Approved: ${stats.paymentApproved} (${Math.round(stats.paymentApproved / stats.paymentAttempted * 100)}%)`);
console.log(`Print Completed: ${stats.printCompleted} (${Math.round(stats.printCompleted / stats.paymentApproved * 100)}%)`);
console.log(`\nOverall Conversion: ${Math.round(stats.printCompleted / stats.sessionsStarted * 100)}%`);
console.log('\nSample data inserted successfully!');
