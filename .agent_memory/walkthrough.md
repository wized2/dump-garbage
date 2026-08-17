# Endroid OS – Virtual Machine & Live Boot Walkthrough

**Endroid OS** is now running live in **Oracle VirtualBox** as a real 64-bit Linux Operating System.

---

## 🟢 Virtual Machine Live Status

* **VM Name**: `EndroidOS`
* **Status**: **RUNNING (Active GUI Window)**
* **UUID**: `a55e9a87-42c8-4bfb-a07d-4a790286bbe4`
* **OS Type**: `Linux 64-bit`
* **Memory**: `1024 MB RAM`
* **CPUs**: `2 Virtual Cores`
* **Graphics Controller**: `VMSVGA` (64 MB VRAM)
* **Boot Medium**: [`endroid-os-x86_64.iso`](file:///C:/Users/Bullettemporary/.gemini/antigravity/scratch/endroid-os/endroid-os-x86_64.iso) (19.77 MB)

---

## 🛠️ What Was Done

1. **Installed Oracle VirtualBox**:
   - Installed Oracle VirtualBox `7.2.14` on Windows.
2. **Created & Configured the VM**:
   - Created `EndroidOS` VM via `VBoxManage`.
   - Configured hardware virtualization, 1024MB RAM, VMSVGA display, NAT networking, and IDE storage controller.
3. **Attached Bootable Linux ISO**:
   - Mounted `endroid-os-x86_64.iso` containing the real 64-bit Linux kernel (`vmlinuz64`), ISOLINUX bootloader, BusyBox initramfs, and Endroid web runtime overlay.
4. **Booted into Graphical GUI Window**:
   - Launched `EndroidOS` in graphical GUI mode on your desktop.

---

## 🔄 How to Control the VM

### Rerun or Reboot the VM anytime:
```powershell
powershell -ExecutionPolicy Bypass -File .\launch-vm.ps1
```

### Stop or Power Off the VM:
```bash
"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" controlvm "EndroidOS" poweroff
```
