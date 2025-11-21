// Test blob to base64 conversion
const fs = require('fs');
const path = require('path');

console.log('Testing WebM blob conversion...\n');

// Read the test WebM file
const testFile = path.join(__dirname, 'test_video.webm');
const buffer = fs.readFileSync(testFile);

console.log(`Original file size: ${buffer.length} bytes`);
console.log(`First 16 bytes (hex): ${buffer.slice(0, 16).toString('hex').toUpperCase()}\n`);

// Convert to base64 (simulating what happens in the app)
const base64Data = buffer.toString('base64');
console.log(`Base64 length: ${base64Data.length} chars`);

// Create data URL
const dataUrl = `data:video/webm;base64,${base64Data}`;
console.log(`Data URL length: ${dataUrl.length} chars\n`);

// Simulate what the main process does - strip prefix and decode
const strippedBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
console.log(`Stripped base64 length: ${strippedBase64.length} chars`);

const decodedBuffer = Buffer.from(strippedBase64, 'base64');
console.log(`Decoded buffer size: ${decodedBuffer.length} bytes`);
console.log(`First 16 bytes (hex): ${decodedBuffer.slice(0, 16).toString('hex').toUpperCase()}\n`);

// Verify they match
if (buffer.equals(decodedBuffer)) {
  console.log('✅ SUCCESS: Buffers match perfectly!');
} else {
  console.log('❌ FAILURE: Buffers do not match!');
}

// Save decoded file
const outputFile = path.join(__dirname, 'test_decoded.webm');
fs.writeFileSync(outputFile, decodedBuffer);
console.log(`\nSaved decoded file to: ${outputFile}`);
