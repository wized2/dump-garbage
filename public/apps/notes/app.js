document.addEventListener('DOMContentLoaded', async () => {
  const notesListEl = document.getElementById('notes-list');
  const btnNewNote = document.getElementById('btn-new-note');
  const noteSearch = document.getElementById('note-search');
  const noteTitleInput = document.getElementById('note-title');
  const noteContentInput = document.getElementById('note-content');
  const notePreview = document.getElementById('note-preview');
  const btnTogglePreview = document.getElementById('btn-toggle-preview');
  const btnDeleteNote = document.getElementById('btn-delete-note');
  const saveStatus = document.getElementById('save-status');
  const wordCount = document.getElementById('word-count');

  let currentNoteFile = null;
  let notes = [];
  let saveTimeout = null;
  let isPreviewVisible = true;

  // Check URL query param ?file=
  const urlParams = new URLSearchParams(window.location.search);
  const targetFileParam = urlParams.get('file');

  async function loadNotesList() {
    try {
      const res = await EndroidAPI.fs.list('/home/user/Notes');
      notes = (res.entries || []).filter(e => !e.isDirectory && (e.ext === '.md' || e.ext === '.txt'));

      renderNotesSidebar();

      if (targetFileParam) {
        openNote(targetFileParam);
      } else if (notes.length > 0 && !currentNoteFile) {
        openNote(notes[0].path);
      } else if (notes.length === 0) {
        createNewNote();
      }
    } catch (err) {
      console.error('Failed to load notes list:', err);
    }
  }

  function renderNotesSidebar(filter = '') {
    notesListEl.innerHTML = '';
    const filtered = notes.filter(n => n.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      notesListEl.innerHTML = `<div style="padding:16px 8px; text-align:center; color:var(--text-muted); font-size:11.5px;">No notes found</div>`;
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item' + (currentNoteFile === note.path ? ' active' : '');
      item.innerHTML = `
        <div class="note-item-title">${note.name.replace(/\.md$/, '')}</div>
        <div class="note-item-date">${new Date(note.mtime).toLocaleDateString()}</div>
      `;

      item.addEventListener('click', () => openNote(note.path));
      notesListEl.appendChild(item);
    });
  }

  async function openNote(filePath) {
    try {
      currentNoteFile = filePath;
      const fileName = filePath.split('/').pop();
      noteTitleInput.value = fileName.replace(/\.md$/, '');

      const res = await EndroidAPI.fs.read(filePath);
      noteContentInput.value = res.content || '';

      updatePreview();
      updateWordCount();
      renderNotesSidebar(noteSearch.value);
    } catch (err) {
      alert('Could not open note: ' + err.message);
    }
  }

  async function createNewNote() {
    const timestamp = Date.now().toString().slice(-4);
    const newName = `Untitled_${timestamp}.md`;
    const newPath = `/home/user/Notes/${newName}`;

    await EndroidAPI.fs.write(newPath, `# New Note\n\nWrite your thoughts here...`);
    await loadNotesList();
    openNote(newPath);
  }

  function triggerAutoSave() {
    saveStatus.innerHTML = `<span style="color:var(--warning);">Saving...</span>`;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (!currentNoteFile) return;

      const content = noteContentInput.value;
      const rawTitle = noteTitleInput.value.trim() || 'Untitled';
      const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_\- ]/g, '');
      const newPath = `/home/user/Notes/${cleanTitle}.md`;

      if (newPath !== currentNoteFile) {
        try {
          await EndroidAPI.fs.rename(currentNoteFile, newPath);
          currentNoteFile = newPath;
        } catch (_) {}
      }

      await EndroidAPI.fs.write(currentNoteFile, content);
      saveStatus.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;color:var(--success);"></i> Saved`;
      EndroidIcons.render(saveStatus);

      // Refresh sidebar list
      const res = await EndroidAPI.fs.list('/home/user/Notes');
      notes = (res.entries || []).filter(e => !e.isDirectory);
      renderNotesSidebar(noteSearch.value);
    }, 600);
  }

  function renderSimpleMarkdown(md) {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/gim, '<pre>$1</pre>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
    return html;
  }

  function updatePreview() {
    notePreview.innerHTML = renderSimpleMarkdown(noteContentInput.value);
  }

  function updateWordCount() {
    const text = noteContentInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    wordCount.innerText = `${words} words, ${chars} chars`;
  }

  // Format Helper
  function insertFormat(prefix, suffix = '') {
    const start = noteContentInput.selectionStart;
    const end = noteContentInput.selectionEnd;
    const selected = noteContentInput.value.substring(start, end);
    const replacement = prefix + selected + suffix;
    noteContentInput.setRangeText(replacement, start, end, 'end');
    noteContentInput.focus();
    updatePreview();
    triggerAutoSave();
  }

  // Event Listeners
  noteContentInput.addEventListener('input', () => {
    updatePreview();
    updateWordCount();
    triggerAutoSave();
  });

  noteTitleInput.addEventListener('input', triggerAutoSave);
  btnNewNote.addEventListener('click', createNewNote);
  noteSearch.addEventListener('input', (e) => renderNotesSidebar(e.target.value));

  btnDeleteNote.addEventListener('click', async () => {
    if (!currentNoteFile) return;
    if (confirm('Delete this note?')) {
      await EndroidAPI.fs.delete(currentNoteFile);
      currentNoteFile = null;
      await loadNotesList();
    }
  });

  btnTogglePreview.addEventListener('click', () => {
    isPreviewVisible = !isPreviewVisible;
    notePreview.style.display = isPreviewVisible ? 'block' : 'none';
    btnTogglePreview.classList.toggle('active', isPreviewVisible);
  });

  document.getElementById('btn-bold').addEventListener('click', () => insertFormat('**', '**'));
  document.getElementById('btn-italic').addEventListener('click', () => insertFormat('*', '*'));
  document.getElementById('btn-heading').addEventListener('click', () => insertFormat('## ', ''));
  document.getElementById('btn-list').addEventListener('click', () => insertFormat('- ', ''));
  document.getElementById('btn-code').addEventListener('click', () => insertFormat('```\n', '\n```'));

  await loadNotesList();
  EndroidIcons.render();
});
