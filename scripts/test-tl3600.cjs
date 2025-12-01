/**
 * TL3600 Connection Test Script (CommonJS)
 * Run with: node scripts/test-tl3600.cjs
 */

const { SerialPort } = require('serialport');

async function listPorts() {
  console.log('='.repeat(50));
  console.log('TL3600 연결 테스트');
  console.log('='.repeat(50));
  console.log('');

  console.log('사용 가능한 COM 포트:');
  try {
    const ports = await SerialPort.list();
    if (ports.length === 0) {
      console.log('  (포트 없음)');
    } else {
      ports.forEach(port => {
        console.log(`  - ${port.path} | ${port.manufacturer || 'Unknown'} | ${port.serialNumber || ''}`);
      });
    }
  } catch (error) {
    console.error('포트 목록 조회 실패:', error.message);
  }
  console.log('');
}

async function testConnection() {
  const portPath = 'COM4';
  const baudRate = 115200;

  console.log('설정:');
  console.log('  - COM 포트:', portPath);
  console.log('  - Baud Rate:', baudRate);
  console.log('  - 터미널 ID: 0000007804292001');
  console.log('');

  return new Promise((resolve, reject) => {
    console.log('[1/3] 시리얼 포트 연결 중...');

    const port = new SerialPort({
      path: portPath,
      baudRate: baudRate,
    }, (err) => {
      if (err) {
        console.error('');
        console.error('연결 실패:', err.message);
        console.error('');
        console.error('확인사항:');
        console.error('  1. TL3600 단말기 전원이 켜져 있는지 확인');
        console.error('  2. USB 케이블이 제대로 연결되어 있는지 확인');
        console.error('  3. 장치관리자에서 COM4가 맞는지 확인');
        console.error('  4. 다른 프로그램이 COM4를 사용중인지 확인');
        reject(err);
        return;
      }

      console.log('[2/3] 포트 열림!');
      console.log('');

      // Build device check packet (Job Code: A)
      // STX(1) + Header(35) + ETX(1) + BCC(1) = 38 bytes
      const STX = 0x02;
      const ETX = 0x03;
      const terminalId = '0000007804292001';
      const jobCode = 'A';  // Device Check

      // Header: 단말기번호(16) + 업무구분코드(1) + 전문길이(4) + 전문일련번호(6) + 응답코드(4) + 더미(4)
      const dataLength = '0000';  // No data for device check
      const serialNum = '000001';
      const responseCode = '0000';
      const dummy = '    ';

      const header = terminalId + jobCode + dataLength + serialNum + responseCode + dummy;

      // Build packet
      const packet = Buffer.alloc(38);
      packet[0] = STX;
      packet.write(header, 1, 35, 'ascii');
      packet[36] = ETX;

      // Calculate BCC (XOR from position 1 to ETX inclusive)
      let bcc = 0;
      for (let i = 1; i <= 36; i++) {
        bcc ^= packet[i];
      }
      packet[37] = bcc;

      console.log('[3/3] 디바이스 체크 패킷 전송...');
      console.log('  TX:', packet.toString('hex').toUpperCase());

      let responseBuffer = Buffer.alloc(0);
      let responseTimeout;

      port.on('data', (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);
        console.log('  RX:', data.toString('hex').toUpperCase());

        // Check for ACK (0x06) or NACK (0x15)
        if (data[0] === 0x06) {
          console.log('  -> ACK 수신');
        } else if (data[0] === 0x15) {
          console.log('  -> NACK 수신');
        }

        // Look for complete response packet (starts with STX, ends with ETX + BCC)
        const stxIndex = responseBuffer.indexOf(STX);
        if (stxIndex >= 0 && responseBuffer.length > stxIndex + 37) {
          clearTimeout(responseTimeout);

          // Parse response
          const responseHeader = responseBuffer.slice(stxIndex + 1, stxIndex + 36).toString('ascii');
          const respJobCode = responseHeader[16];

          console.log('');
          console.log('응답 수신:');
          console.log('  - Job Code:', respJobCode, '(' + (respJobCode === 'a' ? '디바이스 체크 응답' : 'Unknown') + ')');

          if (respJobCode === 'a') {
            // Parse device check response data
            const dataLenStr = responseHeader.slice(17, 21);
            const dataLen = parseInt(dataLenStr, 10);

            if (dataLen > 0 && responseBuffer.length >= stxIndex + 36 + dataLen) {
              const responseData = responseBuffer.slice(stxIndex + 36, stxIndex + 36 + dataLen).toString('ascii');
              console.log('  - 카드 모듈:', responseData[0] === '0' ? 'OK' : 'NG');
              console.log('  - RF 모듈:', responseData[1] === '0' ? 'OK' : 'NG');
              console.log('  - VAN 서버:', responseData[2] === '0' ? 'OK' : 'NG');
            }

            console.log('');
            console.log('='.repeat(50));
            console.log('연결 테스트 성공!');
            console.log('='.repeat(50));
          }

          port.close(() => {
            console.log('');
            console.log('포트 닫힘');
            resolve(true);
          });
        }
      });

      port.on('error', (err) => {
        console.error('시리얼 오류:', err.message);
        reject(err);
      });

      // Send packet
      port.write(packet, (err) => {
        if (err) {
          console.error('전송 실패:', err.message);
          reject(err);
          return;
        }
        console.log('  패킷 전송 완료');
      });

      // Response timeout
      responseTimeout = setTimeout(() => {
        console.error('');
        console.error('응답 타임아웃 (5초)');
        console.error('');
        console.error('수신된 데이터:', responseBuffer.toString('hex').toUpperCase());

        port.close(() => {
          console.log('포트 닫힘');
          reject(new Error('Response timeout'));
        });
      }, 5000);
    });
  });
}

async function main() {
  try {
    await listPorts();
    await testConnection();
  } catch (error) {
    console.error('테스트 실패:', error.message);
    process.exit(1);
  }
}

main();
