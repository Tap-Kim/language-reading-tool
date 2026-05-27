(() => {
  let currentSelection = null;
  let inspectMode = false;
  let lastAnalysisSource = 'selection';
  let activeHtmlTarget = null;
  let hoveredHtmlTarget = null;
  let annotatedTarget = null;
  let annotatedOriginalHtml = '';
  let htmlSourceText = '';
  let latestAnnotationToken = 0;
  let quickMemoSelection = null;
  let sidebarDraftSelection = null;

  function isEnglishDominant(text) {
    const normalized = String(text || '').trim();
    const letters = (normalized.match(/[A-Za-z]/g) || []).length;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (!normalized) return false;
    if (words.length <= 3) return letters >= 1;
    return letters >= Math.max(10, normalized.length * 0.35);
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

  function buildMemoItem(text, analysis, note = '', translationOverride = '') {
    const normalized = text.trim();
    const wordLike = normalized.split(/\s+/).length <= 3;
    return {
      id: crypto.randomUUID(),
      type: wordLike ? 'word' : 'sentence',
      sourceText: normalized,
      translation: translationOverride || analysis.translation,
      note: '',
      context: '',
      glossary: analysis.glossary || [],
      url: location.href,
      title: document.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folded: true,
      saveCount: 1
    };
  }

  function analyze(mode = 'flow', textOverride = '') {
    const targetText = textOverride || currentSelection?.text;
    if (!targetText) return null;
    return window.ReadingFlowChunker.analyze(targetText, mode);
  }

  function renderAnalysisInSidebar(analysis) {
    window.ReadingFlowSidebar.openPanel();
    window.ReadingFlowSidebar.renderActiveAnalysis(analysis, {
      source: lastAnalysisSource,
      sourceText: currentSelection?.text || analysis?.sourceText || '',
      label: lastAnalysisSource === 'html' ? '클릭한 HTML 영역의 교정 결과' : '선택한 텍스트의 교정 결과'
    });
  }

  function restoreAnnotatedTarget() {
    if (annotatedTarget && annotatedTarget.isConnected) {
      annotatedTarget.innerHTML = annotatedOriginalHtml;
      annotatedTarget.classList.remove('rfc-annotated-target');
    }
    annotatedTarget = null;
    annotatedOriginalHtml = '';
    latestAnnotationToken += 1;
  }

  function restoreOriginalContent() {
    restoreAnnotatedTarget();
    activeHtmlTarget = null;
    htmlSourceText = '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function splitTokensPreservingSpace(text) {
    return text.split(/(\s+)/).filter(Boolean);
  }

  function glossaryMap(glossary = []) {
    return Object.fromEntries(glossary.map(item => [String(item.term || '').toLowerCase(), item.meaning || '뜻 메모 필요']));
  }

  function renderWordSpans(text, glossary = {}) {
    return splitTokensPreservingSpace(text).map(token => {
      if (/^\s+$/.test(token)) return token;
      const normalized = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase();
      const tooltip = glossary[normalized] || token;
      return `<span class="rfc-inline-word" data-tooltip="${escapeHtml(tooltip)}" data-word="${escapeHtml(normalized || token.toLowerCase())}"><span class="rfc-inline-word-hitbox">${escapeHtml(token)}</span></span>`;
    }).join('');
  }

  async function hydrateAnnotationTooltips(analysis, tokenId) {
    if (!annotatedTarget || !annotatedTarget.isConnected) return;
    const segmentNodes = [...annotatedTarget.querySelectorAll('.rfc-inline-segment[data-segment-index]')];
    const wordNodes = [...annotatedTarget.querySelectorAll('.rfc-inline-word[data-word]')];
    await Promise.all(segmentNodes.map(async (node) => {
      const text = node.dataset.segmentText || '';
      if (!text) return;
      const translation = await requestTranslation(text);
      if (latestAnnotationToken !== tokenId || !node.isConnected) return;
      node.dataset.tooltip = translation;
    }));
    const uniqueWords = [...new Set(wordNodes.map(node => node.dataset.word).filter(word => /^[a-z][a-z'-]{2,}$/.test(word)).slice(0, 24))];
    const wordTranslations = await Promise.all(uniqueWords.map(async (word) => [word, await requestTranslation(word)]));
    const wordMap = Object.fromEntries(wordTranslations);
    if (latestAnnotationToken !== tokenId || !annotatedTarget?.isConnected) return;
    wordNodes.forEach(node => {
      const translated = wordMap[node.dataset.word];
      if (translated) node.dataset.tooltip = translated;
    });
  }

  function renderInlineAnnotation(analysis) {
    if (lastAnalysisSource !== 'html' || !activeHtmlTarget || !activeHtmlTarget.isConnected) {
      restoreAnnotatedTarget();
      return;
    }

    const text = htmlSourceText || currentSelection?.text || analysis.sourceText || '';
    if (!text) return;

    if (annotatedTarget !== activeHtmlTarget) {
      restoreAnnotatedTarget();
      annotatedTarget = activeHtmlTarget;
      annotatedOriginalHtml = activeHtmlTarget.innerHTML;
    }

    const segments = analysis.segments || [];
    const glossary = glossaryMap(analysis.glossary || []);
    let bodyHtml = '';

    if (analysis.mode === 'structure') {
      bodyHtml = segments.map((segment, index) => `
        <span class="rfc-inline-segment rfc-inline-${segment.role || 'support'}" data-tooltip="번역 불러오는 중..." data-segment-index="${index}" data-segment-text="${escapeHtml(segment.text)}">
          <span class="rfc-inline-label">${escapeHtml(segment.role === 'core' ? 'Core' : segment.role === 'modifier' ? 'Modifier' : segment.role === 'clause' ? 'Clause' : 'Support')}</span>
          <span class="rfc-inline-text">${renderWordSpans(segment.text, glossary)}</span>
        </span>
      `).join(' ');
    } else if (analysis.mode === 'compare') {
      bodyHtml = `
        <span class="rfc-inline-segment rfc-inline-support" data-tooltip="${escapeHtml(analysis.modePayload?.compare?.original || text)}">
          <span class="rfc-inline-label">Original</span>
          <span class="rfc-inline-text">${renderWordSpans(analysis.modePayload?.compare?.original || text, glossary)}</span>
        </span>
        <span class="rfc-inline-segment rfc-inline-core" data-tooltip="${escapeHtml(analysis.modePayload?.compare?.corrected || text)}">
          <span class="rfc-inline-label">Compare</span>
          <span class="rfc-inline-text">${renderWordSpans(analysis.modePayload?.compare?.corrected || text, glossary)}</span>
        </span>
      `;
    } else if (analysis.mode === 'simplify') {
      bodyHtml = `
        <span class="rfc-inline-segment rfc-inline-core" data-tooltip="${escapeHtml(analysis.modePayload?.text || text)}">
          <span class="rfc-inline-label">Simple</span>
          <span class="rfc-inline-text">${renderWordSpans(analysis.modePayload?.text || text, glossary)}</span>
        </span>
      `;
    } else {
      bodyHtml = (analysis.chunks || []).map((chunk, index) => `
        <span class="rfc-inline-segment rfc-inline-${segments[index]?.role || 'support'}" data-tooltip="번역 불러오는 중..." data-segment-index="${index}" data-segment-text="${escapeHtml(chunk)}">
          <span class="rfc-inline-text">${renderWordSpans(chunk, glossary)}</span>
        </span>
      `).join(' ');
    }

    activeHtmlTarget.innerHTML = `<span class="rfc-inline-annotation rfc-inline-mode-${analysis.mode}">${bodyHtml}</span>`;
    activeHtmlTarget.classList.add('rfc-annotated-target');
    const tokenId = ++latestAnnotationToken;
    hydrateAnnotationTooltips(analysis, tokenId);
  }

  async function hydrateTranslation(text, apply) {
    const translation = await requestTranslation(text);
    apply(translation);
  }

  function showAnalysis(mode = 'flow') {
    const baseText = lastAnalysisSource === 'html' ? (htmlSourceText || currentSelection?.text || '') : (currentSelection?.text || '');
    const analysis = analyze(mode, baseText);
    if (!analysis) return;
    if (currentSelection) currentSelection.text = baseText;
    renderAnalysisInSidebar(analysis);
    renderInlineAnnotation(analysis);
    if ((baseText || '').split(/\s+/).length > 3) {
      hydrateTranslation(baseText, (translation) => {
        analysis.translation = translation;
        window.ReadingFlowSidebar.updateActiveTranslation(translation);
      });
    }
  }

  async function saveSelectionToMemo(note = '') {
    if (!currentSelection?.text) return;
    const analysis = analyze('flow', currentSelection.text);
    analysis.translation = await requestTranslation(currentSelection.text);
    const item = buildMemoItem(currentSelection.text, analysis, '', analysis.translation);
    await window.ReadingFlowSidebar.addMemoItem(item);
    renderAnalysisInSidebar(analysis);
    renderInlineAnnotation(analysis);
    sidebarDraftSelection = null;
    window.ReadingFlowSidebar.clearSelectionDraft();
  }

  async function saveDraftSelectionToMemo() {
    if (!sidebarDraftSelection?.text) return;
    const sourceText = sidebarDraftSelection.text.trim();
    if (!sourceText) return;
    const analysis = window.ReadingFlowChunker.analyze(sourceText, 'flow');
    analysis.translation = sidebarDraftSelection.translation && sidebarDraftSelection.translation !== '번역 불러오는 중...'
      ? sidebarDraftSelection.translation
      : await requestTranslation(sourceText);
    const item = buildMemoItem(sourceText, analysis, '', analysis.translation);
    await window.ReadingFlowSidebar.addMemoItem(item);
    currentSelection = { text: sourceText, rect: getSelectionRect() || new DOMRect(24, 24, 320, 20) };
    lastAnalysisSource = 'selection';
    renderAnalysisInSidebar(analysis);
    sidebarDraftSelection = null;
    window.ReadingFlowSidebar.clearSelectionDraft();
    window.ReadingFlowRenderer.clearToolbar();
  }

  function showSelectionDraftInSidebar(text, translation = '번역 불러오는 중...') {
    sidebarDraftSelection = { text, translation };
    window.ReadingFlowSidebar.openPanel();
    window.ReadingFlowSidebar.renderSelectionDraft({ sourceText: text, translation });
    if (translation === '번역 불러오는 중...') {
      hydrateTranslation(text, (translated) => {
        if (!sidebarDraftSelection || sidebarDraftSelection.text !== text) return;
        sidebarDraftSelection.translation = translated;
        window.ReadingFlowSidebar.updateSelectionDraftTranslation(translated);
      });
    }
  }

  function dismissSelectionDraft() {
    sidebarDraftSelection = null;
    window.ReadingFlowSidebar.clearSelectionDraft();
  }


  function clearLiveSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  function openQuickMemoPopover(rect, text, translation = '번역 불러오는 중...') {
    quickMemoSelection = { text, rect, translation };
    window.ReadingFlowRenderer.renderSelectionPopover(rect, { sourceText: text, translation });
    if (translation === '번역 불러오는 중...') {
      hydrateTranslation(text, (translated) => {
        if (!quickMemoSelection || quickMemoSelection.text !== text) return;
        quickMemoSelection.translation = translated;
        window.ReadingFlowRenderer.updateSelectionPopoverTranslation(translated);
      });
    }
  }

  async function saveQuickMemo(detail) {
    const text = (detail?.text || '').trim();
    if (!text) return;
    const analysis = analyze('flow', text);
    const translation = detail?.translation || await requestTranslation(text);
    const item = buildMemoItem(text, analysis, detail?.note || '', translation);
    await window.ReadingFlowSidebar.addMemoItem(item);
    window.ReadingFlowSidebar.openPanel();
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
    htmlSourceText = text;
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
    if (!text || !isEnglishDominant(text)) {
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

  document.addEventListener('mouseup', () => setTimeout(() => {
    handleSelection();
    const selectedText = getSelectionText();
    const rect = getSelectionRect();
    if (!inspectMode && selectedText && rect && rect.width && rect.height && isEnglishDominant(selectedText)) {
      currentSelection = { text: selectedText, rect };
      showSelectionDraftInSidebar(selectedText);
      window.ReadingFlowRenderer.clearToolbar();
      setTimeout(clearLiveSelection, 10);
    }
  }, 20));

  document.addEventListener('dblclick', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || isIgnoredElement(target)) return;
    setTimeout(() => {
      const selectedText = getSelectionText();
      const selectionRect = getSelectionRect();
      const inlineWord = target.closest('.rfc-inline-word');
      const inlineSegment = target.closest('.rfc-inline-segment');
      if (inlineWord) {
        const text = inlineWord.textContent.trim();
        showSelectionDraftInSidebar(text, inlineWord.dataset.tooltip || '번역 불러오는 중...');
        return;
      }
      if (inlineSegment) {
        const text = (inlineSegment.dataset.segmentText || inlineSegment.textContent || '').trim();
        showSelectionDraftInSidebar(text, inlineSegment.dataset.tooltip || '번역 불러오는 중...');
        return;
      }
      if (selectedText && selectionRect && isEnglishDominant(selectedText)) {
        showSelectionDraftInSidebar(selectedText);
      }
    }, 20);
  }, true);

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
    if (!currentSelection?.text && !htmlSourceText) return;
    if (event.detail?.source === 'html' && activeHtmlTarget) {
      currentSelection = {
        text: htmlSourceText || currentSelection?.text || '',
        rect: activeHtmlTarget.getBoundingClientRect()
      };
    }
    showAnalysis(mode);
  });

  window.addEventListener('rfc:restore-original-content', () => {
    restoreOriginalContent();
  });

  window.addEventListener('rfc:save-quick-memo', (event) => {
    saveQuickMemo(event.detail || {});
  });

  window.addEventListener('rfc:save-selection-draft', () => {
    saveDraftSelectionToMemo();
  });

  window.addEventListener('rfc:dismiss-selection-draft', () => {
    dismissSelectionDraft();
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
