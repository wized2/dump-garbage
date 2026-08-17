/**
 * Endroid OS — Self-Contained Web Desktop Server
 * Zero npm dependencies. Pure Node.js built-ins only.
 * Runs on Linux initramfs from /opt/endroid/
 */

import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Pure Node.js built-in server — no npm packages required.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080');
const VFS_ROOT = path.resolve(__dirname, '../vfs');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// ─── MIME Types ───────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// ─── Ensure VFS directories ────────────────────────────────────
const REQUIRED_DIRS = [
  'home/user/Desktop', 'home/user/Documents', 'home/user/Downloads',
  'home/user/Pictures', 'home/user/Notes', 'etc/endroid', 'tmp', 'var/log'
];
for (const d of REQUIRED_DIRS) {
  fs.mkdirSync(path.join(VFS_ROOT, d), { recursive: true });
}

// ─── Default config ────────────────────────────────────────────
const CONFIG_FILE = path.join(VFS_ROOT, 'etc/endroid/config.json');
const APPS_FILE = path.join(VFS_ROOT, 'etc/endroid/apps.json');

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    system: {
      hostname: os.hostname() || 'endroid-box',
      version: '1.0.0',
      codename: 'Endroid Horizon',
      kernel: os.release() || 'Linux 6.6.8-tinycore64',
      build: '2026.08.17'
    },
    display: { wallpaper: 'aurora-gradient', nightMode: false },
    theme: { mode: 'dark', accentColor: '#0ea5e9' }
  }, null, 2));
}

if (!fs.existsSync(APPS_FILE)) {
  fs.writeFileSync(APPS_FILE, JSON.stringify([
    { id: 'files',      name: 'Files',      icon: 'folder',       url: '/apps/files/',      pinned: true },
    { id: 'terminal',   name: 'Terminal',   icon: 'terminal',     url: '/apps/terminal/',   pinned: true },
    { id: 'browser',    name: 'Browser',    icon: 'globe',        url: '/apps/browser/',    pinned: true },
    { id: 'notes',      name: 'Notes',      icon: 'file-text',    url: '/apps/notes/',      pinned: true },
    { id: 'calculator', name: 'Calculator', icon: 'calculator',   url: '/apps/calculator/', pinned: false },
    { id: 'settings',   name: 'Settings',   icon: 'settings',     url: '/apps/settings/',   pinned: false },
    { id: 'installer',  name: 'App Store',  icon: 'package',      url: '/apps/installer/',  pinned: false },
  ], null, 2));
}

// ─── Helpers ────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function err(res, message, status = 500) {
  json(res, { error: message }, status);
}

function serveFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      if (fs.existsSync(idx)) return serveFile(res, idx);
      return err(res, 'Directory listing not supported', 403);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(data);
  } catch {
    err(res, 'File not found', 404);
  }
}

// ─── API Router ────────────────────────────────────────────────
function handleAPI(req, res, urlPath) {
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ── GET /api/system/info ──────────────────────────────────
  if (urlPath === '/api/system/info' && method === 'GET') {
    const uptime = os.uptime();
    const mem = os.totalmem();
    const freemem = os.freemem();
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return json(res, {
      os: 'Endroid OS',
      version: config.system.version,
      codename: config.system.codename,
      kernel: `Linux ${os.release()}`,
      arch: os.arch(),
      platform: os.platform(),
      uptime: Math.floor(uptime),
      hostname: os.hostname(),
      memory: { total: Math.floor(mem / 1024), free: Math.floor(freemem / 1024) },
      cpus: os.cpus().length,
      load: os.loadavg()
    });
  }

  // ── GET /api/system/config ───────────────────────────────
  if (urlPath === '/api/system/config' && method === 'GET') {
    return json(res, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
  }

  // ── POST /api/system/config ──────────────────────────────
  if (urlPath === '/api/system/config' && method === 'POST') {
    return readBody(req).then(body => {
      try {
        const data = JSON.parse(body);
        const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const merged = Object.assign({}, current, data);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
        json(res, { success: true, config: merged });
      } catch (e) {
        err(res, e.message, 400);
      }
    });
  }

  // ── GET /api/apps ────────────────────────────────────────
  if (urlPath === '/api/apps' && method === 'GET') {
    return json(res, JSON.parse(fs.readFileSync(APPS_FILE, 'utf8')));
  }

  // ── GET /api/fs?path=... ─────────────────────────────────
  if (urlPath.startsWith('/api/fs') && method === 'GET') {
    const qp = new URLSearchParams(urlPath.split('?')[1] || '');
    const reqPath = qp.get('path') || '/';
    const absPath = path.join(VFS_ROOT, reqPath.replace(/^\/+/, ''));

    if (!absPath.startsWith(VFS_ROOT)) return err(res, 'Forbidden', 403);

    try {
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(absPath).map(name => {
          const fp = path.join(absPath, name);
          try {
            const s = fs.statSync(fp);
            return {
              name, type: s.isDirectory() ? 'directory' : 'file',
              size: s.size, mtime: s.mtime.toISOString(),
              path: path.join(reqPath, name).replace(/\\/g, '/')
            };
          } catch { return null; }
        }).filter(Boolean);
        return json(res, { path: reqPath, entries });
      } else {
        const content = fs.readFileSync(absPath, 'utf8');
        return json(res, { path: reqPath, content, size: stat.size });
      }
    } catch (e) {
      return err(res, e.message, 404);
    }
  }

  // ── POST /api/fs?path=... ────────────────────────────────
  if (urlPath.startsWith('/api/fs') && method === 'POST') {
    const qp = new URLSearchParams(urlPath.split('?')[1] || '');
    const reqPath = qp.get('path') || '/';
    const absPath = path.join(VFS_ROOT, reqPath.replace(/^\/+/, ''));
    if (!absPath.startsWith(VFS_ROOT)) return err(res, 'Forbidden', 403);

    return readBody(req).then(body => {
      try {
        const { content, type } = JSON.parse(body);
        if (type === 'directory') {
          fs.mkdirSync(absPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, content || '');
        }
        json(res, { success: true, path: reqPath });
      } catch (e) {
        err(res, e.message, 400);
      }
    });
  }

  // ── DELETE /api/fs?path=... ──────────────────────────────
  if (urlPath.startsWith('/api/fs') && method === 'DELETE') {
    const qp = new URLSearchParams(urlPath.split('?')[1] || '');
    const reqPath = qp.get('path') || '/';
    const absPath = path.join(VFS_ROOT, reqPath.replace(/^\/+/, ''));
    if (!absPath.startsWith(VFS_ROOT)) return err(res, 'Forbidden', 403);

    try {
      fs.rmSync(absPath, { recursive: true, force: true });
      return json(res, { success: true });
    } catch (e) {
      return err(res, e.message, 400);
    }
  }

  // ── GET /api/terminal/exec?cmd=... ──────────────────────
  if (urlPath.startsWith('/api/terminal/exec') && method === 'GET') {
    const qp = new URLSearchParams(urlPath.split('?')[1] || '');
    const cmd = qp.get('cmd') || 'echo hello';
    try {
      const out = execSync(cmd, { timeout: 5000, encoding: 'utf8', shell: true });
      return json(res, { output: out });
    } catch (e) {
      return json(res, { output: (e.stdout || '') + (e.stderr || ''), error: e.message });
    }
  }

  // ── 404 ──────────────────────────────────────────────────
  err(res, `Unknown API endpoint: ${urlPath}`, 404);
}

// ─── Main HTTP Server ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const urlPath = rawUrl.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (urlPath.startsWith('/api/')) {
    return handleAPI(req, res, rawUrl);
  }

  // Serve static files from PUBLIC_DIR
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  // If path has no extension and doesn't end in /, try index.html
  if (!path.extname(filePath) && !urlPath.endsWith('/')) {
    const withIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(withIndex)) filePath = withIndex;
  } else if (urlPath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  serveFile(res, filePath);
});

// ─── WebSocket (built-in, no ws package) ─────────────────────
// Simple WebSocket upgrade for system events — clients receive JSON events
const clients = new Set();
server.on('upgrade', (req, socket, head) => {
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    '\r\n'
  );
  // Basic WebSocket frame parser (unmask + parse JSON)
  socket.on('data', buf => {
    try {
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let offset = 2;
      if (len === 126) { len = buf.readUInt16BE(2); offset = 4; }
      else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); offset = 10; }
      let payload;
      if (masked) {
        const mask = buf.slice(offset, offset + 4);
        payload = buf.slice(offset + 4, offset + 4 + len);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      } else {
        payload = buf.slice(offset, offset + len);
      }
      if (opcode === 8) { socket.destroy(); clients.delete(socket); return; }
      if (opcode === 9) { /* ping — ignore */ }
    } catch {}
  });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  clients.add(socket);

  // Send welcome event
  sendWS(socket, { type: 'connected', message: 'Endroid OS WebSocket ready' });
});

function sendWS(socket, data) {
  try {
    const payload = Buffer.from(JSON.stringify(data));
    const frame = Buffer.allocUnsafe(2 + payload.length);
    frame[0] = 0x81; // FIN + text
    frame[1] = payload.length;
    payload.copy(frame, 2);
    socket.write(frame);
  } catch {}
}

// Broadcast system stats every 5 seconds
setInterval(() => {
  if (clients.size === 0) return;
  const evt = {
    type: 'stats',
    uptime: Math.floor(os.uptime()),
    memFree: Math.floor(os.freemem() / 1024),
    memTotal: Math.floor(os.totalmem() / 1024),
    load: os.loadavg()[0].toFixed(2),
    time: new Date().toISOString()
  };
  for (const s of clients) sendWS(s, evt);
}, 5000);

// ─── Start ─────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) { ip = iface.address; break; }
    }
  }
  console.log('=================================================');
  console.log('🚀 Endroid OS Web Desktop Server');
  console.log(`📡 URL: http://${ip}:${PORT}`);
  console.log(`📁 VFS: ${VFS_ROOT}`);
  console.log(`🎨 UI:  ${PUBLIC_DIR}`);
  console.log('=================================================');
});
