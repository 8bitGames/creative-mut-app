/**
 * TL3600 Connection Test - Correct Terminal ID Format
 * Terminal ID: 10-digit credit ID + 6 null bytes (0x00)
 */

const { SerialPort } = require('serialport');

const PORT_PATH = 'COM4';
const BAUD_RATE = 115200;
const CREDIT_ID = '7804292001';  // 10-digit credit ID

async function testConnection() {
  console.log('='.repeat(50));
  console.log('TL3600 연결 테스트');
  console.log('='.repeat(50));
  console.log(`포트: ${PORT_PATH}`);
  console.log(`Baud Rate: ${BAUD_RATE}`);
  console.log(`신용 ID: ${CREDIT_ID}`);
  console.log('');

  return new Promise((resolve) => {
    console.log('[1/3] 시리얼 포트 연결 중...');

    const port = new SerialPort({
      path: PORT_PATH,
      baudRate: BAUD_RATE,
    }, (err) => {
      if (err) {
        console.log(`연결 실패: ${err.message}`);
        resolve(false);
        return;
      }

      console.log('[2/3] 포트 열림!');

      // Build device check packet
      const STX = 0x02;
      const ETX = 0x03;

      // Terminal ID: 10-digit + 6 null bytes
      const terminalIdBuffer = Buffer.alloc(16, 0x00);
      terminalIdBuffer.write(CREDIT_ID, 0, 10, 'ascii');

      // Header components
      const jobCode = 'A';  // Device Check
      const dataLength = '0000';
      const serialNum = '000001';
      const responseCode = '0000';
      const dummy = '    ';  // 4 spaces

      // Build header (35 bytes total)
      const headerRest = jobCode + dataLength + serialNum + responseCode + dummy;
      const headerRestBuffer = Buffer.from(headerRest, 'ascii');

      // Full packet: STX(1) + TerminalID(16) + HeaderRest(19) + ETX(1) + BCC(1) = 38 bytes
      const packet = Buffer.alloc(38);
      let offset = 0;

      packet[offset++] = STX;
      terminalIdBuffer.copy(packet, offset);
      offset += 16;
      headerRestBuffer.copy(packet, offset);
      offset += 19;
      packet[offset++] = ETX;

      // Calculate BCC (XOR from position 1 to ETX inclusive)
      let bcc = 0;
      for (let i = 1; i < offset; i++) {
        bcc ^= packet[i];
      }
      packet[offset] = bcc;

      console.log('[3/3] 디바이스 체크 전송...');
      console.log(`  TX: ${packet.toString('hex').toUpperCase()}`);
      console.log(`  Terminal ID bytes: ${terminalIdBuffer.toString('hex').toUpperCase()}`);

      let responseBuffer = Buffer.alloc(0);
      let gotResponse = false;

      port.on('data', (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);
        console.log(`  RX: ${data.toString('hex').toUpperCase()}`);

        if (data[0] === 0x06) {
          console.log('  -> ACK 수신!');
          gotResponse = true;
        } else if (data[0] === 0x15) {
          console.log('  -> NACK 수신');
          gotResponse = true;
        } else if (data[0] === 0x02) {
          console.log('  -> 응답 패킷 수신!');
          gotResponse = true;

          // Try to parse response
          const respData = responseBuffer;
          if (respData.length >= 38) {
            const respTerminalId = respData.slice(1, 17);
            const respJobCode = String.fromCharCode(respData[17]);
            console.log(`  -> 응답 Job Code: ${respJobCode}`);

            if (respJobCode === 'a') {
              const dataLenStr = respData.slice(18, 22).toString('ascii');
              const dataLen = parseInt(dataLenStr, 10);
              console.log(`  -> 응답 데이터 길이: ${dataLen}`);

              if (dataLen >= 3) {
                const statusData = respData.slice(36, 36 + dataLen);
                console.log('');
                console.log('디바이스 상태:');
                console.log(`  - 카드 모듈: ${statusData[0] === 0x30 ? 'OK' : 'NG'}`);
                console.log(`  - RF 모듈: ${statusData[1] === 0x30 ? 'OK' : 'NG'}`);
                console.log(`  - VAN 서버: ${statusData[2] === 0x30 ? 'OK' : 'NG'}`);
              }
            }
          }
        }
      });

      port.write(packet, (err) => {
        if (err) {
          console.log(`전송 실패: ${err.message}`);
          port.close();
          resolve(false);
          return;
        }
        console.log('  전송 완료, 응답 대기...');
      });

      // Wait for response
      setTimeout(() => {
        port.close(() => {
          console.log('');
          if (gotResponse) {
            console.log('='.repeat(50));
            console.log('연결 테스트 성공!');
            console.log('='.repeat(50));
            console.log('');
            console.log('설정값:');
            console.log(`  TL3600_PORT=COM4`);
            console.log(`  TL3600_TERMINAL_ID=${CREDIT_ID}`);
          } else {
            console.log('='.repeat(50));
            console.log('응답 없음 - 단말기 상태 확인 필요');
            console.log('='.repeat(50));
          }
          resolve(gotResponse);
        });
      }, 5000);
    });
  });
}

testConnection().catch(console.error);
