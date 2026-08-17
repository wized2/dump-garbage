/**
 * Endroid OS - Taskbar, App Launcher, System Tray & Toast System
 */
(function(window) {
  'use strict';

  class Taskbar {
    constructor(wm) {
      this.wm = wm;
      this.launcherBtn = document.getElementById('btn-launcher');
      this.startMenu = document.getElementById('start-menu');
      this.dockApps = document.getElementById('dock-apps');
      this.trayClock = document.getElementById('tray-clock');
      this.toastContainer = document.getElementById('toast-container');
      this.volumePopup = document.getElementById('volume-popup');
      this.notifDrawer = document.getElementById('notification-drawer');
      this.contextMenu = document.getElementById('context-menu');

      this.dockItems = new Map(); // id -> HTMLElement
      this.notifications = [];

      this.init();
    }

    async init() {
      this.initClock();
      this.initStartMenu();
      this.initTray();
      this.initWindowEvents();
      this.loadLauncherApps();

      // Click outside to close popups
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#start-menu') && !e.target.closest('#btn-launcher')) {
          this.closeStartMenu();
        }
        if (!e.target.closest('#volume-popup') && !e.target.closest('#tray-volume')) {
          if (this.volumePopup) this.volumePopup.classList.remove('open');
        }
        if (!e.target.closest('#notification-drawer') && !e.target.closest('#tray-notif')) {
          if (this.notifDrawer) this.notifDrawer.classList.remove('open');
        }
        if (!e.target.closest('#context-menu')) {
          if (this.contextMenu) this.contextMenu.style.display = 'none';
        }
      });
    }

    initClock() {
      const update = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (this.trayClock) {
          this.trayClock.innerHTML = `
            <span class="time">${timeStr}</span>
            <span class="date">${dateStr}</span>
          `;
        }
      };
      update();
      setInterval(update, 1000);
    }

    initStartMenu() {
      this.launcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleStartMenu();
      });

      const searchInput = document.getElementById('start-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.filterLauncherApps(e.target.value.toLowerCase().trim());
        });
      }
    }

    toggleStartMenu() {
      const isOpen = this.startMenu.classList.toggle('open');
      this.launcherBtn.classList.toggle('active', isOpen);
      if (isOpen) {
        const searchInput = document.getElementById('start-search');
        if (searchInput) {
          searchInput.value = '';
          this.filterLauncherApps('');
          setTimeout(() => searchInput.focus(), 100);
        }
      }
    }

    closeStartMenu() {
      this.startMenu.classList.remove('open');
      this.launcherBtn.classList.remove('active');
    }

    async loadLauncherApps() {
      try {
        const data = await EndroidAPI.apps.list();
        const container = document.getElementById('start-app-list');
        if (!container) return;

        container.innerHTML = '';
        const allApps = [...(data.systemApps || []), ...(data.installedApps || [])];

        // Group by category
        const categories = {};
        allApps.forEach(app => {
          const cat = app.category || (app.categories && app.categories[0]) || 'Applications';
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(app);
        });

        for (const [catName, apps] of Object.entries(categories)) {
          const catDiv = document.createElement('div');
          catDiv.className = 'start-category-group';
          catDiv.innerHTML = `<div class="start-category-title">${catName}</div>`;

          const grid = document.createElement('div');
          grid.className = 'start-app-grid';

          apps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'start-app-item';
            item.dataset.appName = app.name.toLowerCase();
            item.dataset.appCategory = catName.toLowerCase();

            let iconHtml = '';
            if (app.iconSvg) {
              iconHtml = app.iconSvg;
            } else if (app.icon && app.icon.startsWith('/')) {
              iconHtml = `<img src="${app.icon}" style="width:28px;height:28px;" alt="${app.name}">`;
            } else {
              iconHtml = EndroidIcons.getHtml(app.icon || 'app-window', { size: 28 });
            }

            item.innerHTML = `
              <div class="app-icon">${iconHtml}</div>
              <div class="app-name">${app.name}</div>
            `;

            item.addEventListener('click', () => {
              this.launchApp(app);
              this.closeStartMenu();
            });

            grid.appendChild(item);
          });

          catDiv.appendChild(grid);
          container.appendChild(catDiv);
        }

        EndroidIcons.render(container);
      } catch (err) {
        console.error('Failed to load apps in launcher:', err);
      }
    }

    filterLauncherApps(query) {
      const items = document.querySelectorAll('.start-app-item');
      items.forEach(item => {
        const name = item.dataset.appName || '';
        const cat = item.dataset.appCategory || '';
        if (!query || name.includes(query) || cat.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });

      // Hide empty categories
      document.querySelectorAll('.start-category-group').forEach(group => {
        const visibleChildren = group.querySelectorAll('.start-app-item:not([style*="display: none"])');
        group.style.display = visibleChildren.length > 0 ? 'block' : 'none';
      });
    }

    launchApp(app) {
      const winOptions = {
        id: app.id,
        title: app.name,
        icon: app.icon,
        url: app.main,
        width: app.window?.width || 800,
        height: app.window?.height || 560,
        minWidth: app.window?.minWidth || 360,
        minHeight: app.window?.minHeight || 260,
        resizable: app.window?.resizable !== false
      };
      this.wm.createWindow(winOptions);
    }

    initTray() {
      // Volume Popup
      const trayVolume = document.getElementById('tray-volume');
      if (trayVolume && this.volumePopup) {
        trayVolume.addEventListener('click', (e) => {
          e.stopPropagation();
          this.volumePopup.classList.toggle('open');
        });

        const slider = document.getElementById('volume-slider');
        if (slider) {
          slider.addEventListener('input', (e) => {
            const val = e.target.value;
            const iconSpan = trayVolume.querySelector('.tray-vol-icon');
            if (iconSpan) {
              const iconName = val == 0 ? 'volume-x' : val < 50 ? 'volume-1' : 'volume-2';
              iconSpan.innerHTML = EndroidIcons.getHtml(iconName, { size: 16 });
              EndroidIcons.render(iconSpan);
            }
          });
        }
      }

      // Theme Mode Toggle
      const trayTheme = document.getElementById('tray-theme');
      if (trayTheme) {
        trayTheme.addEventListener('click', async () => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', newTheme);
          trayTheme.innerHTML = EndroidIcons.getHtml(newTheme === 'dark' ? 'moon' : 'sun', { size: 16 });
          EndroidIcons.render(trayTheme);
          this.showToast('Theme Changed', `Switched to ${newTheme} mode`, newTheme === 'dark' ? 'moon' : 'sun');
          
          try {
            await EndroidAPI.settings.update({ theme: { mode: newTheme } });
          } catch (_) {}
        });
      }

      // Notification Drawer Toggle
      const trayNotif = document.getElementById('tray-notif');
      if (trayNotif && this.notifDrawer) {
        trayNotif.addEventListener('click', (e) => {
          e.stopPropagation();
          this.notifDrawer.classList.toggle('open');
        });

        const clearBtn = document.getElementById('btn-clear-notifs');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            this.notifications = [];
            this.renderNotifications();
          });
        }
      }
    }

    initWindowEvents() {
      // Window Opened -> add dock item
      window.addEventListener('endroid-window-opened', (e) => {
        const win = e.detail;
        if (this.dockItems.has(win.id)) return;

        const item = document.createElement('button');
        item.className = 'dock-item active';
        item.id = 'dock-item-' + win.id;
        item.title = win.title;
        item.innerHTML = `
          ${EndroidIcons.getHtml(win.icon || 'app-window', { size: 20 })}
          <span class="indicator"></span>
        `;

        item.addEventListener('click', () => {
          if (win.isMinimized) {
            this.wm.restoreWindow(win.id);
          } else if (this.wm.activeWindowId === win.id) {
            this.wm.minimizeWindow(win.id);
          } else {
            this.wm.focusWindow(win.id);
          }
        });

        this.dockApps.appendChild(item);
        EndroidIcons.render(item);
        this.dockItems.set(win.id, item);
      });

      // Window Closed -> remove dock item
      window.addEventListener('endroid-window-closed', (e) => {
        const win = e.detail;
        const item = this.dockItems.get(win.id);
        if (item && item.parentNode) {
          item.parentNode.removeChild(item);
          this.dockItems.delete(win.id);
        }
      });

      // Window Focused -> update active class
      window.addEventListener('endroid-window-focused', (e) => {
        const win = e.detail;
        this.dockItems.forEach((btn, id) => {
          btn.classList.toggle('active', id === win.id);
        });
      });

      // Window Minimized -> update active class
      window.addEventListener('endroid-window-minimized', (e) => {
        const win = e.detail;
        const btn = this.dockItems.get(win.id);
        if (btn) btn.classList.remove('active');
      });
    }

    showToast(title, body, icon = 'bell', duration = 4000) {
      if (!this.toastContainer) return;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <div class="toast-icon">${EndroidIcons.getHtml(icon, { size: 20 })}</div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-body">${body}</div>
        </div>
      `;

      this.toastContainer.appendChild(toast);
      EndroidIcons.render(toast);

      // Add to drawer history
      this.notifications.unshift({ title, body, icon, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      this.renderNotifications();

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    renderNotifications() {
      const container = document.getElementById('drawer-notif-list');
      if (!container) return;

      if (this.notifications.length === 0) {
        container.innerHTML = `<div class="empty-state">No new notifications</div>`;
        return;
      }

      container.innerHTML = this.notifications.map(n => `
        <div class="drawer-item" style="padding:10px; background:rgba(255,255,255,0.04); border-radius:var(--radius-md); display:flex; gap:10px; align-items:flex-start;">
          <div style="color:var(--accent);">${EndroidIcons.getHtml(n.icon, { size: 18 })}</div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600;">
              <span>${n.title}</span>
              <span style="font-size:10px; color:var(--text-muted);">${n.time}</span>
            </div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">${n.body}</div>
          </div>
        </div>
      `).join('');

      EndroidIcons.render(container);
    }
  }

  window.EndroidTaskbar = Taskbar;
})(window);
