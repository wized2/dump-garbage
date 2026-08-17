document.addEventListener('DOMContentLoaded', () => {
  const outputEl = document.getElementById('terminal-output');
  const inputEl = document.getElementById('terminal-input');
  const promptLabel = document.getElementById('prompt-label');
  const screenEl = document.getElementById('terminal-screen');
  const themeSelector = document.getElementById('theme-selector');
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  const btnClear = document.getElementById('btn-clear');

  let cwd = '/home/user';
  let history = [];
  let historyIndex = -1;
  let fontSize = 13;

  // Click screen to focus input
  screenEl.addEventListener('click', () => inputEl.focus());

  // WebSocket Connection
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/pty`;

    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      // WS sends output directly
      appendRawOutput(event.data);
      scrollToBottom();
    };

    ws.onopen = () => {
      // connected
    };

    ws.onerror = () => {
      // fallback to REST if WS fails
    };
  }

  connectWebSocket();

  // ANSI to HTML Parser
  function parseAnsi(text) {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Color codes
    html = html
      .replace(/\x1b\[1;32m/g, '<span class="ansi-green ansi-bold">')
      .replace(/\x1b\[1;34m/g, '<span class="ansi-blue ansi-bold">')
      .replace(/\x1b\[1;36m/g, '<span class="ansi-cyan ansi-bold">')
      .replace(/\x1b\[1;37m/g, '<span class="ansi-white ansi-bold">')
      .replace(/\x1b\[31m/g, '<span class="ansi-red">')
      .replace(/\x1b\[32m/g, '<span class="ansi-green">')
      .replace(/\x1b\[33m/g, '<span class="ansi-yellow">')
      .replace(/\x1b\[34m/g, '<span class="ansi-blue">')
      .replace(/\x1b\[35m/g, '<span class="ansi-magenta">')
      .replace(/\x1b\[36m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[1m/g, '<span class="ansi-bold">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[2J\x1b\[H/g, ''); // Clear screen code

    return html;
  }

  function appendRawOutput(text) {
    if (text.includes('\x1b[2J\x1b[H')) {
      outputEl.innerHTML = '';
      return;
    }
    const span = document.createElement('span');
    span.innerHTML = parseAnsi(text);
    outputEl.appendChild(span);
  }

  function scrollToBottom() {
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  // Handle Command Submit via Input
  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const cmd = inputEl.value.trim();
      inputEl.value = '';

      // Print prompt and command into output
      const lineDiv = document.createElement('div');
      lineDiv.innerHTML = `<span class="prompt-label">${promptLabel.innerText}</span><span>${cmd}</span>`;
      outputEl.appendChild(lineDiv);

      if (cmd.length > 0) {
        history.push(cmd);
        historyIndex = history.length;

        if (cmd === 'clear') {
          outputEl.innerHTML = '';
          return;
        }

        if (cmd.startsWith('cd ')) {
          const target = cmd.slice(3).trim();
          cwd = target.startsWith('/') ? target : (cwd === '/' ? '/' + target : cwd + '/' + target);
          promptLabel.innerText = `user@endroid:${cwd}$ `;
        }

        // Send through REST or WS
        try {
          const res = await EndroidAPI.system.exec(cmd, cwd);
          if (res.stdout) appendRawOutput(res.stdout);
          if (res.stderr) appendRawOutput(res.stderr);
        } catch (err) {
          appendRawOutput(`\x1b[31mError: ${err.message}\x1b[0m\n`);
        }
      }

      scrollToBottom();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex > 0) {
        historyIndex--;
        inputEl.value = history[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        inputEl.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        inputEl.value = '';
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const current = inputEl.value.trim();
      const knownCommands = ['help', 'neofetch', 'uname', 'ls', 'cd', 'cat', 'echo', 'mkdir', 'rm', 'ps', 'kill', 'epk', 'clear', 'date', 'whoami'];
      const match = knownCommands.find(c => c.startsWith(current));
      if (match) {
        inputEl.value = match + ' ';
      }
    }
  });

  // Controls
  themeSelector.addEventListener('change', (e) => {
    document.body.className = e.target.value;
  });

  btnFontInc.addEventListener('click', () => {
    fontSize = Math.min(20, fontSize + 1);
    screenEl.style.fontSize = fontSize + 'px';
    inputEl.style.fontSize = fontSize + 'px';
  });

  btnFontDec.addEventListener('click', () => {
    fontSize = Math.max(10, fontSize - 1);
    screenEl.style.fontSize = fontSize + 'px';
    inputEl.style.fontSize = fontSize + 'px';
  });

  btnClear.addEventListener('click', () => {
    outputEl.innerHTML = '';
  });

  EndroidIcons.render();
});
