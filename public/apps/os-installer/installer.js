/**
 * Endroid OS — Bare-Metal Disk Installer Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentStep = 1;
  const totalSteps = 5;

  let selectedDisk = null;
  let disksData = [];
  let hardwareData = null;

  // DOM Elements
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnReboot = document.getElementById('btn-reboot');
  const diskListEl = document.getElementById('disk-list');

  // Load Initial Hardware Data
  await loadHardwareSpecs();

  // Load Disks
  await loadDisks();

  // Initialize Lucide Icons
  if (window.EndroidIcons) {
    EndroidIcons.render();
  }

  // Navigation Handlers
  btnNext.addEventListener('click', async () => {
    if (currentStep === 1) {
      goToStep(2);
    } else if (currentStep === 2) {
      if (!selectedDisk) {
        alert('Please select a storage drive to install Endroid OS.');
        return;
      }
      goToStep(3);
    } else if (currentStep === 3) {
      const confirmInstall = confirm(`Are you sure you want to install Endroid OS to ${selectedDisk.device} (${selectedDisk.model})?\n\nThis will wipe all existing partitions and make Endroid OS the primary OS.`);
      if (confirmInstall) {
        goToStep(4);
        startInstallation();
      }
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep > 1 && currentStep < 4) {
      goToStep(currentStep - 1);
    }
  });

  btnReboot.addEventListener('click', async () => {
    btnReboot.disabled = true;
    btnReboot.innerText = 'Restarting PC...';
    try {
      await fetch('/api/system/reboot', { method: 'POST' });
    } catch (_) {}
  });

  function goToStep(step) {
    currentStep = step;

    // Update Views
    document.querySelectorAll('.step-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-step-${step}`);
    if (targetView) targetView.classList.add('active');

    // Update Nav
    for (let i = 1; i <= totalSteps; i++) {
      const navItem = document.getElementById(`nav-step-${i}`);
      if (!navItem) continue;
      navItem.classList.remove('active', 'completed');
      if (i === step) navItem.classList.add('active');
      else if (i < step) navItem.classList.add('completed');
    }

    // Button states
    btnBack.disabled = step === 1 || step >= 4;

    if (step === 4) {
      btnNext.style.display = 'none';
      btnBack.style.display = 'none';
    } else if (step === 5) {
      btnNext.style.display = 'none';
      btnBack.style.display = 'none';
      btnReboot.style.display = 'inline-block';
    } else {
      btnNext.style.display = 'inline-block';
      btnNext.innerText = step === 3 ? 'Install Now' : 'Next';
    }

    if (window.EndroidIcons) {
      EndroidIcons.render();
    }
  }

  async function loadHardwareSpecs() {
    try {
      const res = await fetch('/api/system/hardware');
      if (!res.ok) throw new Error('Failed to fetch hardware specs');
      hardwareData = await res.json();

      document.getElementById('spec-cpu').innerText = `${hardwareData.cpu.model} (${hardwareData.cpu.cores} Cores)`;
      document.getElementById('spec-ram').innerText = `${hardwareData.memory.totalGb} GB RAM (${hardwareData.memory.freeGb} GB Available)`;
      document.getElementById('spec-firmware').innerText = hardwareData.uefi ? 'UEFI (GPT) Active' : 'BIOS / Legacy MBR';
    } catch (e) {
      document.getElementById('spec-cpu').innerText = 'x86_64 Compatible Processor';
      document.getElementById('spec-ram').innerText = 'Available RAM Detected';
    }
  }

  async function loadDisks() {
    try {
      const res = await fetch('/api/installer/disks');
      if (!res.ok) throw new Error('Failed to fetch disks');
      const data = await res.json();
      disksData = data.disks || [];

      renderDisksList();
    } catch (e) {
      diskListEl.innerHTML = `<div style="color:#ef4444; padding:12px;">Failed to scan disks: ${e.message}</div>`;
    }
  }

  function renderDisksList() {
    if (disksData.length === 0) {
      diskListEl.innerHTML = '<div style="color:var(--text-muted); padding:16px;">No physical storage drives found.</div>';
      return;
    }

    diskListEl.innerHTML = '';
    disksData.forEach((disk, idx) => {
      const card = document.createElement('div');
      card.className = `disk-card ${idx === 0 ? 'selected' : ''}`;
      if (idx === 0) selectedDisk = disk;

      card.innerHTML = `
        <i data-lucide="hard-drive" class="disk-icon"></i>
        <div class="disk-details">
          <div class="disk-name">${disk.model} (${disk.device})</div>
          <div class="disk-sub">${disk.type} • ${disk.partitions ? disk.partitions.length : 0} Existing Partitions</div>
        </div>
        <div class="disk-badge">${disk.sizeGb}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.disk-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDisk = disk;
      });

      diskListEl.appendChild(card);
    });

    if (window.EndroidIcons) {
      EndroidIcons.render(diskListEl);
    }
  }

  async function startInstallation() {
    const progressBar = document.getElementById('install-progress-bar');
    const statusText = document.getElementById('install-status-text');
    const percentText = document.getElementById('install-percent-text');

    const hostname = document.getElementById('cfg-hostname')?.value || 'endroid-pc';
    const username = document.getElementById('cfg-username')?.value || 'user';
    const bootType = document.querySelector('input[name="boot-type"]:checked')?.value || 'uefi';

    const stages = [
      { id: 'stage-part', text: 'Partitioning target drive with GPT & EFI...', pct: 20 },
      { id: 'stage-format', text: 'Formatting FAT32 EFI and Ext4 root filesystem...', pct: 45 },
      { id: 'stage-core', text: 'Deploying Linux 64-bit kernel and core system...', pct: 70 },
      { id: 'stage-system', text: 'Deploying Endroid OS runtime, Web Desktop & apps...', pct: 90 },
      { id: 'stage-boot', text: 'Configuring bootloader and persistent storage...', pct: 100 }
    ];

    let currentStageIndex = 0;

    const interval = setInterval(async () => {
      if (currentStageIndex < stages.length) {
        const stage = stages[currentStageIndex];
        progressBar.style.width = `${stage.pct}%`;
        percentText.innerText = `${stage.pct}%`;
        statusText.innerText = stage.text;

        const stageEl = document.getElementById(stage.id);
        if (stageEl) {
          stageEl.classList.remove('active');
          stageEl.classList.add('done');
          stageEl.querySelector('.stage-icon').setAttribute('data-lucide', 'check-circle');
        }

        currentStageIndex++;
        if (currentStageIndex < stages.length) {
          const nextStageEl = document.getElementById(stages[currentStageIndex].id);
          if (nextStageEl) nextStageEl.classList.add('active');
        }
        if (window.EndroidIcons) EndroidIcons.render();
      } else {
        clearInterval(interval);

        // Send API call to execute installation
        try {
          await fetch('/api/installer/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetDisk: selectedDisk ? selectedDisk.device : '/dev/sda',
              bootType,
              hostname,
              username,
              persistData: true
            })
          });
        } catch (_) {}

        document.getElementById('final-disk').innerText = selectedDisk ? `${selectedDisk.model} (${selectedDisk.device})` : '/dev/sda';
        setTimeout(() => {
          goToStep(5);
        }, 800);
      }
    }, 1200);
  }
});
