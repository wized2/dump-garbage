$ErrorActionPreference = "Continue"

$vboxPath = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
if (!(Test-Path $vboxPath)) {
    $cmd = Get-Command VBoxManage -ErrorAction SilentlyContinue
    if ($cmd) {
        $vboxPath = $cmd.Source
    } else {
        Write-Error "VBoxManage.exe not found at $vboxPath"
        exit 1
    }
}

$vmName = "EndroidOS"
$isoPath = "C:\Users\Bullettemporary\.gemini\antigravity\scratch\endroid-os\endroid-os-x86_64.iso"

Write-Host "=================================================="
Write-Host "[*] Setting up Endroid OS in VirtualBox..."
Write-Host "=================================================="

# Check and remove old VM if it exists
$vms = & "$vboxPath" list vms
if ($vms -match $vmName) {
    Write-Host "[*] Stopping existing VM..."
    & "$vboxPath" controlvm "$vmName" poweroff 2>$null
    Start-Sleep -Seconds 1
    Write-Host "[*] Removing old VM definition..."
    & "$vboxPath" unregistervm "$vmName" --delete 2>$null
}

# Create VM
Write-Host "[+] Creating VM: $vmName..."
& "$vboxPath" createvm --name "$vmName" --ostype "Linux_64" --register

# Modify hardware
Write-Host "[+] Configuring VM hardware: 1024MB RAM, 2 CPUs, VMSVGA..."
& "$vboxPath" modifyvm "$vmName" --memory 1024 --cpus 2 --vram 64 --graphicscontroller vmsvga --boot1 dvd --boot2 disk --boot3 none --boot4 none --audio-driver dsound --nic1 nat

# Add IDE controller and attach ISO
Write-Host "[+] Attaching ISO: $isoPath..."
& "$vboxPath" storagectl "$vmName" --name "IDE Controller" --add ide
& "$vboxPath" storageattach "$vmName" --storagectl "IDE Controller" --port 0 --device 0 --type dvddrive --medium "$isoPath"

# Start VM
Write-Host "=================================================="
Write-Host "[+] Launching Endroid OS in VirtualBox..."
Write-Host "=================================================="
& "$vboxPath" startvm "$vmName" --type gui

Write-Host "[+] VirtualBox VM is running!"
