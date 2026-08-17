#!/usr/bin/env python3
"""
Endroid OS ISO Builder v4
- Merges overlay directly into TinyCore rootfs (single CPIO stream)
- Uses TinyCore base, adds Xorg, Openbox, Dillo, BusyBox httpd (no Node.js)
- Auto‑starts UI via /opt/bootsync.sh (loads extensions, starts httpd, X, Dillo)
- Uses correct ISOLINUX 6.03 layout with lowercase Rock Ridge names
"""

import os, sys, shutil, gzip, io, struct, tarfile, urllib.request, subprocess

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
KERNEL_ASSETS= os.path.join(BASE_DIR, "kernel-assets")
ISOLINUX_BINS= os.path.join(KERNEL_ASSETS, "isolinux")
ISO_OUT      = os.path.join(PROJECT_ROOT, "endroid-os-x86_64.iso")
STAGING_DIR  = os.path.join(BASE_DIR, "iso_staging")

print("=" * 60)
print("  Endroid OS ISO Builder v4 — TinyCore + X/Openbox/Dillo")
print("=" * 60)

# Clean staging area
if os.path.exists(STAGING_DIR):
    shutil.rmtree(STAGING_DIR)
os.makedirs(os.path.join(STAGING_DIR, "isolinux"), exist_ok=True)

# ---------------------------------------------------------------
# STEP 1: Extract TinyCore base rootfs into a working directory
# ---------------------------------------------------------------
print("[1/5] Extracting TinyCore base rootfs...")
TC_ROOTFS = os.path.join(STAGING_DIR, "rootfs")
os.makedirs(TC_ROOTFS)
base_gz = os.path.join(KERNEL_ASSETS, "corepure64.gz")
with gzip.open(base_gz, 'rb') as f:
    cpio_data = f.read()
print(f"  Base CPIO size: {len(cpio_data)/1024/1024:.2f} MB")

def parse_cpio_newc(data):
    """Parse newc CPIO archive, yield entry tuple preserving all header fields."""
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
# STEP 2: Build merged CPIO (base + Endroid overlay)
# ---------------------------------------------------------------
print("[2/5] Building merged rootfs CPIO (base + Endroid overlay)...")
base_entries = parse_cpio_newc(cpio_data)
base_names = {e[0] for e in base_entries if e[0] != 'TRAILER!!!'}
new_cpio = io.BytesIO()

# Write base entries (except trailer) preserving exact device/mode fields
for name, mode, uid, gid, nlink, mtime, devmajor, devminor, rdevmajor, rdevminor, data in base_entries:
    if name == 'TRAILER!!!':
        continue
    new_cpio.write(make_cpio_entry(name, data, mode, uid, gid, nlink, mtime, devmajor, devminor, rdevmajor, rdevminor))

# Helper functions for overlay injection

def add_dir(name, mode=0o040755):
    new_cpio.write(make_cpio_entry(name, b'', mode))

def add_file(name, data, mode=0o100755):
    new_cpio.write(make_cpio_entry(name, data, mode))

def add_text(name, text, mode=0o100644):
    new_cpio.write(make_cpio_entry(name, text.encode('utf-8'), mode))

# Create overlay directories
overlay_dirs = [
    'opt', 'opt/endroid', 'opt/endroid/public', 'opt/endroid/public/js',
    'opt/endroid/public/css', 'opt/endroid/public/apps',
    'opt/endroid/cgi-bin', 'opt/endroid/bin', 'boot', 'boot/tce'
]
for d in overlay_dirs:
    if d not in base_names:
        add_dir(d)

# Add static full BusyBox binary to initrd
bbox_static = os.path.join(BASE_DIR, 'busybox-static')
if os.path.exists(bbox_static):
    with open(bbox_static, 'rb') as f:
        add_file('bin/busybox-full', f.read(), 0o100755)
    print("  Bundled static full BusyBox into /bin/busybox-full")

# ---------------------------------------------------------------
# Add bootsync.sh (auto‑start script)
# ---------------------------------------------------------------
bootsync_sh = """#!/bin/sh
# Endroid OS bootsync - runs at boot as root

# Initialize network loopback & ethernet
ifconfig lo 127.0.0.1 up
ifconfig eth0 10.0.2.15 netmask 255.255.255.0 up 2>/dev/null
route add default gw 10.0.2.2 2>/dev/null

# Setup TCEDIR so tce-load can operate properly from RAM
mkdir -p /tmp/tce/optional
mkdir -p /etc/sysconfig
ln -sf /tmp/tce /etc/sysconfig/tcedir

# Copy and load bundled extensions
for pkg in Xorg-7.7.tcz openbox.tcz dillo.tcz; do
    if [ -f /opt/tcz/$pkg ]; then
        cp /opt/tcz/$pkg /tmp/tce/optional/
        tce-load -i /tmp/tce/optional/$pkg
    fi
done

# Start BusyBox web server (serving public files & CGI scripts) on ports 8080 and 80
mkdir -p /opt/endroid/public/cgi-bin
/bin/busybox-full httpd -p 8080 -h /opt/endroid/public
/bin/busybox-full httpd -p 80 -h /opt/endroid/public

# Prepare xinitrc for user tc
mkdir -p /home/tc
cat > /home/tc/.xinitrc <<'XIEOF'
#!/bin/sh
openbox-session &
sleep 2
dillo http://127.0.0.1:8080/ &
XIEOF
chmod +x /home/tc/.xinitrc
chown tc:staff /home/tc/.xinitrc

# Launch graphical desktop
su tc -c 'startx' &
"""
add_text('opt/bootsync.sh', bootsync_sh, 0o100755)

bootlocal_sh = """#!/bin/sh
# Endroid OS bootlocal - runs in background after bootsync
ifconfig lo 127.0.0.1 up
ifconfig eth0 10.0.2.15 netmask 255.255.255.0 up 2>/dev/null
route add default gw 10.0.2.2 2>/dev/null
mkdir -p /opt/endroid/public/cgi-bin
/bin/busybox-full httpd -p 8080 -h /opt/endroid/public
/bin/busybox-full httpd -p 80 -h /opt/endroid/public
"""
add_text('opt/bootlocal.sh', bootlocal_sh, 0o100755)

# ---------------------------------------------------------------
# Add httpd.conf configuration for CGI script support
# ---------------------------------------------------------------
httpd_conf = """/cgi-bin: /bin/sh
A:*
"""
add_text('etc/httpd.conf', httpd_conf, 0o100644)

# ---------------------------------------------------------------
# Add CGI scripts (simple JSON endpoints inside public/cgi-bin)
# ---------------------------------------------------------------
apps_cgi = """#!/bin/sh
echo "Content-Type: application/json"
echo
cat <<'JSON'
[
  {"name": "Terminal", "icon": "terminal.svg"},
  {"name": "Editor",   "icon": "editor.svg"}
]
JSON
"""
add_text('opt/endroid/public/cgi-bin/apps.sh', apps_cgi, 0o100755)

launch_cgi = """#!/bin/sh
# Placeholder launch endpoint – just returns OK
echo "Content-Type: application/json"
echo
echo '{"status":"ok"}'
"""
add_text('opt/endroid/public/cgi-bin/launch.sh', launch_cgi, 0o100755)

# ---------------------------------------------------------------
# Add MOTD (simple)
# ---------------------------------------------------------------
motd = """\nWelcome to Endroid OS (TinyCore based)\nKernel: $(uname -r)\nWeb Desktop available at http://127.0.0.1/\n"""
add_text('etc/motd', motd, 0o100644)

# ---------------------------------------------------------------
# Bundle UI assets (public folder)
# ---------------------------------------------------------------
pub_root = os.path.join(PROJECT_ROOT, 'public')
bundled = 0
for dirpath, dirnames, filenames in os.walk(pub_root):
    rel = os.path.relpath(dirpath, PROJECT_ROOT).replace('\\', '/')
    target_dir = 'opt/endroid/' + rel
    if target_dir not in base_names:
        add_dir(target_dir)
    for fname in filenames:
        full = os.path.join(dirpath, fname)
        rel_file = os.path.relpath(full, PROJECT_ROOT).replace('\\', '/')
        target = 'opt/endroid/' + rel_file
        try:
            with open(full, 'rb') as fh:
                add_file(target, fh.read(), 0o100644)
            bundled += 1
        except Exception as e:
            print(f"  [SKIP] {rel_file}: {e}")
print(f"  Web assets bundled: {bundled} files")

# ---------------------------------------------------------------
# Download required TinyCore extensions (.tcz) & bundle into initrd
# ---------------------------------------------------------------
print("[Downloading TinyCore extensions]")
pkg_base = "http://tinycorelinux.net/12.x/x86_64/tcz/"
required_pkgs = ["Xorg-7.7.tcz", "openbox.tcz", "dillo.tcz"]
add_dir('opt/tcz')
for pkg in required_pkgs:
    dest = os.path.join(STAGING_DIR, 'boot', 'tce', pkg)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest):
        try:
            urllib.request.urlretrieve(pkg_base + pkg, dest)
            print(f"  Downloaded {pkg}")
        except Exception as e:
            print(f"  Failed to download {pkg}: {e}")
    if os.path.exists(dest):
        with open(dest, 'rb') as f:
            add_file(f'opt/tcz/{pkg}', f.read(), 0o100644)
        print(f"  Bundled {pkg} into initrd /opt/tcz/")

# ---------------------------------------------------------------
# CPIO trailer and compress
# ---------------------------------------------------------------
new_cpio.write(make_cpio_entry('TRAILER!!!', b''))
print("[3/5] Compressing merged initrd.gz...")
initrd_path = os.path.join(STAGING_DIR, 'isolinux', 'initrd.gz')
with gzip.open(initrd_path, 'wb', compresslevel=6) as gz:
    gz.write(new_cpio.getvalue())
print(f"  initrd.gz size: {os.path.getsize(initrd_path)/1024/1024:.2f} MB")

# ---------------------------------------------------------------
# STEP 4: Stage kernel + ISOLINUX
# ---------------------------------------------------------------
print("[4/5] Staging kernel + ISOLINUX 6.03...")
shutil.copy2(os.path.join(KERNEL_ASSETS, 'vmlinuz64'), os.path.join(STAGING_DIR, 'isolinux', 'vmlinuz'))
shutil.copy2(os.path.join(ISOLINUX_BINS, 'isolinux.bin'), os.path.join(STAGING_DIR, 'isolinux', 'isolinux.bin'))
shutil.copy2(os.path.join(ISOLINUX_BINS, 'ldlinux.c32'), os.path.join(STAGING_DIR, 'isolinux', 'ldlinux.c32'))
# ISOLINUX config (lowercase filenames)
cfg = """\
DEFAULT endroid
PROMPT 0
TIMEOUT 30

LABEL endroid
  LINUX vmlinuz
  INITRD initrd.gz
  APPEND loglevel=3 quiet
"""
cfg_path = os.path.join(STAGING_DIR, 'isolinux', 'isolinux.cfg')
with open(cfg_path, 'w', newline='\n') as f:
    f.write(cfg)
print(f"  vmlinuz size: {os.path.getsize(os.path.join(STAGING_DIR,'isolinux','vmlinuz'))/1024/1024:.2f} MB")

# ---------------------------------------------------------------
# STEP 5: Assemble ISO9660 (El Torito)
# ---------------------------------------------------------------
print("[5/5] Assembling bootable ISO9660...")
import pycdlib
iso = pycdlib.PyCdlib()
iso.new(interchange_level=1, joliet=3, rock_ridge='1.09', vol_ident='ENDROID_OS')

def add_iso_dir(iso_path, rr_name, joliet_path):
    iso.add_directory(iso_path, rr_name=rr_name, joliet_path=joliet_path)

def add_iso_file(src, iso_path, rr_name, joliet_path):
    iso.add_file(src, iso_path, rr_name=rr_name, joliet_path=joliet_path)

add_iso_dir('/ISOLINUX', 'isolinux', '/isolinux')
# Add isolinux components before El Torito
add_iso_file(os.path.join(STAGING_DIR, 'isolinux', 'isolinux.bin'), '/ISOLINUX/ISOLINUX.BIN;1', 'isolinux.bin', '/isolinux/isolinux.bin')
iso.add_eltorito(
    '/ISOLINUX/ISOLINUX.BIN;1',
    bootcatfile='/ISOLINUX/BOOT.CAT;1',
    rr_bootcatname='boot.cat',
    joliet_bootcatfile='/isolinux/boot.cat',
    boot_load_size=4,
    media_name='noemul',
    boot_info_table=True
)
add_iso_file(os.path.join(STAGING_DIR, 'isolinux', 'ldlinux.c32'), '/ISOLINUX/LDLINUX.C32;1', 'ldlinux.c32', '/isolinux/ldlinux.c32')
add_iso_file(os.path.join(STAGING_DIR, 'isolinux', 'vmlinuz'), '/ISOLINUX/VMLINUZ;1', 'vmlinuz', '/isolinux/vmlinuz')
add_iso_file(os.path.join(STAGING_DIR, 'isolinux', 'initrd.gz'), '/ISOLINUX/INITRD.GZ;1', 'initrd.gz', '/isolinux/initrd.gz')
add_iso_file(cfg_path, '/ISOLINUX/ISOLINUX.CFG;1', 'isolinux.cfg', '/isolinux/isolinux.cfg')

iso.write(ISO_OUT)
iso.close()

size_mb = os.path.getsize(ISO_OUT) / 1024 / 1024
print("=" * 60)
print(f"[OK] ISO built: {ISO_OUT}")
print(f"Size: {size_mb:.2f} MB")
print("=" * 60)
print("Boot with: powershell -File .\\launch-vm.ps1")
print("=" * 60)
