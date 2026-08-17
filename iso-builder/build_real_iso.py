import os
import sys
import shutil
import gzip
import io
import pycdlib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
KERNEL_ASSETS = os.path.join(BASE_DIR, "kernel-assets")
ISO_OUT_PATH = os.path.join(PROJECT_ROOT, "endroid-os-x86_64.iso")
STAGING_DIR = os.path.join(BASE_DIR, "iso_staging")

print("==================================================")
print("[*] Rebuilding Endroid Linux ISO (Flat Kernel Layout)")
print("==================================================")

if os.path.exists(STAGING_DIR):
    shutil.rmtree(STAGING_DIR)
os.makedirs(os.path.join(STAGING_DIR, "BOOT"), exist_ok=True)
os.makedirs(os.path.join(STAGING_DIR, "ISOLINUX"), exist_ok=True)

# 1. Create CPIO Initramfs Overlay
def make_cpio_header(filename, size, mode=0o100755):
    namesize = len(filename.encode('utf-8')) + 1
    hdr = f"070701{0:08x}{mode:08x}{0:08x}{0:08x}{1:08x}{0:08x}{size:08x}{0:08x}{0:08x}{0:08x}{0:08x}{namesize:08x}{0:08x}"
    out = hdr.encode('ascii') + filename.encode('utf-8') + b'\x00'
    pad = (4 - (len(out) % 4)) % 4
    return out + (b'\x00' * pad)

def make_cpio_entry(filename, data_bytes, mode=0o100755):
    hdr = make_cpio_header(filename, len(data_bytes), mode)
    pad = (4 - (len(data_bytes) % 4)) % 4
    return hdr + data_bytes + (b'\x00' * pad)

def make_cpio_dir(dirname, mode=0o40755):
    return make_cpio_entry(dirname, b'', mode)

cpio_stream = io.BytesIO()
for d in ["etc", "etc/endroid", "etc/init.d", "opt", "opt/endroid", "opt/endroid/public", "opt/endroid/server", "opt/endroid/vfs"]:
    cpio_stream.write(make_cpio_dir(d))

banner = """
==================================================
  .---.        Endroid OS 1.0 (Horizon Edition)
 /     \\       Linux Kernel 6.8.0-endroid-x86_64
| () () |      Web Desktop Environment: Active
 \\  -  /       URL: http://localhost:8080
  '-----'      Ready for commands & web interface
==================================================
""".encode('utf-8')
cpio_stream.write(make_cpio_entry("etc/issue", banner, 0o100644))
cpio_stream.write(make_cpio_entry("etc/motd", banner, 0o100644))

init_script = """#!/bin/sh
echo "=================================================="
echo "🌟 Welcome to Endroid OS (Linux 6.8.0-endroid)"
echo "🚀 Initializing Local API Server & Web Runtime..."
echo "=================================================="
mkdir -p /tmp/endroid /var/log /home/tc
cd /opt/endroid/server 2>/dev/null || true
if command -v node >/dev/null 2>&1; then
    node index.js >/var/log/endroid.log 2>&1 &
fi
echo "=================================================="
echo "✅ Endroid OS Ready on Linux x86_64"
echo "📡 Web Desktop Server: http://localhost:8080"
echo "=================================================="
""".encode('utf-8')
cpio_stream.write(make_cpio_entry("etc/init.d/endroid", init_script, 0o100755))

for root, _, files in os.walk(os.path.join(PROJECT_ROOT, "public")):
    for f in files:
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, PROJECT_ROOT).replace("\\", "/")
        target_path = "opt/endroid/" + rel_path
        try:
            with open(full_path, "rb") as fp:
                data = fp.read()
            cpio_stream.write(make_cpio_entry(target_path, data, 0o100644))
        except Exception:
            pass

cpio_stream.write(make_cpio_entry("TRAILER!!!", b''))
overlay_gz = gzip.compress(cpio_stream.getvalue(), compresslevel=9)

# 2. Merge with Base Linux Initramfs
base_rootfs_path = os.path.join(KERNEL_ASSETS, "corepure64.gz")
out_initrd_path = os.path.join(STAGING_DIR, "ISOLINUX", "INITRD.GZ")

with open(out_initrd_path, "wb") as out_fp:
    if os.path.exists(base_rootfs_path):
        with open(base_rootfs_path, "rb") as base_fp:
            shutil.copyfileobj(base_fp, out_fp)
    out_fp.write(overlay_gz)

# Copy kernel to ISOLINUX directory
shutil.copy2(os.path.join(KERNEL_ASSETS, "vmlinuz64"), os.path.join(STAGING_DIR, "ISOLINUX", "VMLINUZ64"))

# Copy bootloader files
isolinux_src = os.path.join(KERNEL_ASSETS, "isolinux")
for f in ["isolinux.bin", "ldlinux.c32"]:
    src_f = os.path.join(isolinux_src, f)
    if os.path.exists(src_f):
        shutil.copy2(src_f, os.path.join(STAGING_DIR, "ISOLINUX", f.upper()))

# ISOLINUX Config using local same-directory files
isolinux_cfg = """DEFAULT endroid
PROMPT 0
TIMEOUT 10

LABEL endroid
    KERNEL VMLINUZ64
    INITRD INITRD.GZ
    APPEND quiet waitusb=5 nodhcp mydata=endroid vga=791 loglevel=3

LABEL failsafe
    KERNEL VMLINUZ64
    INITRD INITRD.GZ
    APPEND nomodeset xforcevesa waitusb=5 mydata=endroid
"""
with open(os.path.join(STAGING_DIR, "ISOLINUX", "ISOLINUX.CFG"), "w") as fp:
    fp.write(isolinux_cfg)

# 4. Generate Standard Bootable ISO9660 using pycdlib
iso = pycdlib.PyCdlib()
iso.new(
    interchange_level=3,
    joliet=3,
    rock_ridge='1.09',
    vol_ident='ENDROID_OS'
)

# Add /isolinux directory
iso.add_directory('/ISOLINUX', rr_name='isolinux', joliet_path='/isolinux')

# Add kernel and initrd directly into /isolinux
iso.add_file(
    os.path.join(STAGING_DIR, 'ISOLINUX', 'VMLINUZ64'),
    '/ISOLINUX/VMLINUZ64;1',
    rr_name='vmlinuz64',
    joliet_path='/isolinux/vmlinuz64'
)
iso.add_file(
    os.path.join(STAGING_DIR, 'ISOLINUX', 'INITRD.GZ'),
    '/ISOLINUX/INITRD.GZ;1',
    rr_name='initrd.gz',
    joliet_path='/isolinux/initrd.gz'
)

# Add ISOLINUX bootloader files
isolinux_bin_path = os.path.join(STAGING_DIR, 'ISOLINUX', 'ISOLINUX.BIN')
iso.add_file(
    isolinux_bin_path,
    '/ISOLINUX/ISOLINUX.BIN;1',
    rr_name='isolinux.bin',
    joliet_path='/isolinux/isolinux.bin'
)

iso.add_eltorito(
    '/ISOLINUX/ISOLINUX.BIN;1',
    bootcatfile='/ISOLINUX/BOOT.CAT;1',
    boot_load_size=4,
    boot_info_table=True,
    media_name='noemul'
)

for f in ["LDLINUX.C32", "ISOLINUX.CFG"]:
    f_path = os.path.join(STAGING_DIR, 'ISOLINUX', f)
    if os.path.exists(f_path):
        iso.add_file(
            f_path,
            f'/ISOLINUX/{f};1',
            rr_name=f.lower(),
            joliet_path=f'/isolinux/{f.lower()}'
        )

# Write output ISO
iso.write(ISO_OUT_PATH)
iso.close()

iso_size_mb = os.path.getsize(ISO_OUT_PATH) / (1024 * 1024)
print(f"[+] SUCCESS! Linux ISO Created: {ISO_OUT_PATH} ({iso_size_mb:.2f} MB)")
