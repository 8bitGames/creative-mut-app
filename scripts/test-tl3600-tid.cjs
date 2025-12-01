/**
 * TL3600 Terminal ID Test
 * Tests different terminal ID formats
 */

const { SerialPort } = require('serialport');

const PORT_PATH = 'COM4';
const BAUD_RATE = 115200;

// Different terminal ID formats to try
const TERMINAL_IDS = [
  '00000000ECB10751',  // Left-padded with zeros
  'ECB10751        ',  // Right-padded with spaces
  '        ECB10751',  // Left-padded with spaces
  '0000007804292001',  // Original (sticker number)
  'ECB1075100000000',  // Right-padded with zeros
];

async function testTerminalId(terminalId) {
  return new Promise((resolve) => {
    console.log(`\n[테스트] Terminal ID: "${terminalId}"`);

    const port = new SerialPort({
      path: PORT_PATH,
      baudRate: BAUD_RATE,
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
      const header = terminalId + jobCode + dataLength + serialNum + responseCode + dummy;

      const packet = Buffer.alloc(38);
      packet[0] = STX;
      packet.write(header, 1, 35, 'ascii');
      packet[36] = ETX;

      let bcc = 0;
      for (let i = 1; i <= 36; i++) {
        bcc ^= packet[i];
      }
      packet[37] = bcc;

      let gotResponse = false;

      port.on('data', (data) => {
        if (data[0] === 0x06) {
          console.log(`  -> ACK 수신!`);
          gotResponse = true;
        } else if (data[0] === 0x15) {
          console.log(`  -> NACK 수신`);
          gotResponse = true;
        } else if (data[0] === 0x02) {
          console.log(`  -> 응답 패킷 수신!`);
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
        console.log(`  TX: ${packet.toString('hex').toUpperCase()}`);
      });

      setTimeout(() => {
        port.close(() => {
          if (gotResponse) {
            console.log(`  -> 성공!`);
          } else {
            console.log(`  -> 응답 없음`);
          }
          resolve(gotResponse);
        });
      }, 3000);
    });
  });
}

async function main() {
  console.log('='.repeat(50));
  console.log('TL3600 Terminal ID 테스트');
  console.log('='.repeat(50));
  console.log(`포트: ${PORT_PATH}`);
  console.log(`Baud Rate: ${BAUD_RATE}`);

  let foundTerminalId = null;

  for (const terminalId of TERMINAL_IDS) {
    const success = await testTerminalId(terminalId);
    if (success) {
      foundTerminalId = terminalId;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(50));
  if (foundTerminalId) {
    console.log(`성공! Terminal ID: "${foundTerminalId}"`);
  } else {
    console.log('모든 Terminal ID 형식에서 응답 없음');
    console.log('\n단말기 상태를 확인해 주세요:');
    console.log('  - 전원 ON?');
    console.log('  - LCD 화면 상태?');
    console.log('  - VAN 개통 완료?');
  }
  console.log('='.repeat(50));
}

main().catch(console.error);
