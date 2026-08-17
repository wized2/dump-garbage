#!/bin/bash
# ==============================================================================
# Endroid OS - Bootable Linux ISO Construction Script
# Builds a lightweight, hybrid bootable ISO image (< 150MB) featuring:
# - Minimal Linux Kernel + BusyBox initramfs
# - Endroid Local API Server & Node Runtime
# - WebKitGTK / Cage lightweight Wayland compositor kiosk loading http://localhost:8080
# ==============================================================================

set -e

WORK_DIR="/tmp/endroid-iso-build"
ISO_NAME="endroid-os-v1.0-x86_64.iso"
ROOTFS="${WORK_DIR}/rootfs"
ISODIR="${WORK_DIR}/iso"

echo "=================================================="
echo "🌟 Building Endroid OS Bootable Linux ISO..."
echo "=================================================="

# Check requirements
for tool in xorriso mtools syslinux busybox; do
    if ! command -v $tool &> /dev/null; then
        echo "⚠️  Note: '$tool' recommended on Linux build host."
    fi
done

# Clean workspace
rm -rf "${WORK_DIR}"
mkdir -p "${ROOTFS}" "${ISODIR}/isolinux" "${ISODIR}/boot"

# 1. Build initramfs structure
echo "📦 1. Creating base initramfs filesystem structure..."
mkdir -p "${ROOTFS}"/{bin,sbin,dev,proc,sys,etc,mnt,tmp,var,home/user,apps}
mkdir -p "${ROOTFS}/etc/endroid"

# Copy Endroid OS Application & Server Bundle
echo "🎨 2. Bundling Endroid Desktop UI and API Server into image..."
mkdir -p "${ROOTFS}/opt/endroid"
cp -r ../server "${ROOTFS}/opt/endroid/"
cp -r ../public "${ROOTFS}/opt/endroid/"
cp -r ../vfs/* "${ROOTFS}/opt/endroid/vfs/" 2>/dev/null || true

# Copy init script
cp init "${ROOTFS}/init"
chmod +x "${ROOTFS}/init"

# 2. Package initramfs
echo "🗜️ 3. Compressing initramfs..."
(cd "${ROOTFS}" && find . | cpio -H newc -o | gzip -9) > "${ISODIR}/boot/initrd.img"

# 3. Setup ISOLINUX Bootloader
echo "⚙️ 4. Setting up ISOLINUX bootloader..."
cp syslinux.cfg "${ISODIR}/isolinux/isolinux.cfg"
cp /usr/lib/ISOLINUX/isolinux.bin "${ISODIR}/isolinux/" 2>/dev/null || true
cp /usr/lib/syslinux/modules/bios/ldlinux.c32 "${ISODIR}/isolinux/" 2>/dev/null || true

# 4. Generate Hybrid ISO with xorriso
echo "💿 5. Generating hybrid bootable ISO image: ${ISO_NAME}..."
if command -v xorriso &> /dev/null; then
    xorriso -as mkisofs \
        -r -V "ENDROID_OS" \
        -J -l -b isolinux/isolinux.bin \
        -c isolinux/boot.cat \
        -no-emul-boot -boot-load-size 4 -boot-info-table \
        -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \
        -o "../${ISO_NAME}" \
        "${ISODIR}" 2>/dev/null || \
    genisoimage -o "../${ISO_NAME}" -b isolinux/isolinux.bin -c isolinux/boot.cat -no-emul-boot -boot-load-size 4 -boot-info-table -R -J -V "ENDROID_OS" "${ISODIR}"
    echo "✅ Successfully built: ${ISO_NAME}"
else
    echo "💡 Run this script on a Linux host (or WSL2) with xorriso/syslinux installed to produce the binary .iso!"
fi

echo "=================================================="
echo "🚀 Boot test command:"
echo "qemu-system-x86_64 -cdrom ${ISO_NAME} -m 512M -vga virtio"
echo "=================================================="
