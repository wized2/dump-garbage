# Endroid OS — Master AI Agent Context & Memory (Bare-Metal Edition)

This directory contains the full context, architectural history, design decisions, execution trajectory, and technical specifications for **Endroid OS** as a true, standalone bare-metal operating system.

---

## 1. Project Goal & Overview
Endroid OS is a **fully self-contained, standalone bare-metal operating system** built on top of a lightweight 64-bit Linux kernel (`vmlinuz64`). It is designed to run directly on physical PC hardware (laptops, desktops, mini-PCs) as the **primary and only operating system**, completely independent of any host OS.

---

## 2. Core Architecture & Components

### A. Base System & Dual Boot Architecture
- **Base Kernel**: `vmlinuz64` (TinyCore 64-bit Linux Kernel).
- **Dual Boot**:
  - **UEFI 64-bit**: `EFI/BOOT/BOOTX64.EFI`, `ldlinux.e64`, `linux.c32`, `grub.cfg`, `syslinux.cfg` for modern UEFI GPT systems.
  - **Legacy BIOS**: `ISOLINUX 6.03` (`isolinux.bin`, `ldlinux.c32`, `isolinux.cfg`) for classic BIOS MBR systems.
- **Base Rootfs**: Merged CPIO RAM disk (`initrd.gz`, 81.8 MB) bundling standalone 64-bit Node.js, TinyCore extensions (Xorg, Openbox, Dillo), Web Desktop UI assets, and server APIs.

### B. Persistent Storage Engine
- Script `/opt/bootsync.sh` scans for `LABEL=ENDROID_DATA`.
- Automatically mounts persistence onto `/opt/endroid/vfs` and `/home/tc`, preserving documents, configurations, and installed applications across reboots.

### C. Bare-Metal OS Installer (`public/apps/os-installer/`)
- Native guided installer wizard:
  - Scans physical storage drives (`/dev/sda`, `/dev/nvme0n1`).
  - Partitions GPT (512MB FAT32 ESP + Ext4 rootfs).
  - Deploys kernel, initramfs, runtime, and bootloader.
  - Provisions the target PC to boot Endroid OS natively as the sole operating system.

### D. System Server & Hardware APIs (`server/index.js`)
- Runs as a zero-npm dependency Node.js daemon on port 8080.
- Hardware APIs (`/api/system/hardware`, `/api/system/shutdown`, `/api/system/reboot`).
- Disk Manager & Installer APIs (`/api/installer/disks`, `/api/installer/install`).
- Network Manager (`/api/network/interfaces`).

---

## 3. How to Build & Install

### Building the Bare-Metal ISO
```powershell
python iso-builder\build_real_iso.py
```
Produces `endroid-os-x86_64.iso` (~88 MB).

### Flashing & Installing on a Physical PC
1. Flash `endroid-os-x86_64.iso` to a USB drive using **Rufus** (select GPT/UEFI or MBR), **Ventoy**, or `dd`.
2. Boot the target PC from the USB flash drive.
3. Launch the **Install to PC** application from the desktop.
4. Select the target internal SSD/HDD and click **Install Now**.
5. Reboot directly into Endroid OS as the primary operating system.
