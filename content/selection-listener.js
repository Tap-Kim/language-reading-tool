(() => {
  let currentSelection = null;
  let inspectMode = false;
  let lastAnalysisSource = 'selection';
  let activeHtmlTarget = null;
  let hoveredHtmlTarget = null;

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

  function getInspectableTarget(node) {
    if (!(node instanceof HTMLElement)) return null;
    const candidate = node.closest('p, li, blockquote, article, section, div, h1, h2, h3');
    if (!candidate || isIgnoredElement(candidate)) return null;
    const text = (candidate.innerText || candidate.textContent || '').trim();
    if (!text || text.length < 20 || !isEnglishDominant(text)) return null;
    const rect = candidate.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return candidate;
  }

  function setHoverTarget(target) {
    if (hoveredHtmlTarget === target) return;
    clearHoverTarget();
    hoveredHtmlTarget = target;
    if (hoveredHtmlTarget) hoveredHtmlTarget.classList.add('rfc-inspect-highlight');
  }

  function clearHoverTarget() {
    if (hoveredHtmlTarget) hoveredHtmlTarget.classList.remove('rfc-inspect-highlight');
    hoveredHtmlTarget = null;
  }

  async function requestTranslation(text) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RFC_TRANSLATE_TEXT', payload: { text } });
      return response?.ok ? response.translation : '번역을 불러오지 못했습니다.';
    } catch {
      return '번역을 불러오지 못했습니다.';
    }
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

  function renderAnalysisInSidebar(analysis) {
    window.ReadingFlowSidebar.openPanel();
    window.ReadingFlowSidebar.renderActiveAnalysis(analysis, {
      source: lastAnalysisSource,
      sourceText: currentSelection?.text || analysis?.sourceText || '',
      label: lastAnalysisSource === 'html' ? '클릭한 HTML 영역의 교정 결과' : '선택한 텍스트의 교정 결과'
    });
  }

  async function hydrateTranslation(text, apply) {
    const translation = await requestTranslation(text);
    apply(translation);
  }

  function showAnalysis(mode = 'flow') {
    const analysis = analyze(mode);
    if (!analysis) return;
    renderAnalysisInSidebar(analysis);
    if ((currentSelection?.text || '').split(/\s+/).length > 3) {
      hydrateTranslation(currentSelection.text, (translation) => {
        analysis.translation = translation;
        window.ReadingFlowSidebar.updateActiveTranslation(translation);
      });
    }
  }

  async function saveSelectionToMemo() {
    if (!currentSelection?.text) return;
    const analysis = analyze('flow');
    if ((currentSelection.text || '').split(/\s+/).length > 3) {
      analysis.translation = await requestTranslation(currentSelection.text);
    }
    const item = buildMemoItem(currentSelection.text, analysis);
    await window.ReadingFlowSidebar.addMemoItem(item);
    renderAnalysisInSidebar(analysis);
  }

  function enterInspectMode() {
    inspectMode = true;
    clearHoverTarget();
    document.body.classList.add('rfc-inspect-cursor');
    window.ReadingFlowRenderer.renderInspectorHint();
    window.ReadingFlowRenderer.clearToolbar();
  }

  function exitInspectMode() {
    inspectMode = false;
    document.body.classList.remove('rfc-inspect-cursor');
    clearHoverTarget();
    window.ReadingFlowRenderer.clearInspectorHint();
  }

  function activateHtmlTarget(target) {
    const inspectable = getInspectableTarget(target);
    if (!inspectable) return;
    const text = (inspectable.innerText || inspectable.textContent || '').trim();
    const rect = inspectable.getBoundingClientRect();
    activeHtmlTarget = inspectable;
    lastAnalysisSource = 'html';
    currentSelection = { text, rect };
    inspectable.classList.remove('rfc-inspect-highlight');
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

  document.addEventListener('mouseup', () => setTimeout(handleSelection, 10));

  document.addEventListener('mousemove', (event) => {
    if (!inspectMode) return;
    const target = getInspectableTarget(event.target);
    setHoverTarget(target);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (inspectMode) {
      event.preventDefault();
      event.stopPropagation();
      activateHtmlTarget(target);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      exitInspectMode();
      window.ReadingFlowRenderer.clearOverlay();
      window.ReadingFlowRenderer.clearToolbar();
    }
  });

  window.addEventListener('rfc:enter-inspect-mode', () => enterInspectMode());

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
    if (message.type === 'RFC_TOGGLE_SIDEBAR') window.ReadingFlowSidebar.togglePanel();
    if (message.type === 'RFC_ENTER_INSPECT_MODE') enterInspectMode();
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
  window.ReadingFlowRenderer.ensureFloatingButton();
})();
