/**
 * Endroid OS - Desktop Environment Controller
 * Manages desktop surface, icon grid, context menu, rubberband selection, and wallpaper.
 */
(function(window) {
  'use strict';

  class Desktop {
    constructor(wm, taskbar) {
      this.wm = wm;
      this.taskbar = taskbar;
      this.desktopRoot = document.getElementById('desktop-root');
      this.wallpaper = document.getElementById('desktop-wallpaper');
      this.iconGrid = document.getElementById('desktop-icons');
      this.contextMenu = document.getElementById('context-menu');
      this.rubberband = document.getElementById('rubberband');
      this.nightLight = document.getElementById('night-light-overlay');

      this.selectedIcons = new Set();

      this.init();
    }

    async init() {
      await this.loadSettings();
      await this.loadDesktopIcons();
      this.initContextMenu();
      this.initRubberband();

      // Listen for file changes or refresh events
      window.addEventListener('endroid-refresh-desktop', () => this.loadDesktopIcons());
    }

    async loadSettings() {
      try {
        const data = await EndroidAPI.settings.get();
        if (data.theme?.mode) {
          document.documentElement.setAttribute('data-theme', data.theme.mode);
        }
        if (data.display?.wallpaper) {
          this.setWallpaperClass(data.display.wallpaper);
        }
        if (data.display?.nightMode) {
          this.nightLight?.classList.toggle('active', data.display.nightMode);
        }
      } catch (err) {
        console.warn('Could not load desktop settings:', err);
      }
    }

    setWallpaperClass(name) {
      if (!this.wallpaper) return;
      this.wallpaper.className = '';
      this.wallpaper.classList.add(`wallpaper-${name}`);
    }

    async loadDesktopIcons() {
      if (!this.iconGrid) return;
      this.iconGrid.innerHTML = '';

      // Default system shortcuts
      const shortcuts = [
        { name: 'File Manager', icon: 'folder', action: () => this.wm.createWindow({ id: 'files', title: 'File Manager', icon: 'folder', url: 'apps/files/index.html', width: 880, height: 580 }) },
        { name: 'Terminal', icon: 'terminal', action: () => this.wm.createWindow({ id: 'terminal', title: 'Terminal', icon: 'terminal', url: 'apps/terminal/index.html', width: 780, height: 480 }) },
        { name: 'Web Browser', icon: 'globe', action: () => this.wm.createWindow({ id: 'browser', title: 'Web Browser', icon: 'globe', url: 'apps/browser/index.html', width: 960, height: 640 }) },
        { name: 'App Installer', icon: 'package', action: () => this.wm.createWindow({ id: 'installer', title: 'App Installer', icon: 'package', url: 'apps/installer/index.html', width: 760, height: 520 }) },
        { name: 'Settings', icon: 'settings', action: () => this.wm.createWindow({ id: 'settings', title: 'Settings', icon: 'settings', url: 'apps/settings/index.html', width: 860, height: 600 }) }
      ];

      // Read real files in /home/user/Desktop
      let desktopFiles = [];
      try {
        const res = await EndroidAPI.fs.list('/home/user/Desktop');
        desktopFiles = res.entries || [];
      } catch (_) {}

      // Render Shortcuts
      shortcuts.forEach(sc => {
        const item = this.createIconElement(sc.name, sc.icon, sc.action);
        this.iconGrid.appendChild(item);
      });

      // Render Desktop Files
      desktopFiles.forEach(file => {
        let iconName = 'file';
        if (file.isDirectory) iconName = 'folder';
        else if (file.ext === '.md' || file.ext === '.txt') iconName = 'file-text';
        else if (file.ext === '.json') iconName = 'file-code';
        else if (file.ext === '.epk' || file.ext === '.zip') iconName = 'package';
        else if (['.png', '.jpg', '.jpeg', '.svg'].includes(file.ext)) iconName = 'image';

        const action = () => {
          if (file.isDirectory) {
            this.wm.createWindow({ id: 'files', title: 'File Manager', icon: 'folder', url: `apps/files/index.html?path=${encodeURIComponent(file.path)}`, width: 880, height: 580 });
          } else if (file.ext === '.epk') {
            this.wm.createWindow({ id: 'installer', title: 'App Installer', icon: 'package', url: `apps/installer/index.html?package=${encodeURIComponent(file.path)}`, width: 760, height: 520 });
          } else if (file.ext === '.md' || file.ext === '.txt') {
            this.wm.createWindow({ id: 'notes', title: 'Notes - ' + file.name, icon: 'file-text', url: `apps/notes/index.html?file=${encodeURIComponent(file.path)}`, width: 820, height: 540 });
          } else {
            this.taskbar.showToast('File', `Opened ${file.name}`, 'file');
          }
        };

        const item = this.createIconElement(file.name, iconName, action, file.path);
        this.iconGrid.appendChild(item);
      });

      EndroidIcons.render(this.iconGrid);
    }

    createIconElement(label, iconName, onDoubleClick, path = null) {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      el.dataset.path = path || '';
      el.innerHTML = `
        <div class="icon-img">${EndroidIcons.getHtml(iconName, { size: 36 })}</div>
        <div class="icon-label" title="${label}">${label}</div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!e.ctrlKey) this.clearSelection();
        el.classList.add('selected');
        this.selectedIcons.add(el);
      });

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        onDoubleClick();
      });

      return el;
    }

    clearSelection() {
      this.selectedIcons.forEach(el => el.classList.remove('selected'));
      this.selectedIcons.clear();
    }

    initContextMenu() {
      if (!this.contextMenu) return;

      this.desktopRoot.addEventListener('contextmenu', (e) => {
        // Only trigger on desktop wallpaper or icons
        if (e.target.closest('.window') || e.target.closest('#taskbar') || e.target.closest('#start-menu')) {
          return;
        }

        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 200);
        const y = Math.min(e.clientY, window.innerHeight - 250);

        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.style.display = 'flex';
        EndroidIcons.render(this.contextMenu);
      });

      // Context Menu Actions
      const handleAction = async (action) => {
        this.contextMenu.style.display = 'none';
        switch (action) {
          case 'new-folder': {
            const name = prompt('Folder name:', 'New Folder');
            if (name) {
              await EndroidAPI.fs.mkdir(`/home/user/Desktop/${name}`);
              this.loadDesktopIcons();
              this.taskbar.showToast('File System', `Created folder "${name}"`, 'folder-plus');
            }
            break;
          }
          case 'new-file': {
            const name = prompt('File name:', 'New Document.md');
            if (name) {
              await EndroidAPI.fs.write(`/home/user/Desktop/${name}`, '# New Document\n\nStart writing here...');
              this.loadDesktopIcons();
              this.taskbar.showToast('File System', `Created file "${name}"`, 'file-plus');
            }
            break;
          }
          case 'terminal':
            this.wm.createWindow({ id: 'terminal', title: 'Terminal', icon: 'terminal', url: 'apps/terminal/index.html', width: 780, height: 480 });
            break;
          case 'settings':
            this.wm.createWindow({ id: 'settings', title: 'Settings', icon: 'settings', url: 'apps/settings/index.html', width: 860, height: 600 });
            break;
          case 'refresh':
            this.loadDesktopIcons();
            this.taskbar.showToast('Desktop', 'Refreshed desktop', 'refresh-cw');
            break;
        }
      };

      this.contextMenu.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => handleAction(item.dataset.action));
      });
    }

    initRubberband() {
      if (!this.rubberband) return;

      let isSelecting = false;
      let startX = 0, startY = 0;

      this.desktopRoot.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window') || e.target.closest('#taskbar') || e.target.closest('.desktop-icon') || e.target.closest('#start-menu') || e.button !== 0) {
          return;
        }

        this.clearSelection();
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;

        this.rubberband.style.left = startX + 'px';
        this.rubberband.style.top = startY + 'px';
        this.rubberband.style.width = '0px';
        this.rubberband.style.height = '0px';
        this.rubberband.style.display = 'block';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;

        const curX = e.clientX;
        const curY = e.clientY;

        const left = Math.min(startX, curX);
        const top = Math.min(startY, curY);
        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);

        this.rubberband.style.left = left + 'px';
        this.rubberband.style.top = top + 'px';
        this.rubberband.style.width = width + 'px';
        this.rubberband.style.height = height + 'px';

        // Select intersecting icons
        const rRect = this.rubberband.getBoundingClientRect();
        this.iconGrid.querySelectorAll('.desktop-icon').forEach(icon => {
          const iRect = icon.getBoundingClientRect();
          const intersects = !(rRect.right < iRect.left || 
                               rRect.left > iRect.right || 
                               rRect.bottom < iRect.top || 
                               rRect.top > iRect.bottom);
          icon.classList.toggle('selected', intersects);
          if (intersects) this.selectedIcons.add(icon);
          else this.selectedIcons.delete(icon);
        });
      });

      document.addEventListener('mouseup', () => {
        if (!isSelecting) return;
        isSelecting = false;
        this.rubberband.style.display = 'none';
      });
    }
  }

  window.EndroidDesktop = Desktop;
})(window);
