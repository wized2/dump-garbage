$vboxPath = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
if (!(Test-Path $vboxPath)) {
    $cmd = Get-Command VBoxManage -ErrorAction SilentlyContinue
    if ($cmd) { $vboxPath = $cmd.Source } else { Write-Error "VBoxManage not found"; exit 1 }
}

$vmName = "EndroidOS"
$isoPath = "C:\Users\Bullettemporary\.gemini\antigravity\scratch\endroid-os\endroid-os-x86_64.iso"

Write-Host "=================================================="
Write-Host "[*] Setting up Endroid OS in VirtualBox..."
Write-Host "=================================================="

# Force stop and remove any existing VM
$vms = & "$vboxPath" list vms 2>$null
if ($vms -match [regex]::Escape($vmName)) {
    Write-Host "[*] Powering off existing VM..."
    & "$vboxPath" controlvm "$vmName" poweroff 2>$null | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "[*] Removing old VM..."
    & "$vboxPath" unregistervm "$vmName" --delete 2>$null | Out-Null
    Start-Sleep -Seconds 2
}

# Also clean up leftover vbox folder if needed
$vmFolder = "$env:USERPROFILE\VirtualBox VMs\$vmName"
if (Test-Path $vmFolder) {
    Remove-Item -Recurse -Force $vmFolder -ErrorAction SilentlyContinue
}

# Create VM
Write-Host "[+] Creating VM: $vmName..."
& "$vboxPath" createvm --name "$vmName" --ostype "Linux_64" --register

# Modify hardware
Write-Host "[+] Configuring VM hardware: 1024MB RAM, 2 CPUs, VMSVGA..."
& "$vboxPath" modifyvm "$vmName" --memory 1024 --cpus 2 --vram 64 --graphicscontroller vmsvga --boot1 dvd --boot2 disk --boot3 none --boot4 none --audio-driver dsound --nic1 nat --natpf1 "http8080,tcp,,8080,,8080" --natpf1 "http80,tcp,,8000,,80"

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
