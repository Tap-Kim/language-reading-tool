(() => {
  let currentSelection = null;
  let inspectMode = false;
  let lastAnalysisSource = 'selection';
  let activeHtmlTarget = null;

  function isEnglishDominant(text) {
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    return letters >= Math.max(10, text.length * 0.35);
  }

  function getSelectionText() {
    return window.getSelection()?.toString().trim() || '';
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    return selection.getRangeAt(0).getBoundingClientRect();
  }

  function isIgnoredElement(node) {
    return !!node.closest('#rfc-root, #rfc-sidebar-panel, input, textarea, select, button, code, pre');
  }

  function buildMemoItem(text, analysis) {
    const normalized = text.trim();
    const wordLike = normalized.split(/\s+/).length <= 3;
    return {
      id: crypto.randomUUID(),
      type: wordLike ? 'word' : 'sentence',
      sourceText: normalized,
      translation: analysis.translation,
      note: '',
      context: '',
      glossary: analysis.glossary || [],
      url: location.href,
      title: document.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folded: false,
      saveCount: 1
    };
  }

  function analyze(mode = 'flow') {
    if (!currentSelection?.text) return null;
    return window.ReadingFlowChunker.analyze(currentSelection.text, mode);
  }

  function showAnalysis(mode = 'flow') {
    const analysis = analyze(mode);
    if (!analysis || !currentSelection?.rect) return;
    window.ReadingFlowRenderer.renderOverlay(currentSelection.rect, analysis, { source: lastAnalysisSource });
  }

  async function saveSelectionToMemo() {
    if (!currentSelection?.text) return;
    const analysis = analyze('flow');
    const item = buildMemoItem(currentSelection.text, analysis);
    await window.ReadingFlowSidebar.addMemoItem(item);
    window.ReadingFlowRenderer.renderOverlay(currentSelection.rect, analysis, { source: lastAnalysisSource });
  }

  function enterInspectMode() {
    inspectMode = true;
    window.ReadingFlowRenderer.renderInspectorHint();
    window.ReadingFlowRenderer.clearToolbar();
  }

  function exitInspectMode() {
    inspectMode = false;
    window.ReadingFlowRenderer.clearInspectorHint();
  }

  function activateHtmlTarget(target) {
    if (!target || isIgnoredElement(target)) return;
    const text = (target.innerText || target.textContent || '').trim();
    if (!text || text.length < 20 || !isEnglishDominant(text)) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    activeHtmlTarget = target;
    lastAnalysisSource = 'html';
    currentSelection = { text, rect };
    showAnalysis('flow');
    exitInspectMode();
  }

  function onToolbarClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === 'sidebar') {
      window.ReadingFlowSidebar.togglePanel();
      return;
    }
    if (action === 'save') {
      saveSelectionToMemo();
      return;
    }
    if (action === 'inspect') {
      enterInspectMode();
      return;
    }
    showAnalysis(action);
  }

  function handleSelection() {
    const text = getSelectionText();
    if (!text || text.length < 3 || !isEnglishDominant(text)) {
      currentSelection = null;
      window.ReadingFlowRenderer.clearToolbar();
      return;
    }

    const rect = getSelectionRect();
    if (!rect || !rect.width) return;

    lastAnalysisSource = 'selection';
    currentSelection = { text, rect };
    const toolbar = window.ReadingFlowRenderer.renderToolbar(rect);
    toolbar.onclick = onToolbarClick;
  }

  document.addEventListener('mouseup', () => {
    setTimeout(handleSelection, 10);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (inspectMode) {
      event.preventDefault();
      event.stopPropagation();
      activateHtmlTarget(target.closest('p, li, blockquote, article, section, div, h1, h2, h3') || target);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      exitInspectMode();
      window.ReadingFlowRenderer.clearOverlay();
      window.ReadingFlowRenderer.clearToolbar();
    }
  });

  window.addEventListener('rfc:mode-change', (event) => {
    const mode = event.detail?.mode || 'flow';
    if (!currentSelection?.text) return;
    if (event.detail?.source === 'html' && activeHtmlTarget) {
      currentSelection = {
        text: (activeHtmlTarget.innerText || activeHtmlTarget.textContent || '').trim(),
        rect: activeHtmlTarget.getBoundingClientRect()
      };
    }
    showAnalysis(mode);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RFC_TOGGLE_SIDEBAR') {
      window.ReadingFlowSidebar.togglePanel();
    }
    if (message.type === 'RFC_SAVE_CURRENT_SELECTION') {
      handleSelection();
      saveSelectionToMemo();
    }
    if (message.type === 'RFC_CONTEXT_SAVE_SELECTION') {
      const text = (message.payload?.text || '').trim();
      if (!text) return;
      lastAnalysisSource = 'selection';
      currentSelection = { text, rect: getSelectionRect() || new DOMRect(24, 24, 320, 20) };
      saveSelectionToMemo();
    }
  });

  window.ReadingFlowSidebar.ensurePanel();
})();
