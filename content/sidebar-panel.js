(() => {
  const STORAGE_KEY = 'rfcMemoItems';
  const PANEL_ID = 'rfc-sidebar-panel';

  async function getItems() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
  }

  async function saveItems(items) {
    await chrome.storage.local.set({ [STORAGE_KEY]: items });
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
          <strong>Reading Memo</strong>
          <div class="rfc-sidebar-actions">
            <button type="button" data-role="collapse-all">접기</button>
            <button type="button" data-role="expand-all">펼치기</button>
          </div>
        </header>
        <div class="rfc-sidebar-list"></div>
      </div>
    `;

    document.documentElement.appendChild(panel);

    panel.querySelector('[data-role="toggle-sidebar"]').addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
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

    return panel;
  }

  async function addMemoItem(item) {
    const items = await getItems();
    const existing = items.find(entry => entry.sourceText === item.sourceText && entry.type === item.type);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      existing.saveCount = (existing.saveCount || 1) + 1;
      if (item.translation) existing.translation = item.translation;
      if (item.note) existing.note = item.note;
    } else {
      items.unshift(item);
    }
    await saveItems(items);
    renderItems(items);
    openPanel();
  }

  function openPanel() {
    const panel = ensurePanel();
    panel.classList.remove('is-collapsed');
  }

  function togglePanel() {
    const panel = ensurePanel();
    panel.classList.toggle('is-collapsed');
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

  function renderItems(items) {
    const panel = ensurePanel();
    const list = panel.querySelector('.rfc-sidebar-list');

    if (!items.length) {
      list.innerHTML = `
        <div class="rfc-empty-state">
          <p>모르는 단어나 문장을 저장하면 여기에 쌓입니다.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => `
      <article class="rfc-memo-card ${item.folded ? 'is-folded' : ''}">
        <button class="rfc-memo-summary" data-role="toggle-fold" data-id="${item.id}" type="button">
          <span class="rfc-memo-type">${item.type}</span>
          <span class="rfc-memo-text">${escapeHtml(item.sourceText)}</span>
        </button>
        <div class="rfc-memo-body">
          <p><strong>해석</strong><br>${escapeHtml(item.translation || '해석 없음')}</p>
          <p><strong>메모</strong><br>${escapeHtml(item.note || '직접 메모를 추가해 보세요.')}</p>
          <p><strong>저장 횟수</strong> ${item.saveCount || 1}</p>
          <div class="rfc-memo-actions">
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
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  chrome.storage.local.get(STORAGE_KEY).then(data => renderItems(data[STORAGE_KEY] || []));

  window.ReadingFlowSidebar = {
    ensurePanel,
    renderItems,
    addMemoItem,
    getItems,
    togglePanel,
    openPanel
  };
})();
