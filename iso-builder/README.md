# Endroid OS – Bootable Linux ISO Guide

This directory contains the pipeline and configuration files to package Endroid OS into a bootable Linux ISO image.

## Architecture

```
[BIOS / UEFI]
      │
[Syslinux / GRUB] (isolinux.cfg / grub.cfg)
      │
[Linux Kernel] (vmlinuz - minimal custom x86_64)
      │
[initramfs] (BusyBox + init script)
      │
[Local API Server] (Node.js Express / WebSocket daemon on port 8080)
      │
[Web Engine Runtime] (WebKitGTK / Cog / Chromium Kiosk on Wayland)
      │
[Endroid Desktop UI] (HTML5 / CSS3 / Vanilla JS + Offline Lucide)
```

## How to Build the ISO (Linux or WSL2)

### 1. Install prerequisites:
```bash
sudo apt-get update
sudo apt-get install -y xorriso isolinux syslinux-utils busybox-static nodejs npm qemu-system-x86
```

### 2. Run the build script:
```bash
chmod +x build-iso.sh
./build-iso.sh
```

### 3. Test booting in QEMU:
```bash
qemu-system-x86_64 -cdrom endroid-os-v1.0-x86_64.iso -m 512M -vga virtio -enable-kvm
```
