# Endroid OS — VirtualBox Automated VM Launcher
$ErrorActionPreference = "Continue"

$vboxPath = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
if (!(Test-Path $vboxPath)) {
    $cmd = Get-Command VBoxManage -ErrorAction SilentlyContinue
    if ($cmd) { $vboxPath = $cmd.Source } else { Write-Error "VBoxManage not found. Please install Oracle VirtualBox."; exit 1 }
}

$vmName = "EndroidOS"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$isoPath = Join-Path $scriptDir "endroid-os-x86_64.iso"

Write-Host "=================================================="
Write-Host "[*] Endroid OS - VirtualBox VM Setup and Boot"
Write-Host "=================================================="

# Verify ISO exists
if (!(Test-Path $isoPath)) {
    Write-Host "[*] ISO not found at $isoPath. Building ISO now..."
    python (Join-Path $scriptDir "iso-builder\build_real_iso.py")
    if (!(Test-Path $isoPath)) {
        Write-Error "Failed to build ISO at $isoPath"
        exit 1
    }
}

Write-Host "[+] Using ISO: $isoPath"

# Force stop and remove any existing VM
$vms = & $vboxPath list vms 2>$null
if ($vms -match [regex]::Escape($vmName)) {
    Write-Host "[*] Powering off existing EndroidOS VM..."
    & $vboxPath controlvm $vmName poweroff 2>$null | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "[*] Removing old VM..."
    & $vboxPath unregistervm $vmName --delete 2>$null | Out-Null
    Start-Sleep -Seconds 1
}

# Clean up leftover VM folder if present
$vmFolder = "$env:USERPROFILE\VirtualBox VMs\$vmName"
if (Test-Path $vmFolder) {
    Remove-Item -Recurse -Force $vmFolder -ErrorAction SilentlyContinue
}

# 1. Create and Register VM
Write-Host "[+] Creating VirtualBox VM: $vmName..."
& $vboxPath createvm --name $vmName --ostype "Linux_64" --register

# 2. Configure Hardware (2048 MB RAM, 2 CPUs, VMSVGA Graphics, Network NAT)
Write-Host "[+] Configuring Hardware: 2048 MB RAM, 2 CPUs, 128 MB VRAM..."
$modArgs = @(
    "modifyvm", $vmName,
    "--memory", "2048",
    "--cpus", "2",
    "--vram", "128",
    "--graphicscontroller", "vmsvga",
    "--boot1", "dvd",
    "--boot2", "disk",
    "--boot3", "none",
    "--boot4", "none",
    "--audio-driver", "dsound",
    "--nic1", "nat",
    "--natpf1", "http8080,tcp,,8080,,8080",
    "--natpf1", "http80,tcp,,8000,,80"
)
& $vboxPath $modArgs

# 3. Attach Optical Drive (IDE) with Endroid OS ISO
Write-Host "[+] Attaching Live Boot ISO ($isoPath)..."
& $vboxPath storagectl $vmName --name "IDE Controller" --add ide
& $vboxPath storageattach $vmName --storagectl "IDE Controller" --port 0 --device 0 --type dvddrive --medium $isoPath

# 4. Attach Virtual SATA Hard Disk (20 GB) for Disk Installation & Persistence Testing
Write-Host "[+] Creating and attaching 20 GB virtual SATA Hard Disk for Bare-Metal Installer..."
$vdiPath = Join-Path $vmFolder "Endroid_Disk.vdi"
& $vboxPath storagectl $vmName --name "SATA Controller" --add sata --controller IntelAhci --portcount 2
& $vboxPath createmedium disk --filename $vdiPath --size 20480 --format VDI
& $vboxPath storageattach $vmName --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium $vdiPath

# 5. Start VM
Write-Host "=================================================="
Write-Host "[+] Launching Endroid OS in VirtualBox GUI..."
Write-Host "=================================================="
& $vboxPath startvm $vmName --type gui

Write-Host "[+] VirtualBox VM is now running!"
Write-Host "[+] Web Desktop is also accessible on host at: http://localhost:8080"
