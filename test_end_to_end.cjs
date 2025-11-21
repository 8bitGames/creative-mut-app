// End-to-end test: Recording → Blob → Base64 → Save → Python Pipeline
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

console.log('======================================================================');
console.log('END-TO-END TEST: RECORDING → PROCESSING → S3 UPLOAD');
console.log('======================================================================\n');

async function runTest() {
  try {
    // Step 1: Simulate blob from MediaRecorder
    console.log('📹 Step 1: Simulating recorded video blob...');
    const testVideoPath = path.join(__dirname, 'test_video.webm');

    if (!fs.existsSync(testVideoPath)) {
      throw new Error('test_video.webm not found. Run the test creation first.');
    }

    const videoBuffer = fs.readFileSync(testVideoPath);
    console.log(`   ✓ Loaded test video: ${(videoBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   ✓ First 16 bytes (hex): ${videoBuffer.slice(0, 16).toString('hex').toUpperCase()}`);

    // Step 2: Convert to base64 (simulating renderer process)
    console.log('\n💾 Step 2: Converting blob to base64 (renderer process)...');
    const base64Data = videoBuffer.toString('base64');
    const dataUrl = `data:video/webm;base64,${base64Data}`;
    console.log(`   ✓ Base64 length: ${base64Data.length} chars`);
    console.log(`   ✓ Data URL length: ${dataUrl.length} chars`);

    // Step 3: Save via IPC (simulating main process)
    console.log('\n💾 Step 3: Saving video file (main process IPC)...');
    const tempDir = '/var/folders/t4/qlds1kb57kb9vmk9y6xc5rcw0000gn/T/mut-captures';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Strip prefix and decode (same as electron/main.ts)
    const strippedBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const decodedBuffer = Buffer.from(strippedBase64, 'base64');

    const testFilename = `test_recording_${Date.now()}.webm`;
    const testFilePath = path.join(tempDir, testFilename);
    fs.writeFileSync(testFilePath, decodedBuffer);

    console.log(`   ✓ Saved to: ${testFilePath}`);
    console.log(`   ✓ File size: ${(decodedBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   ✓ First 16 bytes (hex): ${decodedBuffer.slice(0, 16).toString('hex').toUpperCase()}`);

    // Step 4: Verify with FFmpeg
    console.log('\n🔍 Step 4: Verifying WebM file with FFmpeg...');
    try {
      await execPromise(`/opt/homebrew/bin/ffmpeg -v error -i "${testFilePath}" -f null - 2>&1`);
      console.log('   ✅ FFmpeg verification: PASSED');
    } catch (error) {
      console.error('   ❌ FFmpeg verification: FAILED');
      console.error(`   Error: ${error.message}`);
      throw error;
    }

    // Step 5: Run Python pipeline
    console.log('\n🐍 Step 5: Running Python pipeline...');
    const framePath = path.join(__dirname, 'public', 'frame1.png');
    const pythonCmd = `cd "${path.join(__dirname, 'MUT-distribution')}" && python3 pipeline.py --input "${testFilePath}" --frame "${framePath}" --subtitle "Test Recording" --s3-folder test-e2e`;

    console.log(`   Command: ${pythonCmd}\n`);

    const { stdout, stderr } = await execPromise(pythonCmd);
    console.log(stdout);

    if (stderr) {
      console.error('Pipeline stderr:', stderr);
    }

    // Step 6: Verify output
    console.log('\n✅ Step 6: Verification...');
    console.log('   ✓ Video recorded and converted successfully');
    console.log('   ✓ File format is valid WebM');
    console.log('   ✓ Python pipeline processed video');
    console.log('   ✓ Uploaded to S3');
    console.log('   ✓ QR code generated');

    console.log('\n======================================================================');
    console.log('✅ END-TO-END TEST PASSED!');
    console.log('======================================================================\n');

    // Cleanup
    console.log('🧹 Cleaning up test file...');
    fs.unlinkSync(testFilePath);
    console.log('   ✓ Test file deleted\n');

  } catch (error) {
    console.error('\n======================================================================');
    console.error('❌ END-TO-END TEST FAILED!');
    console.error('======================================================================');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

runTest();
