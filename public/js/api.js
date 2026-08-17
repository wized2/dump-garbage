/**
 * Endroid OS - Client API SDK
 * Provides typed, resilient access to local REST & WebSocket endpoints.
 */
(function(window) {
  'use strict';

  const EndroidAPI = {
    baseUrl: window.location.origin,

    // File System API
    fs: {
      async list(virtualPath = '/home/user') {
        const res = await fetch('/api/fs/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to list files');
        return await res.json();
      },

      async read(virtualPath) {
        const res = await fetch('/api/fs/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to read file');
        return await res.json();
      },

      async write(virtualPath, content, isBase64 = false) {
        const res = await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath, content, isBase64 })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to write file');
        return await res.json();
      },

      async delete(virtualPath) {
        const res = await fetch('/api/fs/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete path');
        return await res.json();
      },

      async mkdir(virtualPath) {
        const res = await fetch('/api/fs/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create directory');
        return await res.json();
      },

      async rename(oldPath, newPath) {
        const res = await fetch('/api/fs/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath, newPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to rename file');
        return await res.json();
      },

      async copy(src, dest) {
        const res = await fetch('/api/fs/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, dest })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to copy');
        return await res.json();
      },

      async move(src, dest) {
        const res = await fetch('/api/fs/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, dest })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to move');
        return await res.json();
      },

      async stat(virtualPath) {
        const res = await fetch('/api/fs/stat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: virtualPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to get stat');
        return await res.json();
      }
    },

    // .epk Apps & Package Manager API
    apps: {
      async list() {
        const res = await fetch('/api/apps/list');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch apps');
        return await res.json();
      },

      async installFromVfs(vfsPath) {
        const res = await fetch('/api/apps/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vfsPath })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to install .epk');
        return await res.json();
      },

      async installUpload(fileBlob) {
        const formData = new FormData();
        formData.append('package', fileBlob);
        const res = await fetch('/api/apps/install', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to upload and install .epk');
        return await res.json();
      },

      async uninstall(appId) {
        const res = await fetch('/api/apps/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: appId })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to uninstall app');
        return await res.json();
      }
    },

    // Settings API
    settings: {
      async get() {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch settings');
        return await res.json();
      },

      async update(settingsObj) {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsObj)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save settings');
        return await res.json();
      }
    },

    // System Telemetry & Process Management
    system: {
      async info() {
        const res = await fetch('/api/system/info');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch system info');
        return await res.json();
      },

      async exec(command, cwd = '/home/user') {
        const res = await fetch('/api/system/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, cwd })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to execute command');
        return await res.json();
      },

      async processes() {
        const res = await fetch('/api/process/list');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch processes');
        return await res.json();
      },

      async killProcess(pid) {
        const res = await fetch('/api/process/kill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pid })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to kill process');
        return await res.json();
      },

      async hardware() {
        const res = await fetch('/api/system/hardware');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch hardware info');
        return await res.json();
      },

      async shutdown() {
        const res = await fetch('/api/system/shutdown', { method: 'POST' });
        return await res.json();
      },

      async reboot() {
        const res = await fetch('/api/system/reboot', { method: 'POST' });
        return await res.json();
      }
    },

    // Bare-Metal OS Installer
    installer: {
      async getDisks() {
        const res = await fetch('/api/installer/disks');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to list storage disks');
        return await res.json();
      },

      async install(options) {
        const res = await fetch('/api/installer/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to install to disk');
        return await res.json();
      }
    },

    // Network Management
    network: {
      async interfaces() {
        const res = await fetch('/api/network/interfaces');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch network interfaces');
        return await res.json();
      }
    }
  };

  window.EndroidAPI = EndroidAPI;
})(window);
