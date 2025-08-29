export const ttsService = {
  // TTS 지원 여부 확인
  isSupported() {
    return 'speechSynthesis' in window;
  },

  // 사용 가능한 음성 목록 가져오기
  getVoices() {
    if (!this.isSupported()) return [];
    
    const voices = speechSynthesis.getVoices();
    // 영어 음성만 필터링
    return voices.filter(voice => 
      voice.lang.startsWith('en-') || voice.lang === 'en'
    );
  },

  // 음성으로 단어 읽기
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('TTS가 지원되지 않는 브라우저입니다.'));
        return;
      }

      // 현재 재생 중인 음성 중단
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 기본 설정
      const defaultOptions = {
        language: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const settings = { ...defaultOptions, ...options };

      // 설정 적용
      utterance.lang = settings.language;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      // 특정 음성 선택 (있는 경우)
      if (settings.voiceName) {
        const voices = this.getVoices();
        const selectedVoice = voices.find(voice => voice.name === settings.voiceName);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      // 이벤트 핸들러
      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);
      
      // 진행 상황 콜백
      if (options.onStart) {
        utterance.onstart = options.onStart;
      }
      
      if (options.onEnd) {
        utterance.onend = () => {
          options.onEnd();
          resolve();
        };
      }

      // 음성 재생 시작
      speechSynthesis.speak(utterance);
    });
  },

  // 단어 목록을 순차적으로 읽기
  async speakWordList(words, options = {}) {
    const defaultOptions = {
      interval: 2000, // 단어 간 간격 (ms)
      language: 'en-US',
      rate: 1.0,
      onWordStart: null,
      onWordEnd: null,
      onComplete: null
    };

    const settings = { ...defaultOptions, ...options };

    try {
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        if (settings.onWordStart) {
          settings.onWordStart(word, i);
        }

        await this.speak(word, {
          language: settings.language,
          rate: settings.rate,
          pitch: settings.pitch,
          volume: settings.volume,
          voiceName: settings.voiceName
        });

        if (settings.onWordEnd) {
          settings.onWordEnd(word, i);
        }

        // 마지막 단어가 아닌 경우 간격 대기
        if (i < words.length - 1) {
          await this.delay(settings.interval);
        }
      }

      if (settings.onComplete) {
        settings.onComplete();
      }

      return { success: true };
    } catch (error) {
      console.error('단어 목록 읽기 실패:', error);
      return { success: false, error: error.message };
    }
  },

  // 재생 중단
  stop() {
    if (this.isSupported()) {
      speechSynthesis.cancel();
    }
  },

  // 재생 일시정지
  pause() {
    if (this.isSupported()) {
      speechSynthesis.pause();
    }
  },

  // 재생 재개
  resume() {
    if (this.isSupported()) {
      speechSynthesis.resume();
    }
  },

  // 현재 재생 중인지 확인
  isSpeaking() {
    return this.isSupported() && speechSynthesis.speaking;
  },

  // 일시정지 상태인지 확인
  isPaused() {
    return this.isSupported() && speechSynthesis.paused;
  },

  // 지연 함수
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 언어별 기본 설정
  getLanguageSettings(language = 'en-US') {
    const languageSettings = {
      'en-US': { rate: 1.0, pitch: 1.0 },
      'en-GB': { rate: 0.9, pitch: 1.0 },
      'en-AU': { rate: 1.0, pitch: 1.0 },
      'en-CA': { rate: 1.0, pitch: 1.0 }
    };

    return languageSettings[language] || languageSettings['en-US'];
  },

  // 단어 발음 테스트
  async testPronunciation(word) {
    try {
      await this.speak(word, { rate: 0.8 }); // 조금 느리게 발음
      return true;
    } catch (error) {
      console.error('발음 테스트 실패:', error);
      return false;
    }
  },

  // TTS 설정 저장
  saveSettings(settings) {
    const ttsSettings = {
      language: settings.language || 'en-US',
      rate: settings.rate || 1.0,
      pitch: settings.pitch || 1.0,
      volume: settings.volume || 1.0,
      voiceName: settings.voiceName || null,
      autoPlayInterval: settings.autoPlayInterval || 2000
    };

    localStorage.setItem('vocabsnap-tts-settings', JSON.stringify(ttsSettings));
    return ttsSettings;
  },

  // TTS 설정 불러오기
  loadSettings() {
    try {
      const saved = localStorage.getItem('vocabsnap-tts-settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('TTS 설정 로드 실패:', error);
    }

    // 기본 설정 반환
    return {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      voiceName: null,
      autoPlayInterval: 2000
    };
  }
};