import 'dotenv/config';
import { desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { alerts, machines } from '../src/lib/db/schema';

async function testAlerts() {
  console.log('Testing Alerts System...\n');

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

  // Create test alerts
  console.log('\n========================================');
  console.log('Creating test alerts...');
  console.log('========================================');

  const testAlerts = [
    {
      machineId: machine.id,
      severity: 'warning',
      type: 'disk_space',
      title: '디스크 용량 부족 경고',
      message: '디스크 사용량이 85%를 초과했습니다. 정리가 필요합니다.',
      metadata: { usedPercent: 87, freeSpace: '15GB' },
    },
    {
      machineId: machine.id,
      severity: 'error',
      type: 'printer_error',
      title: '프린터 연결 오류',
      message: '프린터 통신에 실패했습니다. 연결을 확인해 주세요.',
      metadata: { errorCode: 'PRINTER_TIMEOUT', attempts: 3 },
    },
    {
      machineId: machine.id,
      severity: 'critical',
      type: 'payment_error',
      title: '결제 단말기 오류',
      message: '결제 단말기가 응답하지 않습니다. 즉시 확인이 필요합니다.',
      metadata: { terminalId: 'TL3600', lastResponse: '10분 전' },
    },
    {
      machineId: machine.id,
      severity: 'info',
      type: 'maintenance',
      title: '정기 점검 알림',
      message: '다음 주 정기 점검이 예정되어 있습니다.',
      metadata: { scheduledDate: '2025-12-07' },
    },
  ];

  for (const alertData of testAlerts) {
    const [alert] = await db.insert(alerts).values(alertData).returning();

    if (alert) {
      console.log(`- Created ${alert.severity.toUpperCase()} alert: ${alert.title}`);
    }
  }

  // List all alerts for this machine
  console.log('\n========================================');
  console.log('All alerts for this machine:');
  console.log('========================================');

  const allAlerts = await db
    .select()
    .from(alerts)
    .where(eq(alerts.machineId, machine.id))
    .orderBy(desc(alerts.createdAt))
    .limit(10);

  for (const a of allAlerts) {
    const status = a.resolved ? '해결됨' : a.acknowledged ? '확인됨' : '활성';
    console.log(`- [${a.severity.toUpperCase()}] ${a.title} - ${status}`);
  }

  // Acknowledge one alert
  const firstUnacknowledged = allAlerts.find((a) => !a.acknowledged) ?? null;
  if (firstUnacknowledged) {
    console.log('\n========================================');
    console.log(`Acknowledging alert: ${firstUnacknowledged.title}`);
    console.log('========================================');

    await db
      .update(alerts)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: '00000000-0000-0000-0000-000000000000', // dummy UUID
      })
      .where(eq(alerts.id, firstUnacknowledged.id));

    console.log('Alert acknowledged!');
  }

  // Resolve another alert
  const secondUnresolved =
    allAlerts.find((a) => !a.resolved && a.id !== firstUnacknowledged?.id) ?? null;
  if (secondUnresolved) {
    console.log('\n========================================');
    console.log(`Resolving alert: ${secondUnresolved.title}`);
    console.log('========================================');

    await db
      .update(alerts)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: '00000000-0000-0000-0000-000000000000',
      })
      .where(eq(alerts.id, secondUnresolved.id));

    console.log('Alert resolved!');
  }

  // Show updated stats
  console.log('\n========================================');
  console.log('Alert Statistics:');
  console.log('========================================');

  const stats = await db.select().from(alerts).where(eq(alerts.machineId, machine.id));

  const critical = stats.filter((a) => a.severity === 'critical' && !a.resolved).length;
  const error = stats.filter((a) => a.severity === 'error' && !a.resolved).length;
  const warning = stats.filter((a) => a.severity === 'warning' && !a.resolved).length;
  const info = stats.filter((a) => a.severity === 'info' && !a.resolved).length;
  const resolved = stats.filter((a) => a.resolved).length;

  console.log(`Critical: ${critical}`);
  console.log(`Error: ${error}`);
  console.log(`Warning: ${warning}`);
  console.log(`Info: ${info}`);
  console.log(`Resolved: ${resolved}`);

  console.log('\n========================================');
  console.log('Alerts Test Completed!');
  console.log('========================================');
  console.log('Check the cloud dashboard Alerts page to verify:');
  console.log('URL: http://localhost:3001/alerts');
  console.log('========================================\n');

  process.exit(0);
}

testAlerts().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
