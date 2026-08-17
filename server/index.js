import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const VFS_ROOT = path.resolve(__dirname, '../vfs');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Ensure base VFS directories exist
const REQUIRED_DIRS = [
  'apps',
  'etc/endroid',
  'home/user/Desktop',
  'home/user/Documents',
  'home/user/Downloads',
  'home/user/Pictures',
  'home/user/Notes',
  'tmp',
  'var/log'
];

for (const dir of REQUIRED_DIRS) {
  const full = path.join(VFS_ROOT, dir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
}

// Ensure default apps.json and config.json exist
const CONFIG_FILE = path.join(VFS_ROOT, 'etc/endroid/config.json');
const APPS_FILE = path.join(VFS_ROOT, 'etc/endroid/apps.json');

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    system: {
      hostname: "endroid-node",
      version: "1.0.0",
      codename: "Endroid Horizon",
      kernel: "Linux 6.8.0-endroid-x86_64",
      build: "2026.08.1"
    },
    display: {
      resolution: "1920x1080",
      wallpaper: "aurora-gradient",
      nightMode: false,
      nightModeWarmth: 40
    },
    theme: {
      mode: "dark",
      accentColor: "#0ea5e9",
      borderRadius: "12px",
      transparency: true,
      reduceMotion: false
    },
    sound: {
      volume: 80,
      muted: false,
      systemSounds: true
    }
  }, null, 2));
}

if (!fs.existsSync(APPS_FILE)) {
  fs.writeFileSync(APPS_FILE, JSON.stringify({
    systemApps: [
      {
        id: "files",
        name: "File Manager",
        icon: "folder",
        category: "System",
        description: "Browse, copy, move, and manage files",
        isBuiltin: true,
        main: "apps/files/index.html",
        window: { width: 880, height: 580, minWidth: 640, minHeight: 400 }
      },
      {
        id: "terminal",
        name: "Terminal",
        icon: "terminal",
        category: "System",
        description: "Interactive command-line interface",
        isBuiltin: true,
        main: "apps/terminal/index.html",
        window: { width: 780, height: 480, minWidth: 500, minHeight: 320 }
      },
      {
        id: "browser",
        name: "Web Browser",
        icon: "globe",
        category: "Internet",
        description: "Lightweight web browser with tabs & ad blocker",
        isBuiltin: true,
        main: "apps/browser/index.html",
        window: { width: 960, height: 640, minWidth: 600, minHeight: 400 }
      },
      {
        id: "notes",
        name: "Notes",
        icon: "file-text",
        category: "Productivity",
        description: "Distraction-free Markdown note editor",
        isBuiltin: true,
        main: "apps/notes/index.html",
        window: { width: 820, height: 540, minWidth: 550, minHeight: 380 }
      },
      {
        id: "calculator",
        name: "Calculator",
        icon: "calculator",
        category: "Utilities",
        description: "Scientific calculator with memory and history",
        isBuiltin: true,
        main: "apps/calculator/index.html",
        window: { width: 380, height: 560, resizable: false }
      },
      {
        id: "installer",
        name: "App Installer",
        icon: "package",
        category: "System",
        description: "Install, validate, and manage .epk packages",
        isBuiltin: true,
        main: "apps/installer/index.html",
        window: { width: 760, height: 520, minWidth: 600, minHeight: 400 }
      },
      {
        id: "settings",
        name: "Settings",
        icon: "settings",
        category: "System",
        description: "System preferences, themes, wallpaper, and storage",
        isBuiltin: true,
        main: "apps/settings/index.html",
        window: { width: 860, height: 600, minWidth: 650, minHeight: 450 }
      }
    ],
    installedApps: []
  }, null, 2));
}

// Helper: resolve virtual path to physical path within VFS
function resolveVfsPath(virtualPath = '/') {
  let cleaned = path.normalize(virtualPath).replace(/^[\\\/]+/, '');
  // Prevent path traversal
  const target = path.resolve(VFS_ROOT, cleaned);
  if (!target.startsWith(VFS_ROOT)) {
    throw new Error('Access denied: Path outside virtual filesystem');
  }
  return target;
}

// Convert physical path back to virtual path
function toVirtualPath(physicalPath) {
  const rel = path.relative(VFS_ROOT, physicalPath);
  return '/' + rel.replace(/\\/g, '/');
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/pty' });

const upload = multer({ dest: path.join(VFS_ROOT, 'tmp') });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & Security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Serve static desktop UI
app.use(express.static(PUBLIC_DIR));
// Serve installed apps directory from VFS
app.use('/installed-apps', express.static(path.join(VFS_ROOT, 'apps')));

// ==========================================
// 1. FILE SYSTEM REST API (agent.md sec 8.3)
// ==========================================

// /api/fs/list
app.post('/api/fs/list', (req, res) => {
  try {
    const vPath = req.body.path || '/home/user';
    const pPath = resolveVfsPath(vPath);

    if (!fs.existsSync(pPath)) {
      return res.status(404).json({ error: `Directory not found: ${vPath}` });
    }

    const stat = fs.statSync(pPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `Path is not a directory: ${vPath}` });
    }

    const files = fs.readdirSync(pPath);
    const entries = files.map(name => {
      const itemPath = path.join(pPath, name);
      try {
        const itemStat = fs.statSync(itemPath);
        return {
          name,
          path: path.posix.join(vPath.replace(/\\/g, '/'), name),
          isDirectory: itemStat.isDirectory(),
          size: itemStat.size,
          mtime: itemStat.mtime,
          ext: path.extname(name).toLowerCase()
        };
      } catch (err) {
        return { name, path: path.posix.join(vPath, name), isDirectory: false, size: 0, mtime: new Date(), ext: '' };
      }
    });

    res.json({ path: vPath, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/read
app.post('/api/fs/read', (req, res) => {
  try {
    const vPath = req.body.path;
    if (!vPath) return res.status(400).json({ error: 'Path is required' });
    const pPath = resolveVfsPath(vPath);

    if (!fs.existsSync(pPath)) {
      return res.status(404).json({ error: `File not found: ${vPath}` });
    }

    const stat = fs.statSync(pPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: `Path is a directory: ${vPath}` });
    }

    const ext = path.extname(pPath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.epk', '.bin', '.wasm'];
    const isBinary = binaryExts.includes(ext);

    if (isBinary) {
      const buffer = fs.readFileSync(pPath);
      res.json({
        path: vPath,
        content: buffer.toString('base64'),
        isBase64: true,
        size: stat.size,
        mtime: stat.mtime
      });
    } else {
      const content = fs.readFileSync(pPath, 'utf8');
      res.json({
        path: vPath,
        content,
        isBase64: false,
        size: stat.size,
        mtime: stat.mtime
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/write
app.post('/api/fs/write', (req, res) => {
  try {
    const { path: vPath, content, isBase64 } = req.body;
    if (!vPath) return res.status(400).json({ error: 'Path is required' });
    const pPath = resolveVfsPath(vPath);

    const dir = path.dirname(pPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (isBase64) {
      const buffer = Buffer.from(content, 'base64');
      fs.writeFileSync(pPath, buffer);
    } else {
      fs.writeFileSync(pPath, content || '', 'utf8');
    }

    const stat = fs.statSync(pPath);
    res.json({ success: true, path: vPath, size: stat.size, mtime: stat.mtime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/delete
app.delete('/api/fs/delete', (req, res) => {
  try {
    const vPath = req.body.path;
    if (!vPath) return res.status(400).json({ error: 'Path is required' });
    const pPath = resolveVfsPath(vPath);

    if (!fs.existsSync(pPath)) {
      return res.status(404).json({ error: `File not found: ${vPath}` });
    }

    const stat = fs.statSync(pPath);
    if (stat.isDirectory()) {
      fs.rmSync(pPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(pPath);
    }

    res.json({ success: true, path: vPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/mkdir
app.post('/api/fs/mkdir', (req, res) => {
  try {
    const vPath = req.body.path;
    if (!vPath) return res.status(400).json({ error: 'Path is required' });
    const pPath = resolveVfsPath(vPath);

    fs.mkdirSync(pPath, { recursive: true });
    res.json({ success: true, path: vPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/rename
app.post('/api/fs/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath are required' });
    const pOld = resolveVfsPath(oldPath);
    const pNew = resolveVfsPath(newPath);

    fs.renameSync(pOld, pNew);
    res.json({ success: true, oldPath, newPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/copy
app.post('/api/fs/copy', (req, res) => {
  try {
    const { src, dest } = req.body;
    if (!src || !dest) return res.status(400).json({ error: 'src and dest required' });
    const pSrc = resolveVfsPath(src);
    const pDest = resolveVfsPath(dest);

    fs.cpSync(pSrc, pDest, { recursive: true });
    res.json({ success: true, src, dest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/move
app.post('/api/fs/move', (req, res) => {
  try {
    const { src, dest } = req.body;
    if (!src || !dest) return res.status(400).json({ error: 'src and dest required' });
    const pSrc = resolveVfsPath(src);
    const pDest = resolveVfsPath(dest);

    fs.renameSync(pSrc, pDest);
    res.json({ success: true, src, dest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/fs/stat
app.post('/api/fs/stat', (req, res) => {
  try {
    const vPath = req.body.path;
    if (!vPath) return res.status(400).json({ error: 'Path is required' });
    const pPath = resolveVfsPath(vPath);

    if (!fs.existsSync(pPath)) {
      return res.json({ exists: false });
    }

    const stat = fs.statSync(pPath);
    res.json({
      exists: true,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      mtime: stat.mtime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. .EPK PACKAGE MANAGER (agent.md sec 6)
// ==========================================

// Helper: validate manifest schema
function validateManifest(manifest) {
  const errors = [];
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing or invalid "name" in manifest');
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing or invalid "version" in manifest');
  if (!manifest.icon || typeof manifest.icon !== 'string') errors.push('Missing or invalid "icon" in manifest');
  if (!manifest.main || typeof manifest.main !== 'string') errors.push('Missing or invalid "main" in manifest');
  return errors;
}

// /api/apps/list
app.get('/api/apps/list', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/apps/install
app.post('/api/apps/install', upload.single('package'), (req, res) => {
  try {
    let zipPath = null;
    let cleanupUploadedFile = false;

    if (req.file) {
      zipPath = req.file.path;
      cleanupUploadedFile = true;
    } else if (req.body.vfsPath) {
      zipPath = resolveVfsPath(req.body.vfsPath);
    } else {
      return res.status(400).json({ error: 'No .epk file uploaded or vfsPath provided' });
    }

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'Package file not found' });
    }

    // Unpack and validate package
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    // Check for manifest.json
    const manifestEntry = zipEntries.find(e => e.entryName === 'manifest.json' || e.entryName.endsWith('/manifest.json'));
    if (!manifestEntry) {
      if (cleanupUploadedFile) fs.unlinkSync(zipPath);
      return res.status(400).json({ error: 'Invalid .epk: manifest.json is missing' });
    }

    const manifestContent = zip.readAsText(manifestEntry);
    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch (e) {
      if (cleanupUploadedFile) fs.unlinkSync(zipPath);
      return res.status(400).json({ error: 'Invalid manifest.json: JSON parsing error' });
    }

    const validationErrors = validateManifest(manifest);
    if (validationErrors.length > 0) {
      if (cleanupUploadedFile) fs.unlinkSync(zipPath);
      return res.status(400).json({ error: 'Manifest validation failed', details: validationErrors });
    }

    // Check required files (main entry and icon)
    const hasMain = zipEntries.some(e => e.entryName === manifest.main || e.entryName.endsWith('/' + manifest.main));
    const hasIcon = zipEntries.some(e => e.entryName === manifest.icon || e.entryName.endsWith('/' + manifest.icon));

    if (!hasMain) {
      if (cleanupUploadedFile) fs.unlinkSync(zipPath);
      return res.status(400).json({ error: `Entry point "${manifest.main}" not found in .epk archive` });
    }

    if (!hasIcon) {
      if (cleanupUploadedFile) fs.unlinkSync(zipPath);
      return res.status(400).json({ error: `Icon file "${manifest.icon}" not found in .epk archive` });
    }

    // App ID from name (slugified)
    const appId = (manifest.id || manifest.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')).trim();
    const appDir = path.join(VFS_ROOT, 'apps', appId);

    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.mkdirSync(appDir, { recursive: true });

    // Extract all entries
    zip.extractAllTo(appDir, true);

    // Read icon as SVG text or data URI if available
    let iconSvgData = null;
    const physicalIconPath = path.join(appDir, manifest.icon);
    if (fs.existsSync(physicalIconPath)) {
      iconSvgData = fs.readFileSync(physicalIconPath, 'utf8');
    }

    // Register in apps.json
    const appsData = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    const appEntry = {
      id: appId,
      name: manifest.name,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      author: manifest.author || 'Unknown',
      icon: `/installed-apps/${appId}/${manifest.icon}`,
      iconSvg: iconSvgData,
      main: `/installed-apps/${appId}/${manifest.main}`,
      isBuiltin: false,
      permissions: manifest.permissions || [],
      window: manifest.window || { width: 800, height: 600, resizable: true },
      background: manifest.background || '#ffffff',
      categories: manifest.categories || ['utility'],
      installedAt: new Date().toISOString()
    };

    // Remove existing if replacing
    appsData.installedApps = (appsData.installedApps || []).filter(a => a.id !== appId);
    appsData.installedApps.push(appEntry);
    fs.writeFileSync(APPS_FILE, JSON.stringify(appsData, null, 2));

    if (cleanupUploadedFile) {
      try { fs.unlinkSync(zipPath); } catch (_) {}
    }

    res.json({ success: true, app: appEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/apps/uninstall
app.post('/api/apps/uninstall', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'App ID is required' });

    const appsData = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    const appExists = appsData.installedApps.find(a => a.id === id);

    if (!appExists) {
      return res.status(404).json({ error: `App "${id}" not found or is a protected system app` });
    }

    const appDir = path.join(VFS_ROOT, 'apps', id);
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }

    appsData.installedApps = appsData.installedApps.filter(a => a.id !== id);
    fs.writeFileSync(APPS_FILE, JSON.stringify(appsData, null, 2));

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. SETTINGS & SYSTEM CONFIGURATION
// ==========================================

// GET /api/settings
app.get('/api/settings', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
  try {
    const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const updated = { ...current, ...req.body };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. PROCESS MANAGEMENT & SYSTEM TELEMETRY
// ==========================================

const processTable = [
  { pid: 1, name: "systemd-init", user: "root", cpu: 0.1, mem: 12.4, status: "running" },
  { pid: 2, name: "endroid-apiserver", user: "system", cpu: 0.8, mem: 28.6, status: "running" },
  { pid: 3, name: "endroid-wm", user: "user", cpu: 1.2, mem: 34.2, status: "running" },
  { pid: 4, name: "dbus-daemon", user: "messagebus", cpu: 0.0, mem: 4.1, status: "running" },
  { pid: 5, name: "network-manager", user: "root", cpu: 0.2, mem: 8.5, status: "running" }
];

let nextPid = 100;

app.get('/api/process/list', (req, res) => {
  res.json(processTable);
});

app.post('/api/process/spawn', (req, res) => {
  const { name, user = "user" } = req.body;
  const proc = {
    pid: nextPid++,
    name: name || "app-sandbox",
    user,
    cpu: +(Math.random() * 2 + 0.1).toFixed(1),
    mem: +(Math.random() * 15 + 5).toFixed(1),
    status: "running",
    startedAt: new Date().toISOString()
  };
  processTable.push(proc);
  res.json({ success: true, process: proc });
});

app.post('/api/process/kill', (req, res) => {
  const { pid } = req.body;
  const idx = processTable.findIndex(p => p.pid === Number(pid));
  if (idx !== -1) {
    if (processTable[idx].pid <= 5) {
      return res.status(403).json({ error: "Cannot kill critical system service" });
    }
    const removed = processTable.splice(idx, 1);
    return res.json({ success: true, process: removed[0] });
  }
  res.status(404).json({ error: "Process not found" });
});

// GET /api/system/info
app.get('/api/system/info', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  res.json({
    os: "Endroid OS",
    version: "1.0.0",
    codename: "Endroid Horizon",
    kernel: "Linux 6.8.0-endroid-x86_64",
    arch: os.arch(),
    platform: "linux",
    uptime: Math.floor(process.uptime()),
    hostname: "endroid-box",
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentUsed: Math.round((usedMem / totalMem) * 100)
    },
    cpu: {
      model: os.cpus()[0]?.model || "x86_64 Virtual CPU",
      cores: os.cpus().length,
      load: os.loadavg()
    },
    storage: {
      totalMB: 500,
      usedMB: 142,
      freeMB: 358,
      percentUsed: 28
    }
  });
});

// POST /api/system/exec
app.post('/api/system/exec', (req, res) => {
  try {
    const { command, cwd = '/home/user' } = req.body;
    if (!command) return res.status(400).json({ error: 'Command required' });

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Virtual shell execution simulation
    let stdout = '';
    let stderr = '';
    let code = 0;

    switch (cmd) {
      case 'help':
        stdout = `Endroid OS Shell v1.0\n` +
                 `Available commands:\n` +
                 `  help       - Show this command reference\n` +
                 `  ls [path]  - List directory contents\n` +
                 `  cd <path>  - Change working directory\n` +
                 `  pwd        - Print working directory\n` +
                 `  cat <file> - Display file contents\n` +
                 `  echo <txt> - Output text or write to file (with >)\n` +
                 `  mkdir <dir>- Create a directory\n` +
                 `  rm <path>  - Remove file or directory\n` +
                 `  ps         - Show running processes\n` +
                 `  kill <pid> - Kill a running process\n` +
                 `  epk <cmd>  - Package manager (list, install, info)\n` +
                 `  neofetch   - Display system summary art\n` +
                 `  uname -a   - Show kernel and OS details\n` +
                 `  date       - Show current system date and time\n` +
                 `  whoami     - Show current user\n` +
                 `  clear      - Clear terminal screen\n`;
        break;

      case 'uname':
        if (args.includes('-a')) {
          stdout = `Linux endroid-node 6.8.0-endroid-x86_64 #1 SMP PREEMPT_DYNAMIC Endroid SMP Mon Aug 17 04:30:00 UTC 2026 x86_64 GNU/Linux\n`;
        } else {
          stdout = `Linux\n`;
        }
        break;

      case 'whoami':
        stdout = `user\n`;
        break;

      case 'date':
        stdout = `${new Date().toUTCString()}\n`;
        break;

      case 'pwd':
        stdout = `${cwd}\n`;
        break;

      case 'ls': {
        const targetVPath = args[0] || cwd;
        const pPath = resolveVfsPath(targetVPath);
        if (fs.existsSync(pPath)) {
          const files = fs.readdirSync(pPath);
          stdout = files.map(f => {
            const isDir = fs.statSync(path.join(pPath, f)).isDirectory();
            return isDir ? `\x1b[1;34m${f}/\x1b[0m` : f;
          }).join('  ') + '\n';
        } else {
          stderr = `ls: cannot access '${targetVPath}': No such file or directory\n`;
          code = 1;
        }
        break;
      }

      case 'cat': {
        if (!args[0]) {
          stderr = `cat: missing file operand\n`;
          code = 1;
        } else {
          const filePath = args[0].startsWith('/') ? args[0] : path.posix.join(cwd, args[0]);
          const p = resolveVfsPath(filePath);
          if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
            stdout = fs.readFileSync(p, 'utf8') + '\n';
          } else {
            stderr = `cat: ${args[0]}: No such file\n`;
            code = 1;
          }
        }
        break;
      }

      case 'neofetch':
        stdout = 
`\x1b[36m        .---.        \x1b[1;37muser@endroid-node\x1b[0m
\x1b[36m       /     \\       \x1b[0m-----------------
\x1b[36m      | () () |      \x1b[33mOS\x1b[0m: Endroid OS 1.0 Horizon x86_64
\x1b[36m       \\  -  /       \x1b[33mKernel\x1b[0m: 6.8.0-endroid-x86_64
\x1b[36m      /       \\      \x1b[33mUptime\x1b[0m: ${Math.floor(process.uptime())} seconds
\x1b[36m     / |     | \\     \x1b[33mShell\x1b[0m: endroid-sh 1.0
\x1b[36m    *  |_____|  *    \x1b[33mWM\x1b[0m: Endroid Window Manager
\x1b[36m       |     |       \x1b[33mTheme\x1b[0m: Modern Acrylic [Dark]
\x1b[36m       '-----'       \x1b[33mIcons\x1b[0m: Lucide Offline Suite
                     \x1b[33mMemory\x1b[0m: 142MB / 500MB
\x1b[0m`;
        break;

      case 'ps':
        stdout = `  PID TTY          TIME CMD\n` +
                 processTable.map(p => `  ${String(p.pid).padStart(3, ' ')} ?        00:00:01 ${p.name}`).join('\n') + '\n';
        break;

      case 'epk': {
        const sub = args[0];
        if (sub === 'list') {
          const apps = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
          stdout = `Installed .epk packages:\n` +
                   apps.installedApps.map(a => `  - ${a.name} (${a.id}) v${a.version}`).join('\n') + '\n';
        } else {
          stdout = `Usage: epk <list|install <file>|info <id>>\n`;
        }
        break;
      }

      default:
        stdout = `${cmd}: command executed successfully.\n`;
    }

    res.json({ stdout, stderr, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. LIVE WEBSOCKET PTY STREAMING
// ==========================================

wss.on('connection', (ws) => {
  let cwd = '/home/user';
  let history = [];
  let buffer = '';

  const sendPrompt = () => {
    ws.send(`\r\n\x1b[1;32muser@endroid\x1b[0m:\x1b[1;34m${cwd}\x1b[0m$ `);
  };

  // Welcome message
  ws.send(`\x1b[1;36mWelcome to Endroid OS v1.0 (Linux 6.8.0-endroid-x86_64)\x1b[0m\r\nType '\x1b[1mhelp\x1b[0m' or '\x1b[1mneofetch\x1b[0m' to explore.\r\n`);
  sendPrompt();

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'input') {
        const char = data.char;
        if (char === '\r' || char === '\n') {
          const line = buffer.trim();
          ws.send('\r\n');
          if (line.length > 0) {
            history.push(line);
            executeWsCommand(line, cwd, (out, newCwd) => {
              if (newCwd) cwd = newCwd;
              if (out) ws.send(out.replace(/\n/g, '\r\n'));
              sendPrompt();
            });
          } else {
            sendPrompt();
          }
          buffer = '';
        } else if (char === '\u007F' || char === '\b') { // Backspace
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            ws.send('\b \b');
          }
        } else if (char === '\u0003') { // Ctrl+C
          buffer = '';
          ws.send('^C\r\n');
          sendPrompt();
        } else {
          buffer += char;
          ws.send(char);
        }
      }
    } catch (e) {
      // Raw string fallback
      buffer += msg.toString();
    }
  });

  function executeWsCommand(commandLine, currentDir, cb) {
    const parts = commandLine.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === 'cd') {
      let target = args[0] || '/home/user';
      let resolved = target.startsWith('/') ? target : path.posix.join(currentDir, target);
      try {
        const p = resolveVfsPath(resolved);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          return cb('', resolved);
        } else {
          return cb(`cd: ${target}: No such directory\n`, null);
        }
      } catch (e) {
        return cb(`cd: ${e.message}\n`, null);
      }
    }

    if (cmd === 'clear') {
      return cb('\x1b[2J\x1b[H', null);
    }

    // Call REST exec handler internally
    const mockReq = { body: { command: commandLine, cwd: currentDir } };
    const mockRes = {
      json: (data) => {
        let output = (data.stdout || '') + (data.stderr || '');
        cb(output, null);
      },
      status: () => mockRes
    };
    app._router.handle(
      { method: 'POST', url: '/api/system/exec', body: mockReq.body, headers: {} },
      mockRes,
      () => cb(`Command not found: ${cmd}\n`, null)
    );
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Endroid OS API Server & Desktop Runtime`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 VFS Root: ${VFS_ROOT}`);
  console.log(`🎨 UI Directory: ${PUBLIC_DIR}`);
  console.log(`=================================================`);
});
