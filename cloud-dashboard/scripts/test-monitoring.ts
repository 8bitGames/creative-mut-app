import 'dotenv/config';
import { desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { machineLogs, machines } from '../src/lib/db/schema';

async function testMonitoring() {
  console.log('Testing Monitoring System...\n');

  // Get the machine with full details
  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.hardwareId, 'f7c2a2b02a4856364598b199578336e0'))
    .limit(1);

  if (!machine) {
    console.log('Machine not found!');
    process.exit(1);
  }

  console.log('========================================');
  console.log('Machine Status:');
  console.log('========================================');
  console.log('ID:', machine.id);
  console.log('Name:', machine.name);
  console.log('Status:', machine.status);
  console.log('Last Heartbeat:', machine.lastHeartbeat?.toISOString() || 'Never');
  console.log('Config Version:', machine.configVersion || 'N/A');
  console.log('Peripheral Status:', JSON.stringify(machine.peripheralStatus, null, 2));

  // Check if heartbeat is recent (within last 2 minutes)
  const lastHeartbeat = machine.lastHeartbeat;
  const now = new Date();
  if (lastHeartbeat) {
    const diffMs = now.getTime() - lastHeartbeat.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    console.log(`\nHeartbeat Age: ${diffSec} seconds ago`);

    if (diffSec < 120) {
      console.log('✅ Machine is actively sending heartbeats');
    } else {
      console.log('⚠️  Machine heartbeat is stale');
    }
  }

  // Get recent logs
  console.log('\n========================================');
  console.log('Recent Machine Logs:');
  console.log('========================================');

  const logs = await db
    .select()
    .from(machineLogs)
    .where(eq(machineLogs.machineId, machine.id))
    .orderBy(desc(machineLogs.timestamp))
    .limit(10);

  if (logs.length === 0) {
    console.log('No logs found');
  } else {
    for (const log of logs) {
      const time = log.timestamp?.toISOString().slice(11, 19) || 'N/A';
      console.log(`[${time}] [${log.level.toUpperCase()}] ${log.category}: ${log.message}`);
    }
  }

  // Test log insertion
  console.log('\n========================================');
  console.log('Inserting test log entry...');
  console.log('========================================');

  await db.insert(machineLogs).values({
    machineId: machine.id,
    level: 'info',
    category: 'test',
    message: 'Test log entry from monitoring script',
    metadata: { source: 'test-monitoring.ts' },
  });

  console.log('✅ Test log inserted');

  console.log('\n========================================');
  console.log('Monitoring Test Completed!');
  console.log('========================================');
  console.log('Machine is being monitored by the cloud dashboard.');
  console.log('View machine details at: http://localhost:3001/machines');
  console.log('========================================\n');

  process.exit(0);
}

testMonitoring().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
