import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { machineCommands, machines } from '../src/lib/db/schema';

async function testCommand() {
  console.log('Creating test command...\n');

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

  // Create a clear-cache command - use a valid UUID format for createdBy
  const [command] = await db
    .insert(machineCommands)
    .values({
      machineId: machine.id,
      type: 'clear-cache',
      payload: { types: ['temp'] },
      status: 'pending',
      createdBy: '00000000-0000-0000-0000-000000000000', // dummy UUID for testing
    })
    .returning();

  if (!command) {
    console.log('Failed to create command');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('Test Command Created Successfully!');
  console.log('========================================');
  console.log('Command ID:', command.id);
  console.log('Type:', command.type);
  console.log('Status:', command.status);
  console.log('========================================');
  console.log('\nWait for Electron to poll (every 30 seconds)...');
  console.log('Watch Electron console for "Executing command: clear-cache"');
  console.log('========================================\n');

  process.exit(0);
}

testCommand().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
