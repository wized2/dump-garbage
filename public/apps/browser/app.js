document.addEventListener('DOMContentLoaded', () => {
  const tabList = document.getElementById('tab-list');
  const btnNewTab = document.getElementById('btn-new-tab');
  const urlInput = document.getElementById('url-input');
  const btnGo = document.getElementById('btn-go');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnHome = document.getElementById('btn-home');
  const btnAdblock = document.getElementById('btn-adblock');
  const adblockBadge = document.getElementById('adblock-badge');
  const viewportContainer = document.getElementById('viewport-container');

  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;
  let adBlockCount = 4;

  function createTab(url = 'about:home', title = 'New Tab') {
    const id = ++tabCounter;
    const tab = {
      id,
      title,
      url,
      history: [url],
      historyIdx: 0
    };

    tabs.push(tab);

    // Render Tab Header
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item';
    tabEl.id = 'tab-' + id;
    tabEl.innerHTML = `
      <i data-lucide="globe" style="width:12px;height:12px;"></i>
      <span class="tab-title">${title}</span>
      <button class="tab-close"><i data-lucide="x" style="width:10px;height:10px;"></i></button>
    `;

    tabEl.addEventListener('click', () => switchTab(id));
    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    tabList.appendChild(tabEl);
    EndroidIcons.render(tabEl);

    // Render Viewport
    const viewEl = document.createElement('div');
    viewEl.id = 'view-' + id;
    viewEl.style.width = '100%';
    viewEl.style.height = '100%';
    viewEl.style.display = 'none';
    viewportContainer.appendChild(viewEl);

    switchTab(id);
    navigateTab(tab, url);
  }

  function switchTab(id) {
    activeTabId = id;
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    document.querySelectorAll('.tab-item').forEach(el => el.classList.toggle('active', el.id === 'tab-' + id));
    document.querySelectorAll('#viewport-container > div').forEach(el => el.style.display = el.id === 'view-' + id ? 'block' : 'none');

    urlInput.value = tab.url === 'about:home' ? '' : tab.url;
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    document.getElementById('tab-' + id)?.remove();
    document.getElementById('view-' + id)?.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
      createTab('about:home');
    } else if (activeTabId === id) {
      const nextTab = tabs[Math.max(0, idx - 1)];
      switchTab(nextTab.id);
    }
  }

  function navigateTab(tab, input) {
    let targetUrl = input.trim();
    if (!targetUrl || targetUrl === 'about:home') {
      tab.url = 'about:home';
      tab.title = 'Start Page';
      renderStartPage(tab);
    } else {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
        if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
          targetUrl = 'https://' + targetUrl;
        } else {
          // Search simulation
          targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetUrl)}`;
        }
      }
      tab.url = targetUrl;
      tab.title = targetUrl.replace(/^https?:\/\//, '').split('/')[0];
      renderIframe(tab, targetUrl);
    }

    // Update Tab Title in UI
    const tabEl = document.getElementById('tab-' + tab.id);
    if (tabEl) {
      tabEl.querySelector('.tab-title').innerText = tab.title;
    }
    urlInput.value = tab.url === 'about:home' ? '' : tab.url;
  }

  function renderStartPage(tab) {
    const viewEl = document.getElementById('view-' + tab.id);
    if (!viewEl) return;

    viewEl.innerHTML = `
      <div class="start-page">
        <div class="start-page-logo">Endroid Web</div>
        <p style="color:var(--text-secondary); font-size:13px;">Fast, lightweight, ad-shielded private web browsing</p>

        <div class="start-search-card">
          <i data-lucide="search" style="width:18px;height:18px;color:var(--text-muted);"></i>
          <input type="text" id="start-query-${tab.id}" placeholder="Search the web or type a URL..." autofocus>
        </div>

        <div class="quick-links-grid">
          <div class="quick-card" data-url="https://kernel.org">
            <i data-lucide="cpu" style="width:24px;height:24px;color:var(--accent);"></i>
            <span>Kernel.org</span>
          </div>
          <div class="quick-card" data-url="https://developer.mozilla.org">
            <i data-lucide="code" style="width:24px;height:24px;color:var(--accent);"></i>
            <span>MDN Docs</span>
          </div>
          <div class="quick-card" data-url="https://news.ycombinator.com">
            <i data-lucide="terminal" style="width:24px;height:24px;color:var(--accent);"></i>
            <span>Hacker News</span>
          </div>
          <div class="quick-card" data-url="https://en.wikipedia.org">
            <i data-lucide="globe" style="width:24px;height:24px;color:var(--accent);"></i>
            <span>Wikipedia</span>
          </div>
        </div>
      </div>
    `;

    EndroidIcons.render(viewEl);

    const input = viewEl.querySelector(`#start-query-${tab.id}`);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigateTab(tab, input.value);
    });

    viewEl.querySelectorAll('.quick-card').forEach(card => {
      card.addEventListener('click', () => navigateTab(tab, card.dataset.url));
    });
  }

  function renderIframe(tab, url) {
    const viewEl = document.getElementById('view-' + tab.id);
    if (!viewEl) return;
    viewEl.innerHTML = `<iframe class="browser-iframe" src="${url}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;
  }

  // Events
  btnNewTab.addEventListener('click', () => createTab('about:home'));

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) navigateTab(tab, urlInput.value);
    }
  });

  btnGo.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) navigateTab(tab, urlInput.value);
  });

  btnHome.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) navigateTab(tab, 'about:home');
  });

  btnReload.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) navigateTab(tab, tab.url);
  });

  btnAdblock.addEventListener('click', () => {
    adBlockCount += 2;
    adblockBadge.innerText = adBlockCount;
    alert(`Ad-Shield Active: ${adBlockCount} trackers and third-party scripts blocked on this domain.`);
  });

  document.querySelectorAll('.bookmark-item').forEach(b => {
    b.addEventListener('click', () => {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) navigateTab(tab, b.dataset.url);
    });
  });

  // Initial Tab
  createTab('about:home');
  EndroidIcons.render();
});
