const STORAGE_KEY = 'vocabsnap-data';

const defaultData = {
  words: [],
  settings: {
    tts_language: 'en-US',
    tts_rate: 1.0,
    auto_play_interval: 3000,
    theme: 'light'
  },
  statistics: {
    total_words: 0,
    learned_words: 0,
    study_streak: 0,
    last_study_date: null
  }
};

export const storageService = {
  // 데이터 불러오기
  loadData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsedData = JSON.parse(data);
        // 기본값과 병합하여 누락된 필드 보완
        return {
          ...defaultData,
          ...parsedData,
          settings: { ...defaultData.settings, ...parsedData.settings },
          statistics: { ...defaultData.statistics, ...parsedData.statistics }
        };
      }
      return defaultData;
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      return defaultData;
    }
  },

  // 데이터 저장
  saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      return false;
    }
  },

  // 단어 추가
  addWords(newWords) {
    console.log('Storage: addWords 호출됨', newWords); // 디버깅용
    const data = this.loadData();
    console.log('Storage: 기존 데이터 로드됨', data.words.length, '개'); // 디버깅용
    const currentDate = new Date().toISOString().split('T')[0];
    
    const wordsToAdd = newWords.map(wordObj => {
      // word가 문자열인지 객체인지 확인
      const wordText = typeof wordObj === 'string' ? wordObj : (wordObj.word || '');
      console.log('Storage: 단어 처리 중', wordObj, '->', wordText); // 디버깅용
      
      return {
        id: `word_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word: wordText.toLowerCase().trim(),
        meaning: '',
        pronunciation: '',
        date_added: currentDate,
        source_image_data: (typeof wordObj === 'object' ? wordObj.imageData : null) || null,
        learned: false,
        wrong_attempts: 0,
        last_reviewed: null,
        created_at: new Date().toISOString()
      };
    });

    console.log('Storage: 처리된 단어들', wordsToAdd); // 디버깅용

    // 중복 단어 필터링
    const existingWords = data.words.map(w => w.word.toLowerCase());
    console.log('Storage: 기존 단어들', existingWords); // 디버깅용
    
    const uniqueWords = wordsToAdd.filter(word => 
      !existingWords.includes(word.word.toLowerCase())
    );

    console.log('Storage: 중복 제거 후 단어들', uniqueWords); // 디버깅용

    if (uniqueWords.length > 0) {
      data.words = [...data.words, ...uniqueWords];
      data.statistics.total_words = data.words.length;
      
      console.log('Storage: 데이터 저장 시도'); // 디버깅용
      this.saveData(data);
      console.log('Storage: 데이터 저장 완료, 총', data.words.length, '개'); // 디버깅용
    } else {
      console.warn('Storage: 저장할 고유 단어가 없음 (모두 중복)'); // 디버깅용
    }

    return uniqueWords;
  },

  // 단어 업데이트
  updateWord(wordId, updates) {
    const data = this.loadData();
    const wordIndex = data.words.findIndex(w => w.id === wordId);
    
    if (wordIndex !== -1) {
      data.words[wordIndex] = { ...data.words[wordIndex], ...updates };
      
      // 학습 완료 상태가 변경된 경우 통계 업데이트
      if ('learned' in updates) {
        data.statistics.learned_words = data.words.filter(w => w.learned).length;
        if (updates.learned) {
          data.statistics.last_study_date = new Date().toISOString().split('T')[0];
        }
      }
      
      this.saveData(data);
      return data.words[wordIndex];
    }
    return null;
  },

  // 단어 삭제
  deleteWord(wordId) {
    const data = this.loadData();
    const wordIndex = data.words.findIndex(w => w.id === wordId);
    
    if (wordIndex !== -1) {
      const deletedWord = data.words[wordIndex];
      data.words.splice(wordIndex, 1);
      data.statistics.total_words = data.words.length;
      data.statistics.learned_words = data.words.filter(w => w.learned).length;
      
      this.saveData(data);
      return deletedWord;
    }
    return null;
  },

  // 날짜별 단어 조회
  getWordsByDate(date) {
    const data = this.loadData();
    return data.words.filter(word => word.date_added === date);
  },

  // 학습 필요 단어 조회 (틀린 적 있거나 아직 학습하지 않은 단어)
  getWordsNeedingReview() {
    const data = this.loadData();
    return data.words.filter(word => !word.learned || word.wrong_attempts > 0);
  },

  // 단어 검색
  searchWords(query) {
    const data = this.loadData();
    const lowercaseQuery = query.toLowerCase();
    return data.words.filter(word => 
      word.word.toLowerCase().includes(lowercaseQuery) ||
      (word.meaning && word.meaning.toLowerCase().includes(lowercaseQuery))
    );
  },

  // 설정 업데이트
  updateSettings(newSettings) {
    const data = this.loadData();
    data.settings = { ...data.settings, ...newSettings };
    this.saveData(data);
    return data.settings;
  },

  // 통계 업데이트
  updateStatistics(newStats) {
    const data = this.loadData();
    data.statistics = { ...data.statistics, ...newStats };
    this.saveData(data);
    return data.statistics;
  },

  // 데이터 백업 (JSON 다운로드)
  exportData() {
    const data = this.loadData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabsnap-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // 데이터 복원
  importData(jsonString) {
    try {
      const importedData = JSON.parse(jsonString);
      
      // 데이터 유효성 검사
      if (!importedData.words || !Array.isArray(importedData.words)) {
        throw new Error('잘못된 데이터 형식입니다.');
      }

      // 기존 데이터와 병합
      const currentData = this.loadData();
      const mergedWords = [...currentData.words];
      
      // 중복 확인하며 단어 추가
      importedData.words.forEach(importedWord => {
        const exists = mergedWords.some(word => 
          word.word.toLowerCase() === importedWord.word.toLowerCase()
        );
        if (!exists) {
          mergedWords.push({
            ...importedWord,
            id: importedWord.id || `word_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        }
      });

      const mergedData = {
        ...currentData,
        words: mergedWords,
        settings: { ...currentData.settings, ...(importedData.settings || {}) },
        statistics: {
          ...currentData.statistics,
          total_words: mergedWords.length,
          learned_words: mergedWords.filter(w => w.learned).length
        }
      };

      this.saveData(mergedData);
      return { success: true, imported: importedData.words.length };
    } catch (error) {
      console.error('데이터 가져오기 실패:', error);
      return { success: false, error: error.message };
    }
  },

  // 모든 데이터 삭제
  clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('데이터 삭제 실패:', error);
      return false;
    }
  }
};