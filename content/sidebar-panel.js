(() => {
  const STORAGE_KEY = 'rfcMemoItems';
  const PANEL_ID = 'rfc-sidebar-panel';
  const UI_KEY = 'rfcSidebarUi';
  const AUTO_OPEN_KEY = 'rfcAutoOpenSidebar';

  const uiState = {
    query: '',
    type: 'all',
    sections: {
      selection: false,
      analysis: false,
      memo: false
    }
  };

  const MODE_LABELS = {
    flow: '흐름 교정',
    chunk: '의미 덩어리',
    structure: '구조 강조',
    simplify: '간소화 보기',
    compare: '원문 비교'
  };

  function iconChevronUp() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconChevronDown() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconSparkle() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="rfcGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5aa6ff"/><stop offset="55%" stop-color="#8b7bff"/><stop offset="100%" stop-color="#8fe1ff"/></linearGradient></defs><path d="M12 2.8l2.05 5.15L19.2 10l-5.15 2.05L12 17.2l-2.05-5.15L4.8 10l5.15-2.05L12 2.8z" fill="url(#rfcGem)"/><circle cx="18.2" cy="5.2" r="1.25" fill="#8b7bff"/><circle cx="6.1" cy="17.9" r="1.15" fill="#5aa6ff"/></svg>';
  }


  function iconSave() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5 10 16.5 18 8.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconFold() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconExpand() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 14l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

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

  function consumeScroll(node) {
    return (event) => {
      if (!node || node.scrollHeight <= node.clientHeight + 2) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      node.scrollTop += event.deltaY;
    };
  }

  function bindScrollable(node) {
    if (!node || node.dataset.rfcScrollBound === 'true') return;
    node.dataset.rfcScrollBound = 'true';
    const handler = consumeScroll(node);
    node.addEventListener('wheel', handler, { passive: false, capture: true });
    node.addEventListener('mousewheel', handler, { passive: false, capture: true });
    node.addEventListener('DOMMouseScroll', handler, { passive: false, capture: true });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function syncFloatingButton(panel) {
    window.ReadingFlowRenderer?.setFloatingEntryVisibility(panel.classList.contains('is-collapsed'));
  }

  async function setPanelCollapsed(panel, collapsed) {
    panel.classList.toggle('is-collapsed', collapsed);
    await saveUiState({ collapsed });
    syncFloatingButton(panel);
  }

  function sectionHeader(title, key, extra = '') {
    return `
      <button type="button" class="rfc-section-toggle" data-role="toggle-section" data-section="${key}" aria-expanded="${uiState.sections[key] ? 'false' : 'true'}">
        <span>${title}</span>
        <span class="rfc-section-toggle-icons">${extra}<span class="rfc-icon-inline">${uiState.sections[key] ? iconChevronDown() : iconChevronUp()}</span></span>
      </button>
    `;
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = 'rfc-sidebar is-collapsed';
    panel.innerHTML = `
      <div class="rfc-sidebar-shell">
        <header class="rfc-sidebar-header">
          <div>
            <strong>Reading Memo</strong>
            <p class="rfc-sidebar-subtitle">단어와 문장 해석을 저장하고 다시 봅니다.</p>
          </div>
          <div class="rfc-sidebar-actions">
            <button type="button" class="rfc-header-action" data-role="enter-inspect-mode"><span class="rfc-header-action-icon">${iconSparkle()}</span><span>영역 분석</span></button>
            <button type="button" class="rfc-selection-close rfc-panel-close" data-role="toggle-sidebar" aria-label="패널 닫기">×</button>
          </div>
        </header>
        <div class="rfc-sidebar-body" data-role="sidebar-body">
          <section class="rfc-section rfc-section-selection is-hidden" data-section-root="selection">
            ${sectionHeader('드래그 선택', 'selection')}
            <div class="rfc-section-content"><div class="rfc-selection-draft" data-role="selection-draft"></div></div>
          </section>
          <section class="rfc-section rfc-section-analysis" data-section-root="analysis">
            ${sectionHeader('선택 영역 분석', 'analysis')}
            <div class="rfc-section-content"><div class="rfc-analysis-panel" data-role="analysis-panel"><div class="rfc-analysis-empty">선택한 영역의 교정 결과가 여기에 표시됩니다.</div></div></div>
          </section>
          <section class="rfc-section rfc-section-memo" data-section-root="memo">
            ${sectionHeader('메모 보관함', 'memo')}
            <div class="rfc-section-content">
              <div class="rfc-memo-controls-wrap">
                <div class="rfc-sidebar-controls">
                  <input type="search" class="rfc-search" data-role="search" placeholder="단어, 문장, 메모 검색" />
                  <div class="rfc-filter-group">
                    <button type="button" data-role="filter" data-type="all" class="is-active">전체</button>
                    <button type="button" data-role="filter" data-type="word">단어</button>
                    <button type="button" data-role="filter" data-type="sentence">문장</button>
                  </div>
                </div>
              </div>
              <div class="rfc-sidebar-list"></div>
            </div>
          </section>
        </div>
      </div>
    `;

    document.documentElement.appendChild(panel);
    bindScrollable(panel.querySelector('[data-role="sidebar-body"]'));

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      if (button.dataset.role === 'toggle-sidebar') {
        await setPanelCollapsed(panel, !panel.classList.contains('is-collapsed'));
        return;
      }

      if (button.dataset.role === 'enter-inspect-mode') {
        window.dispatchEvent(new CustomEvent('rfc:enter-inspect-mode'));
        return;
      }

      if (button.dataset.role === 'toggle-section') {
        const key = button.dataset.section;
        uiState.sections[key] = !uiState.sections[key];
        await saveUiState({ sections: uiState.sections });
        applySectionState();
        return;
      }

      if (button.dataset.role === 'analysis-mode') {
        window.dispatchEvent(new CustomEvent('rfc:mode-change', {
          detail: { mode: button.dataset.mode, source: button.dataset.source || 'selection', target: 'sidebar' }
        }));
        return;
      }

      if (button.dataset.role === 'restore-original') {
        window.dispatchEvent(new CustomEvent('rfc:restore-original-content'));
        return;
      }

      if (button.dataset.role === 'save-selection-draft') {
        window.dispatchEvent(new CustomEvent('rfc:save-selection-draft'));
        return;
      }

      if (button.dataset.role === 'dismiss-selection-draft') {
        window.dispatchEvent(new CustomEvent('rfc:dismiss-selection-draft'));
      }
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

    syncFloatingButton(panel);
    return panel;
  }

  function applySectionState() {
    const panel = ensurePanel();
    panel.querySelectorAll('[data-section-root]').forEach(section => {
      const key = section.dataset.sectionRoot;
      section.classList.toggle('is-collapsed', !!uiState.sections[key]);
      const toggle = section.querySelector('[data-role="toggle-section"]');
      if (toggle) toggle.setAttribute('aria-expanded', uiState.sections[key] ? 'false' : 'true');
      const icon = toggle?.querySelector('.rfc-icon-inline');
      if (icon) icon.innerHTML = uiState.sections[key] ? iconChevronDown() : iconChevronUp();
    });
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
    setPanelCollapsed(panel, false);
  }

  function togglePanel() {
    const panel = ensurePanel();
    setPanelCollapsed(panel, !panel.classList.contains('is-collapsed'));
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

  function renderModeContent(analysis) {
    const payload = analysis?.modePayload || {};
    if (payload.contentType === 'lines') {
      return `<div class="rfc-analysis-lines">${(payload.lines || []).map(line => `<div class="rfc-analysis-line"><span>${escapeHtml(line.label)}</span><p>${escapeHtml(line.text)}</p></div>`).join('')}</div>`;
    }
    if (payload.contentType === 'text') {
      return `<div class="rfc-analysis-simple">${escapeHtml(payload.text || '')}</div>`;
    }
    if (payload.contentType === 'compare') {
      return `
        <div class="rfc-analysis-compare">
          <div><strong>원문</strong><p>${escapeHtml(payload.compare?.original || '')}</p></div>
          <div><strong>교정형</strong><p>${escapeHtml(payload.compare?.corrected || '')}</p></div>
        </div>
      `;
    }
    return `<div class="rfc-analysis-chips">${(payload.chips || analysis?.chunks || []).map(chunk => `<span class="rfc-analysis-chip">${escapeHtml(chunk)}</span>`).join('')}</div>`;
  }

  function renderActiveAnalysis(analysis, meta = {}) {
    const panel = ensurePanel();
    const box = panel.querySelector('[data-role="analysis-panel"]');
    const modes = (analysis?.supportedModes || ['flow', 'chunk', 'structure', 'simplify', 'compare'])
      .map(mode => `<button type="button" class="rfc-analysis-tab ${mode === analysis.mode ? 'is-active' : ''}" data-role="analysis-mode" data-source="${escapeHtml(meta.source || 'selection')}" data-mode="${mode}">${MODE_LABELS[mode]}</button>`)
      .join('');
    const restoreButton = meta.source === 'html'
      ? '<button type="button" class="rfc-analysis-restore" data-role="restore-original">원본 복원</button>'
      : '';

    box.innerHTML = `
      <div class="rfc-analysis-header">
        <div>
          <strong>선택 영역 분석</strong>
          <p>${escapeHtml(meta.label || '클릭한 영역의 교정 결과')}</p>
        </div>
        ${restoreButton}
      </div>
      <div class="rfc-analysis-source">${escapeHtml(meta.sourceText || analysis?.sourceText || '')}</div>
      <div class="rfc-analysis-tabs">${modes}</div>
      <div class="rfc-analysis-body">
        <h4>${escapeHtml(analysis?.modePayload?.title || '')}</h4>
        <p class="rfc-analysis-summary">${escapeHtml(analysis?.modePayload?.summary || '')}</p>
        ${renderModeContent(analysis)}
        <div class="rfc-analysis-translation">
          <strong>번역</strong>
          <p data-role="analysis-translation">${escapeHtml(analysis?.translation || '')}</p>
        </div>
      </div>
    `;
  }

  function updateActiveTranslation(translation) {
    const panel = ensurePanel();
    const node = panel.querySelector('[data-role="analysis-translation"]');
    if (node) node.textContent = translation || '';
  }

  function renderSelectionDraft(payload = {}) {
    const panel = ensurePanel();
    const section = panel.querySelector('[data-section-root="selection"]');
    const box = panel.querySelector('[data-role="selection-draft"]');
    if (!payload.sourceText) {
      section.classList.add('is-hidden');
      box.innerHTML = '';
      return;
    }
    section.classList.remove('is-hidden');
    box.innerHTML = `
      <div class="rfc-selection-draft-header">
        <div>
          <strong>드래그 선택</strong>
          <p>선택한 단어/문장을 번역하고 메모로 저장할 수 있습니다.</p>
        </div>
        <button type="button" class="rfc-selection-close" data-role="dismiss-selection-draft" aria-label="닫기">×</button>
      </div>
      <div class="rfc-selection-draft-source">${escapeHtml(payload.sourceText || '')}</div>
      <div class="rfc-selection-draft-translation">
        <strong>번역</strong>
        <p data-role="selection-translation">${escapeHtml(payload.translation || '번역 불러오는 중...')}</p>
      </div>
      <div class="rfc-selection-draft-actions">
        <button type="button" data-role="save-selection-draft">메모 저장</button>
        <button type="button" data-role="dismiss-selection-draft">저장 안 함</button>
      </div>
    `;
  }

  function updateSelectionDraftTranslation(translation) {
    const panel = ensurePanel();
    const node = panel.querySelector('[data-role="selection-translation"]');
    if (node) node.textContent = translation || '';
  }

  function clearSelectionDraft() {
    renderSelectionDraft({});
  }

  function renderItems(items) {
    const panel = ensurePanel();
    const list = panel.querySelector('.rfc-sidebar-list');
    const filtered = filterItems(items);

    if (!filtered.length) {
      list.innerHTML = '<div class="rfc-empty-state"><p>조건에 맞는 메모가 없습니다.</p></div>';
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
        <div class="rfc-memo-corner-actions">
          <button class="rfc-memo-remove" data-role="remove" data-id="${item.id}" type="button" aria-label="메모 삭제">×</button>
        </div>
        <div class="rfc-memo-body">
          <label class="rfc-field-label">해석</label>
          <textarea class="rfc-field-input" data-role="translation" data-id="${item.id}" rows="3">${escapeHtml(item.translation || '')}</textarea>
          ${renderGlossary(item.glossary)}
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
        await updateItem(id, { translation, note: '' });
      });
    });
  }

  async function refresh() {
    const items = await getItems();
    renderItems(items);
  }

  async function bootstrap() {
    const panel = ensurePanel();
    const ui = await getUiState();
    if (ui.collapsed === false) panel.classList.remove('is-collapsed');
    uiState.sections = { ...uiState.sections, ...(ui.sections || {}) };
    syncFloatingButton(panel);
    applySectionState();
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
    refresh,
    renderActiveAnalysis,
    updateActiveTranslation,
    renderSelectionDraft,
    updateSelectionDraftTranslation,
    clearSelectionDraft
  };
})();
