(() => {
  let currentSelection = null;

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

  async function saveSelectionToMemo() {
    if (!currentSelection?.text) return;
    const analysis = analyze('flow');
    const item = buildMemoItem(currentSelection.text, analysis);
    await window.ReadingFlowSidebar.addMemoItem(item);
    window.ReadingFlowRenderer.renderOverlay(currentSelection.rect, analysis);
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
    const analysis = analyze(action);
    if (!analysis) return;
    window.ReadingFlowRenderer.renderOverlay(currentSelection.rect, analysis);
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

    currentSelection = { text, rect };
    const toolbar = window.ReadingFlowRenderer.renderToolbar(rect);
    toolbar.onclick = onToolbarClick;
  }

  document.addEventListener('mouseup', () => {
    setTimeout(handleSelection, 10);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.ReadingFlowRenderer.clearOverlay();
      window.ReadingFlowRenderer.clearToolbar();
    }
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
      currentSelection = { text, rect: getSelectionRect() || new DOMRect(24, 24, 320, 20) };
      saveSelectionToMemo();
    }
  });

  window.ReadingFlowSidebar.ensurePanel();
})();
