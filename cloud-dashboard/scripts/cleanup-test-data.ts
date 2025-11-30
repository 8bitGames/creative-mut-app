import 'dotenv/config';
import { and, eq, like } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { alerts, machineLogs, machines, sessions } from '../src/lib/db/schema';

async function cleanupTestData() {
  console.log('Cleaning up test data...\n');

  // Get the machine
  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.hardwareId, 'f7c2a2b02a4856364598b199578336e0'))
    .limit(1);

  if (!machine) {
    console.log('Machine not found - nothing to clean up');
    process.exit(0);
  }

  // Delete test sessions
  const deletedSessions = await db
    .delete(sessions)
    .where(like(sessions.sessionCode, 'test_session_%'))
    .returning();
  console.log(`Deleted ${deletedSessions.length} test sessions`);

  // Delete test alerts
  const deletedAlerts = await db.delete(alerts).where(eq(alerts.machineId, machine.id)).returning();
  console.log(`Deleted ${deletedAlerts.length} test alerts`);

  // Delete test logs (keep system logs)
  const deletedLogs = await db
    .delete(machineLogs)
    .where(and(eq(machineLogs.machineId, machine.id), eq(machineLogs.category, 'test')))
    .returning();
  console.log(`Deleted ${deletedLogs.length} test logs`);

  console.log('\n========================================');
  console.log('Cleanup completed!');
  console.log('========================================\n');

  process.exit(0);
}

cleanupTestData().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
