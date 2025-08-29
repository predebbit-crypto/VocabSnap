import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import './Statistics.css';

const Statistics = () => {
  const [stats, setStats] = useState({
    totalWords: 0,
    learnedWords: 0,
    unlearnedWords: 0,
    errorWords: 0,
    completionRate: 0,
    studyStreak: 0,
    lastStudyDate: null,
    dailyStats: [],
    weeklyStats: [],
    monthlyStats: []
  });

  useEffect(() => {
    calculateStatistics();
  }, []);

  const calculateStatistics = () => {
    const data = storageService.loadData();
    const words = data.words;

    // 기본 통계
    const totalWords = words.length;
    const learnedWords = words.filter(w => w.learned).length;
    const unlearnedWords = totalWords - learnedWords;
    const errorWords = words.filter(w => w.wrong_attempts > 0).length;
    const completionRate = totalWords > 0 ? (learnedWords / totalWords) * 100 : 0;

    // 날짜별 통계 계산
    const dailyStats = calculateDailyStats(words);
    const weeklyStats = calculateWeeklyStats(words);
    const monthlyStats = calculateMonthlyStats(words);

    // 연속 학습 일수 계산
    const studyStreak = calculateStudyStreak(words);
    const lastStudyDate = getLastStudyDate(words);

    setStats({
      totalWords,
      learnedWords,
      unlearnedWords,
      errorWords,
      completionRate,
      studyStreak,
      lastStudyDate,
      dailyStats,
      weeklyStats,
      monthlyStats
    });
  };

  const calculateDailyStats = (words) => {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayWords = words.filter(w => w.date_added === dateString);
      const dayLearned = dayWords.filter(w => w.learned).length;

      last7Days.push({
        date: dateString,
        label: i === 0 ? '오늘' : i === 1 ? '어제' : `${i}일전`,
        added: dayWords.length,
        learned: dayLearned,
        day: date.toLocaleDateString('ko-KR', { weekday: 'short' })
      });
    }

    return last7Days;
  };

  const calculateWeeklyStats = (words) => {
    const last4Weeks = [];
    const today = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartString = weekStart.toISOString().split('T')[0];
      const weekEndString = weekEnd.toISOString().split('T')[0];

      const weekWords = words.filter(w => 
        w.date_added >= weekStartString && w.date_added <= weekEndString
      );
      const weekLearned = weekWords.filter(w => w.learned).length;

      last4Weeks.push({
        week: i === 0 ? '이번 주' : `${i}주 전`,
        startDate: weekStartString,
        endDate: weekEndString,
        added: weekWords.length,
        learned: weekLearned
      });
    }

    return last4Weeks;
  };

  const calculateMonthlyStats = (words) => {
    const monthsData = new Map();
    
    words.forEach(word => {
      const date = new Date(word.date_added);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthsData.has(monthKey)) {
        monthsData.set(monthKey, {
          month: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }),
          added: 0,
          learned: 0
        });
      }
      
      const monthData = monthsData.get(monthKey);
      monthData.added++;
      if (word.learned) monthData.learned++;
    });

    return Array.from(monthsData.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6);
  };

  const calculateStudyStreak = (words) => {
    if (words.length === 0) return 0;

    const dates = [...new Set(words.map(w => w.date_added))].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let streak = 0;
    let currentDate = today;

    // 오늘 또는 어제부터 시작
    if (dates[0] === today) {
      streak = 1;
      currentDate = yesterday;
    } else if (dates[0] === yesterday) {
      streak = 1;
      currentDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    } else {
      return 0;
    }

    // 연속 날짜 확인
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] === currentDate) {
        streak++;
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = prevDate.toISOString().split('T')[0];
      } else {
        break;
      }
    }

    return streak;
  };

  const getLastStudyDate = (words) => {
    const learnedWords = words.filter(w => w.learned);
    if (learnedWords.length === 0) return null;

    const lastLearned = learnedWords.reduce((latest, word) => {
      const wordDate = word.last_reviewed || word.date_added;
      const latestDate = latest.last_reviewed || latest.date_added;
      return wordDate > latestDate ? word : latest;
    });

    return lastLearned.last_reviewed || lastLearned.date_added;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '없음';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
  };

  const getProgressColor = (rate) => {
    if (rate >= 80) return 'var(--success-color)';
    if (rate >= 50) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  return (
    <div className="statistics">
      {/* 전체 요약 */}
      <div className="stats-overview">
        <div className="stats-card">
          <div className="stats-icon">📚</div>
          <div className="stats-content">
            <div className="stats-number">{stats.totalWords}</div>
            <div className="stats-label">총 단어 수</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon">✅</div>
          <div className="stats-content">
            <div className="stats-number">{stats.learnedWords}</div>
            <div className="stats-label">학습 완료</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon">📖</div>
          <div className="stats-content">
            <div className="stats-number">{stats.unlearnedWords}</div>
            <div className="stats-label">미학습</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon">❌</div>
          <div className="stats-content">
            <div className="stats-number">{stats.errorWords}</div>
            <div className="stats-label">오답 단어</div>
          </div>
        </div>
      </div>

      {/* 진도율 */}
      <div className="progress-section">
        <div className="section-title">학습 진도</div>
        <div className="progress-container">
          <div className="progress-bar-large">
            <div 
              className="progress-fill-large"
              style={{ 
                width: `${stats.completionRate}%`,
                backgroundColor: getProgressColor(stats.completionRate)
              }}
            ></div>
          </div>
          <div className="progress-text">
            <span className="progress-percentage">
              {stats.completionRate.toFixed(1)}%
            </span>
            <span className="progress-description">
              {stats.totalWords > 0 ? `${stats.learnedWords}/${stats.totalWords} 완료` : '단어 없음'}
            </span>
          </div>
        </div>
      </div>

      {/* 학습 현황 */}
      <div className="study-status">
        <div className="status-card">
          <div className="status-icon">🔥</div>
          <div className="status-content">
            <div className="status-number">{stats.studyStreak}</div>
            <div className="status-label">연속 학습 일수</div>
          </div>
        </div>

        <div className="status-card">
          <div className="status-icon">📅</div>
          <div className="status-content">
            <div className="status-text">{formatDate(stats.lastStudyDate)}</div>
            <div className="status-label">마지막 학습일</div>
          </div>
        </div>
      </div>

      {/* 일별 통계 */}
      <div className="daily-stats">
        <div className="section-title">최근 7일 활동</div>
        <div className="daily-chart">
          {stats.dailyStats.map((day, index) => (
            <div key={index} className="daily-bar">
              <div className="bar-container">
                <div 
                  className="bar-added"
                  style={{ height: `${Math.max(day.added * 20, 5)}px` }}
                  title={`추가: ${day.added}개`}
                ></div>
                <div 
                  className="bar-learned"
                  style={{ height: `${Math.max(day.learned * 20, day.learned > 0 ? 5 : 0)}px` }}
                  title={`학습: ${day.learned}개`}
                ></div>
              </div>
              <div className="bar-label">
                <div className="bar-day">{day.day}</div>
                <div className="bar-date">{day.label}</div>
                <div className="bar-numbers">
                  <span className="added-count">{day.added}</span>
                  {day.learned > 0 && <span className="learned-count">/{day.learned}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color added"></div>
            <span>추가된 단어</span>
          </div>
          <div className="legend-item">
            <div className="legend-color learned"></div>
            <span>학습 완료</span>
          </div>
        </div>
      </div>

      {/* 주별 통계 */}
      <div className="weekly-stats">
        <div className="section-title">주별 학습 현황</div>
        <div className="weekly-list">
          {stats.weeklyStats.map((week, index) => (
            <div key={index} className="weekly-item">
              <div className="weekly-period">{week.week}</div>
              <div className="weekly-progress">
                <div className="weekly-numbers">
                  <span>추가: {week.added}개</span>
                  <span>완료: {week.learned}개</span>
                </div>
                <div className="weekly-bar">
                  <div 
                    className="weekly-fill"
                    style={{ 
                      width: week.added > 0 ? `${(week.learned / week.added) * 100}%` : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 월별 통계 */}
      {stats.monthlyStats.length > 0 && (
        <div className="monthly-stats">
          <div className="section-title">월별 누적 통계</div>
          <div className="monthly-list">
            {stats.monthlyStats.map((month, index) => (
              <div key={index} className="monthly-item">
                <div className="monthly-period">{month.month}</div>
                <div className="monthly-numbers">
                  <span className="monthly-added">{month.added}개 추가</span>
                  <span className="monthly-learned">{month.learned}개 완료</span>
                  <span className="monthly-rate">
                    {month.added > 0 ? Math.round((month.learned / month.added) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;