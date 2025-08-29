import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { ttsService } from '../../services/ttsService';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState({
    tts_language: 'en-US',
    tts_rate: 1.0,
    auto_play_interval: 3000,
    theme: 'light'
  });
  
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isTestingTTS, setIsTestingTTS] = useState(false);

  useEffect(() => {
    loadSettings();
    loadVoices();
  }, []);

  const loadSettings = () => {
    const data = storageService.loadData();
    setSettings(data.settings);
    
    const ttsSettings = ttsService.loadSettings();
    setSelectedVoice(ttsSettings.voiceName || '');
  };

  const loadVoices = () => {
    if (ttsService.isSupported()) {
      // 음성 목록이 로드될 때까지 기다림
      const loadVoicesList = () => {
        const availableVoices = ttsService.getVoices();
        setVoices(availableVoices);
      };

      // 즉시 로드 시도
      loadVoicesList();
      
      // voiceschanged 이벤트 리스너 추가 (일부 브라우저에서는 비동기로 로드됨)
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoicesList;
      }
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    storageService.updateSettings(newSettings);
  };

  const handleTTSSettingChange = (key, value) => {
    const ttsSettings = ttsService.loadSettings();
    ttsSettings[key] = value;
    ttsService.saveSettings(ttsSettings);
    
    if (key === 'voiceName') {
      setSelectedVoice(value);
    }
  };

  const testTTS = async () => {
    setIsTestingTTS(true);
    try {
      await ttsService.speak('Hello world, this is a test pronunciation.', {
        language: settings.tts_language,
        rate: settings.tts_rate,
        voiceName: selectedVoice
      });
    } catch (error) {
      console.error('TTS 테스트 실패:', error);
    } finally {
      setIsTestingTTS(false);
    }
  };

  const exportData = () => {
    try {
      storageService.exportData();
    } catch (error) {
      alert('데이터 내보내기에 실패했습니다.');
    }
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target.result;
        const result = storageService.importData(jsonString);
        
        if (result.success) {
          alert(`${result.imported}개의 단어를 성공적으로 가져왔습니다.`);
          window.location.reload(); // 데이터 새로고침
        } else {
          alert(`데이터 가져오기 실패: ${result.error}`);
        }
      } catch (error) {
        alert('잘못된 파일 형식입니다.');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // 파일 입력 초기화
  };

  const clearAllData = () => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      if (window.confirm('정말로 모든 단어와 설정을 삭제하시겠습니까?')) {
        const success = storageService.clearAllData();
        if (success) {
          alert('모든 데이터가 삭제되었습니다.');
          window.location.reload();
        } else {
          alert('데이터 삭제에 실패했습니다.');
        }
      }
    }
  };

  const getStorageInfo = () => {
    try {
      const data = JSON.stringify(storageService.loadData());
      const sizeInBytes = new Blob([data]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      return `${sizeInKB} KB`;
    } catch (error) {
      return '계산 불가';
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>설정</h2>
      </div>

      {/* TTS 설정 */}
      <div className="settings-section">
        <h3 className="section-title">음성 설정</h3>
        
        <div className="setting-item">
          <label className="setting-label">언어</label>
          <select
            className="setting-select"
            value={settings.tts_language}
            onChange={(e) => {
              handleSettingChange('tts_language', e.target.value);
              handleTTSSettingChange('language', e.target.value);
            }}
          >
            <option value="en-US">영어 (미국)</option>
            <option value="en-GB">영어 (영국)</option>
            <option value="en-AU">영어 (호주)</option>
            <option value="en-CA">영어 (캐나다)</option>
          </select>
        </div>

        {voices.length > 0 && (
          <div className="setting-item">
            <label className="setting-label">음성 선택</label>
            <select
              className="setting-select"
              value={selectedVoice}
              onChange={(e) => handleTTSSettingChange('voiceName', e.target.value)}
            >
              <option value="">기본 음성</option>
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="setting-item">
          <label className="setting-label">
            재생 속도: {settings.tts_rate}x
          </label>
          <input
            type="range"
            className="setting-range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.tts_rate}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              handleSettingChange('tts_rate', value);
              handleTTSSettingChange('rate', value);
            }}
          />
          <div className="range-labels">
            <span>0.5x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            자동재생 간격: {settings.auto_play_interval / 1000}초
          </label>
          <input
            type="range"
            className="setting-range"
            min="1000"
            max="10000"
            step="500"
            value={settings.auto_play_interval}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              handleSettingChange('auto_play_interval', value);
              handleTTSSettingChange('autoPlayInterval', value);
            }}
          />
          <div className="range-labels">
            <span>1초</span>
            <span>5초</span>
            <span>10초</span>
          </div>
        </div>

        <div className="setting-item">
          <button 
            className="btn btn-primary test-btn"
            onClick={testTTS}
            disabled={isTestingTTS}
          >
            {isTestingTTS ? '재생 중...' : '🔊 음성 테스트'}
          </button>
        </div>
      </div>

      {/* 앱 설정 */}
      <div className="settings-section">
        <h3 className="section-title">앱 설정</h3>
        
        <div className="setting-item">
          <label className="setting-label">테마</label>
          <select
            className="setting-select"
            value={settings.theme}
            onChange={(e) => handleSettingChange('theme', e.target.value)}
          >
            <option value="light">라이트 모드</option>
            <option value="dark">다크 모드</option>
            <option value="auto">시스템 설정 따름</option>
          </select>
          <div className="setting-description">
            다크 모드는 추후 업데이트에서 지원 예정입니다.
          </div>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="settings-section">
        <h3 className="section-title">데이터 관리</h3>
        
        <div className="setting-item">
          <div className="data-info">
            <span className="data-label">현재 데이터 크기</span>
            <span className="data-value">{getStorageInfo()}</span>
          </div>
        </div>

        <div className="setting-item">
          <button 
            className="btn btn-outline data-btn"
            onClick={exportData}
          >
            📤 데이터 백업
          </button>
          <div className="setting-description">
            모든 단어와 설정을 JSON 파일로 내보냅니다.
          </div>
        </div>

        <div className="setting-item">
          <label className="btn btn-outline data-btn">
            📥 데이터 복원
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              style={{ display: 'none' }}
            />
          </label>
          <div className="setting-description">
            백업 파일에서 데이터를 불러옵니다.
          </div>
        </div>

        <div className="setting-item">
          <button 
            className="btn btn-danger data-btn"
            onClick={clearAllData}
          >
            🗑️ 모든 데이터 삭제
          </button>
          <div className="setting-description">
            모든 단어와 설정을 영구적으로 삭제합니다.
          </div>
        </div>
      </div>

      {/* 앱 정보 */}
      <div className="settings-section">
        <h3 className="section-title">앱 정보</h3>
        
        <div className="app-info">
          <div className="info-item">
            <span className="info-label">앱 이름</span>
            <span className="info-value">VocabSnap</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">버전</span>
            <span className="info-value">1.0.0</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">설치 방법</span>
            <div className="info-description">
              모바일 브라우저에서 "홈 화면에 추가"를 선택하면 
              네이티브 앱처럼 사용할 수 있습니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;