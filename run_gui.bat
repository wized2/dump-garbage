@echo off
title Endroid OS - Bare Metal VM Launcher
echo ===================================================
echo   Endroid OS - Standalone GUI VM Launcher
echo ===================================================
echo Starting QEMU Virtual Machine with Graphical Display...

set QEMU="C:\Program Files\qemu\qemu-system-x86_64.exe"
set ISO="C:\Users\Bullettemporary\.gemini\antigravity\scratch\dump-garbage\endroid-os-x86_64.iso"

if not exist %ISO% (
    echo Building ISO first...
    cd /d "C:\Users\Bullettemporary\.gemini\antigravity\scratch\dump-garbage\iso-builder"
    python build_real_iso.py
)

cd /d "C:\Users\Bullettemporary\.gemini\antigravity\scratch\dump-garbage"
echo Launching Endroid OS...
start "" %QEMU% -m 2048 -smp 2 -cdrom %ISO% -vga std -boot d -net nic,model=virtio -net user,hostfwd=tcp::8080-:8080

echo.
echo ===================================================
echo [SUCCESS] Endroid OS VM is running in a live GUI window!
echo Web Desktop is also accessible at: http://localhost:8080
echo ===================================================
timeout /t 5
