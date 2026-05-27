(() => {
  const STORAGE_KEY = 'rfcMemoItems';
  const PANEL_ID = 'rfc-sidebar-panel';
  const UI_KEY = 'rfcSidebarUi';
  const AUTO_OPEN_KEY = 'rfcAutoOpenSidebar';

  const uiState = {
    query: '',
    type: 'all'
  };

  async function getItems() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
  }

  async function saveItems(items) {
    await chrome.storage.local.set({ [STORAGE_KEY]: items });
  }

  async function getUiState() {
    const data = await chrome.storage.local.get(UI_KEY);
    return data[UI_KEY] || {};
  }

  async function saveUiState(partial) {
    const current = await getUiState();
    const next = { ...current, ...partial };
    await chrome.storage.local.set({ [UI_KEY]: next });
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = 'rfc-sidebar is-collapsed';
    panel.innerHTML = `
      <div class="rfc-sidebar-handle">
        <button type="button" data-role="toggle-sidebar" aria-label="Toggle memo sidebar">📚</button>
      </div>
      <div class="rfc-sidebar-shell">
        <header class="rfc-sidebar-header">
          <div>
            <strong>Reading Memo</strong>
            <p class="rfc-sidebar-subtitle">단어와 문장 해석을 저장하고 다시 봅니다.</p>
          </div>
          <div class="rfc-sidebar-actions">
            <button type="button" data-role="collapse-all">접기</button>
            <button type="button" data-role="expand-all">펼치기</button>
          </div>
        </header>
        <div class="rfc-sidebar-controls">
          <input type="search" class="rfc-search" data-role="search" placeholder="단어, 문장, 메모 검색" />
          <div class="rfc-filter-group">
            <button type="button" data-role="filter" data-type="all" class="is-active">전체</button>
            <button type="button" data-role="filter" data-type="word">단어</button>
            <button type="button" data-role="filter" data-type="sentence">문장</button>
          </div>
        </div>
        <div class="rfc-sidebar-list"></div>
      </div>
    `;

    document.documentElement.appendChild(panel);

    panel.querySelector('[data-role="toggle-sidebar"]').addEventListener('click', async () => {
      panel.classList.toggle('is-collapsed');
      await saveUiState({ collapsed: panel.classList.contains('is-collapsed') });
    });

    panel.querySelector('[data-role="collapse-all"]').addEventListener('click', async () => {
      const items = (await getItems()).map(item => ({ ...item, folded: true }));
      await saveItems(items);
      renderItems(items);
    });

    panel.querySelector('[data-role="expand-all"]').addEventListener('click', async () => {
      const items = (await getItems()).map(item => ({ ...item, folded: false }));
      await saveItems(items);
      renderItems(items);
    });

    panel.querySelector('[data-role="search"]').addEventListener('input', (event) => {
      uiState.query = event.target.value.trim().toLowerCase();
      refresh();
    });

    panel.querySelectorAll('[data-role="filter"]').forEach(button => {
      button.addEventListener('click', () => {
        uiState.type = button.dataset.type || 'all';
        panel.querySelectorAll('[data-role="filter"]').forEach(node => node.classList.toggle('is-active', node === button));
        refresh();
      });
    });

    return panel;
  }

  async function maybeAutoOpenPanel() {
    const data = await chrome.storage.local.get(AUTO_OPEN_KEY);
    if (data[AUTO_OPEN_KEY]) openPanel();
  }

  async function addMemoItem(item) {
    const items = await getItems();
    const existing = items.find(entry => entry.sourceText === item.sourceText && entry.type === item.type);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      existing.saveCount = (existing.saveCount || 1) + 1;
      if (item.translation) existing.translation = item.translation;
      if (item.note) existing.note = item.note;
      if (item.glossary?.length) existing.glossary = item.glossary;
    } else {
      items.unshift(item);
    }
    await saveItems(items);
    renderItems(items);
    await maybeAutoOpenPanel();
  }

  function openPanel() {
    const panel = ensurePanel();
    panel.classList.remove('is-collapsed');
    saveUiState({ collapsed: false });
  }

  function togglePanel() {
    const panel = ensurePanel();
    panel.classList.toggle('is-collapsed');
    saveUiState({ collapsed: panel.classList.contains('is-collapsed') });
  }

  async function toggleFold(id) {
    const items = await getItems();
    const next = items.map(item => item.id === id ? { ...item, folded: !item.folded } : item);
    await saveItems(next);
    renderItems(next);
  }

  async function removeItem(id) {
    const items = await getItems();
    const next = items.filter(item => item.id !== id);
    await saveItems(next);
    renderItems(next);
  }

  async function updateItem(id, patch) {
    const items = await getItems();
    const next = items.map(item => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
    await saveItems(next);
    renderItems(next);
  }

  function filterItems(items) {
    return items.filter(item => {
      const typeOk = uiState.type === 'all' || item.type === uiState.type;
      if (!typeOk) return false;
      if (!uiState.query) return true;
      const haystack = [item.sourceText, item.translation, item.note, (item.glossary || []).map(g => `${g.term} ${g.meaning}`).join(' ')].join(' ').toLowerCase();
      return haystack.includes(uiState.query);
    });
  }

  function renderGlossary(glossary = []) {
    if (!glossary.length) return '';
    return `
      <div class="rfc-glossary">
        <strong>핵심 단어</strong>
        <ul>${glossary.map(item => `<li><span>${escapeHtml(item.term)}</span><em>${escapeHtml(item.meaning || '뜻 메모 필요')}</em></li>`).join('')}</ul>
      </div>
    `;
  }

  function renderItems(items) {
    const panel = ensurePanel();
    const list = panel.querySelector('.rfc-sidebar-list');
    const filtered = filterItems(items);

    if (!filtered.length) {
      list.innerHTML = `
        <div class="rfc-empty-state">
          <p>조건에 맞는 메모가 없습니다.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(item => `
      <article class="rfc-memo-card ${item.folded ? 'is-folded' : ''}">
        <button class="rfc-memo-summary" data-role="toggle-fold" data-id="${item.id}" type="button">
          <span class="rfc-memo-topline">
            <span class="rfc-memo-type">${item.type}</span>
            <span class="rfc-memo-count">저장 ${item.saveCount || 1}회</span>
          </span>
          <span class="rfc-memo-text">${escapeHtml(item.sourceText)}</span>
        </button>
        <div class="rfc-memo-body">
          <label class="rfc-field-label">해석</label>
          <textarea class="rfc-field-input" data-role="translation" data-id="${item.id}" rows="3">${escapeHtml(item.translation || '')}</textarea>
          <label class="rfc-field-label">메모</label>
          <textarea class="rfc-field-input" data-role="note" data-id="${item.id}" rows="3">${escapeHtml(item.note || '')}</textarea>
          ${renderGlossary(item.glossary)}
          <div class="rfc-memo-actions">
            <button data-role="save-edit" data-id="${item.id}" type="button">저장</button>
            <button data-role="toggle-fold" data-id="${item.id}" type="button">${item.folded ? '펼치기' : '접기'}</button>
            <button data-role="remove" data-id="${item.id}" type="button">삭제</button>
          </div>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-role="toggle-fold"]').forEach(button => {
      button.addEventListener('click', () => toggleFold(button.dataset.id));
    });

    list.querySelectorAll('[data-role="remove"]').forEach(button => {
      button.addEventListener('click', () => removeItem(button.dataset.id));
    });

    list.querySelectorAll('[data-role="save-edit"]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.id;
        const card = button.closest('.rfc-memo-card');
        const translation = card.querySelector('[data-role="translation"]').value.trim();
        const note = card.querySelector('[data-role="note"]').value.trim();
        await updateItem(id, { translation, note });
      });
    });
  }

  async function refresh() {
    const items = await getItems();
    renderItems(items);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function bootstrap() {
    const panel = ensurePanel();
    const ui = await getUiState();
    if (ui.collapsed === false) panel.classList.remove('is-collapsed');
    const items = await getItems();
    renderItems(items);
  }

  bootstrap();

  window.ReadingFlowSidebar = {
    ensurePanel,
    renderItems,
    addMemoItem,
    getItems,
    togglePanel,
    openPanel,
    refresh
  };
})();
