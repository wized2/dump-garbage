/**
 * Endroid OS - Window Manager Engine
 * High performance, 60fps window management with snapping, resizing, and dock sync.
 */
(function(window) {
  'use strict';

  class WindowManager {
    constructor() {
      this.windows = new Map();
      this.activeWindowId = null;
      this.topZIndex = 100;
      this.container = document.getElementById('window-layer');
      this.snapPreview = document.getElementById('snap-preview');
      this.taskbarHeight = 52;

      this.initEvents();
    }

    initEvents() {
      window.addEventListener('resize', () => {
        this.windows.forEach(win => {
          if (win.isMaximized) {
            this.applyMaximizeBounds(win);
          } else {
            this.clampWindowToBounds(win);
          }
        });
      });
    }

    createWindow(config) {
      const id = config.id || 'win_' + Date.now();

      // Check if singleton window is already open
      if (this.windows.has(id)) {
        const existing = this.windows.get(id);
        if (existing.isMinimized) this.restoreWindow(id);
        this.focusWindow(id);
        return existing;
      }

      const title = config.title || 'Application';
      const icon = config.icon || 'app-window';
      const width = Math.min(config.width || 760, window.innerWidth - 40);
      const height = Math.min(config.height || 500, window.innerHeight - this.taskbarHeight - 40);
      const resizable = config.resizable !== false;
      const minWidth = config.minWidth || 360;
      const minHeight = config.minHeight || 260;

      // Smart cascading cascade offset
      const cascadeOffset = (this.windows.size % 8) * 28;
      const left = Math.max(20, (window.innerWidth - width) / 2 + cascadeOffset - 60);
      const top = Math.max(20, (window.innerHeight - this.taskbarHeight - height) / 2 + cascadeOffset - 60);

      // Create DOM element
      const el = document.createElement('div');
      el.id = 'window-' + id;
      el.className = 'window';
      el.style.width = width + 'px';
      el.style.height = height + 'px';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.zIndex = ++this.topZIndex;

      // Titlebar & Header
      const header = document.createElement('div');
      header.className = 'window-header';
      header.innerHTML = `
        <div class="window-title">
          <span class="window-icon" id="icon-${id}">${EndroidIcons.getHtml(icon, { size: 16 })}</span>
          <span>${title}</span>
        </div>
        <div class="window-controls">
          <button class="window-btn btn-min" title="Minimize">${EndroidIcons.getHtml('minus', { size: 14 })}</button>
          ${resizable ? `<button class="window-btn btn-max" title="Maximize">${EndroidIcons.getHtml('square', { size: 12 })}</button>` : ''}
          <button class="window-btn btn-close" title="Close">${EndroidIcons.getHtml('x', { size: 14 })}</button>
        </div>
      `;

      // Window Body
      const body = document.createElement('div');
      body.className = 'window-body';

      if (config.url) {
        const iframe = document.createElement('iframe');
        iframe.className = 'window-iframe';
        iframe.src = config.url;
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write; microphone; camera');
        body.appendChild(iframe);
      } else if (config.contentHtml) {
        body.innerHTML = config.contentHtml;
      } else if (config.element) {
        body.appendChild(config.element);
      }

      el.appendChild(header);
      el.appendChild(body);

      // Resize handles if resizable
      if (resizable) {
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
          const handle = document.createElement('div');
          handle.className = `resize-handle resize-${dir}`;
          handle.dataset.dir = dir;
          el.appendChild(handle);
        });
      }

      this.container.appendChild(el);
      EndroidIcons.render(el);

      const winState = {
        id,
        title,
        icon,
        el,
        header,
        body,
        config,
        isMinimized: false,
        isMaximized: false,
        normalBounds: { left, top, width, height },
        resizable,
        minWidth,
        minHeight
      };

      this.windows.set(id, winState);
      this.bindWindowInteractions(winState);
      this.focusWindow(id);

      // Notify dock / taskbar
      window.dispatchEvent(new CustomEvent('endroid-window-opened', { detail: winState }));

      return winState;
    }

    bindWindowInteractions(win) {
      const { el, header, id } = win;

      // Focus on click
      el.addEventListener('mousedown', () => this.focusWindow(id));

      // Control buttons
      const btnMin = header.querySelector('.btn-min');
      const btnMax = header.querySelector('.btn-max');
      const btnClose = header.querySelector('.btn-close');

      if (btnMin) btnMin.addEventListener('click', (e) => { e.stopPropagation(); this.minimizeWindow(id); });
      if (btnMax) btnMax.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(id); });
      if (btnClose) btnClose.addEventListener('click', (e) => { e.stopPropagation(); this.closeWindow(id); });

      // Double-click header to maximize
      if (win.resizable) {
        header.addEventListener('dblclick', (e) => {
          if (e.target.closest('.window-btn')) return;
          this.toggleMaximize(id);
        });
      }

      // Dragging with Snap detection
      let isDragging = false;
      let startX, startY, origLeft, origTop;
      let pendingSnap = null;

      const onMouseDown = (e) => {
        if (e.target.closest('.window-btn')) return;
        this.focusWindow(id);
        if (win.isMaximized) {
          // Restore to floating size positioned under cursor
          const ratioX = e.clientX / window.innerWidth;
          this.restoreWindow(id);
          win.normalBounds.left = e.clientX - win.normalBounds.width * ratioX;
          win.normalBounds.top = e.clientY - 15;
          this.applyBounds(win, win.normalBounds);
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origLeft = parseFloat(el.style.left) || 0;
        origTop = parseFloat(el.style.top) || 0;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = origLeft + dx;
        let newTop = Math.max(0, origTop + dy);

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';

        // Check Snap Hotspots
        if (e.clientX <= 10) {
          pendingSnap = 'left';
          this.showSnapPreview(0, 0, window.innerWidth / 2, window.innerHeight - this.taskbarHeight);
        } else if (e.clientX >= window.innerWidth - 10) {
          pendingSnap = 'right';
          this.showSnapPreview(window.innerWidth / 2, 0, window.innerWidth / 2, window.innerHeight - this.taskbarHeight);
        } else if (e.clientY <= 10) {
          pendingSnap = 'top';
          this.showSnapPreview(0, 0, window.innerWidth, window.innerHeight - this.taskbarHeight);
        } else {
          pendingSnap = null;
          this.hideSnapPreview();
        }
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.hideSnapPreview();

        if (pendingSnap === 'top') {
          this.maximizeWindow(id);
        } else if (pendingSnap === 'left') {
          this.snapWindow(id, 'left');
        } else if (pendingSnap === 'right') {
          this.snapWindow(id, 'right');
        } else {
          win.normalBounds.left = parseFloat(el.style.left);
          win.normalBounds.top = parseFloat(el.style.top);
          this.clampWindowToBounds(win);
        }
        pendingSnap = null;
      };

      header.addEventListener('mousedown', onMouseDown);

      // Resizing logic
      if (win.resizable) {
        el.querySelectorAll('.resize-handle').forEach(handle => {
          handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.focusWindow(id);
            const dir = handle.dataset.dir;
            this.startResizing(win, dir, e);
          });
        });
      }
    }

    startResizing(win, dir, e) {
      const { el, minWidth, minHeight } = win;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = el.offsetWidth;
      const startH = el.offsetHeight;
      const startL = el.offsetLeft;
      const startT = el.offsetTop;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        let w = startW;
        let h = startH;
        let l = startL;
        let t = startT;

        if (dir.includes('e')) w = Math.max(minWidth, startW + dx);
        if (dir.includes('s')) h = Math.max(minHeight, startH + dy);
        if (dir.includes('w')) {
          const possibleW = startW - dx;
          if (possibleW >= minWidth) {
            w = possibleW;
            l = startL + dx;
          }
        }
        if (dir.includes('n')) {
          const possibleH = startH - dy;
          if (possibleH >= minHeight) {
            h = possibleH;
            t = startT + dy;
          }
        }

        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.left = l + 'px';
        el.style.top = t + 'px';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        win.normalBounds.width = el.offsetWidth;
        win.normalBounds.height = el.offsetHeight;
        win.normalBounds.left = el.offsetLeft;
        win.normalBounds.top = el.offsetTop;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    }

    focusWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      this.windows.forEach(w => w.el.classList.remove('active'));
      win.el.classList.add('active');
      win.el.style.zIndex = ++this.topZIndex;
      this.activeWindowId = id;

      window.dispatchEvent(new CustomEvent('endroid-window-focused', { detail: win }));
    }

    minimizeWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      win.isMinimized = true;
      win.el.classList.add('minimized');
      win.el.classList.remove('active');

      // Focus next top window
      const remaining = Array.from(this.windows.values())
        .filter(w => !w.isMinimized && w.id !== id)
        .sort((a, b) => parseInt(b.el.style.zIndex || 0) - parseInt(a.el.style.zIndex || 0));

      if (remaining.length > 0) {
        this.focusWindow(remaining[0].id);
      } else {
        this.activeWindowId = null;
      }

      window.dispatchEvent(new CustomEvent('endroid-window-minimized', { detail: win }));
    }

    restoreWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      win.isMinimized = false;
      win.el.classList.remove('minimized');
      this.focusWindow(id);

      window.dispatchEvent(new CustomEvent('endroid-window-restored', { detail: win }));
    }

    maximizeWindow(id) {
      const win = this.windows.get(id);
      if (!win || !win.resizable) return;

      if (!win.isMaximized) {
        win.normalBounds = {
          left: parseFloat(win.el.style.left),
          top: parseFloat(win.el.style.top),
          width: parseFloat(win.el.style.width),
          height: parseFloat(win.el.style.height)
        };
      }

      win.isMaximized = true;
      win.el.classList.add('maximized');
      this.applyMaximizeBounds(win);
      this.focusWindow(id);

      const maxBtn = win.header.querySelector('.btn-max');
      if (maxBtn) maxBtn.innerHTML = EndroidIcons.getHtml('copy', { size: 12 });
    }

    toggleMaximize(id) {
      const win = this.windows.get(id);
      if (!win) return;
      if (win.isMaximized) {
        this.unmaximizeWindow(id);
      } else {
        this.maximizeWindow(id);
      }
    }

    unmaximizeWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      win.isMaximized = false;
      win.el.classList.remove('maximized');
      this.applyBounds(win, win.normalBounds);

      const maxBtn = win.header.querySelector('.btn-max');
      if (maxBtn) maxBtn.innerHTML = EndroidIcons.getHtml('square', { size: 12 });
    }

    snapWindow(id, side) {
      const win = this.windows.get(id);
      if (!win) return;

      win.isMaximized = false;
      win.el.classList.remove('maximized');

      const fullW = window.innerWidth;
      const fullH = window.innerHeight - this.taskbarHeight;

      if (side === 'left') {
        this.applyBounds(win, { left: 0, top: 0, width: fullW / 2, height: fullH });
      } else if (side === 'right') {
        this.applyBounds(win, { left: fullW / 2, top: 0, width: fullW / 2, height: fullH });
      }
      this.focusWindow(id);
    }

    closeWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      win.el.style.opacity = '0';
      win.el.style.transform = 'scale(0.95)';

      setTimeout(() => {
        if (win.el.parentNode) win.el.parentNode.removeChild(win.el);
        this.windows.delete(id);
        window.dispatchEvent(new CustomEvent('endroid-window-closed', { detail: win }));
      }, 200);
    }

    applyBounds(win, bounds) {
      win.el.style.left = bounds.left + 'px';
      win.el.style.top = bounds.top + 'px';
      win.el.style.width = bounds.width + 'px';
      win.el.style.height = bounds.height + 'px';
    }

    applyMaximizeBounds(win) {
      win.el.style.left = '0px';
      win.el.style.top = '0px';
      win.el.style.width = window.innerWidth + 'px';
      win.el.style.height = (window.innerHeight - this.taskbarHeight) + 'px';
    }

    clampWindowToBounds(win) {
      const maxLeft = window.innerWidth - 80;
      const maxTop = window.innerHeight - this.taskbarHeight - 40;
      let left = parseFloat(win.el.style.left) || 0;
      let top = parseFloat(win.el.style.top) || 0;

      left = Math.max(0, Math.min(left, maxLeft));
      top = Math.max(0, Math.min(top, maxTop));

      win.el.style.left = left + 'px';
      win.el.style.top = top + 'px';
    }

    showSnapPreview(x, y, w, h) {
      if (!this.snapPreview) return;
      this.snapPreview.style.left = x + 'px';
      this.snapPreview.style.top = y + 'px';
      this.snapPreview.style.width = w + 'px';
      this.snapPreview.style.height = h + 'px';
      this.snapPreview.classList.add('visible');
    }

    hideSnapPreview() {
      if (!this.snapPreview) return;
      this.snapPreview.classList.remove('visible');
    }
  }

  window.EndroidWM = WindowManager;
})(window);
