document.addEventListener('DOMContentLoaded', async () => {
  const chkNightMode = document.getElementById('chk-nightmode');
  const chkReduceMotion = document.getElementById('chk-reducemotion');
  const soundVolumeSlider = document.getElementById('sound-volume-slider');
  const appListContainer = document.getElementById('settings-app-list');

  const specKernel = document.getElementById('spec-kernel');
  const specArch = document.getElementById('spec-arch');
  const specMem = document.getElementById('spec-mem');
  const specStorage = document.getElementById('spec-storage');
  const specUptime = document.getElementById('spec-uptime');

  let currentSettings = {};

  // Tab switching
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      document.getElementById('pane-' + tabName)?.classList.add('active');

      if (tabName === 'apps') loadAppsList();
      if (tabName === 'system') loadSystemSpecs();
    });
  });

  // Load Settings
  async function loadSettings() {
    try {
      currentSettings = await EndroidAPI.settings.get();

      // Theme Mode
      const themeMode = currentSettings.theme?.mode || 'dark';
      document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === themeMode);
      });

      // Wallpaper
      const currentWp = currentSettings.display?.wallpaper || 'aurora';
      document.querySelectorAll('.wallpaper-card').forEach(card => {
        card.classList.toggle('active', card.dataset.wp === currentWp);
      });

      // Toggles
      chkNightMode.checked = !!currentSettings.display?.nightMode;
      chkReduceMotion.checked = !!currentSettings.theme?.reduceMotion;
      soundVolumeSlider.value = currentSettings.sound?.volume || 80;

      // Accent color
      const currentAccent = currentSettings.theme?.accentColor || '#0ea5e9';
      document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === currentAccent);
      });
    } catch (err) {
      console.warn('Could not fetch settings:', err);
    }
  }

  // Wallpaper change
  document.querySelectorAll('.wallpaper-card').forEach(card => {
    card.addEventListener('click', async () => {
      const wp = card.dataset.wp;
      document.querySelectorAll('.wallpaper-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      await EndroidAPI.settings.update({ display: { wallpaper: wp } });

      // Live update parent desktop if embedded
      if (window.parent && window.parent.Endroid) {
        window.parent.Endroid.desktop.setWallpaperClass(wp);
        window.parent.Endroid.taskbar.showToast('Wallpaper Updated', `Set wallpaper to ${card.querySelector('span').innerText}`, 'image');
      }
    });
  });

  // Theme mode change
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const mode = card.dataset.mode;
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      await EndroidAPI.settings.update({ theme: { mode } });
      document.documentElement.setAttribute('data-theme', mode);

      if (window.parent && window.parent.document) {
        window.parent.document.documentElement.setAttribute('data-theme', mode);
      }
    });
  });

  // Accent color change
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', async () => {
      const color = dot.dataset.color;
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');

      await EndroidAPI.settings.update({ theme: { accentColor: color } });
      document.documentElement.style.setProperty('--accent', color);

      if (window.parent && window.parent.document) {
        window.parent.document.documentElement.style.setProperty('--accent', color);
      }
    });
  });

  // Night light mode
  chkNightMode.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await EndroidAPI.settings.update({ display: { nightMode: enabled } });

    if (window.parent && window.parent.document) {
      const overlay = window.parent.document.getElementById('night-light-overlay');
      overlay?.classList.toggle('active', enabled);
    }
  });

  // Reduce motion
  chkReduceMotion.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await EndroidAPI.settings.update({ theme: { reduceMotion: enabled } });
    document.documentElement.setAttribute('data-reduce-motion', enabled ? 'true' : 'false');

    if (window.parent && window.parent.document) {
      window.parent.document.documentElement.setAttribute('data-reduce-motion', enabled ? 'true' : 'false');
    }
  });

  // Load Apps List in Settings
  async function loadAppsList() {
    try {
      const data = await EndroidAPI.apps.list();
      appListContainer.innerHTML = '';

      const all = [...(data.systemApps || []), ...(data.installedApps || [])];
      all.forEach(app => {
        const row = document.createElement('div');
        row.className = 'spec-item';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="color:var(--accent);">${EndroidIcons.getHtml(app.icon || 'package', { size: 18 })}</div>
            <div>
              <div style="font-weight:600;">${app.name}</div>
              <div style="font-size:11px; color:var(--text-muted);">${app.isBuiltin ? 'System Preinstalled' : 'User Installed .epk'}</div>
            </div>
          </div>
          <div>
            ${app.isBuiltin ? '<span style="color:var(--text-muted); font-size:11px;">Protected</span>' : `<button class="btn-secondary btn-uninstall-s" data-id="${app.id}" style="padding:4px 8px; font-size:11px; color:var(--danger);">Uninstall</button>`}
          </div>
        `;

        const uninstallBtn = row.querySelector('.btn-uninstall-s');
        if (uninstallBtn) {
          uninstallBtn.addEventListener('click', async () => {
            if (confirm(`Uninstall ${app.name}?`)) {
              await EndroidAPI.apps.uninstall(app.id);
              loadAppsList();
              if (window.parent && window.parent.Endroid) {
                window.parent.Endroid.taskbar.loadLauncherApps();
              }
            }
          });
        }

        appListContainer.appendChild(row);
      });

      EndroidIcons.render(appListContainer);
    } catch (_) {}
  }

  // Load System Specs
  async function loadSystemSpecs() {
    try {
      const info = await EndroidAPI.system.info();
      if (specKernel) specKernel.innerText = info.kernel;
      if (specArch) specArch.innerText = `${info.arch} / Linux Standard`;
      if (specMem) specMem.innerText = `${info.storage.usedMB} MB / ${info.storage.totalMB} MB (${info.storage.percentUsed}%)`;
      if (specStorage) specStorage.innerText = `142 MB / 500 MB (358 MB Free)`;
      if (specUptime) specUptime.innerText = `${info.uptime} seconds`;
    } catch (_) {}
  }

  await loadSettings();
  EndroidIcons.render();
});
