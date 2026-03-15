// Unit Tests for Client Utility Functions
describe('Client Utils Functions', () => {
  // Mock DOM elements for testing
  beforeEach(() => {
    // Reset any global state if needed
  });

  describe('normalizeForToken', () => {
    test('should normalize text to lowercase and remove accents', () => {
      const result = window.utils.normalizeForToken("Café");
      expect(result).toBe("cafe");
    });

    test('should handle empty strings', () => {
      const result = window.utils.normalizeForToken("");
      expect(result).toBe("");
    });

    test('should handle special characters', () => {
      const result = window.utils.normalizeForToken("Hello-World_123");
      expect(result).toBe("hello-world_123");
    });
  });

  describe('extractTopKeywords', () => {
    test('should extract keywords from text', () => {
      const text = "Il gatto nero corre velocemente nel giardino fiorito";
      const result = window.utils.extractTopKeywords(text, 5);
      // Should return array of keywords (words >= 4 chars, not in stop words)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('should respect limit parameter', () => {
      const text = "uno due tre quattro cinque sei sette otto nove dieci";
      const result = window.utils.extractTopKeywords(text, 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    test('should filter out stop words', () => {
      const text = "il e la con per da in a un";
      const result = window.utils.extractTopKeywords(text, 10);
      // Should be empty or very short since all are stop words
      expect(result.length).toBe(0);
    });
  });

  describe('createSentenceCandidates', () => {
    test('should extract sentences of appropriate length', () => {
      const text = "Questa è una frase molto lunga che supera i cinquanta caratteri. Questa è corta.";
      const result = window.utils.createSentenceCandidates(text);
      expect(Array.isArray(result)).toBe(true);
      // First sentence should qualify (>= 50 chars)
      expect(result[0]).toContain("Questa è una frase molto lunga");
    });

    test('should filter out too short sentences', () => {
      const text = "Breve. Questa è una frase abbastanza lunga per essere considerata.";
      const result = window.utils.createSentenceCandidates(text);
      expect(result.length).toBe(1);
      expect(result[0]).toContain("abbastanza lunga");
    });
  });

  describe('pickFallbackKeyword', () => {
    test('should return first keyword from sentence', () => {
      const sentence = "Questo è un test di fallback";
      const result = window.utils.pickFallbackKeyword(sentence);
      // Should return a keyword from the sentence
      expect(typeof result).toBe('string');
    });

    test('should return empty string for no valid keywords', () => {
      const sentence = "il e la";
      const result = window.utils.pickFallbackKeyword(sentence);
      expect(result).toBe("");
    });
  });

  describe('shuffleList', () => {
    test('should return array with same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = window.utils.shuffleList(original);
      expect(shuffled).toHaveLength(5);
      expect(shuffled).toEqual(expect.arrayContaining(original));
    });

    test('should not modify original array', () => {
      const original = [1, 2, 3];
      const copy = [...original];
      window.utils.shuffleList(original);
      expect(original).toEqual(copy);
    });
  });

  describe('buildQuestionFromSentence', () => {
    test('should return question object with masked sentence', () => {
      const sentence = "Il gatto nero dorme sul tappeto";
      const keywordPool = ["gatto", "tappeto", "cane"];
      const result = window.utils.buildQuestionFromSentence(sentence, keywordPool);
      
      expect(result).toHaveProperty('maskedSentence');
      expect(result).toHaveProperty('correctAnswer');
      expect(result).toHaveProperty('options');
      expect(Array.isArray(result.options)).toBe(true);
      expect(result.options.length).toBe(4); // 1 correct + 3 distractors
    });

    test('should return null for invalid sentence', () => {
      const result = window.utils.buildQuestionFromSentence("", ["test"]);
      expect(result).toBeNull();
    });
  });

  describe('buildQuestionSet', () => {
    test('should return array of questions up to count limit', () => {
      const sentences = [
        "Prima frase di test per la costruzione delle domande",
        "Seconda frase di test con contenuto diverso",
        "Terza frase per completare il set di domande"
      ];
      const keywordPool = ["frase", "test", "costruzione", "contenuto"];
      const result = window.utils.buildQuestionSet(sentences, keywordPool, 2);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    test('should handle empty sentences array', () => {
      const result = window.utils.buildQuestionSet([], ["test"], 5);
      expect(result).toEqual([]);
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const result = window.utils.escapeHtml("<script>alert('xss')</script>");
      expect(result).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
    });

    test('should handle empty string', () => {
      const result = window.utils.escapeHtml("");
      expect(result).toBe("");
    });
  });

  describe('toHtmlLines', () => {
    test('should convert newlines to br tags', () => {
      const result = window.utils.toHtmlLines("Linea 1\nLinea 2\n\nLinea 4");
      expect(result).toBe("Linea 1<br>Linea 2<br><br>Linea 4");
    });

    test('should handle empty string', () => {
      const result = window.utils.toHtmlLines("");
      expect(result).toBe("");
    });
  });
});