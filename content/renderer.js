(() => {
  const ROOT_ID = 'rfc-root';
  const MODE_LABELS = {
    flow: '흐름 교정',
    chunk: '의미 덩어리',
    structure: '구조 강조',
    simplify: '간소화 보기',
    compare: '원문 비교'
  };

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    return root;
  }

  function clearOverlay() {
    const root = ensureRoot();
    const overlay = root.querySelector('.rfc-overlay');
    if (overlay) overlay.remove();
  }

  function clearInspectorHint() {
    const root = ensureRoot();
    const hint = root.querySelector('.rfc-inspector-hint');
    if (hint) hint.remove();
  }

  function renderInspectorHint() {
    clearInspectorHint();
    const root = ensureRoot();
    const hint = document.createElement('div');
    hint.className = 'rfc-inspector-hint';
    hint.innerHTML = '<strong>영역 분석 모드</strong><span>본문의 HTML 영역을 클릭하면 5가지 교정 기능을 적용합니다.</span>';
    root.appendChild(hint);
  }

  function renderModeContent(analysis) {
    const payload = analysis.modePayload || {};
    if (payload.contentType === 'lines') {
      return `<div class="rfc-lines">${(payload.lines || []).map(line => `<div class="rfc-line"><span>${escapeHtml(line.label)}</span><p>${escapeHtml(line.text)}</p></div>`).join('')}</div>`;
    }
    if (payload.contentType === 'text') {
      return `<div class="rfc-simple">${escapeHtml(payload.text || '')}</div>`;
    }
    if (payload.contentType === 'compare') {
      return `
        <div class="rfc-compare-grid">
          <div><strong>원문</strong><p>${escapeHtml(payload.compare?.original || '')}</p></div>
          <div><strong>교정형</strong><p>${escapeHtml(payload.compare?.corrected || '')}</p></div>
        </div>
      `;
    }
    return `<div class="rfc-chip-row">${(payload.chips || analysis.chunks || []).map((chunk, idx) => `<span class="rfc-chip rfc-chip-${analysis.segments[idx]?.role || 'support'}">${escapeHtml(chunk)}</span>`).join('')}</div>`;
  }

  function renderOverlay(rect, analysis, meta = {}) {
    clearOverlay();
    clearInspectorHint();
    const root = ensureRoot();
    const overlay = document.createElement('div');
    overlay.className = 'rfc-overlay';
    overlay.style.top = `${window.scrollY + rect.bottom + 10}px`;
    overlay.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;

    const modes = analysis.supportedModes || ['flow', 'chunk', 'structure', 'simplify', 'compare'];
    const tabs = modes.map(mode => `<button class="rfc-mode-tab ${mode === analysis.mode ? 'is-active' : ''}" data-mode="${mode}" type="button">${MODE_LABELS[mode]}</button>`).join('');

    overlay.innerHTML = `
      <div class="rfc-card">
        <div class="rfc-card-header">
          <div>
            <strong>${escapeHtml(analysis.modePayload?.title || 'Reading Flow')}</strong>
            <p class="rfc-summary">${escapeHtml(analysis.modePayload?.summary || '')}</p>
          </div>
          <button class="rfc-close" type="button" aria-label="Close overlay">×</button>
        </div>
        <div class="rfc-mode-tabs">${tabs}</div>
        ${renderModeContent(analysis)}
        <p class="rfc-translation">${escapeHtml(analysis.translation || '')}</p>
        <ul class="rfc-tips">${(analysis.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>
    `;

    overlay.querySelector('.rfc-close').addEventListener('click', clearOverlay);
    overlay.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('rfc:mode-change', {
          detail: { mode: button.dataset.mode, source: meta.source || 'selection' }
        }));
      });
    });

    root.appendChild(overlay);
  }

  function renderToolbar(rect) {
    const root = ensureRoot();
    let toolbar = root.querySelector('.rfc-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'rfc-toolbar';
      toolbar.innerHTML = `
        <button data-action="flow" type="button">흐름 교정</button>
        <button data-action="chunk" type="button">의미 덩어리</button>
        <button data-action="save" type="button">메모 저장</button>
        <button data-action="inspect" type="button">영역 분석</button>
        <button data-action="sidebar" type="button">패널</button>
      `;
      root.appendChild(toolbar);
    }
    toolbar.style.top = `${window.scrollY + rect.top - 46}px`;
    toolbar.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;
    return toolbar;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.ReadingFlowRenderer = {
    ensureRoot,
    renderToolbar,
    renderOverlay,
    renderInspectorHint,
    clearInspectorHint,
    clearOverlay,
    clearToolbar() {
      const root = ensureRoot();
      const toolbar = root.querySelector('.rfc-toolbar');
      if (toolbar) toolbar.remove();
    }
  };
})();
