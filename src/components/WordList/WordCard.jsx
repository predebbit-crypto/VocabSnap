import React, { useState } from 'react';
import { ttsService } from '../../services/ttsService';
import './WordCard.css';

const WordCard = ({ word, onUpdate, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);


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


  return (
    <div className={`word-card single-row ${word.learned ? 'learned' : ''} ${word.wrong_attempts > 0 ? 'has-errors' : ''}`}>
      <div className="word-row">
        <div className="word-content">
          <h3 className="word-text">{word.word}</h3>
          {word.wrong_attempts > 0 && (
            <span className="wrong-count">❌{word.wrong_attempts}</span>
          )}
        </div>
        
        <div className="word-actions">
          <button
            className={`btn-play-single ${isPlaying ? 'playing' : ''}`}
            onClick={playPronunciation}
            disabled={isPlaying}
            title="발음 듣기"
          >
            {isPlaying ? '🔊' : '🔊'}
          </button>
          
          <button
            className={`btn-correct ${word.learned ? 'active' : ''}`}
            onClick={handleLearnedToggle}
            title={word.learned ? '학습 완료' : '학습 중'}
          >
            {word.learned ? '✅' : '⭕'}
          </button>
          
          <button 
            className="btn-wrong"
            onClick={handleWrongAttempt}
            title="틀렸음 표시"
          >
            ❌
          </button>
          
          <button 
            className="btn-delete"
            onClick={() => onDelete(word.id)}
            title="단어 삭제"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

export default WordCard;