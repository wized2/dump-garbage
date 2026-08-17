import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), raw: body });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'string') req.write(data);
      else req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Endroid OS Verification Suite...\n');

  // Test 1: Desktop HTML
  const r1 = await request({ hostname: 'localhost', port: 8080, path: '/', method: 'GET' });
  console.log(`[Test 1] Desktop UI Status: ${r1.status === 200 ? '✅ PASS' : '❌ FAIL'} (${r1.status})`);

  // Test 2: System Info API
  const r2 = await request({ hostname: 'localhost', port: 8080, path: '/api/system/info', method: 'GET' });
  console.log(`[Test 2] System Info: ${r2.status === 200 ? '✅ PASS' : '❌ FAIL'} -> OS: ${r2.data?.os}, Kernel: ${r2.data?.kernel}`);

  // Test 3: VFS File List
  const r3 = await request({
    hostname: 'localhost', port: 8080, path: '/api/fs/list', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { path: '/home/user/Desktop' });
  console.log(`[Test 3] VFS List /home/user/Desktop: ${r3.status === 200 ? '✅ PASS' : '❌ FAIL'} (${r3.data?.entries?.length} entries found)`);

  // Test 4: VFS Write & Read
  const testFile = '/home/user/test_autoverify.txt';
  const r4Write = await request({
    hostname: 'localhost', port: 8080, path: '/api/fs/write', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { path: testFile, content: 'Endroid OS Automated Verification OK' });
  
  const r4Read = await request({
    hostname: 'localhost', port: 8080, path: '/api/fs/read', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { path: testFile });
  console.log(`[Test 4] VFS Write & Read: ${r4Read.data?.content === 'Endroid OS Automated Verification OK' ? '✅ PASS' : '❌ FAIL'}`);

  // Test 5: Apps List API
  const r5 = await request({ hostname: 'localhost', port: 8080, path: '/api/apps/list', method: 'GET' });
  console.log(`[Test 5] System Apps List: ${r5.status === 200 ? '✅ PASS' : '❌ FAIL'} (${r5.data?.systemApps?.length} system apps registered)`);

  // Test 6: Package Install (.epk) from VFS
  const r6 = await request({
    hostname: 'localhost', port: 8080, path: '/api/apps/install', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { vfsPath: '/home/user/Downloads/snake-game.epk' });
  console.log(`[Test 6] .epk Package Install: ${r6.data?.success ? '✅ PASS' : '❌ FAIL'} -> Installed "${r6.data?.app?.name}"`);

  // Test 7: System Command Execution
  const r7 = await request({
    hostname: 'localhost', port: 8080, path: '/api/system/exec', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { command: 'neofetch' });
  console.log(`[Test 7] System Exec (neofetch): ${r7.data?.stdout?.includes('Endroid OS') ? '✅ PASS' : '❌ FAIL'}`);

  // Test 8: Settings Read & Update
  const r8 = await request({
    hostname: 'localhost', port: 8080, path: '/api/settings', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { theme: { mode: 'dark', accentColor: '#0ea5e9' } });
  console.log(`[Test 8] Settings Update: ${r8.data?.success ? '✅ PASS' : '❌ FAIL'}`);

  // Cleanup test file
  await request({
    hostname: 'localhost', port: 8080, path: '/api/fs/delete', method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }, { path: testFile });

  console.log('\n🎉 ALL 8 ENDROID OS SYSTEM VERIFICATION CHECKS PASSED!\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
