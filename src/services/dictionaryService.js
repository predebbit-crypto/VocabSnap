// 무료 영어 사전 API 서비스
export const dictionaryService = {
  // Free Dictionary API 사용
  API_BASE_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',

  // 단어 뜻 검색
  async lookupWord(word) {
    try {
      const cleanWord = word.toLowerCase().trim();
      const response = await fetch(`${this.API_BASE_URL}/${cleanWord}`);
      
      if (!response.ok) {
        throw new Error('단어를 찾을 수 없습니다');
      }

      const data = await response.json();
      return this.parseResponse(data);
      
    } catch (error) {
      console.warn(`단어 검색 실패: ${word}`, error);
      return {
        word,
        meanings: [],
        phonetic: '',
        pronunciation: '',
        success: false,
        error: error.message
      };
    }
  },

  // API 응답 파싱
  parseResponse(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { success: false, error: '검색 결과가 없습니다' };
    }

    const entry = data[0];
    const word = entry.word || '';
    
    // 발음 정보 추출
    const phonetic = entry.phonetic || '';
    const phoneticAudio = entry.phonetics?.find(p => p.audio)?.audio || '';

    // 뜻 정보 추출  
    const meanings = [];
    
    if (entry.meanings && Array.isArray(entry.meanings)) {
      for (const meaning of entry.meanings) {
        const partOfSpeech = meaning.partOfSpeech || '';
        
        if (meaning.definitions && Array.isArray(meaning.definitions)) {
          for (const def of meaning.definitions.slice(0, 3)) { // 최대 3개만
            meanings.push({
              partOfSpeech,
              definition: def.definition || '',
              example: def.example || '',
              synonyms: def.synonyms?.slice(0, 3) || []
            });
          }
        }
      }
    }

    return {
      word,
      meanings,
      phonetic,
      phoneticAudio,
      success: true,
      source: 'Free Dictionary API'
    };
  },

  // 여러 단어 일괄 검색
  async lookupWords(words) {
    const results = [];
    
    for (const word of words) {
      try {
        const result = await this.lookupWord(word);
        results.push(result);
        
        // API 호출 간 지연 (요청 제한 방지)
        await this.delay(100);
      } catch (error) {
        results.push({
          word,
          meanings: [],
          phonetic: '',
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  },

  // 뜻을 간단한 텍스트로 변환
  formatMeaning(meaningData) {
    if (!meaningData.success || !meaningData.meanings.length) {
      return '';
    }

    // 첫 번째 뜻만 사용
    const firstMeaning = meaningData.meanings[0];
    let formatted = firstMeaning.definition;
    
    // 품사 정보 추가
    if (firstMeaning.partOfSpeech) {
      formatted = `(${firstMeaning.partOfSpeech}) ${formatted}`;
    }

    return formatted;
  },

  // 발음 기호 추출
  formatPhonetic(meaningData) {
    if (!meaningData.success || !meaningData.phonetic) {
      return '';
    }
    return meaningData.phonetic;
  },

  // 지연 함수
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 단어 유효성 검사 (영어인지 확인)
  isValidEnglishWord(word) {
    // 기본적인 영어 단어 패턴 확인
    const englishPattern = /^[a-zA-Z'-]+$/;
    return englishPattern.test(word) && word.length >= 2;
  },

  // 캐시된 결과 저장/로드 (로컬스토리지 사용)
  _cacheKey: 'vocabsnap-dictionary-cache',
  _cache: null,

  // 캐시 초기화
  initCache() {
    if (this._cache) return;
    
    try {
      const cached = localStorage.getItem(this._cacheKey);
      this._cache = cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('사전 캐시 로드 실패:', error);
      this._cache = {};
    }
  },

  // 캐시에서 검색
  getFromCache(word) {
    this.initCache();
    const cleanWord = word.toLowerCase().trim();
    return this._cache[cleanWord] || null;
  },

  // 캐시에 저장
  saveToCache(word, result) {
    this.initCache();
    const cleanWord = word.toLowerCase().trim();
    this._cache[cleanWord] = {
      ...result,
      cachedAt: Date.now()
    };

    try {
      // 캐시 크기 제한 (최대 500개)
      const cacheKeys = Object.keys(this._cache);
      if (cacheKeys.length > 500) {
        // 오래된 항목부터 삭제
        const sorted = cacheKeys
          .map(key => ({ key, time: this._cache[key].cachedAt || 0 }))
          .sort((a, b) => a.time - b.time);
        
        // 100개 삭제
        for (let i = 0; i < 100; i++) {
          delete this._cache[sorted[i].key];
        }
      }

      localStorage.setItem(this._cacheKey, JSON.stringify(this._cache));
    } catch (error) {
      console.warn('사전 캐시 저장 실패:', error);
    }
  },

  // 캐시된 검색 (캐시 우선)
  async lookupWordCached(word) {
    // 캐시에서 먼저 확인
    const cached = this.getFromCache(word);
    if (cached) {
      // 7일 이내의 캐시만 사용
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - cached.cachedAt < oneWeek) {
        return cached;
      }
    }

    // 캐시에 없으면 API에서 검색
    const result = await this.lookupWord(word);
    
    // 성공한 결과만 캐시에 저장
    if (result.success) {
      this.saveToCache(word, result);
    }
    
    return result;
  }
};