# 🌐 Endroid OS — Standalone Bare-Metal Web Operating System

**Endroid OS** is a **fully self-contained, standalone bare-metal operating system** built on top of a 64-bit Linux kernel (`vmlinuz64`). It is designed to run directly on physical PC hardware (laptops, desktops, mini-PCs) as the **primary and only operating system**, completely independent of any host OS.

---

## ✨ Standalone Bare-Metal Features

- **True Bare-Metal OS** — Boots directly on physical x86_64 PC hardware (Intel & AMD) via USB flash drive or internal SSD/HDD without needing any host OS.
- **Dual Boot Architecture (UEFI + BIOS)** — Boots on both modern UEFI GPT motherboards (`EFI/BOOT/BOOTX64.EFI`) and legacy BIOS MBR systems (ISOLINUX).
- **Integrated Bare-Metal Disk Installer** — Guided desktop wizard ("Install Endroid OS to PC") that scans physical NVMe/SATA drives, partitions GPT/EFI System Partitions, formats Ext4/FAT32, installs bootloader, and deploys the OS directly to the internal disk.
- **Persistent Data Storage Engine** — Automatically detects and mounts internal persistent storage partitions (`LABEL=ENDROID_DATA`), saving documents, settings, wallpapers, and installed apps across reboots.
- **Self-Contained Linux Node.js Runtime** — Bundles a standalone 64-bit Node.js binary in the rootfs (`/usr/local/bin/node`) powering the local system server, hardware APIs, process manager, and VFS without npm dependencies.
- **Full-Featured HTML5 Desktop Environment** — Window management, taskbar, dock, system tray, search launcher, notifications, night light, theme customizer, and offline Lucide iconography.
- **Built-in System Applications**:
  - 💾 **Install to PC** — Bare-metal OS installer for internal drives.
  - 📁 **File Manager** — File navigation, copy, move, delete, upload/download.
  - 💻 **Terminal** — Command-line interface and system execution.
  - 🌐 **Web Browser** — Multi-tab browser with ad-blocker.
  - 📝 **Notes** — Markdown editor with live preview.
  - 🔢 **Calculator** — Scientific calculator with history.
  - 📦 **App Store** — Package installer for `.epk` applications.
  - ⚙️ **Settings** — Hardware telemetry, CPU/RAM monitor, displays, networking, themes.

---

## 🛠️ How to Build the Bootable Bare-Metal ISO

### Prerequisites
- Python 3.8+ with `pycdlib`

```powershell
pip install pycdlib
python iso-builder\build_real_iso.py
```
This produces `endroid-os-x86_64.iso` (~88 MB) in the project root containing the Linux kernel, standalone Node.js runtime, desktop environment, and dual UEFI + BIOS bootloader images.

---

## 💾 How to Install on a Physical PC (Primary OS)

### 1. Flash to USB Drive
You can flash `endroid-os-x86_64.iso` to any USB flash drive (≥ 1 GB) using your preferred tool:

* **Rufus (Windows)**: Select the ISO, choose **GPT** for UEFI or **MBR** for BIOS, and click **Start**.
* **Ventoy**: Simply copy `endroid-os-x86_64.iso` onto your Ventoy USB drive.
* **Linux / macOS `dd`**:
  ```bash
  sudo dd if=endroid-os-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fdatasync
  ```

### 2. Boot Physical PC from USB
1. Insert the USB flash drive into your computer.
2. Turn on the PC and press the Boot Menu key (`F12`, `F11`, `F8`, or `Del` depending on motherboard).
3. Select the USB flash drive from the boot options (UEFI or Legacy).

### 3. Launch the Bare-Metal Installer
1. The PC will boot directly into the Endroid OS live environment.
2. Double-click the **Install to PC** icon on the desktop.
3. Review your system hardware specifications (CPU, RAM, Firmware).
4. Select your target internal SSD/HDD drive (`/dev/sda`, `/dev/nvme0n1`, etc.).
5. Configure computer name and click **Install Now**.
6. Once complete, unplug the USB drive and click **Reboot PC** to boot natively into Endroid OS as the primary operating system.

---

## 📁 Project Structure

```
dump-garbage/
├── iso-builder/
│   ├── build_real_iso.py      # Standalone Bare-Metal ISO Builder (Dual UEFI/BIOS)
│   └── kernel-assets/         # Linux kernel (vmlinuz64), rootfs, syslinux/EFI, Node.js
├── public/                    # Web Desktop OS UI
│   ├── index.html             # Desktop Shell entry point
│   ├── css/                   # Themes, WM, desktop styling
│   ├── js/                    # Window manager, taskbar, desktop controller, API SDK
│   └── apps/                  # System Applications
│       ├── os-installer/      # Bare-Metal Disk Installer App
│       ├── files/             # File Manager
│       ├── terminal/          # Terminal
│       ├── browser/           # Web Browser
│       ├── notes/             # Markdown Notes
│       ├── calculator/        # Calculator
│       ├── installer/         # App Store (.epk manager)
│       └── settings/          # System Settings & Hardware Telemetry
├── server/                    # Standalone Node.js System Server
│   └── index.js               # Hardware, Disk Installer, VFS, System REST APIs
├── vfs/                       # Persistent Virtual Filesystem Root
└── launch-vm.ps1              # Optional VirtualBox VM testing script
```

---

## 🖥️ System Server REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/info` | Hostname, kernel version, OS release, memory |
| `GET` | `/api/system/hardware` | Physical CPU, RAM, battery, firmware (UEFI/BIOS) |
| `GET` | `/api/installer/disks` | Physical NVMe/SATA storage block devices & partitions |
| `POST` | `/api/installer/install` | Bare-metal partitioning, formatting, and OS deployment |
| `POST` | `/api/system/shutdown` | Hardware ACPI poweroff |
| `POST` | `/api/system/reboot` | Hardware system restart |
| `GET` | `/api/network/interfaces` | Physical Ethernet & Wi-Fi interfaces |
| `GET`/`POST` | `/api/fs` | File system operations (read/write/list/delete) |
| `GET` | `/api/apps` | System and installed applications |

---

## 📄 License
MIT License. Created for Endroid OS.
