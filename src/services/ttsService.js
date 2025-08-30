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
      console.log('TTS: speak 호출됨', { text, options });
      
      if (!this.isSupported()) {
        console.error('TTS: 브라우저가 TTS를 지원하지 않음');
        reject(new Error('TTS가 지원되지 않는 브라우저입니다.'));
        return;
      }

      // iOS에서는 TTS 비활성화
      if (this._isiOS()) {
        console.error('TTS: iOS에서 TTS 비활성화됨');
        reject(new Error('iOS에서는 음성 기능을 지원하지 않습니다.'));
        return;
      }

      // 안드로이드에서만 사용자 상호작용 확인
      if (this._isMobile() && !this._userInteracted) {
        console.warn('TTS: 사용자 상호작용이 필요함');
        // 사용자 상호작용 초기화 다시 시도
        this.initUserInteraction();
        reject(new Error('음성을 재생하려면 화면을 터치해주세요.'));
        return;
      }

      // 현재 재생 중인 음성 중단
      speechSynthesis.cancel();

      // 안드로이드 호환성을 위한 약간의 지연
      const delay = this._isMobile() ? 200 : 0;
      
      setTimeout(() => {
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
        console.log('TTS: 음성 재생 시작', text);
        speechSynthesis.speak(utterance);
      }, delay);
    });
  },

  // 안드로이드 디바이스 감지 (iOS 제외)
  _isMobile() {
    return /Android|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // iOS 디바이스 감지
  _isiOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  // 사용자 상호작용 초기화
  _userInteracted: false,
  
  // 사용자 상호작용 등록
  initUserInteraction() {
    if (this._userInteracted) return;
    
    const enableAudio = () => {
      console.log('TTS: 사용자 상호작용 감지됨');
      this._userInteracted = true;
      
      // 모바일에서 TTS 활성화를 위한 빈 음성 재생
      if (this._isMobile() && this.isSupported()) {
        try {
          const utterance = new SpeechSynthesisUtterance('');
          utterance.volume = 0;
          speechSynthesis.speak(utterance);
          console.log('TTS: 모바일 TTS 활성화 완료');
        } catch (error) {
          console.error('TTS: 모바일 TTS 활성화 실패:', error);
        }
      }
      
      // 이벤트 리스너 제거
      document.removeEventListener('click', enableAudio, true);
      document.removeEventListener('touchstart', enableAudio, true);
      document.removeEventListener('touchend', enableAudio, true);
      document.removeEventListener('keydown', enableAudio, true);
      console.log('TTS: 사용자 상호작용 이벤트 리스너 제거됨');
    };
    
    // 사용자 상호작용 이벤트 등록 (더 많은 이벤트 추가)
    document.addEventListener('click', enableAudio, true);
    document.addEventListener('touchstart', enableAudio, true); 
    document.addEventListener('touchend', enableAudio, true);
    document.addEventListener('keydown', enableAudio, true);
    console.log('TTS: 사용자 상호작용 이벤트 리스너 등록됨');
  },

  // 중단 플래그 추가
  _isStopRequested: false,

  // 단어 목록을 순차적으로 읽기 (개선된 버전)
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
      // 중단 플래그 초기화
      this._isStopRequested = false;

      // iOS에서는 전체 재생 비활성화
      if (this._isiOS()) {
        throw new Error('iOS에서는 전체 재생 기능을 지원하지 않습니다.');
      }

      // speechSynthesis 초기화
      speechSynthesis.cancel();
      
      // 약간의 지연 후 시작 (안드로이드 호환성)
      if (this._isMobile()) {
        await this.delay(300);
      }

      for (let i = 0; i < words.length; i++) {
        // 중단 요청 확인
        if (this._isStopRequested) {
          console.log('TTS: 전체 재생이 중단되었습니다.');
          break;
        }

        const word = words[i];
        
        if (settings.onWordStart) {
          settings.onWordStart(word, i);
        }

        // 각 단어 재생 전 speechSynthesis 상태 확인
        if (speechSynthesis.pending || speechSynthesis.speaking) {
          speechSynthesis.cancel();
          await this.delay(100);
        }

        // 중단 요청 재확인
        if (this._isStopRequested) {
          console.log('TTS: 전체 재생이 중단되었습니다.');
          break;
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

        // 마지막 단어가 아닌 경우 간격 대기 (중단 확인 포함)
        if (i < words.length - 1 && !this._isStopRequested) {
          await this.delay(settings.interval);
        }
      }

      if (settings.onComplete && !this._isStopRequested) {
        settings.onComplete();
      }

      return { success: true, stopped: this._isStopRequested };
    } catch (error) {
      console.error('단어 목록 읽기 실패:', error);
      return { success: false, error: error.message };
    } finally {
      this._isStopRequested = false;
    }
  },

  // 재생 중단
  stop() {
    console.log('TTS: stop 호출됨');
    this._isStopRequested = true;
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