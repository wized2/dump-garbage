document.addEventListener('DOMContentLoaded', async () => {
  let currentPath = '/home/user';
  let historyStack = [];
  let viewMode = 'grid'; // 'grid' | 'list'
  let currentEntries = [];
  let selectedEntry = null;

  // Check URL query param ?path=
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('path')) {
    currentPath = urlParams.get('path');
  }

  const container = document.getElementById('file-container');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const statusCount = document.getElementById('status-count');
  const statusSelected = document.getElementById('status-selected');
  const statusPath = document.getElementById('status-path');

  const btnBack = document.getElementById('btn-back');
  const btnUp = document.getElementById('btn-up');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnNewFolder = document.getElementById('btn-new-folder');
  const btnNewFile = document.getElementById('btn-new-file');
  const btnViewGrid = document.getElementById('btn-view-grid');
  const btnViewList = document.getElementById('btn-view-list');

  const previewModal = document.getElementById('preview-modal');
  const previewTitle = document.getElementById('preview-title');
  const previewBody = document.getElementById('preview-body');
  const btnClosePreview = document.getElementById('btn-close-preview');

  // Load Folder
  async function loadDirectory(path, recordHistory = true) {
    try {
      if (recordHistory && currentPath !== path) {
        historyStack.push(currentPath);
      }
      currentPath = path;
      const res = await EndroidAPI.fs.list(currentPath);
      currentEntries = res.entries || [];
      selectedEntry = null;

      renderBreadcrumbs();
      renderFiles();
      updateStatus();
      updateSidebarActive();
    } catch (err) {
      alert('Error loading directory: ' + err.message);
    }
  }

  function renderBreadcrumbs() {
    breadcrumbsEl.innerHTML = '';
    const parts = currentPath.split('/').filter(Boolean);

    // Root crumb
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'crumb';
    rootCrumb.innerText = '/';
    rootCrumb.addEventListener('click', () => loadDirectory('/'));
    breadcrumbsEl.appendChild(rootCrumb);

    let buildPath = '';
    parts.forEach(part => {
      buildPath += '/' + part;
      const thisPath = buildPath;

      const sep = document.createElement('span');
      sep.className = 'crumb-separator';
      sep.innerText = '>';
      breadcrumbsEl.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      crumb.innerText = part;
      crumb.addEventListener('click', () => loadDirectory(thisPath));
      breadcrumbsEl.appendChild(crumb);
    });
  }

  function renderFiles() {
    container.innerHTML = '';
    container.className = viewMode === 'grid' ? 'file-grid' : 'file-list';

    if (currentEntries.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">This directory is empty</div>`;
      return;
    }

    currentEntries.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'file-item' + (selectedEntry?.name === entry.name ? ' selected' : '');

      let iconName = 'file';
      if (entry.isDirectory) iconName = 'folder';
      else if (entry.ext === '.md' || entry.ext === '.txt') iconName = 'file-text';
      else if (entry.ext === '.json') iconName = 'file-code';
      else if (entry.ext === '.epk' || entry.ext === '.zip') iconName = 'package';
      else if (['.png', '.jpg', '.jpeg', '.svg'].includes(entry.ext)) iconName = 'image';

      if (viewMode === 'grid') {
        el.innerHTML = `
          <div class="file-icon">${EndroidIcons.getHtml(iconName, { size: 36 })}</div>
          <div class="file-name" title="${entry.name}">${entry.name}</div>
        `;
      } else {
        const sizeStr = entry.isDirectory ? '--' : formatBytes(entry.size);
        const dateStr = new Date(entry.mtime).toLocaleDateString();
        el.innerHTML = `
          <div class="file-icon">${EndroidIcons.getHtml(iconName, { size: 20 })}</div>
          <div class="file-name" title="${entry.name}">${entry.name}</div>
          <div class="file-meta">${sizeStr}</div>
          <div class="file-meta" style="margin-left:16px;">${dateStr}</div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedEntry = entry;
        document.querySelectorAll('.file-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        updateStatus();
      });

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        handleOpenEntry(entry);
      });

      container.appendChild(el);
    });

    EndroidIcons.render(container);
  }

  function handleOpenEntry(entry) {
    if (entry.isDirectory) {
      loadDirectory(entry.path);
    } else if (entry.ext === '.epk') {
      // Launch installer if parent window is Endroid OS
      if (window.parent && window.parent.Endroid) {
        window.parent.Endroid.wm.createWindow({
          id: 'installer',
          title: 'App Installer',
          icon: 'package',
          url: `apps/installer/index.html?package=${encodeURIComponent(entry.path)}`,
          width: 760,
          height: 520
        });
      }
    } else if (entry.ext === '.md' || entry.ext === '.txt' || entry.ext === '.json') {
      openPreview(entry);
    } else {
      openPreview(entry);
    }
  }

  async function openPreview(entry) {
    previewTitle.innerText = entry.name;
    previewBody.innerHTML = 'Loading preview...';
    previewModal.classList.add('open');

    try {
      const res = await EndroidAPI.fs.read(entry.path);
      if (res.isBase64) {
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(entry.ext)) {
          previewBody.innerHTML = `<img src="data:image/${entry.ext.replace('.', '')};base64,${res.content}" style="max-width:100%; max-height:400px; border-radius:8px;">`;
        } else {
          previewBody.innerHTML = `<p>Binary file (${formatBytes(res.size)})</p>`;
        }
      } else {
        previewBody.innerText = res.content;
      }
    } catch (err) {
      previewBody.innerText = 'Failed to load preview: ' + err.message;
    }
  }

  if (btnClosePreview) {
    btnClosePreview.addEventListener('click', () => previewModal.classList.remove('open'));
  }

  function updateStatus() {
    statusCount.innerText = `${currentEntries.length} items`;
    statusSelected.innerText = selectedEntry ? `Selected: ${selectedEntry.name}` : 'No selection';
    statusPath.innerText = currentPath;
  }

  function updateSidebarActive() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === currentPath);
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Sidebar item clicks
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => loadDirectory(item.dataset.path));
  });

  // Toolbar events
  btnBack.addEventListener('click', () => {
    if (historyStack.length > 0) {
      loadDirectory(historyStack.pop(), false);
    }
  });

  btnUp.addEventListener('click', () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadDirectory('/' + parts.join('/'));
  });

  btnRefresh.addEventListener('click', () => loadDirectory(currentPath, false));

  btnNewFolder.addEventListener('click', async () => {
    const name = prompt('Folder name:', 'New Folder');
    if (name) {
      const p = currentPath === '/' ? '/' + name : `${currentPath}/${name}`;
      await EndroidAPI.fs.mkdir(p);
      loadDirectory(currentPath, false);
    }
  });

  btnNewFile.addEventListener('click', async () => {
    const name = prompt('File name:', 'document.md');
    if (name) {
      const p = currentPath === '/' ? '/' + name : `${currentPath}/${name}`;
      await EndroidAPI.fs.write(p, '# ' + name + '\n\nCreated in File Manager');
      loadDirectory(currentPath, false);
    }
  });

  btnViewGrid.addEventListener('click', () => {
    viewMode = 'grid';
    btnViewGrid.classList.add('active');
    btnViewList.classList.remove('active');
    renderFiles();
  });

  btnViewList.addEventListener('click', () => {
    viewMode = 'list';
    btnViewList.classList.add('active');
    btnViewGrid.classList.remove('active');
    renderFiles();
  });

  // Initial Load
  await loadDirectory(currentPath);
  EndroidIcons.render();
});
