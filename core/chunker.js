(() => {
  const CLAUSE_BREAKS = /,|;|:|\b(which|that|who|when|while|because|although|if|but|and|or)\b/gi;
  const PREPOSITIONS = /\b(of|for|to|with|in|on|at|from|by|about|into|through|after|before|over|under)\b/i;
  const MINI_DICT = {
    article: '기사',
    context: '문맥',
    sentence: '문장',
    paragraph: '문단',
    clause: '절',
    flow: '흐름',
    structure: '구조',
    modifier: '수식어',
    reader: '독자',
    naturally: '자연스럽게',
    complex: '복잡한',
    meaning: '의미',
    phrase: '구',
    improve: '개선하다',
    reading: '읽기'
  };

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

  function translateWord(word) {
    const normalized = word.toLowerCase();
    return MINI_DICT[normalized] || '뜻 메모 필요';
  }

  function simpleTranslate(text) {
    const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean);
    if (words.length <= 3) {
      return words.map(translateWord).join(', ');
    }
    return '문장 해석 초안: 핵심 골격부터 읽고 수식어는 뒤에서 보세요.';
  }

  function extractGlossary(text) {
    const words = normalizeWhitespace(text)
      .split(/[^A-Za-z'-]+/)
      .filter(Boolean)
      .filter(word => word.length >= 5)
      .slice(0, 6);
    return [...new Set(words)].map(term => ({
      term,
      meaning: translateWord(term),
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
          '첫 chunk에서 문장 핵심을 먼저 잡습니다.',
          'modifier는 한 박자 늦춰 읽어도 의미 이해에 큰 문제가 없습니다.'
        ],
        warnings: sourceText.length > 240 ? ['긴 문장입니다. 핵심절과 부가 설명을 분리해 보세요.'] : []
      };
    }
  };
})();
