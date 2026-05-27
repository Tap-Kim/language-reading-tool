(() => {
  const ROOT_ID = 'rfc-root';

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

  function renderOverlay(rect, analysis) {
    clearOverlay();
    const root = ensureRoot();
    const overlay = document.createElement('div');
    overlay.className = 'rfc-overlay';
    overlay.style.top = `${window.scrollY + rect.bottom + 10}px`;
    overlay.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;

    const chips = analysis.chunks
      .map((chunk, idx) => `<span class="rfc-chip rfc-chip-${analysis.segments[idx]?.role || 'support'}">${escapeHtml(chunk)}</span>`)
      .join('');

    overlay.innerHTML = `
      <div class="rfc-card">
        <div class="rfc-card-header">
          <strong>Reading Flow</strong>
          <button class="rfc-close" type="button" aria-label="Close overlay">×</button>
        </div>
        <div class="rfc-chip-row">${chips}</div>
        <p class="rfc-translation">${escapeHtml(analysis.translation || '')}</p>
        <ul class="rfc-tips">${(analysis.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>
    `;

    overlay.querySelector('.rfc-close').addEventListener('click', clearOverlay);
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
        <button data-action="sidebar" type="button">패널</button>
      `;
      root.appendChild(toolbar);
    }
    toolbar.style.top = `${window.scrollY + rect.top - 46}px`;
    toolbar.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;
    return toolbar;
  }

  function escapeHtml(value) {
    return String(value)
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
    clearOverlay,
    clearToolbar() {
      const root = ensureRoot();
      const toolbar = root.querySelector('.rfc-toolbar');
      if (toolbar) toolbar.remove();
    }
  };
})();
