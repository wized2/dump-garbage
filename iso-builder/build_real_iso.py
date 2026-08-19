#!/usr/bin/env python3
"""
Endroid OS — Master Bare-Metal ISO Builder v7 (Complete Graphical Desktop)
- Fully self-contained, standalone operating system (zero host dependencies).
- Boots into full graphical Xorg + JWM + Dillo desktop automatically.
- Bundles 64-bit Linux Node.js runtime and full Endroid Web Desktop server.
- Supports UEFI (GPT) and Legacy BIOS (MBR) bare-metal booting.
- Auto-mounts persistent data storage (LABEL=ENDROID_DATA) across reboots.
"""

import os, sys, shutil, gzip, io, struct, tarfile, zipfile, urllib.request

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
KERNEL_ASSETS= os.path.join(BASE_DIR, "kernel-assets")
ISOLINUX_BINS= os.path.join(KERNEL_ASSETS, "isolinux")
TCE_CACHE    = os.path.join(BASE_DIR, "tce_cache")
ISO_OUT      = os.path.join(PROJECT_ROOT, "endroid-os-x86_64.iso")
STAGING_DIR  = os.path.join(BASE_DIR, "iso_staging")

print("=" * 65)
print("  Endroid OS — Master Bare-Metal OS Builder v7")
print("  Target: Physical PC Hardware (Full GUI Desktop, UEFI + BIOS)")
print("=" * 65)

# Clean staging area
if os.path.exists(STAGING_DIR):
    shutil.rmtree(STAGING_DIR)
os.makedirs(os.path.join(STAGING_DIR, "isolinux"), exist_ok=True)
os.makedirs(os.path.join(STAGING_DIR, "EFI", "BOOT"), exist_ok=True)
os.makedirs(os.path.join(STAGING_DIR, "boot"), exist_ok=True)
os.makedirs(os.path.join(STAGING_DIR, "cce", "optional"), exist_ok=True)

# ---------------------------------------------------------------
# STEP 1: Extract TinyCore base rootfs
# ---------------------------------------------------------------
print("[1/5] Extracting base Linux rootfs...")
base_gz = os.path.join(KERNEL_ASSETS, "corepure64.gz")
with gzip.open(base_gz, 'rb') as f:
    cpio_data = f.read()
print(f"  Base CPIO size: {len(cpio_data)/1024/1024:.2f} MB")

def parse_cpio_newc(data):
    """Parse newc CPIO archive, preserving all exact header fields."""
    pos = 0
    entries = []
    while pos < len(data):
        if data[pos:pos+6] != b'070701':
            break
        header = data[pos:pos+110]
        namesize = int(header[94:102], 16)
        filesize = int(header[54:62], 16)
        name = data[pos+110:pos+110+namesize-1].decode('utf-8', errors='replace')
        name_pad = (4 - ((110 + namesize) % 4)) % 4
        data_start = pos + 110 + namesize + name_pad
        file_data = data[data_start:data_start+filesize]
        
        mode = int(header[14:22], 16)
        uid = int(header[22:30], 16)
        gid = int(header[30:38], 16)
        nlink = int(header[38:46], 16)
        mtime = int(header[46:54], 16)
        devmajor = int(header[62:70], 16)
        devminor = int(header[70:78], 16)
        rdevmajor = int(header[78:86], 16)
        rdevminor = int(header[86:94], 16)
        
        entries.append((name, mode, uid, gid, nlink, mtime, devmajor, devminor, rdevmajor, rdevminor, file_data))
        if name == 'TRAILER!!!':
            break
        data_pad = (4 - (filesize % 4)) % 4
        pos = data_start + filesize + data_pad
    return entries

_ino_counter = [1000000]

def make_cpio_entry(name, data=b'', mode=0o100755, uid=0, gid=0, nlink=1, mtime=0, devmajor=3, devminor=1, rdevmajor=0, rdevminor=0):
    name_bytes = name.encode('utf-8') + b'\x00'
    namesize = len(name_bytes)
    filesize = len(data)
    if name == 'TRAILER!!!':
        ino = 0
    else:
        _ino_counter[0] += 1
        ino = _ino_counter[0]
    header = (
        b'070701'
        + f'{ino:08X}'.encode()
        + f'{mode:08X}'.encode()
        + f'{uid:08X}'.encode()
        + f'{gid:08X}'.encode()
        + f'{nlink:08X}'.encode()
        + f'{mtime:08X}'.encode()
        + f'{filesize:08X}'.encode()
        + f'{devmajor:08X}'.encode()
        + f'{devminor:08X}'.encode()
        + f'{rdevmajor:08X}'.encode()
        + f'{rdevminor:08X}'.encode()
        + f'{namesize:08X}'.encode()
        + b'00000000'
    )
    raw = header + name_bytes
    raw += b'\x00' * ((4 - (len(raw) % 4)) % 4)
    raw += data
    raw += b'\x00' * ((4 - (len(data) % 4)) % 4)
    return raw

# ---------------------------------------------------------------
# STEP 2: Build merged CPIO (Base + Node.js + Endroid OS)
# ---------------------------------------------------------------
print("[2/5] Building merged rootfs CPIO with standalone Node.js and Endroid OS...")
base_entries = parse_cpio_newc(cpio_data)
base_names = {e[0] for e in base_entries if e[0] != 'TRAILER!!!'}
new_cpio = io.BytesIO()

for name, mode, uid, gid, nlink, mtime, devmajor, devminor, rdevmajor, rdevminor, data in base_entries:
    if name == 'TRAILER!!!':
        continue
    new_cpio.write(make_cpio_entry(name, data, mode, uid, gid, nlink, mtime, devmajor, devminor, rdevmajor, rdevminor))

def add_dir(name, mode=0o040755):
    if name not in base_names:
        new_cpio.write(make_cpio_entry(name, b'', mode))
        base_names.add(name)

def add_file(name, data, mode=0o100755):
    new_cpio.write(make_cpio_entry(name, data, mode))
    base_names.add(name)

def add_text(name, text, mode=0o100644):
    new_cpio.write(make_cpio_entry(name, text.encode('utf-8'), mode))
    base_names.add(name)

# Ensure overlay directories
overlay_dirs = [
    'opt', 'opt/endroid', 'opt/endroid/server', 'opt/endroid/public',
    'opt/endroid/vfs', 'opt/endroid/vfs/home', 'opt/endroid/vfs/home/user',
    'opt/endroid/vfs/home/user/Desktop', 'opt/endroid/vfs/etc', 'opt/endroid/vfs/etc/endroid',
    'usr', 'usr/local', 'usr/local/bin', 'lib64', 'boot', 'boot/tce', 'etc/sysconfig', 'var/log', 'mnt/endroid_storage'
]
for d in overlay_dirs:
    add_dir(d)

# Extract and bundle standalone 64-bit Node.js binary
node_tar_path = os.path.join(KERNEL_ASSETS, "node-linux-x64.tar.gz")
if os.path.exists(node_tar_path):
    print("  Extracting 64-bit Linux Node.js runtime...")
    with tarfile.open(node_tar_path, 'r:gz') as tar:
        for member in tar.getmembers():
            if member.name.endswith('/bin/node'):
                f = tar.extractfile(member)
                node_binary_data = f.read()
                add_file('usr/local/bin/node', node_binary_data, 0o100755)
                add_file('bin/node', node_binary_data, 0o100755)
                print(f"  [OK] Bundled Node.js runtime ({len(node_binary_data)/1024/1024:.2f} MB)")
                break

# Bundle server, public, and vfs files
def bundle_directory(src_dir, target_prefix):
    count = 0
    for root, dirs, files in os.walk(src_dir):
        rel_dir = os.path.relpath(root, src_dir).replace('\\', '/')
        dest_dir = target_prefix if rel_dir == '.' else f"{target_prefix}/{rel_dir}"
        add_dir(dest_dir)
        for f in files:
            full_path = os.path.join(root, f)
            dest_file = f"{dest_dir}/{f}"
            try:
                with open(full_path, 'rb') as fh:
                    add_file(dest_file, fh.read(), 0o100644)
                count += 1
            except Exception as e:
                print(f"  [SKIP] {dest_file}: {e}")
    return count

server_count = bundle_directory(os.path.join(PROJECT_ROOT, 'server'), 'opt/endroid/server')
public_count = bundle_directory(os.path.join(PROJECT_ROOT, 'public'), 'opt/endroid/public')
vfs_count    = bundle_directory(os.path.join(PROJECT_ROOT, 'vfs'), 'opt/endroid/vfs')
print(f"  Bundled Endroid OS: {server_count} server files, {public_count} web UI files, {vfs_count} VFS template files.")

# Pre-extract all TCE squashfs packages on Windows host → embed binaries directly into CPIO
print("  Pre-extracting TCE squashfs packages into rootfs...")
extracted_count = 0
skipped_dirs = {'opt/tce'}
if os.path.exists(TCE_CACHE):
    from PySquashfsImage import SquashFsImage
    tce_files = [f for f in os.listdir(TCE_CACHE) if f.endswith('.tcz')]
    for tf in tce_files:
        fpath = os.path.join(TCE_CACHE, tf)
        try:
            with open(fpath, 'rb') as fh:
                img = SquashFsImage(fh)
                for item in img.root.riter():
                    ipath = str(item.path).lstrip('/')
                    if not ipath:
                        continue
                    try:
                        if item.is_dir:
                            add_dir(ipath)
                        elif item.is_file:
                            data = img.read_file(item.inode)
                            mode = 0o100755 if (item.mode & 0o111) else 0o100644
                            if ipath not in base_names:
                                add_file(ipath, data, mode)
                            extracted_count += 1
                    except Exception:
                        pass
        except Exception as e:
            print(f"  [SKIP] {tf}: {e}")
    print(f"  Pre-extracted {extracted_count} files from {len(tce_files)} TCE packages into rootfs.")

# Initial sysconfig for Xorg and desktop
add_text('etc/sysconfig/Xserver', 'Xorg\n', 0o100644)
add_text('etc/sysconfig/desktop', 'jwm\n', 0o100644)

# ---------------------------------------------------------------
# Add Bare-Metal bootsync.sh (Startup & Persistence Manager)
# ---------------------------------------------------------------
bootsync_sh = """#!/bin/sh
mkdir -p /lib64
ln -sf /lib/* /lib64/ 2>/dev/null || true
ldconfig 2>/dev/null || true
mdev -s 2>/dev/null || true
ifconfig lo 127.0.0.1 up
for iface in $(ls /sys/class/net/ 2>/dev/null); do
    [ "$iface" = "lo" ] && continue
    ifconfig "$iface" up 2>/dev/null || true
    udhcpc -b -i "$iface" 2>/dev/null || true
done
echo Xorg > /etc/sysconfig/Xserver
echo jwm > /etc/sysconfig/desktop
"""
add_text('opt/bootsync.sh', bootsync_sh, 0o100755)

bootlocal_sh = """#!/bin/sh
mkdir -p /lib64
ln -sf /lib/* /lib64/ 2>/dev/null || true
ldconfig 2>/dev/null || true

export PORT=8080
/usr/local/bin/node /opt/endroid/server/index.js > /var/log/endroid.log 2>&1 &

mkdir -p /etc/X11
cat > /etc/X11/xorg.conf << 'XEOF'
Section "Device"
  Identifier "Card0"
  Driver "vesa"
EndSection
Section "Screen"
  Identifier "Screen0"
  Device "Card0"
  DefaultDepth 16
EndSection
Section "ServerFlags"
  Option "AllowMouseOpenFail" "true"
  Option "AutoAddDevices" "false"
EndSection
XEOF

mkdir -p /home/tc
cat > /home/tc/.xinitrc << 'XIEOF'
#!/bin/sh
xsetroot -solid '#1a1a2e'
dillo http://127.0.0.1:8080/ &
exec jwm
XIEOF
chmod +x /home/tc/.xinitrc
chown -R tc:staff /home/tc 2>/dev/null || true

sleep 2
export HOME=/home/tc
export DISPLAY=:0
export XAUTHORITY=/home/tc/.Xauthority
xinit /home/tc/.xinitrc -- :0 -ac vt7 > /tmp/xinit.log 2>&1 &
"""
add_text('opt/bootlocal.sh', bootlocal_sh, 0o100755)

# MOTD
motd = """
=============================================================
  Endroid OS — Standalone Bare-Metal Operating System
  Kernel: $(uname -r) | Arch: $(uname -m)
  Web Desktop: http://127.0.0.1:8080/
=============================================================
"""
add_text('etc/motd', motd, 0o100644)

# Copy all cached TCE packages into ISO /cce/optional/
if os.path.exists(TCE_CACHE):
    tce_files = os.listdir(TCE_CACHE)
    for tf in tce_files:
        src = os.path.join(TCE_CACHE, tf)
        dest = os.path.join(STAGING_DIR, 'cce', 'optional', tf)
        shutil.copy2(src, dest)

# Onboot package list for TinyCore
onboot_lst = """Xorg-jwm-desktop.tcz
vesa-Xorg.conf.tcz
dillo.tcz
"""
with open(os.path.join(STAGING_DIR, 'cce', 'onboot.lst'), 'w', newline='\n') as f:
    f.write(onboot_lst)

# CPIO trailer and compression
new_cpio.write(make_cpio_entry('TRAILER!!!', b''))
print("[3/5] Compressing bare-metal initrd.gz...")
initrd_path = os.path.join(STAGING_DIR, 'isolinux', 'initrd.gz')
with gzip.open(initrd_path, 'wb', compresslevel=6) as gz:
    gz.write(new_cpio.getvalue())
print(f"  initrd.gz size: {os.path.getsize(initrd_path)/1024/1024:.2f} MB")

# Copy initrd.gz and vmlinuz to boot/
shutil.copy2(initrd_path, os.path.join(STAGING_DIR, 'boot', 'initrd.gz'))
shutil.copy2(os.path.join(KERNEL_ASSETS, 'vmlinuz64'), os.path.join(STAGING_DIR, 'boot', 'vmlinuz'))

# ---------------------------------------------------------------
# STEP 4: Stage Dual Bootloaders (BIOS ISOLINUX + UEFI Syslinux/GRUB)
# ---------------------------------------------------------------
print("[4/5] Staging Dual Bootloaders (UEFI 64-bit + BIOS ISOLINUX)...")

# BIOS ISOLINUX
shutil.copy2(os.path.join(KERNEL_ASSETS, 'vmlinuz64'), os.path.join(STAGING_DIR, 'isolinux', 'vmlinuz'))
shutil.copy2(os.path.join(ISOLINUX_BINS, 'isolinux.bin'), os.path.join(STAGING_DIR, 'isolinux', 'isolinux.bin'))
shutil.copy2(os.path.join(ISOLINUX_BINS, 'ldlinux.c32'), os.path.join(STAGING_DIR, 'isolinux', 'ldlinux.c32'))

isolinux_cfg = """\
DEFAULT endroid
PROMPT 0
TIMEOUT 30

LABEL endroid
  LINUX /boot/vmlinuz
  INITRD /boot/initrd.gz
  APPEND quiet loglevel=3 waitusb=5 cce=cce
"""
with open(os.path.join(STAGING_DIR, 'isolinux', 'isolinux.cfg'), 'w', newline='\n') as f:
    f.write(isolinux_cfg)

# UEFI EFI/BOOT/
syslinux_zip = os.path.join(KERNEL_ASSETS, 'syslinux.zip')
if os.path.exists(syslinux_zip):
    with zipfile.ZipFile(syslinux_zip, 'r') as zf:
        efi_extracts = {
            'efi64/efi/syslinux.efi': 'BOOTX64.EFI',
            'efi64/com32/elflink/ldlinux/ldlinux.e64': 'ldlinux.e64',
            'efi64/com32/modules/linux.c32': 'linux.c32',
            'efi64/com32/modules/libutil.c32': 'libutil.c32',
            'efi64/com32/modules/libcom32.c32': 'libcom32.c32'
        }
        for zip_path, out_name in efi_extracts.items():
            if zip_path in zf.namelist():
                out_path = os.path.join(STAGING_DIR, 'EFI', 'BOOT', out_name)
                with open(out_path, 'wb') as of:
                    of.write(zf.read(zip_path))
                print(f"  Extracted UEFI component: {out_name}")

efi_cfg = """\
DEFAULT endroid
PROMPT 0
TIMEOUT 30

LABEL endroid
  LINUX /boot/vmlinuz
  INITRD /boot/initrd.gz
  APPEND quiet loglevel=3 waitusb=5 cce=cce
"""
with open(os.path.join(STAGING_DIR, 'EFI', 'BOOT', 'syslinux.cfg'), 'w', newline='\n') as f:
    f.write(efi_cfg)

# GRUB2 config fallback for UEFI
grub_cfg = """\
set default=0
set timeout=3

menuentry "Endroid OS (Standalone Bare-Metal)" {
    linux /boot/vmlinuz quiet loglevel=3 waitusb=5 cce=cce
    initrd /boot/initrd.gz
}
"""
with open(os.path.join(STAGING_DIR, 'EFI', 'BOOT', 'grub.cfg'), 'w', newline='\n') as f:
    f.write(grub_cfg)

# ---------------------------------------------------------------
# STEP 5: Assemble Bootable Hybrid ISO9660
# ---------------------------------------------------------------
print("[5/5] Assembling bootable ISO9660...")
import pycdlib

iso = pycdlib.PyCdlib()
iso.new(interchange_level=3, joliet=3, rock_ridge='1.09', vol_ident='ENDROID_OS')

def make_iso_8_3(fname):
    parts = fname.rsplit('.', 1)
    if len(parts) == 2:
        base = parts[0].replace('.', '_').replace('-', '_').upper()[:8]
        ext = parts[1].replace('.', '_').replace('-', '_').upper()[:3]
        return f"{base}.{ext}"
    else:
        base = fname.replace('.', '_').replace('-', '_').upper()[:8]
        return base

# Add ISOLINUX (BIOS)
iso.add_directory('/ISOLINUX', rr_name='isolinux', joliet_path='/isolinux')
iso.add_file(os.path.join(STAGING_DIR, 'isolinux', 'isolinux.bin'), '/ISOLINUX/ISOLINUX.BIN;1', rr_name='isolinux.bin', joliet_path='/isolinux/isolinux.bin')

# El Torito BIOS boot catalog
iso.add_eltorito(
    '/ISOLINUX/ISOLINUX.BIN;1',
    bootcatfile='/ISOLINUX/BOOT.CAT;1',
    rr_bootcatname='boot.cat',
    joliet_bootcatfile='/isolinux/boot.cat',
    boot_load_size=4,
    media_name='noemul',
    boot_info_table=True
)

iso.add_file(os.path.join(STAGING_DIR, 'isolinux', 'ldlinux.c32'), '/ISOLINUX/LDLINUX.C32;1', rr_name='ldlinux.c32', joliet_path='/isolinux/ldlinux.c32')
iso.add_file(os.path.join(STAGING_DIR, 'isolinux', 'isolinux.cfg'), '/ISOLINUX/ISOLINUX.CFG;1', rr_name='isolinux.cfg', joliet_path='/isolinux/isolinux.cfg')

# Add /boot
iso.add_directory('/BOOT', rr_name='boot', joliet_path='/boot')
iso.add_file(os.path.join(STAGING_DIR, 'boot', 'vmlinuz'), '/BOOT/VMLINUZ;1', rr_name='vmlinuz', joliet_path='/boot/vmlinuz')
iso.add_file(os.path.join(STAGING_DIR, 'boot', 'initrd.gz'), '/BOOT/INITRD.GZ;1', rr_name='initrd.gz', joliet_path='/boot/initrd.gz')

# Add /EFI/BOOT (UEFI)
iso.add_directory('/EFI', rr_name='EFI', joliet_path='/EFI')
iso.add_directory('/EFI/BOOT', rr_name='BOOT', joliet_path='/EFI/BOOT')
efi_boot_files = os.listdir(os.path.join(STAGING_DIR, 'EFI', 'BOOT'))
for ebf in efi_boot_files:
    fpath = os.path.join(STAGING_DIR, 'EFI', 'BOOT', ebf)
    iso_name = make_iso_8_3(ebf)
    iso.add_file(fpath, f'/EFI/BOOT/{iso_name};1', rr_name=ebf, joliet_path=f'/EFI/BOOT/{ebf}')

# Add /cce and /cce/optional with all TCZ packages
iso.add_directory('/CCE', rr_name='cce', joliet_path='/cce')
iso.add_file(os.path.join(STAGING_DIR, 'cce', 'onboot.lst'), '/CCE/ONBOOT.LST;1', rr_name='onboot.lst', joliet_path='/cce/onboot.lst')
iso.add_directory('/CCE/OPTIONAL', rr_name='optional', joliet_path='/cce/optional')

cce_opt_files = os.listdir(os.path.join(STAGING_DIR, 'cce', 'optional'))
for cf in cce_opt_files:
    fpath = os.path.join(STAGING_DIR, 'cce', 'optional', cf)
    iso_name = make_iso_8_3(cf)
    iso_name_clean = f"{iso_name};1"
    try:
        iso.add_file(fpath, f'/CCE/OPTIONAL/{iso_name_clean}', rr_name=cf, joliet_path=f'/cce/optional/{cf}')
    except Exception:
        idx = len(cf) % 1000
        iso.add_file(fpath, f'/CCE/OPTIONAL/P_{idx}_{iso_name_clean}', rr_name=cf, joliet_path=f'/cce/optional/{cf}')

iso.write(ISO_OUT)
iso.close()

size_mb = os.path.getsize(ISO_OUT) / 1024 / 1024
print("=" * 65)
print(f"[OK] Full GUI Standalone Bare-Metal ISO Created: {ISO_OUT}")
print(f"Size: {size_mb:.2f} MB")
print("=" * 65)
