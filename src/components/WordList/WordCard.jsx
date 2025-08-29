import React, { useState } from 'react';
import { ttsService } from '../../services/ttsService';
import './WordCard.css';

const WordCard = ({ word, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    meaning: word.meaning || '',
    pronunciation: word.pronunciation || ''
  });
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSave = () => {
    onUpdate(word.id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      meaning: word.meaning || '',
      pronunciation: word.pronunciation || ''
    });
    setIsEditing(false);
  };

  const handleLearnedToggle = () => {
    onUpdate(word.id, { learned: !word.learned });
  };

  const handleWrongAttempt = () => {
    onUpdate(word.id, { 
      wrong_attempts: word.wrong_attempts + 1,
      last_reviewed: new Date().toISOString()
    });
  };

  const playPronunciation = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    try {
      await ttsService.speak(word.word, {
        language: 'en-US',
        rate: 0.9
      });
    } catch (error) {
      console.error('발음 재생 실패:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '오늘';
    if (diffDays === 2) return '어제';
    if (diffDays <= 7) return `${diffDays - 1}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className={`word-card ${word.learned ? 'learned' : ''} ${word.wrong_attempts > 0 ? 'has-errors' : ''}`}>
      <div className="word-header">
        <div className="word-main">
          <h3 className="word-text">{word.word}</h3>
          <button
            className={`btn-play ${isPlaying ? 'playing' : ''}`}
            onClick={playPronunciation}
            disabled={isPlaying}
            title="발음 듣기"
          >
            {isPlaying ? '🔊' : '🔊'}
          </button>
        </div>
        
        <div className="word-status">
          <button
            className={`btn-learned ${word.learned ? 'active' : ''}`}
            onClick={handleLearnedToggle}
            title={word.learned ? '학습 완료' : '학습 중'}
          >
            {word.learned ? '✅' : '⭕'}
          </button>
          
          {word.wrong_attempts > 0 && (
            <span className="wrong-count" title={`${word.wrong_attempts}번 틀림`}>
              ❌{word.wrong_attempts}
            </span>
          )}
        </div>
      </div>

      <div className="word-body">
        {isEditing ? (
          <div className="word-edit">
            <div className="form-group">
              <label className="form-label">발음기호</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: /ˈeksəmpəl/"
                value={editData.pronunciation}
                onChange={(e) => setEditData({
                  ...editData,
                  pronunciation: e.target.value
                })}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">뜻</label>
              <textarea
                className="form-input"
                placeholder="단어의 뜻을 입력하세요"
                rows="3"
                value={editData.meaning}
                onChange={(e) => setEditData({
                  ...editData,
                  meaning: e.target.value
                })}
              />
            </div>

            <div className="edit-actions">
              <button className="btn btn-success" onClick={handleSave}>
                저장
              </button>
              <button className="btn btn-outline" onClick={handleCancel}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="word-info">
            {word.pronunciation && (
              <div className="pronunciation">
                <span className="pronunciation-text">{word.pronunciation}</span>
              </div>
            )}
            
            {word.meaning ? (
              <div className="meaning">
                <p>{word.meaning}</p>
              </div>
            ) : (
              <div className="no-meaning">
                <p className="text-muted">뜻이 입력되지 않았습니다</p>
              </div>
            )}

            <div className="word-actions">
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => setIsEditing(true)}
              >
                편집
              </button>
              
              {!word.learned && (
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={handleWrongAttempt}
                  title="틀렸음 표시"
                >
                  틀림
                </button>
              )}
              
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(word.id)}
                title="단어 삭제"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="word-footer">
        <div className="word-meta">
          <span className="added-date">추가일: {formatDate(word.date_added)}</span>
          {word.confidence && (
            <span className="confidence">정확도: {Math.round(word.confidence)}%</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordCard;