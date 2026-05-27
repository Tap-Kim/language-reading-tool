(() => {
  const CLAUSE_BREAKS = /,|;|:|\b(which|that|who|when|while|because|although|if|but|and|or)\b/gi;
  const PREPOSITIONS = /\b(of|for|to|with|in|on|at|from|by|about|into|through|after|before|over|under)\b/i;

  function normalizeWhitespace(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function splitIntoChunks(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return [];

    const rough = normalized
      .split(/(?<=[,;:])\s+|\s+(?=which\b|that\b|who\b|when\b|while\b|because\b|although\b|if\b|but\b|and\b|or\b)/i)
      .map(part => part.trim())
      .filter(Boolean);

    return rough.length ? rough : [normalized];
  }

  function classifySegment(text, index) {
    if (index === 0) return 'core';
    if (PREPOSITIONS.test(text)) return 'modifier';
    if (CLAUSE_BREAKS.test(text)) return 'clause';
    return 'support';
  }

  function simpleTranslate(text) {
    return '자동 해석 준비 중: 현재 MVP에서는 저장 후 직접 메모를 보강하는 구조입니다.';
  }

  function extractGlossary(text) {
    const words = normalizeWhitespace(text)
      .split(/[^A-Za-z'-]+/)
      .filter(Boolean)
      .filter(word => word.length >= 5)
      .slice(0, 5);
    return [...new Set(words)].map(term => ({
      term,
      meaning: '뜻 메모 필요',
      partOfSpeech: 'unknown'
    }));
  }

  window.ReadingFlowChunker = {
    analyze(text, mode = 'flow') {
      const sourceText = normalizeWhitespace(text);
      const chunks = splitIntoChunks(sourceText);
      const segments = chunks.map((chunk, index) => ({
        text: chunk,
        role: classifySegment(chunk, index),
        priority: index === 0 ? 'high' : index === chunks.length - 1 ? 'low' : 'medium'
      }));

      return {
        sourceText,
        normalizedText: sourceText,
        mode,
        chunks,
        segments,
        translation: simpleTranslate(sourceText),
        glossary: extractGlossary(sourceText),
        tips: [
          '먼저 첫 chunk를 읽고 문장 골격을 잡습니다.',
          'modifier는 한 박자 늦춰 읽어도 됩니다.'
        ],
        warnings: sourceText.length > 240 ? ['긴 문장입니다. 핵심과 수식을 분리해 보세요.'] : []
      };
    }
  };
})();
