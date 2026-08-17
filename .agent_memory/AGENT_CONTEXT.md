# Endroid OS — Master AI Agent Context & Memory

This directory contains the full context, architectural history, design decisions, execution trajectory, and technical specifications for **Endroid OS**.

---

## 1. Project Goal & Overview
Endroid OS is a fully self-contained, standalone web-powered operating system built on top of a lightweight Linux kernel (TinyCore 64-bit). It runs without any external host Node.js dependencies, boots bare-metal or in VirtualBox, and delivers a desktop UI via a local web server (`busybox httpd`).

---

## 2. Core Architecture & Components

### A. Base System
- **Base Kernel**: `vmlinuz64` (TinyCore 64-bit Linux Kernel v6.6.8).
- **Base Rootfs**: `corepure64.gz` (TinyCore base CPIO RAM disk).
- **Bootloader**: ISOLINUX 6.03 (El Torito ISO9660).

### B. ISO Builder (`iso-builder/build_real_iso.py`)
- Unpacks the base CPIO archive using a 13-field CPIO `newc` parser.
- **Critical CPIO Device Fix**: Preserves exact hex-encoded `mode`, `uid`, `gid`, `nlink`, `mtime`, `devmajor`, `devminor`, `rdevmajor`, `rdevminor` header fields. This prevents character device corruption (`/dev/null` and `/dev/console` lost major/minor numbers).
- Merges the Endroid OS overlay directly into a single compressed `initrd.gz` stream.
- Bundles full 64-bit static BusyBox (`/bin/busybox-full`), TCZ packages (`Xorg-7.7.tcz`, `openbox.tcz`, `dillo.tcz`), web assets (`public/`), and CGI scripts (`public/cgi-bin/`).

### C. Web Server & CGI API (`/bin/busybox-full httpd`)
- Serves static Web UI assets from `/opt/endroid/public` on HTTP ports `8080` and `80`.
- Executes CGI scripts placed under `/opt/endroid/public/cgi-bin/` (e.g. `apps.sh`, `launch.sh`).
- Configured via `/etc/httpd.conf` with `A:*` to permit unrestricted web desktop and CGI access.

### D. Startup Automation (`/opt/bootsync.sh` and `/opt/bootlocal.sh`)
- Initializes network loopback (`lo`) and configures static IP `10.0.2.15` on `eth0` for VirtualBox NAT port forwarding.
- Sets up `/tmp/tce` and `/etc/sysconfig/tcedir` for TinyCore extension loading.
- Spawns `/bin/busybox-full httpd` daemons.
- Configures `/home/tc/.xinitrc` to launch `openbox-session` and `dillo http://127.0.0.1:8080/`.

---

## 3. How to Build & Run

### Rebuilding the ISO
```powershell
python iso-builder\build_real_iso.py
```
Outputs `endroid-os-x86_64.iso` (~21 MB).

### Launching in VirtualBox
```powershell
powershell -File .\launch-vm.ps1
```
Creates/registers the `EndroidOS` VM with 1024MB RAM, VMSVGA graphics, NAT port forwarding (`localhost:8080` -> `guest:8080`), attaches ISO, and starts VirtualBox GUI.

---

## 4. Included Memory Files
- **`implementation_plan.md`**: Architectural plan & design specifications.
- **`walkthrough.md`**: Complete log of boot fixes, CPIO newc resolution, and verification steps.
- **`transcript.jsonl`**: Full chronological AI agent action log and execution transcript.
