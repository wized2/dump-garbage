import AdmZip from '../server/node_modules/adm-zip/adm-zip.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname);
const VFS_DOWNLOADS = path.resolve(__dirname, '../vfs/home/user/Downloads');

// 1. Build Retro Snake .epk
function buildSnakeEpk() {
  const zip = new AdmZip();

  const manifest = {
    "$schema": "https://endroid.os/schema/manifest-v1.json",
    "id": "retro-snake",
    "name": "Retro Snake",
    "version": "1.0.0",
    "description": "Classic retro arcade snake game with smooth controls and score tracker",
    "author": "Endroid Games",
    "icon": "icon.svg",
    "main": "index.html",
    "permissions": ["filesystem.read"],
    "window": {
      "width": 540,
      "height": 580,
      "resizable": false
    },
    "background": "#090d16",
    "categories": ["games", "arcade"]
  };

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="6"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Retro Snake</title>
  <style>
    body {
      margin: 0;
      background: #090d16;
      color: #22c55e;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      user-select: none;
    }
    #score-bar {
      width: 400px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 16px;
      font-weight: bold;
    }
    canvas {
      border: 2px solid #22c55e;
      background: #051008;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
    }
    #game-over {
      margin-top: 10px;
      font-size: 14px;
      color: #ef4444;
      display: none;
    }
    .btn {
      background: #22c55e;
      color: #000;
      border: none;
      padding: 6px 14px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="score-bar">
    <span>SCORE: <span id="score">0</span></span>
    <span>HIGH: <span id="high">0</span></span>
  </div>
  <canvas id="game" width="400" height="400"></canvas>
  <div id="game-over">GAME OVER! <button class="btn" onclick="restart()">Restart (Space)</button></div>

  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const grid = 20;
    let count = 0;
    let score = 0;
    let high = 0;
    let running = true;

    let snake = { x: 160, y: 160, dx: grid, dy: 0, cells: [], maxCells: 4 };
    let apple = { x: 320, y: 320 };

    function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min)) + min;
    }

    function restart() {
      score = 0;
      document.getElementById('score').innerText = score;
      document.getElementById('game-over').style.display = 'none';
      snake.x = 160;
      snake.y = 160;
      snake.cells = [];
      snake.maxCells = 4;
      snake.dx = grid;
      snake.dy = 0;
      running = true;
    }

    function loop() {
      requestAnimationFrame(loop);
      if (!running) return;

      if (++count < 6) return;
      count = 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      snake.x += snake.dx;
      snake.y += snake.dy;

      // Wrap edges
      if (snake.x < 0) snake.x = canvas.width - grid;
      else if (snake.x >= canvas.width) snake.x = 0;
      if (snake.y < 0) snake.y = canvas.height - grid;
      else if (snake.y >= canvas.height) snake.y = 0;

      snake.cells.unshift({ x: snake.x, y: snake.y });
      if (snake.cells.length > snake.maxCells) snake.cells.pop();

      // Draw Apple
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(apple.x, apple.y, grid - 1, grid - 1);

      // Draw Snake
      ctx.fillStyle = '#22c55e';
      snake.cells.forEach((cell, index) => {
        ctx.fillRect(cell.x, cell.y, grid - 1, grid - 1);

        // Ate apple
        if (cell.x === apple.x && cell.y === apple.y) {
          snake.maxCells++;
          score += 10;
          if (score > high) high = score;
          document.getElementById('score').innerText = score;
          document.getElementById('high').innerText = high;
          apple.x = getRandomInt(0, 20) * grid;
          apple.y = getRandomInt(0, 20) * grid;
        }

        // Collision with body
        for (let i = index + 1; i < snake.cells.length; i++) {
          if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
            running = false;
            document.getElementById('game-over').style.display = 'block';
          }
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && snake.dx === 0) { snake.dx = -grid; snake.dy = 0; }
      else if (e.key === 'ArrowUp' && snake.dy === 0) { snake.dy = -grid; snake.dx = 0; }
      else if (e.key === 'ArrowRight' && snake.dx === 0) { snake.dx = grid; snake.dy = 0; }
      else if (e.key === 'ArrowDown' && snake.dy === 0) { snake.dy = grid; snake.dx = 0; }
      else if (e.code === 'Space' && !running) { restart(); }
    });

    requestAnimationFrame(loop);
  </script>
</body>
</html>`;

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('icon.svg', Buffer.from(iconSvg));
  zip.addFile('index.html', Buffer.from(indexHtml));

  const outPath = path.join(OUT_DIR, 'snake-game.epk');
  zip.writeZip(outPath);
  zip.writeZip(path.join(VFS_DOWNLOADS, 'snake-game.epk'));
  console.log('✅ Created snake-game.epk');
}

// 2. Build MarkdownPad Pro .epk
function buildMarkdownPadEpk() {
  const zip = new AdmZip();

  const manifest = {
    "$schema": "https://endroid.os/schema/manifest-v1.json",
    "id": "markdown-pad",
    "name": "MarkdownPad Pro",
    "version": "1.2.0",
    "description": "Pro Markdown authoring and HTML export utility",
    "author": "Endroid Studio",
    "icon": "icon.svg",
    "main": "index.html",
    "permissions": ["filesystem.read", "filesystem.write"],
    "window": {
      "width": 780,
      "height": 540,
      "resizable": true
    },
    "background": "#1e293b",
    "categories": ["productivity", "editor"]
  };

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MarkdownPad Pro</title>
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; }
    .header { height: 40px; background: #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .btn { background: #0ea5e9; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .split { flex: 1; display: flex; }
    textarea { flex: 1; background: #090d16; color: #38bdf8; font-family: monospace; border: none; outline: none; padding: 16px; font-size: 14px; resize: none; border-right: 1px solid rgba(255,255,255,0.1); }
    .preview { flex: 1; padding: 16px; overflow-y: auto; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <strong>MarkdownPad Pro</strong>
    <button class="btn" onclick="exportHtml()">Export HTML</button>
  </div>
  <div class="split">
    <textarea id="editor" placeholder="# Welcome to MarkdownPad Pro..."># MarkdownPad Pro\n\n- Real-time syntax\n- Instant HTML rendering\n- Lightweight and offline</textarea>
    <div class="preview" id="preview"></div>
  </div>
  <script>
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    function update() {
      preview.innerHTML = editor.value.replace(/^# (.*$)/gim, '<h1>$1</h1>').replace(/^- (.*$)/gim, '<li>$1</li>').replace(/\\n/g, '<br>');
    }
    function exportHtml() {
      alert('HTML ready to export!');
    }
    editor.addEventListener('input', update);
    update();
  </script>
</body>
</html>`;

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('icon.svg', Buffer.from(iconSvg));
  zip.addFile('index.html', Buffer.from(indexHtml));

  const outPath = path.join(OUT_DIR, 'markdown-pad.epk');
  zip.writeZip(outPath);
  zip.writeZip(path.join(VFS_DOWNLOADS, 'markdown-pad.epk'));
  console.log('✅ Created markdown-pad.epk');
}

// 3. Build System Monitor .epk
function buildSysMonitorEpk() {
  const zip = new AdmZip();

  const manifest = {
    "$schema": "https://endroid.os/schema/manifest-v1.json",
    "id": "sys-monitor",
    "name": "System Monitor",
    "version": "1.0.0",
    "description": "Live hardware performance meters and memory telemetry",
    "author": "Endroid Core",
    "icon": "icon.svg",
    "main": "index.html",
    "permissions": ["system.telemetry"],
    "window": {
      "width": 640,
      "height": 480,
      "resizable": true
    },
    "background": "#0f172a",
    "categories": ["system", "utilities"]
  };

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>System Monitor</title>
  <style>
    body { margin: 0; background: #090d16; color: #f8fafc; font-family: -apple-system, sans-serif; padding: 20px; }
    h2 { margin-top: 0; color: #f59e0b; }
    .card { background: #1e293b; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .meter { height: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden; margin-top: 8px; }
    .fill { height: 100%; width: 28%; background: #0ea5e9; transition: width 0.5s ease; }
  </style>
</head>
<body>
  <h2>System Resource Monitor</h2>
  <div class="card">
    <div style="display:flex; justify-content:space-between;">
      <span>CPU Utilization</span>
      <span id="cpu-text">4.2%</span>
    </div>
    <div class="meter"><div class="fill" id="cpu-fill" style="width: 4.2%; background:#10b981;"></div></div>
  </div>
  <div class="card">
    <div style="display:flex; justify-content:space-between;">
      <span>Memory Usage</span>
      <span>142 MB / 500 MB (28%)</span>
    </div>
    <div class="meter"><div class="fill" style="width: 28%;"></div></div>
  </div>
  <script>
    setInterval(() => {
      const cpu = (Math.random() * 8 + 2).toFixed(1);
      document.getElementById('cpu-text').innerText = cpu + '%';
      document.getElementById('cpu-fill').style.width = cpu + '%';
    }, 1500);
  </script>
</body>
</html>`;

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('icon.svg', Buffer.from(iconSvg));
  zip.addFile('index.html', Buffer.from(indexHtml));

  const outPath = path.join(OUT_DIR, 'sys-monitor.epk');
  zip.writeZip(outPath);
  zip.writeZip(path.join(VFS_DOWNLOADS, 'sys-monitor.epk'));
  console.log('✅ Created sys-monitor.epk');
}

buildSnakeEpk();
buildMarkdownPadEpk();
buildSysMonitorEpk();
