import React, { useState, useEffect } from 'react';
import CameraCapture from './components/Camera/CameraCapture';
import WordList from './components/WordList/WordList';
import Statistics from './components/Statistics/Statistics';
import Settings from './components/Settings/Settings';
import { storageService } from './services/storageService';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [todayStats, setTodayStats] = useState({
    totalWords: 0,
    learnedWords: 0,
    todayAdded: 0
  });
  const [showWordResults, setShowWordResults] = useState(false);
  const [extractedWords, setExtractedWords] = useState([]);

  useEffect(() => {
    updateTodayStats();
  }, []);

  const updateTodayStats = () => {
    const data = storageService.loadData();
    const today = new Date().toISOString().split('T')[0];
    const todayWords = data.words.filter(word => word.date_added === today);
    
    setTodayStats({
      totalWords: data.words.length,
      learnedWords: data.words.filter(w => w.learned).length,
      todayAdded: todayWords.length
    });
  };

  const handleWordsExtracted = (words, imageData) => {
    console.log('App: handleWordsExtracted 호출됨', words); // 디버깅용
    if (words.length === 0) return;

    // 이미지 데이터를 포함하여 단어 배열 생성
    const wordsWithImage = words.map(wordObj => ({
      ...wordObj,
      imageData
    }));

    console.log('App: 모달 표시 준비', wordsWithImage); // 디버깅용
    setExtractedWords(wordsWithImage);
    setShowWordResults(true);
    console.log('App: showWordResults 상태 변경됨', true); // 디버깅용
  };

  const handleSaveWords = (selectedWords) => {
    console.log('App: handleSaveWords 호출됨', selectedWords); // 디버깅용
    if (selectedWords.length > 0) {
      try {
        console.log('App: storageService.addWords 호출 시도'); // 디버깅용
        const addedWords = storageService.addWords(selectedWords);
        console.log('App: 저장된 단어들', addedWords); // 디버깅용
        
        if (addedWords.length > 0) {
          console.log('App: 상태 업데이트 시작'); // 디버깅용
          updateTodayStats();
          setActiveTab('words'); // 단어장 탭으로 이동
          setShowWordResults(false);
          setExtractedWords([]);
          console.log('App: 상태 업데이트 완료'); // 디버깅용
        } else {
          console.warn('App: 저장된 단어가 없음'); // 디버깅용
        }
      } catch (error) {
        console.error('App: 단어 저장 중 오류', error); // 디버깅용
        alert('단어 저장 중 오류가 발생했습니다: ' + error.message);
      }
    } else {
      console.warn('App: 선택된 단어가 없음'); // 디버깅용
    }
  };

  const handleCancelWords = () => {
    setShowWordResults(false);
    setExtractedWords([]);
  };

  const handleError = (error) => {
    console.error('Error:', error);
    // 여기에 에러 처리 로직 추가 (예: 토스트 메시지)
    alert(error);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="home-tab">
            <div className="home-header">
              <h1 className="app-title">VocabSnap</h1>
              <p className="app-subtitle">사진으로 영어 단어 학습하기</p>
            </div>

            {/* 오늘의 통계 */}
            <div className="today-stats">
              <div className="stat-card">
                <div className="stat-number">{todayStats.totalWords}</div>
                <div className="stat-label">총 단어</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{todayStats.learnedWords}</div>
                <div className="stat-label">학습완료</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{todayStats.todayAdded}</div>
                <div className="stat-label">오늘 추가</div>
              </div>
            </div>

            {/* 카메라 캡처 */}
            <div className="camera-section">
              <CameraCapture 
                onWordsExtracted={handleWordsExtracted}
                onError={handleError}
              />
            </div>
          </div>
        );

      case 'words':
        return <WordList />;

      case 'stats':
        return <Statistics />;

      case 'settings':
        return <Settings />;

      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* 메인 콘텐츠 */}
      <main className="main-content">
        <div className="container">
          {renderTabContent()}
        </div>
      </main>

      {/* 하단 네비게이션 */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">홈</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveTab('words')}
        >
          <span className="nav-icon">📚</span>
          <span className="nav-label">단어장</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">통계</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">설정</span>
        </button>
      </nav>

      {/* 단어 결과 모달 */}
      {showWordResults && (
        <WordResultsModal
          words={extractedWords}
          onSave={handleSaveWords}
          onCancel={handleCancelWords}
        />
      )}

      {/* 디버깅 정보 (개발용) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          showWordResults: {showWordResults.toString()}<br/>
          extractedWords: {extractedWords.length}개<br/>
          activeTab: {activeTab}
        </div>
      )}
    </div>
  );
}

// 단어 결과 모달 컴포넌트
const WordResultsModal = ({ words, onSave, onCancel }) => {
  console.log('WordResultsModal 렌더링됨', words); // 디버깅용
  const [selectedWords, setSelectedWords] = useState(
    words.map(word => ({ ...word, selected: true }))
  );

  const toggleWordSelection = (index) => {
    const updated = [...selectedWords];
    updated[index].selected = !updated[index].selected;
    setSelectedWords(updated);
  };

  const handleSave = () => {
    console.log('Modal: handleSave 호출됨'); // 디버깅용
    const wordsToSave = selectedWords.filter(word => word.selected);
    console.log('Modal: 저장할 단어들', wordsToSave); // 디버깅용
    try {
      onSave(wordsToSave);
      console.log('Modal: onSave 호출 완료'); // 디버깅용
    } catch (error) {
      console.error('Modal: onSave 에러', error); // 디버깅용
    }
  };

  const selectedCount = selectedWords.filter(word => word.selected).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>인식된 단어들</h3>
          <p>저장할 단어를 선택하세요 ({selectedCount}개 선택됨)</p>
        </div>

        <div className="modal-body">
          <div className="word-results">
            {selectedWords.map((wordData, index) => (
              <div key={index} className="word-result-item">
                <label className="word-checkbox">
                  <input
                    type="checkbox"
                    checked={wordData.selected}
                    onChange={() => toggleWordSelection(index)}
                  />
                  <span className="word-result-text">
                    {wordData.word}
                    {wordData.confidence && (
                      <span className="confidence-badge">
                        {Math.round(wordData.confidence)}%
                      </span>
                    )}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            취소
          </button>
          <button 
            className="btn btn-primary" 
            onClick={(e) => {
              console.log('Modal: 저장 버튼 클릭됨', e); // 디버깅용
              e.preventDefault();
              handleSave();
            }}
            disabled={selectedCount === 0}
            type="button"
          >
            {selectedCount}개 저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;