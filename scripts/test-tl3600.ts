/**
 * TL3600 Connection Test Script
 * Run with: npx ts-node scripts/test-tl3600.ts
 */

import { TL3600Controller } from '../electron/hardware/tl3600';

async function testConnection() {
  console.log('='.repeat(50));
  console.log('TL3600 연결 테스트');
  console.log('='.repeat(50));
  console.log('');
  console.log('설정:');
  console.log('  - COM 포트: COM4');
  console.log('  - 터미널 ID: 0000007804292001');
  console.log('');

  const controller = new TL3600Controller({
    port: 'COM4',
    terminalId: '0000007804292001',
  });

  try {
    console.log('[1/3] 시리얼 포트 연결 중...');
    const result = await controller.connect();

    if (!result.success) {
      console.error('');
      console.error('연결 실패:', result.error);
      console.error('');
      console.error('확인사항:');
      console.error('  1. TL3600 단말기 전원이 켜져 있는지 확인');
      console.error('  2. USB 케이블이 제대로 연결되어 있는지 확인');
      console.error('  3. 장치관리자에서 COM4가 맞는지 확인');
      process.exit(1);
    }

    console.log('[2/3] 연결 성공!');
    console.log('');
    console.log('[3/3] 디바이스 상태:');
    console.log('  - 카드 모듈:', result.deviceStatus?.cardModuleStatus);
    console.log('  - RF 모듈:', result.deviceStatus?.rfModuleStatus);
    console.log('  - VAN 서버:', result.deviceStatus?.vanServerStatus);
    console.log('');

    // Get controller status
    const status = controller.getStatus();
    console.log('컨트롤러 상태:');
    console.log('  - 연결됨:', status.connected);
    console.log('  - 결제 대기:', status.inPaymentMode);
    console.log('  - 터미널 ID:', status.terminalId);
    console.log('');

    console.log('='.repeat(50));
    console.log('연결 테스트 완료!');
    console.log('='.repeat(50));

    // Disconnect
    await controller.disconnect();
    console.log('');
    console.log('연결 해제됨');

  } catch (error) {
    console.error('');
    console.error('오류 발생:', error);
    process.exit(1);
  }
}

// List available ports first
async function listPorts() {
  console.log('사용 가능한 COM 포트:');
  const ports = await TL3600Controller.listPorts();
  if (ports.length === 0) {
    console.log('  (포트 없음)');
  } else {
    ports.forEach(port => {
      console.log(`  - ${port.path} (${port.manufacturer || 'Unknown'})`);
    });
  }
  console.log('');
}

async function main() {
  await listPorts();
  await testConnection();
}

main().catch(console.error);
