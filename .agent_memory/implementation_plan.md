# Implementation Plan

## Goal
Deliver a **fully self‑contained operating system** that boots on bare‑metal (ISO/USB), runs **offline**, and provides the Endroid web‑desktop UI **via a local web browser**. No host OS dependencies – the OS includes everything needed to start the UI automatically after boot.

## Chosen Base
- **TinyCore Linux** – very small (≈ 16 MB) and already used in the project. We will extend it with the minimal X stack and a lightweight browser.

## Core Architecture
1. **Boot Process**
   - TinyCore boots, runs `/opt/bootsync.sh`.
   - `bootsync.sh` starts **BusyBox httpd** to serve the Endroid UI (static files + CGI API).
   - `bootsync.sh` then launches **Xorg**, a lightweight window manager (**Openbox**), and a minimal graphical browser (**Dillo**). The browser opens `http://127.0.0.1/` automatically.
2. **Overlay (CPIO)**
   - The CPIO overlay now contains:
     - `/opt/endroid/` – UI assets, CGI scripts, Lucide icons.
     - `/opt/endroid/scripts/` – startup scripts (`bootsync.sh`, `start_httpd.sh`, `start_x.sh`).
     - Package lists for TinyCore to load required `.tcz` modules (Xorg, Openbox, Dillo, BusyBox‑httpd, etc.).
3. **API Layer**
   - Keep the **BusyBox CGI** implementation from the previous plan (shell scripts that return JSON). This avoids needing Node.js.
4. **Auto‑Start**
   - `bootsync.sh` will:
     ```sh
     #!/bin/sh
     # Load required TinyCore extensions (X, Openbox, Dillo, BusyBox httpd)
     for pkg in xorg.tcz openbox.tcz dillo.tcz busybox-httpd.tcz; do
       tce-load -i $pkg
     done

     # Start httpd serving the UI
     /usr/local/bin/busybox httpd -f -v -p 80 -c /opt/endroid/cgi-bin &

     # Start X with Openbox and launch Dillo pointing to localhost
     startx &   # startx will read ~/.xinitrc
     ```
   - `~/.xinitrc` will contain:
     ```sh
     openbox-session &
     dillo http://127.0.0.1/ &
     ```
5. **Size Management**
   - TinyCore base (≈ 16 MB) + Xorg (~70 MB) + Openbox (~5 MB) + Dillo (~10 MB) + BusyBox httpd & UI assets (~30 MB) = **~130 MB**. This comfortably fits under a **200 MB** ISO.

## Open Questions (need your confirmation)
1. **Acceptable Browser** – Do you agree to use **Dillo** as the default web browser? It is lightweight and fast, but may lack full CSS/JS support. If you need a more capable browser (e.g., Midori or a minimal Chromium), the ISO size will increase.
2. **Automatic Launch** – Should the UI launch immediately after X starts, or would you prefer a login screen (e.g., `tlogin`)?
3. **Persistence** – Any need for persistent storage (e.g., saving user settings) across reboots, or is a purely in‑memory session sufficient?
4. **Additional Packages** – Do you foresee needing any extra utilities (e.g., `git`, `vim`) packaged into the ISO?

## Proposed Changes (file list)
---
### [MODIFY] `iso-builder/build_real_iso.py`
- Update overlay creation to copy additional scripts and package list.
- Ensure the resulting `initrd.gz` contains a **single** CPIO archive with all files.
---
### [NEW] `opt/endroid/cgi-bin/apps.sh`
- Shell CGI returning JSON list of apps.
---
### [NEW] `opt/endroid/cgi-bin/launch.sh`
- Handles simple app launch requests (placeholder implementation).
---
### [NEW] `opt/endroid/scripts/bootsync.sh`
- As described above, loads TinyCore extensions, starts httpd, X, Openbox, Dillo.
---
### [NEW] `opt/endroid/scripts/.xinitrc`
- Starts Openbox and Dillo.
---
### [NEW] `opt/endroid/packages.txt`
- Lists required `.tcz` packages (one per line) for `tce-load`.
---
### [MODIFY] `README.md`
- Document the new boot flow, how the UI is served, and how to rebuild the ISO.
---

## Verification Plan
### Automated
- **ISO inspection** – Use `pycdlib` to confirm that `initrd.gz` contains the new overlay files and that the ISO size ≤ 200 MB.
- **Package presence** – Verify that all listed `.tcz` packages exist in the overlay.
### Manual
- **Boot test** – Launch the ISO in VirtualBox, ensure the system reaches the X desktop and Dillo opens the Endroid UI automatically.
- **API test** – From the host, `curl http://127.0.0.1/apps.sh` should return the expected JSON.
- **UI sanity** – Verify Lucide icons render correctly; interact with the UI (open/close windows) to ensure functionality.

---
**Please confirm the above approach (or adjust the questions) so we can proceed to implement the changes, rebuild the ISO, and deliver a fully self‑contained web‑based OS.**
