/**
 * TL3600 Multi-BaudRate Connection Test
 * Tests multiple baud rates to find the correct one
 */

const { SerialPort } = require('serialport');

const BAUD_RATES = [115200, 9600, 19200, 38400, 57600];
const PORT_PATH = 'COM4';
const TERMINAL_ID = '0000007804292001';

async function testBaudRate(baudRate) {
  return new Promise((resolve) => {
    console.log(`\n[테스트] Baud Rate: ${baudRate}`);

    const port = new SerialPort({
      path: PORT_PATH,
      baudRate: baudRate,
    }, (err) => {
      if (err) {
        console.log(`  -> 포트 열기 실패: ${err.message}`);
        resolve(false);
        return;
      }

      // Build device check packet
      const STX = 0x02;
      const ETX = 0x03;
      const jobCode = 'A';
      const dataLength = '0000';
      const serialNum = '000001';
      const responseCode = '0000';
      const dummy = '    ';
      const header = TERMINAL_ID + jobCode + dataLength + serialNum + responseCode + dummy;

      const packet = Buffer.alloc(38);
      packet[0] = STX;
      packet.write(header, 1, 35, 'ascii');
      packet[36] = ETX;

      let bcc = 0;
      for (let i = 1; i <= 36; i++) {
        bcc ^= packet[i];
      }
      packet[37] = bcc;

      let responseBuffer = Buffer.alloc(0);
      let gotResponse = false;

      port.on('data', (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);

        // Check for any response (ACK, NACK, or data)
        if (data[0] === 0x06) {
          console.log(`  -> ACK 수신!`);
          gotResponse = true;
        } else if (data[0] === 0x15) {
          console.log(`  -> NACK 수신`);
          gotResponse = true;
        } else if (data[0] === 0x02) {
          console.log(`  -> STX 수신 (응답 패킷)`);
          gotResponse = true;
        }

        console.log(`  RX: ${data.toString('hex').toUpperCase()}`);
      });

      port.write(packet, (err) => {
        if (err) {
          console.log(`  -> 전송 실패: ${err.message}`);
          port.close();
          resolve(false);
          return;
        }
        console.log(`  -> 패킷 전송 완료`);
      });

      // Wait 3 seconds for response
      setTimeout(() => {
        port.close(() => {
          if (gotResponse) {
            console.log(`  -> 성공! Baud Rate ${baudRate} 에서 응답 수신`);
            resolve(true);
          } else {
            console.log(`  -> 응답 없음`);
            resolve(false);
          }
        });
      }, 3000);
    });
  });
}

async function main() {
  console.log('='.repeat(50));
  console.log('TL3600 Baud Rate 테스트');
  console.log('='.repeat(50));
  console.log(`포트: ${PORT_PATH}`);
  console.log(`터미널 ID: ${TERMINAL_ID}`);

  // List ports first
  const ports = await SerialPort.list();
  console.log('\n사용 가능한 포트:');
  ports.forEach(p => console.log(`  - ${p.path}: ${p.manufacturer || 'Unknown'}`));

  let foundBaudRate = null;

  for (const baudRate of BAUD_RATES) {
    const success = await testBaudRate(baudRate);
    if (success) {
      foundBaudRate = baudRate;
      break;
    }
    // Wait a bit between tests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(50));
  if (foundBaudRate) {
    console.log(`결과: Baud Rate ${foundBaudRate} 에서 통신 성공!`);
    console.log('\n환경변수 설정:');
    console.log(`  TL3600_PORT=COM4`);
    console.log(`  TL3600_TERMINAL_ID=${TERMINAL_ID}`);
    console.log(`  TL3600_BAUD_RATE=${foundBaudRate}`);
  } else {
    console.log('결과: 모든 Baud Rate에서 응답 없음');
    console.log('\n확인사항:');
    console.log('  1. 단말기 전원이 켜져 있는지');
    console.log('  2. 단말기 화면에 "대기" 상태인지');
    console.log('  3. USB 케이블 연결 상태');
    console.log('  4. 터미널 ID가 맞는지');
  }
  console.log('='.repeat(50));
}

main().catch(console.error);
