(() => {
  const ROOT_ID = 'rfc-root';

  function iconSparkle() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="rfcFloatGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5aa6ff"/><stop offset="55%" stop-color="#8b7bff"/><stop offset="100%" stop-color="#8fe1ff"/></linearGradient></defs><path d="M12 2.8l2.05 5.15L19.2 10l-5.15 2.05L12 17.2l-2.05-5.15L4.8 10l5.15-2.05L12 2.8z" fill="url(#rfcFloatGem)"/><circle cx="18.2" cy="5.2" r="1.25" fill="#8b7bff"/><circle cx="6.1" cy="17.9" r="1.15" fill="#5aa6ff"/></svg>';
  }

  function iconPanel() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 5.5v13" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.5 10.2 15.8 12l-3.3 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    return root;
  }

  function ensureFloatingButton() {
    const root = ensureRoot();
    let wrap = root.querySelector('.rfc-floating-wrap');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'rfc-floating-wrap';
    wrap.innerHTML = `
      <div class="rfc-floating-menu" role="menu" aria-label="Quick actions">
        <button type="button" class="rfc-floating-action" data-action="inspect" role="menuitem">
          <span class="rfc-header-action-icon">${iconSparkle()}</span><span>영역 분석</span>
        </button>
        <button type="button" class="rfc-floating-action" data-action="open-panel" role="menuitem">
          <span class="rfc-header-action-icon">${iconPanel()}</span><span>패널 열기</span>
        </button>
      </div>
      <button type="button" class="rfc-floating-entry" aria-label="Quick tools" title="Quick tools">
        <span class="rfc-header-action-icon">${iconSparkle()}</span>
      </button>
    `;
    wrap.querySelector('.rfc-floating-entry').addEventListener('click', () => {
      wrap.classList.toggle('is-open');
    });
    wrap.querySelector('[data-action="inspect"]').addEventListener('click', () => {
      wrap.classList.remove('is-open');
      window.dispatchEvent(new CustomEvent('rfc:enter-inspect-mode'));
    });
    wrap.querySelector('[data-action="open-panel"]').addEventListener('click', () => {
      wrap.classList.remove('is-open');
      window.dispatchEvent(new CustomEvent('rfc:open-sidebar-panel'));
    });
    wrap.addEventListener('mouseleave', () => wrap.classList.remove('is-open'));
    root.appendChild(wrap);
    return wrap;
  }

  function clearToolbar() {
    const toolbar = ensureRoot().querySelector('.rfc-toolbar');
    if (toolbar) toolbar.remove();
  }

  function clearOverlay() {
    const root = ensureRoot();
    root.querySelector('.rfc-overlay')?.remove();
    root.querySelector('.rfc-selection-popover')?.remove();
  }

  function clearInspectorHint() {
    ensureRoot().querySelector('.rfc-inspector-hint')?.remove();
  }

  function renderInspectorHint() {
    clearInspectorHint();
    const hint = document.createElement('div');
    hint.className = 'rfc-inspector-hint';
    hint.innerHTML = '<strong>영역 분석 모드</strong><span>본문의 HTML 영역을 클릭하면 교정 결과를 우측 패널과 원문에 함께 표시합니다.</span>';
    ensureRoot().appendChild(hint);
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
    toolbar.style.top = `${window.scrollY + rect.top - 52}px`;
    toolbar.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;
    return toolbar;
  }

  function renderSelectionPopover(rect, payload) {
    const root = ensureRoot();
    root.querySelector('.rfc-selection-popover')?.remove();
    const popover = document.createElement('div');
    popover.className = 'rfc-selection-popover';
    popover.style.top = `${window.scrollY + rect.bottom + 12}px`;
    popover.style.left = `${Math.max(16, window.scrollX + rect.left)}px`;
    popover.innerHTML = `
      <div class="rfc-popover-card">
        <div class="rfc-popover-header">
          <strong>빠른 메모</strong>
          <button type="button" class="rfc-popover-close" aria-label="Close popover">×</button>
        </div>
        <div class="rfc-popover-source">${escapeHtml(payload.sourceText || '')}</div>
        <div class="rfc-popover-translation">
          <label>번역</label>
          <p data-role="quick-translation">${escapeHtml(payload.translation || '번역 불러오는 중...')}</p>
        </div>
        <label class="rfc-popover-label" for="rfc-popover-note">메모</label>
        <textarea id="rfc-popover-note" class="rfc-popover-note" rows="4" placeholder="이 표현을 어떻게 기억할지 적어보세요."></textarea>
        <div class="rfc-popover-actions">
          <button type="button" data-role="save-quick-note">메모 저장</button>
          <button type="button" data-role="close-quick-note">닫기</button>
        </div>
      </div>
    `;

    popover.querySelector('.rfc-popover-close').addEventListener('click', () => popover.remove());
    popover.querySelector('[data-role="close-quick-note"]').addEventListener('click', () => popover.remove());
    popover.querySelector('[data-role="save-quick-note"]').addEventListener('click', () => {
      const note = popover.querySelector('.rfc-popover-note').value.trim();
      const translation = popover.querySelector('[data-role="quick-translation"]').textContent.trim();
      window.dispatchEvent(new CustomEvent('rfc:save-quick-memo', {
        detail: {
          text: payload.sourceText || '',
          translation,
          note
        }
      }));
      popover.remove();
    });

    root.appendChild(popover);
  }

  function updateSelectionPopoverTranslation(translation) {
    const node = ensureRoot().querySelector('[data-role="quick-translation"]');
    if (node) node.textContent = translation || '';
  }

  function escapeHtml(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function setFloatingEntryVisibility(isVisible) {
    const wrap = ensureFloatingButton();
    wrap.classList.toggle('is-hidden', !isVisible);
    if (!isVisible) wrap.classList.remove('is-open');
  }

  ensureFloatingButton();

  window.ReadingFlowRenderer = {
    ensureRoot,
    ensureFloatingButton,
    setFloatingEntryVisibility,
    renderToolbar,
    clearToolbar,
    clearOverlay,
    renderInspectorHint,
    clearInspectorHint,
    renderSelectionPopover,
    updateSelectionPopoverTranslation
  };
})();
