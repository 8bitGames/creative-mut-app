import 'dotenv/config';
import { desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { machines, sessions } from '../src/lib/db/schema';

async function testSessionSync() {
  console.log('Testing Session Sync...\n');

  // Get the machine
  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.hardwareId, 'f7c2a2b02a4856364598b199578336e0'))
    .limit(1);

  if (!machine) {
    console.log('Machine not found!');
    process.exit(1);
  }

  console.log('Found machine:', machine.id, machine.name);

  // Create a test session directly in cloud database (simulating what Electron's SessionSyncManager does)
  const sessionCode = `test_session_${Date.now()}`;

  console.log('\n========================================');
  console.log('Creating test session in cloud database...');
  console.log('========================================');

  const [session] = await db
    .insert(sessions)
    .values({
      machineId: machine.id,
      sessionCode: sessionCode,
      frameId: 'test-frame-1',
      processingMode: 'standard',
      status: 'started',
    })
    .returning();

  if (!session) {
    console.log('Failed to create session');
    process.exit(1);
  }

  console.log('Session created:', {
    id: session.id,
    sessionCode: session.sessionCode,
    status: session.status,
  });

  // Update to completed status (simulating session completion)
  console.log('\nUpdating session to completed status...');

  const [updated] = await db
    .update(sessions)
    .set({
      status: 'completed',
      processingTimeMs: 45000,
      paymentAmount: '5000',
      currency: 'KRW',
      completedAt: new Date(),
      approvalNumber: '12345678',
      salesDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      salesTime: new Date().toTimeString().slice(0, 8).replace(/:/g, ''),
      transactionMedia: 'ic',
      cardNumber: '****-****-****-1234',
    })
    .where(eq(sessions.id, session.id))
    .returning();

  if (!updated) {
    console.log('Failed to update session');
    process.exit(1);
  }

  console.log('Session updated:', {
    id: updated.id,
    status: updated.status,
    paymentAmount: updated.paymentAmount,
    approvalNumber: updated.approvalNumber,
  });

  // List all sessions for this machine
  console.log('\n========================================');
  console.log('All sessions for this machine:');
  console.log('========================================');

  const allSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.machineId, machine.id))
    .orderBy(desc(sessions.startedAt))
    .limit(10);

  for (const s of allSessions) {
    console.log(`- ${s.sessionCode}: ${s.status} (payment: ${s.paymentAmount || 'N/A'})`);
  }

  console.log('\n========================================');
  console.log('Session Sync Test Completed!');
  console.log('========================================');
  console.log('Check the cloud dashboard Sessions page to verify the session appears.');
  console.log('URL: http://localhost:3001/sessions');
  console.log('========================================\n');

  process.exit(0);
}

testSessionSync().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
