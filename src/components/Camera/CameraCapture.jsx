import React, { useState, useRef, useEffect } from 'react';
import { ocrService } from '../../services/ocrService';
import { dictionaryService } from '../../services/dictionaryService';
import './CameraCapture.css';

const CameraCapture = ({ onWordsExtracted, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [progress, setProgress] = useState({ status: '', progress: 0 });
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkCameraSupport();
    return () => {
      stopCamera();
    };
  }, []);

  const checkCameraSupport = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setHasCamera(cameras.length > 0);
    } catch (error) {
      console.warn('카메라 확인 실패:', error);
      setHasCamera(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // 후면 카메라 선호
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('카메라 시작 실패:', error);
      onError('카메라에 접근할 수 없습니다. 권한을 확인해주세요.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Canvas 크기를 비디오 크기에 맞춤
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 비디오 프레임을 캔버스에 그리기
    ctx.drawImage(video, 0, 0);

    // 캔버스에서 이미지 데이터 생성
    const imageBlob = await ocrService.captureFromCanvas(canvas);
    setCapturedImage(URL.createObjectURL(imageBlob));

    // 카메라 중지
    stopCamera();

    // OCR 처리 시작
    processImage(imageBlob);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setCapturedImage(URL.createObjectURL(file));
      processImage(file);
    }
  };

  const processImage = async (imageFile) => {
    setIsProcessing(true);
    setProgress({ status: 'OCR 처리 중...', progress: 0 });
    setDebugInfo(null);

    try {
      const result = await ocrService.extractText(imageFile, {
        debug: debugMode,
        onProgress: (info) => {
          if (info.status) {
            setProgress({
              status: getProgressMessage(info.status),
              progress: info.progress ? Math.round(info.progress) : 0
            });
          }
        }
      });

      // 디버깅 정보 저장
      if (debugMode && result.debugInfo) {
        setDebugInfo(result.debugInfo);
      }

      if (result.success && result.words.length > 0) {
        // 개선된 단어 데이터 구조로 변환
        const enhancedWords = result.words.map(wordObj => ({
          word: wordObj.word,
          confidence: wordObj.confidence,
          bbox: wordObj.bbox,
          source: wordObj.source || 'ocr',
          imageData: null // 이미지 데이터는 별도로 전달
        }));
        
        onWordsExtracted(enhancedWords, await ocrService.imageToBase64(imageFile));
      } else {
        const errorMsg = result.error || '단어를 인식하지 못했습니다. 다른 이미지를 시도해보세요.';
        onError(errorMsg);
      }
    } catch (error) {
      console.error('이미지 처리 실패:', error);
      onError('이미지 처리 중 오류가 발생했습니다: ' + error.message);
      
      if (debugMode) {
        setDebugInfo({ error: error.message, stack: error.stack });
      }
    } finally {
      setIsProcessing(false);
      setProgress({ status: '', progress: 0 });
    }
  };

  const getProgressMessage = (status) => {
    const messages = {
      'preprocessing': '이미지 전처리 중...',
      'ocr processing': 'OCR 엔진 로딩 중...',
      'trying single_word_optimized': '단일 단어 인식 중...',
      'trying text_block': '텍스트 블록 인식 중...',
      'trying auto_segmentation': '자동 분할 인식 중...',
      'processing words': '단어 추출 중...',
      'initializing api': 'API 초기화 중...',
      'loading language traineddata': '언어 데이터 로드 중...',
      'initializing tesseract': 'OCR 엔진 초기화 중...',
      'loading language': '언어 설정 중...',
      'recognizing text': '텍스트 인식 중...',
      'done': '완료'
    };
    return messages[status] || status;
  };

  const retryCapture = () => {
    setCapturedImage(null);
    if (hasCamera) {
      startCamera();
    }
  };

  const handleManualInput = () => {
    setShowManualInput(true);
  };

  const handleManualWordSubmit = async () => {
    console.log('handleManualWordSubmit 호출됨'); // 디버깅용
    setIsSubmittingManual(true);
    const input = manualWord.trim();
    
    if (!input) {
      onError('단어를 입력해주세요.');
      setIsSubmittingManual(false);
      return;
    }

    try {
      // 쉼표나 줄바꿈으로만 분리 (공백은 단어 내에서 허용)
      let rawWords = [];
      
      // 줄바꿈으로 먼저 분리
      const lines = input.split(/\r?\n/);
      
      for (const line of lines) {
        if (line.trim()) {
          // 각 줄을 쉼표로 분리
          const wordsInLine = line.split(',').map(w => w.trim()).filter(w => w.length > 0);
          rawWords.push(...wordsInLine);
        }
      }

      console.log('파싱된 단어들:', rawWords); // 디버깅용
      
      if (rawWords.length === 0) {
        onError('올바른 단어를 입력해주세요.');
        setIsSubmittingManual(false);
        return;
      }

      const validWords = [];
      const invalidWords = [];

      // 각 단어/구문 검증 및 뜻 찾기
      for (const rawWord of rawWords) {
        const phrase = rawWord.trim().toLowerCase();
        
        // 영어 단어/구문 검증 (2글자 이상, 영어와 공백, 하이픈/아포스트로피만)
        if (/^[a-zA-Z'\s-]+$/.test(phrase) && phrase.length >= 2) {
          // 자동 뜻 찾기 (단일 단어인 경우만)
          let meaning = '';
          
          if (!phrase.includes(' ')) { // 단일 단어인 경우
            try {
              console.log(`${phrase} 한글 뜻 검색 중...`); // 디버깅용
              const lookupResult = await dictionaryService.lookupWordCached(phrase);
              
              if (lookupResult.success) {
                meaning = dictionaryService.formatMeaning(lookupResult);
                console.log(`${phrase} 한글 뜻 찾음:`, meaning); // 디버깅용
              }
            } catch (error) {
              console.warn(`${phrase} 뜻 검색 실패:`, error);
            }
          }

          validWords.push({
            word: phrase,
            meaning: meaning, // 자동으로 찾은 한글 뜻
            confidence: 100, // 수동 입력은 100% 신뢰도
            bbox: null,
            source: 'manual_input',
            imageData: null
          });
        } else {
          invalidWords.push(rawWord);
        }
      }

      console.log('유효한 단어들:', validWords); // 디버깅용
      console.log('잘못된 단어들:', invalidWords); // 디버깅용

      if (validWords.length === 0) {
        onError(`올바른 영어 단어가 없습니다. 2글자 이상의 영어 단어를 입력해주세요.${invalidWords.length > 0 ? ` (잘못된 단어: ${invalidWords.join(', ')})` : ''}`);
        setIsSubmittingManual(false);
        return;
      }

      // 잘못된 단어가 있으면 경고 메시지와 함께 진행
      if (invalidWords.length > 0) {
        console.warn('잘못된 단어 무시:', invalidWords);
      }

      console.log('onWordsExtracted 호출 시도'); // 디버깅용

      // 성공 콜백 호출
      onWordsExtracted(validWords, null);
      console.log('onWordsExtracted 성공'); // 디버깅용
      
      // 상태 초기화
      setManualWord('');
      setShowManualInput(false);
      setIsSubmittingManual(false);

      // 성공 메시지
      const wordsWithMeaning = validWords.filter(w => w.meaning).length;
      if (wordsWithMeaning > 0) {
        setTimeout(() => {
          onError(`${validWords.length}개 단어 추가됨. ${wordsWithMeaning}개 단어의 뜻을 자동으로 찾았습니다!`);
        }, 100);
      }

    } catch (error) {
      console.error('수동 입력 처리 에러:', error); // 디버깅용
      onError('단어 처리 중 오류가 발생했습니다.');
      setIsSubmittingManual(false);
    }

    // 성공 메시지 (선택사항)
    if (invalidWords.length > 0) {
      setTimeout(() => {
        onError(`${validWords.length}개 단어 추가됨. 잘못된 단어 제외: ${invalidWords.join(', ')}`);
      }, 100);
    }
  };

  const handleManualWordCancel = () => {
    setManualWord('');
    setShowManualInput(false);
  };

  return (
    <div className="camera-capture">
      {!capturedImage ? (
        <div className="capture-interface">
          {stream ? (
            // 카메라 뷰
            <div className="camera-view">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
              <div className="capture-overlay">
                <div className="capture-frame"></div>
                <button 
                  className="btn-capture"
                  onClick={capturePhoto}
                  disabled={isProcessing}
                >
                  📷
                </button>
              </div>
            </div>
          ) : (
            // 카메라 시작 또는 파일 업로드
            <div className="capture-options">
              <div className="capture-placeholder">
                <div className="placeholder-icon">📸</div>
                <h3>영어 단어 사진 찍기</h3>
                <p>카메라로 영어가 적힌 텍스트를 촬영하거나<br />갤러리에서 이미지를 선택하세요</p>
              </div>

              <div className="capture-buttons">
                {hasCamera && (
                  <button 
                    className="btn btn-primary capture-btn"
                    onClick={startCamera}
                    disabled={isProcessing}
                  >
                    📷 카메라 촬영
                  </button>
                )}
                
                <button 
                  className="btn btn-outline capture-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  🖼️ 갤러리에서 선택
                </button>
                
                <button 
                  className="btn btn-secondary capture-btn"
                  onClick={handleManualInput}
                  disabled={isProcessing}
                >
                  ⌨️ 직접 입력
                </button>
              </div>

              {/* 디버깅 모드 토글 */}
              <div className="debug-controls">
                <label className="debug-toggle">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                  <span className="debug-label">🔧 디버깅 모드</span>
                </label>
                {debugMode && (
                  <div className="debug-description">
                    OCR 처리 과정의 상세 정보를 표시합니다
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>
      ) : (
        // 캡처된 이미지 및 처리 상태
        <div className="captured-image-view">
          <div className="image-preview">
            <img src={capturedImage} alt="Captured" />
            {isProcessing && (
              <div className="processing-overlay">
                <div className="progress-info">
                  <div className="loading"></div>
                  <p>{progress.status}</p>
                  {progress.progress > 0 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${progress.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isProcessing && (
            <div className="image-actions">
              <button 
                className="btn btn-outline"
                onClick={retryCapture}
              >
                🔄 다시 촬영
              </button>
            </div>
          )}

          {/* 디버깅 정보 표시 */}
          {debugMode && debugInfo && !isProcessing && (
            <div className="debug-info">
              <h4>🔧 디버깅 정보</h4>
              
              {debugInfo.error ? (
                <div className="debug-error">
                  <strong>에러:</strong> {debugInfo.error}
                  {debugInfo.stack && (
                    <details>
                      <summary>스택 트레이스</summary>
                      <pre>{debugInfo.stack}</pre>
                    </details>
                  )}
                </div>
              ) : (
                <div className="debug-details">
                  {debugInfo.selectedStrategy && (
                    <div className="debug-item">
                      <strong>사용된 전략:</strong> {debugInfo.selectedStrategy}
                    </div>
                  )}
                  
                  {debugInfo.rawText && (
                    <div className="debug-item">
                      <strong>원본 텍스트:</strong>
                      <div className="debug-text">{debugInfo.rawText}</div>
                    </div>
                  )}
                  
                  {debugInfo.allResults && (
                    <div className="debug-item">
                      <strong>전체 인식 결과:</strong>
                      <details>
                        <summary>상세 보기</summary>
                        <div className="debug-results">
                          {debugInfo.allResults.map((result, index) => (
                            <div key={index} className="debug-result-item">
                              <div><strong>전략:</strong> {result.strategy}</div>
                              <div><strong>신뢰도:</strong> {result.confidence?.toFixed(1) || 0}%</div>
                              <div><strong>텍스트:</strong> "{result.text || '없음'}"</div>
                              <div><strong>단어 수:</strong> {result.words?.length || 0}개</div>
                              {result.error && (
                                <div className="debug-error"><strong>에러:</strong> {result.error}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                  
                  {debugInfo.processingSteps && (
                    <div className="debug-item">
                      <strong>처리 단계:</strong>
                      <ul className="debug-steps">
                        {debugInfo.processingSteps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 수동 단어 입력 모달 */}
      {showManualInput && (
        <div className="modal-overlay">
          <div className="modal-content manual-input-modal">
            <div className="modal-header">
              <h3>영어 단어 직접 입력</h3>
              <p>학습하고 싶은 영어 단어를 키보드로 입력하세요</p>
            </div>
            
            <div className="modal-body">
              <div className="manual-input-form">
                <textarea
                  className="manual-word-input"
                  placeholder="영어 단어/구문 입력&#10;예: apple&#10;weather forecast, beautiful day&#10;hello world"
                  value={manualWord}
                  onChange={(e) => setManualWord(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleManualWordSubmit();
                    }
                  }}
                  autoFocus
                  rows="4"
                />
                <div className="input-guidelines">
                  • 영어 단어나 구문을 입력할 수 있습니다 (예: "apple", "weather forecast")<br/>
                  • 여러 개는 <strong>쉼표(,)</strong> 또는 <strong>줄바꿈</strong>으로 구분하세요<br/>
                  • <strong>단일 단어는 자동으로 뜻을 찾아 저장됩니다!</strong><br/>
                  • Ctrl+Enter 키로 빠르게 추가할 수 있습니다
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={handleManualWordCancel}
              >
                취소
              </button>
              <button 
                className="btn btn-primary"
                onClick={(e) => {
                  console.log('버튼 클릭됨', e); // 디버깅용
                  e.preventDefault();
                  handleManualWordSubmit();
                }}
                disabled={!manualWord.trim() || isSubmittingManual}
                type="button"
              >
                {isSubmittingManual ? '추가 중...' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CameraCapture;