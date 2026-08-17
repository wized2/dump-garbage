# 🌐 Endroid OS — Real Linux + Web Operating System

**Endroid OS** is a lightweight, web-powered operating system built on top of a real 64-bit Linux kernel. It boots from a live ISO image and delivers a full HTML5/CSS3/JS desktop environment via a local Node.js API server.

---

## ✨ Features

- **Real Linux Kernel** — Boots a real 64-bit Linux kernel (`vmlinuz64`) via ISOLINUX/El Torito
- **HTML5 Desktop Environment** — Full windowed desktop with drag, resize, snap, minimize, and maximize
- **7 Preinstalled Apps** — File Manager, Terminal, Web Browser, Notes, Calculator, App Installer, Settings
- **WebSocket Terminal** — Real interactive shell over `/pty` WebSocket endpoint
- **`.epk` Package System** — Install/uninstall zip-based app packages with manifest validation
- **Offline Lucide Icons** — 100% offline iconography, no CDN required
- **Glassmorphism UI** — Acrylic effects, dark/light themes, accent colors, wallpaper studio
- **REST API Server** — Full filesystem, process, settings, and system info API on port `8080`

---

## 📁 Project Structure

```
endroid-os/
├── server/               # Node.js REST API + WebSocket PTY server
│   ├── index.js          # Main server (Express + ws)
│   └── package.json
├── public/               # HTML5 Web Desktop (runs in browser / VM)
│   ├── index.html        # Desktop shell entry point
│   ├── css/              # Theme, WM, and desktop styles
│   ├── js/               # Window manager, desktop, taskbar, API SDK
│   └── apps/             # 7 preinstalled applications
│       ├── files/        # File Manager
│       ├── terminal/     # WebSocket Terminal
│       ├── browser/      # Web Browser
│       ├── notes/        # Markdown Notes
│       ├── calculator/   # Scientific Calculator
│       ├── installer/    # .epk App Installer
│       └── settings/     # System Settings
├── vfs/                  # Virtual Filesystem (home, tmp, etc.)
├── sample-packages/      # Sample .epk app packages
├── iso-builder/          # Bootable ISO generator
│   ├── build_real_iso.py # Python ISO builder (pycdlib)
│   └── kernel-assets/    # Linux kernel, initramfs, ISOLINUX binaries
└── launch-vm.ps1         # VirtualBox VM automation script
```

---

## 🚀 Quick Start

### 1. Run the Web Desktop (Browser Mode)
```bash
cd server
npm install
node index.js
```
Then open **http://localhost:8080** in your browser.

### 2. Build the Bootable ISO
```bash
pip install pycdlib
python iso-builder/build_real_iso.py
```

### 3. Boot in VirtualBox
```powershell
powershell -ExecutionPolicy Bypass -File .\launch-vm.ps1
```

---

## 🖥️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/info` | System information & uptime |
| GET/POST | `/api/fs/*` | Virtual filesystem read/write |
| GET | `/api/apps/list` | List installed apps |
| POST | `/api/apps/install` | Install `.epk` package |
| DELETE | `/api/apps/uninstall/:id` | Uninstall app |
| GET | `/api/process/list` | Running process list |
| GET/POST | `/api/settings` | Read/write system settings |
| WS | `/pty` | WebSocket interactive shell |

---

## 📦 `.epk` Package Format

Endroid apps are distributed as `.epk` files (ZIP archives) with this structure:

```
myapp.epk
├── manifest.json    # App metadata (name, version, permissions)
├── icon.svg         # App icon (Lucide-compatible SVG)
└── index.html       # App UI entry point
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

*Built with ❤️ on Linux + Node.js + HTML5*
