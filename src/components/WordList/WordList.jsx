import React, { useState, useEffect } from 'react';
import WordCard from './WordCard';
import { storageService } from '../../services/storageService';
import { ttsService } from '../../services/ttsService';
import './WordList.css';

const WordList = () => {
  const [words, setWords] = useState([]);
  const [filteredWords, setFilteredWords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, yesterday, week, month
  const [statusFilter, setStatusFilter] = useState('all'); // all, learned, unlearned, errors
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1);

  useEffect(() => {
    loadWords();
  }, []);

  useEffect(() => {
    filterWords();
  }, [words, searchQuery, dateFilter, statusFilter]);

  const loadWords = () => {
    const data = storageService.loadData();
    const sortedWords = data.words.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    setWords(sortedWords);
  };

  const filterWords = () => {
    let filtered = [...words];

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(word =>
        word.word.toLowerCase().includes(query) ||
        (word.meaning && word.meaning.toLowerCase().includes(query))
      );
    }

    // 날짜 필터
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(word => word.date_added === today);
        break;
      case 'yesterday':
        filtered = filtered.filter(word => word.date_added === yesterday);
        break;
      case 'week':
        filtered = filtered.filter(word => word.date_added >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(word => word.date_added >= monthAgo);
        break;
    }

    // 상태 필터
    switch (statusFilter) {
      case 'learned':
        filtered = filtered.filter(word => word.learned);
        break;
      case 'unlearned':
        filtered = filtered.filter(word => !word.learned);
        break;
      case 'errors':
        filtered = filtered.filter(word => word.wrong_attempts > 0);
        break;
    }

    setFilteredWords(filtered);
  };

  const handleWordUpdate = (wordId, updates) => {
    const updatedWord = storageService.updateWord(wordId, updates);
    if (updatedWord) {
      loadWords(); // 데이터 새로고침
    }
  };

  const handleWordDelete = (wordId) => {
    if (window.confirm('이 단어를 삭제하시겠습니까?')) {
      const deletedWord = storageService.deleteWord(wordId);
      if (deletedWord) {
        loadWords(); // 데이터 새로고침
      }
    }
  };

  const playAllWords = async () => {
    console.log('playAllWords 함수 호출됨');
    
    if (filteredWords.length === 0) {
      console.log('재생할 단어가 없습니다.');
      alert('재생할 단어가 없습니다.');
      return;
    }
    
    console.log('전체 재생 시작, 단어 수:', filteredWords.length);
    setIsPlayingAll(true);
    
    try {
      for (let i = 0; i < filteredWords.length; i++) {
        const word = filteredWords[i];
        console.log(`${i + 1}/${filteredWords.length}: ${word.word} 재생`);
        
        setCurrentPlayingIndex(i);

        // 첫 번째 재생
        console.log(`첫 번째 재생: ${word.word}`);
        await ttsService.speak(word.word, {
          language: 'en-US',
          rate: 0.9
        });

        // 5초 대기
        console.log('5초 대기...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 두 번째 재생
        console.log(`두 번째 재생: ${word.word}`);
        await ttsService.speak(word.word, {
          language: 'en-US',
          rate: 0.9
        });

        // 다음 단어로 넘어가기 전 4초 대기 (마지막 단어가 아닌 경우)
        if (i < filteredWords.length - 1) {
          console.log('4초 대기...');
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }

      console.log('전체 재생 완료');
    } catch (error) {
      console.error('전체 재생 실패:', error);
      alert('전체 재생 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsPlayingAll(false);
      setCurrentPlayingIndex(-1);
      console.log('전체 재생 종료');
    }
  };

  const stopPlayAll = () => {
    console.log('전체 재생 정지 요청');
    ttsService.stop();
    setIsPlayingAll(false);
    setCurrentPlayingIndex(-1);
  };

  const getFilterTitle = () => {
    const filterTitles = {
      all: '전체',
      today: '오늘',
      yesterday: '어제',
      week: '이번 주',
      month: '이번 달'
    };

    const statusTitles = {
      all: '',
      learned: ' (학습완료)',
      unlearned: ' (미학습)',
      errors: ' (오답)'
    };

    return filterTitles[dateFilter] + statusTitles[statusFilter];
  };

  return (
    <div className="word-list">
      {/* 필터 섹션 */}
      <div className="word-list-header">
        <div className="search-section">
          <input
            type="text"
            className="form-input search-input"
            placeholder="단어나 뜻으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label className="filter-label">기간</label>
            <select
              className="filter-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="today">오늘</option>
              <option value="yesterday">어제</option>
              <option value="week">이번 주</option>
              <option value="month">이번 달</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">상태</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="learned">학습완료</option>
              <option value="unlearned">미학습</option>
              <option value="errors">틀린단어</option>
            </select>
          </div>
        </div>

        {/* 통계 및 액션 */}
        <div className="list-stats">
          <div className="stats-info">
            <span className="stats-title">{getFilterTitle()}</span>
            <span className="stats-count">{filteredWords.length}개</span>
          </div>

          {filteredWords.length > 0 && (
            <div className="list-actions">
              {!isPlayingAll ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    console.log('전체 재생 버튼 클릭됨', e);
                    console.log('filteredWords:', filteredWords);
                    playAllWords();
                  }}
                >
                  🔊 전체 재생 ({filteredWords.length})
                </button>
              ) : (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={stopPlayAll}
                >
                  ⏹️ 정지
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 단어 목록 */}
      <div className="word-list-content">
        {filteredWords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>단어가 없습니다</h3>
            <p>
              {searchQuery || dateFilter !== 'all' || statusFilter !== 'all'
                ? '검색 조건에 맞는 단어를 찾을 수 없습니다.'
                : '카메라로 영어 단어를 촬영하여 추가해보세요!'}
            </p>
            {(searchQuery || dateFilter !== 'all' || statusFilter !== 'all') && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                  setStatusFilter('all');
                }}
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="words-container">
            {filteredWords.map((word, index) => (
              <div
                key={word.id}
                className={`word-wrapper ${
                  currentPlayingIndex === index ? 'playing' : ''
                }`}
              >
                <WordCard
                  word={word}
                  onUpdate={handleWordUpdate}
                  onDelete={handleWordDelete}
                />
                {currentPlayingIndex === index && (
                  <div className="playing-indicator">
                    <span>🔊 재생 중...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordList;