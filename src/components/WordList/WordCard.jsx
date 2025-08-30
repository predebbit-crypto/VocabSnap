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
      // 사용자에게 에러 표시
      alert('음성 재생에 실패했습니다: ' + error.message);
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
    <div className={`word-card compact ${word.learned ? 'learned' : ''} ${word.wrong_attempts > 0 ? 'has-errors' : ''}`}>
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
        
        <div className="word-actions-compact">
          <button
            className={`btn-learned-compact ${word.learned ? 'active' : ''}`}
            onClick={handleLearnedToggle}
            title={word.learned ? '학습 완료' : '학습 중'}
          >
            {word.learned ? '✅' : '⭕'}
          </button>
          
          {!word.learned && (
            <button 
              className="btn-wrong-compact"
              onClick={handleWrongAttempt}
              title="틀렸음 표시"
            >
              ❌
            </button>
          )}
          
          <button 
            className="btn-delete-compact"
            onClick={() => onDelete(word.id)}
            title="단어 삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      {word.wrong_attempts > 0 && (
        <div className="wrong-indicator">
          ❌ {word.wrong_attempts}번 틀림
        </div>
      )}
    </div>
  );
};

export default WordCard;