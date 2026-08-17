document.addEventListener('DOMContentLoaded', async () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const packageCard = document.getElementById('package-card');
  const installedListEl = document.getElementById('installed-list');
  const storeGridEl = document.getElementById('store-grid');

  const pkgNameEl = document.getElementById('pkg-name');
  const pkgVersionEl = document.getElementById('pkg-version');
  const pkgAuthorEl = document.getElementById('pkg-author');
  const pkgCatEl = document.getElementById('pkg-cat');
  const pkgDescEl = document.getElementById('pkg-desc');
  const pkgIconEl = document.getElementById('pkg-icon');
  const pkgPermsEl = document.getElementById('pkg-perms');
  const btnDoInstall = document.getElementById('btn-do-install');
  const btnCancelInstall = document.getElementById('btn-cancel-install');

  let currentPackageFile = null;
  let currentVfsPath = null;

  // Check URL query param ?package=
  const urlParams = new URLSearchParams(window.location.search);
  const pkgParam = urlParams.get('package');
  if (pkgParam) {
    handleVfsPackage(pkgParam);
  }

  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      document.getElementById('pane-' + tabName)?.classList.add('active');

      if (tabName === 'installed') loadInstalledApps();
      if (tabName === 'store') loadStoreApps();
    });
  });

  // Dropzone Events
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUploadedFile(e.target.files[0]);
    }
  });

  function handleUploadedFile(file) {
    if (!file.name.endsWith('.epk') && !file.name.endsWith('.zip')) {
      alert('Please upload a valid .epk package archive');
      return;
    }
    currentPackageFile = file;
    currentVfsPath = null;
    displayPackageInfo({
      name: file.name.replace(/\.epk$/, '').replace(/\.zip$/, ''),
      version: '1.0.0',
      author: 'Endroid Developer',
      description: 'Endroid application package',
      categories: ['Utility'],
      permissions: ['filesystem.read', 'filesystem.write', 'network']
    });
  }

  function handleVfsPackage(vfsPath) {
    currentVfsPath = vfsPath;
    currentPackageFile = null;
    const name = vfsPath.split('/').pop().replace(/\.epk$/, '');
    displayPackageInfo({
      name: name,
      version: '1.0.0',
      author: 'Endroid Bundle',
      description: 'Local package ready for installation',
      categories: ['Productivity'],
      permissions: ['filesystem.read', 'network']
    });
  }

  function displayPackageInfo(meta) {
    pkgNameEl.innerText = meta.name;
    pkgVersionEl.innerText = meta.version || 'v1.0.0';
    pkgAuthorEl.innerText = meta.author || 'Developer';
    pkgCatEl.innerText = (meta.categories && meta.categories[0]) || 'Utility';
    pkgDescEl.innerText = meta.description || 'No description provided';
    pkgPermsEl.innerText = (meta.permissions || ['standard']).join(', ');

    pkgIconEl.innerHTML = EndroidIcons.getHtml('package', { size: 36 });
    EndroidIcons.render(pkgIconEl);

    dropZone.style.display = 'none';
    packageCard.style.display = 'flex';
  }

  btnCancelInstall.addEventListener('click', () => {
    currentPackageFile = null;
    currentVfsPath = null;
    packageCard.style.display = 'none';
    dropZone.style.display = 'flex';
  });

  btnDoInstall.addEventListener('click', async () => {
    try {
      btnDoInstall.innerHTML = `<span style="opacity:0.8;">Installing...</span>`;
      btnDoInstall.disabled = true;

      let res;
      if (currentPackageFile) {
        res = await EndroidAPI.apps.installUpload(currentPackageFile);
      } else if (currentVfsPath) {
        res = await EndroidAPI.apps.installFromVfs(currentVfsPath);
      }

      if (res && res.success) {
        alert(`Successfully installed "${res.app.name}"!`);
        btnDoInstall.innerHTML = `<i data-lucide="check"></i> Installed`;
        EndroidIcons.render(btnDoInstall);

        // Notify parent desktop to reload app launcher
        if (window.parent && window.parent.Endroid) {
          window.parent.Endroid.taskbar.loadLauncherApps();
          window.parent.Endroid.taskbar.showToast('App Installed', `${res.app.name} is now available in your launcher.`, 'check-circle');
        }

        setTimeout(() => {
          packageCard.style.display = 'none';
          dropZone.style.display = 'flex';
          btnDoInstall.disabled = false;
          btnDoInstall.innerHTML = `<i data-lucide="download"></i> Install Application`;
          EndroidIcons.render(btnDoInstall);
        }, 1200);
      }
    } catch (err) {
      alert('Installation failed: ' + err.message);
      btnDoInstall.disabled = false;
      btnDoInstall.innerHTML = `<i data-lucide="download"></i> Install Application`;
      EndroidIcons.render(btnDoInstall);
    }
  });

  async function loadInstalledApps() {
    try {
      const data = await EndroidAPI.apps.list();
      installedListEl.innerHTML = '';

      const installed = data.installedApps || [];
      if (installed.length === 0) {
        installedListEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No third-party .epk applications installed yet. Explore the App Store!</div>`;
        return;
      }

      installed.forEach(app => {
        const card = document.createElement('div');
        card.className = 'installed-card';
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; background:var(--bg-surface); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; color:var(--accent);">
              ${app.iconSvg ? app.iconSvg : EndroidIcons.getHtml('package', { size: 24 })}
            </div>
            <div>
              <div style="font-weight:600; font-size:14px;">${app.name} <span style="font-size:11px; color:var(--text-muted);">v${app.version}</span></div>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${app.description || 'Installed application'}</div>
            </div>
          </div>
          <button class="btn-secondary btn-uninstall" data-id="${app.id}" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.3);">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Uninstall
          </button>
        `;

        card.querySelector('.btn-uninstall').addEventListener('click', async () => {
          if (confirm(`Uninstall ${app.name}?`)) {
            await EndroidAPI.apps.uninstall(app.id);
            loadInstalledApps();
            if (window.parent && window.parent.Endroid) {
              window.parent.Endroid.taskbar.loadLauncherApps();
            }
          }
        });

        installedListEl.appendChild(card);
      });

      EndroidIcons.render(installedListEl);
    } catch (err) {
      installedListEl.innerHTML = `<div>Error loading apps: ${err.message}</div>`;
    }
  }

  function loadStoreApps() {
    const storeApps = [
      {
        id: 'retro-snake',
        name: 'Retro Snake Arcade',
        version: '1.0.0',
        author: 'Endroid Games',
        desc: 'Classic arcade snake game with responsive controls and high scores.',
        icon: 'gamepad-2',
        packageVfs: '/sample-packages/snake-game.epk'
      },
      {
        id: 'markdown-pad',
        name: 'MarkdownPad Pro',
        version: '1.2.0',
        author: 'Endroid Studio',
        desc: 'Advanced markdown document authoring with instant HTML exporter.',
        icon: 'file-edit',
        packageVfs: '/sample-packages/markdown-pad.epk'
      },
      {
        id: 'sys-monitor',
        name: 'System Monitor',
        version: '1.0.0',
        author: 'Endroid Core',
        desc: 'Live hardware performance graphs and memory telemetry.',
        icon: 'activity',
        packageVfs: '/sample-packages/sys-monitor.epk'
      }
    ];

    storeGridEl.innerHTML = '';
    storeApps.forEach(app => {
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:48px; height:48px; background:var(--bg-surface); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; color:var(--accent);">
            ${EndroidIcons.getHtml(app.icon, { size: 28 })}
          </div>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:14.5px;">${app.name}</div>
            <div style="font-size:11px; color:var(--text-muted);">${app.author} • v${app.version}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px; line-height:1.4;">${app.desc}</div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
          <button class="btn-primary btn-install-store" data-vfs="${app.packageVfs}">
            <i data-lucide="download"></i> 1-Click Install
          </button>
        </div>
      `;

      card.querySelector('.btn-install-store').addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="install"]').click();
        handleVfsPackage(app.packageVfs);
      });

      storeGridEl.appendChild(card);
    });

    EndroidIcons.render(storeGridEl);
  }

  EndroidIcons.render();
});
