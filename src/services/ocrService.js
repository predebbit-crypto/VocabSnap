import Tesseract from 'tesseract.js';

export const ocrService = {
  // 최적화된 Tesseract 설정
  defaultTesseractConfig: {
    tessedit_ocr_engine_mode: '1', // OEM 1: LSTM 엔진만 사용
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\'-.', // 영어 + 기본 구두점
    tessjs_create_hocr: '0',
    tessjs_create_tsv: '0',
    tessjs_create_pdf: '0',
    // 정확도 향상 설정
    tessedit_do_invert: '0',
    tessedit_zero_kelvin_approach: '0',
    tessedit_zero_rejection: '0',
    tessedit_minimal_rej_features: '1',
    // 성능 최적화
    tessedit_parallelize: '1',
    tessedit_use_reject_reasons: '0'
  },

  // 이미지 타입별 최적화된 PSM 전략
  optimizedStrategies: [
    {
      name: 'single_word_high_quality',
      description: '고품질 단일 단어',
      config: {
        tessedit_pageseg_mode: '8', // 단일 단어
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '0',
        tessedit_enable_doc_dict: '1'
      }
    },
    {
      name: 'text_line_optimized',
      description: '텍스트 라인 최적화',
      config: {
        tessedit_pageseg_mode: '7', // 단일 텍스트 라인
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
        tessedit_enable_doc_dict: '1'
      }
    },
    {
      name: 'text_block_dense',
      description: '밀집된 텍스트 블록',
      config: {
        tessedit_pageseg_mode: '6', // 단일 텍스트 블록
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
        tessedit_enable_doc_dict: '1'
      }
    },
    {
      name: 'sparse_text_auto',
      description: '희소 텍스트 자동',
      config: {
        tessedit_pageseg_mode: '3', // 자동 페이지 분할
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
        tessedit_enable_doc_dict: '0' // 자동 모드에서는 사전 비활성화
      }
    },
    {
      name: 'mixed_content',
      description: '혼합 콘텐츠',
      config: {
        tessedit_pageseg_mode: '11', // 희소한 텍스트
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1'
      }
    }
  ],

  // 메인 텍스트 추출 함수 (다중 전략 사용)
  async extractText(imageFile, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const enableDebug = options.debug || false;
    
    try {
      onProgress({ status: 'preprocessing', progress: 0 });
      
      // 1단계: 이미지 회전 감지 및 보정
      onProgress({ status: 'rotation detection', progress: 5 });
      const rotationCorrectedImage = await this.detectAndCorrectRotation(imageFile);
      
      // 2단계: 이미지 전처리
      onProgress({ status: 'preprocessing', progress: 10 });
      const preprocessedImage = await this.preprocessImage(rotationCorrectedImage, {
        enhance: true,
        resize: true,
        sharpen: true,
        binarize: true,
        denoise: true
      });

      onProgress({ status: 'ocr processing', progress: 20 });

      // 2단계: 다중 인식 전략 시도
      const results = await this.tryMultipleRecognitionStrategies(
        preprocessedImage, 
        onProgress,
        enableDebug
      );

      // 3단계: 최적의 결과 선택
      const bestResult = this.selectBestResult(results);

      onProgress({ status: 'processing words', progress: 90 });

      // 4단계: 단어 추출 및 후처리
      const processedWords = this.extractAndProcessWords(bestResult, enableDebug);

      onProgress({ status: 'done', progress: 100 });

      return {
        success: true,
        text: bestResult.text || '',
        words: processedWords,
        confidence: bestResult.confidence || 0,
        debugInfo: enableDebug ? {
          allResults: results,
          selectedStrategy: bestResult.strategy,
          rawText: bestResult.text,
          processingSteps: bestResult.processingSteps
        } : undefined
      };

    } catch (error) {
      console.error('OCR 처리 실패:', error);
      return {
        success: false,
        error: error.message,
        text: '',
        words: [],
        debugInfo: enableDebug ? { error: error.message, stack: error.stack } : undefined
      };
    }
  },

  // 향상된 다중 인식 전략
  async tryMultipleRecognitionStrategies(imageFile, onProgress, enableDebug = false) {
    const results = [];
    
    // 최적화된 전략 순서 (성공률 높은 순)
    const strategiesToTry = this.optimizedStrategies;

    for (let i = 0; i < strategiesToTry.length; i++) {
      const strategy = strategiesToTry[i];
      const progressBase = 20 + (i * 70 / strategiesToTry.length);
      
      try {
        onProgress({ 
          status: `trying ${strategy.name}`, 
          progress: progressBase 
        });

        const config = {
          ...this.defaultTesseractConfig,
          ...strategy.config
        };

        const { data } = await Tesseract.recognize(imageFile, 'eng', {
          logger: (info) => {
            if (info.status && info.progress) {
              onProgress({
                status: `${strategy.description}: ${this.getKoreanProgressStatus(info.status)}`,
                progress: progressBase + (info.progress * 70 / strategiesToTry.length)
              });
            }
          },
          ...config
        });

        // 결과 품질 평가
        const qualityScore = this.evaluateRecognitionQuality(data);
        
        results.push({
          strategy: strategy.name,
          description: strategy.description,
          confidence: data.confidence || 0,
          qualityScore: qualityScore,
          text: data.text || '',
          words: data.words || [],
          lines: data.lines || [],
          symbols: data.symbols || [],
          paragraphs: data.paragraphs || [],
          processingSteps: enableDebug ? [
            `Strategy: ${strategy.name} (${strategy.description})`,
            `Confidence: ${data.confidence?.toFixed(1) || 0}%`,
            `Quality Score: ${qualityScore.toFixed(1)}`,
            `Words Found: ${data.words?.length || 0}`,
            `Text Length: ${(data.text || '').length}`
          ] : []
        });

        // 매우 높은 품질의 결과를 얻으면 조기 종료
        if (qualityScore > 90 && data.confidence > 80) {
          if (enableDebug) {
            results[results.length - 1].processingSteps.push('Early exit: High quality result achieved');
          }
          break;
        }

        // 좋은 결과를 얻었고 3개 이상 시도했으면 조기 종료 고려
        if (i >= 2 && qualityScore > 70 && data.confidence > 70) {
          if (enableDebug) {
            results[results.length - 1].processingSteps.push('Early exit: Good result after multiple attempts');
          }
          break;
        }

      } catch (error) {
        console.warn(`전략 ${strategy.name} 실패:`, error);
        results.push({
          strategy: strategy.name,
          description: strategy.description,
          confidence: 0,
          qualityScore: 0,
          text: '',
          words: [],
          error: error.message,
          processingSteps: enableDebug ? [
            `Strategy: ${strategy.name} (${strategy.description})`,
            `Error: ${error.message}`
          ] : []
        });
      }
    }

    return results;
  },

  // 인식 결과 품질 평가
  evaluateRecognitionQuality(data) {
    let score = 0;
    
    // 기본 신뢰도 (40점)
    score += (data.confidence || 0) * 0.4;
    
    // 단어 개수 보너스 (20점)
    const wordCount = (data.words || []).length;
    score += Math.min(wordCount * 4, 20);
    
    // 텍스트 길이 보너스 (15점)
    const textLength = (data.text || '').trim().length;
    score += Math.min(textLength * 0.5, 15);
    
    // 유효한 영어 단어 비율 (15점)
    if (data.words && data.words.length > 0) {
      const validWords = data.words.filter(wordObj => {
        const word = wordObj.text || wordObj.word || '';
        return this.isValidEnglishWord(word);
      });
      const validRatio = validWords.length / data.words.length;
      score += validRatio * 15;
    }
    
    // 평균 단어 신뢰도 (10점)
    if (data.words && data.words.length > 0) {
      const avgWordConfidence = data.words.reduce((sum, word) => 
        sum + (word.confidence || 0), 0) / data.words.length;
      score += avgWordConfidence * 0.1;
    }
    
    return Math.min(100, Math.max(0, score));
  },

  // 진행 상태 한국어 변환
  getKoreanProgressStatus(status) {
    const statusMap = {
      'initializing api': 'API 초기화',
      'loading language traineddata': '언어 데이터 로딩',
      'initializing tesseract': 'OCR 엔진 초기화',
      'loading language': '언어 설정',
      'recognizing text': '텍스트 인식',
      'done': '완료'
    };
    return statusMap[status] || status;
  },

  // 최적의 결과 선택 (품질 점수 기반)
  selectBestResult(results) {
    if (!results || results.length === 0) {
      return { confidence: 0, text: '', words: [], strategy: 'none', qualityScore: 0 };
    }

    // 에러가 없는 결과들만 필터링
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      // 모든 결과가 에러인 경우 첫 번째 결과 반환
      return { ...results[0], qualityScore: 0 };
    }

    // 품질 점수가 있는 결과들 우선
    const qualityResults = validResults.filter(r => r.qualityScore !== undefined);
    
    if (qualityResults.length > 0) {
      // 품질 점수와 신뢰도를 종합적으로 고려
      const bestResult = qualityResults.reduce((best, current) => {
        // 종합 점수 = 품질점수 * 0.6 + 신뢰도 * 0.4
        const bestScore = (best.qualityScore || 0) * 0.6 + (best.confidence || 0) * 0.4;
        const currentScore = (current.qualityScore || 0) * 0.6 + (current.confidence || 0) * 0.4;
        
        return currentScore > bestScore ? current : best;
      });
      
      return bestResult;
    }

    // 품질 점수가 없는 경우 기존 로직 사용
    const scoredResults = validResults.map(result => {
      const wordCount = Array.isArray(result.words) ? result.words.length : 0;
      const textLength = result.text ? result.text.trim().length : 0;
      const validWordCount = this.countValidEnglishWords(result.words || []);
      
      // 개선된 점수 계산
      // 기본 신뢰도 (40%) + 유효 단어 개수 (30%) + 텍스트 품질 (20%) + 길이 (10%)
      const score = 
        (result.confidence || 0) * 0.4 + 
        validWordCount * 8 * 0.3 + 
        (validWordCount / Math.max(wordCount, 1)) * 100 * 0.2 + 
        Math.min(textLength, 50) * 0.1;
      
      return { ...result, score };
    });

    return scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  },

  // 유효한 영어 단어 개수 계산
  countValidEnglishWords(words) {
    if (!Array.isArray(words)) return 0;
    
    return words.filter(wordObj => {
      const word = wordObj.text || wordObj.word || '';
      const confidence = wordObj.confidence || 0;
      
      return this.isHighQualityEnglishWord(word, confidence);
    }).length;
  },

  // 라인 기반 단어 추출 및 후처리 (새로운 기준 적용)
  extractAndProcessWords(result, enableDebug = false) {
    const words = [];
    
    // 1단계: 라인별로 텍스트 분석
    const linesData = this.extractLinesWithBoundingBoxes(result);
    
    // 2단계: 각 라인에서 왼쪽부터 첫 번째 영어 단어만 추출
    for (const lineData of linesData) {
      const extractedWord = this.extractFirstEnglishWordFromLine(lineData, enableDebug);
      
      if (extractedWord && this.isHighQualityEnglishWord(extractedWord.word, extractedWord.confidence)) {
        words.push({
          word: extractedWord.word.toLowerCase(),
          confidence: extractedWord.confidence,
          bbox: extractedWord.bbox,
          line: lineData.lineText,
          source: 'line_based_extraction'
        });
      }
    }

    // 3단계: fallback - 라인 데이터가 부족한 경우 기존 방식 사용
    if (words.length === 0) {
      const fallbackWords = this.fallbackWordExtraction(result, enableDebug);
      words.push(...fallbackWords);
    }

    // 4단계: 최종 품질 검증 및 정리
    const qualityFilteredWords = words.filter(wordObj => 
      this.passesQualityCheck(wordObj.word, wordObj.confidence)
    );

    // 중복 제거 및 정리
    const uniqueWords = this.removeDuplicateWords(qualityFilteredWords);
    
    // Y 좌표 순으로 정렬 (위에서 아래로)
    return uniqueWords.sort((a, b) => {
      if (a.bbox && b.bbox) {
        return a.bbox.y0 - b.bbox.y0;
      }
      return b.confidence - a.confidence; // bbox가 없으면 신뢰도 순
    });
  },

  // 라인별 데이터 추출 (bounding box 포함)
  extractLinesWithBoundingBoxes(result) {
    const linesData = [];
    
    // 1순위: Tesseract lines 데이터 사용
    if (result.lines && Array.isArray(result.lines) && result.lines.length > 0) {
      for (const line of result.lines) {
        const lineText = line.text || '';
        const bbox = line.bbox || null;
        const words = line.words || [];
        
        if (lineText.trim()) {
          linesData.push({
            lineText: lineText,
            bbox: bbox,
            words: words,
            source: 'tesseract_lines'
          });
        }
      }
    }
    
    // 2순위: paragraphs에서 라인 추출
    else if (result.paragraphs && Array.isArray(result.paragraphs)) {
      for (const paragraph of result.paragraphs) {
        if (paragraph.lines && Array.isArray(paragraph.lines)) {
          for (const line of paragraph.lines) {
            const lineText = line.text || '';
            const bbox = line.bbox || null;
            const words = line.words || [];
            
            if (lineText.trim()) {
              linesData.push({
                lineText: lineText,
                bbox: bbox,
                words: words,
                source: 'paragraph_lines'
              });
            }
          }
        }
      }
    }
    
    // 3순위: 전체 텍스트를 줄바꿈으로 분할
    else if (result.text) {
      const textLines = result.text.split(/\r?\n/);
      for (let i = 0; i < textLines.length; i++) {
        const lineText = textLines[i].trim();
        if (lineText) {
          linesData.push({
            lineText: lineText,
            bbox: null,
            words: [],
            source: 'text_split_lines'
          });
        }
      }
    }

    return linesData;
  },

  // 각 라인에서 왼쪽부터 첫 번째 영어 단어 추출
  extractFirstEnglishWordFromLine(lineData, enableDebug = false) {
    const { lineText, words, bbox } = lineData;
    
    // 1순위: line의 words 데이터에서 왼쪽부터 첫 번째 영어 단어 찾기
    if (words && Array.isArray(words) && words.length > 0) {
      // X 좌표 순으로 정렬 (왼쪽부터)
      const sortedWords = words
        .filter(word => word.bbox && typeof word.bbox.x0 === 'number')
        .sort((a, b) => a.bbox.x0 - b.bbox.x0);
      
      for (const wordObj of sortedWords) {
        const word = this.extractWordFromTesseractObject(wordObj);
        if (word && this.isValidEnglishWordStart(word.text, lineText)) {
          return {
            word: word.text,
            confidence: word.confidence,
            bbox: word.bbox
          };
        }
      }
    }
    
    // 2순위: 텍스트 파싱으로 첫 번째 영어 단어 추출
    return this.parseFirstEnglishWordFromText(lineText, bbox);
  },

  // 텍스트에서 첫 번째 영어 단어 파싱
  parseFirstEnglishWordFromText(lineText, bbox) {
    if (!lineText) return null;
    
    // 한국어, 괄호, 특수문자 등을 제거하고 영어 단어만 추출
    const cleanedText = lineText
      // 한국어 제거
      .replace(/[\u3131-\u3163\uac00-\ud7a3]/g, ' ')
      // 대괄호와 내용 제거
      .replace(/\[[^\]]*\]/g, ' ')
      // 소괄호와 내용 제거  
      .replace(/\([^)]*\)/g, ' ')
      // 중괄호와 내용 제거
      .replace(/\{[^}]*\}/g, ' ')
      // 숫자 제거
      .replace(/\d+/g, ' ')
      // 특수문자를 공백으로 변경
      .replace(/[^\w\s'-]/g, ' ')
      // 연속 공백 제거
      .replace(/\s+/g, ' ')
      .trim();

    // 왼쪽부터 첫 번째 유효한 영어 단어 찾기
    const words = cleanedText.split(/\s+/);
    
    for (const word of words) {
      const trimmedWord = word.trim();
      if (trimmedWord.length >= 2 && /^[a-zA-Z'-]+$/.test(trimmedWord)) {
        // 추가 검증
        if (this.isValidEnglishWordPattern(trimmedWord)) {
          return {
            word: trimmedWord,
            confidence: 75, // 텍스트 파싱 기본 신뢰도
            bbox: bbox
          };
        }
      }
    }
    
    return null;
  },

  // 유효한 영어 단어 시작인지 확인
  isValidEnglishWordStart(word, lineText) {
    if (!this.isValidEnglishWordPattern(word)) {
      return false;
    }
    
    // 괄호 안에 있는지 확인
    const wordIndex = lineText.indexOf(word);
    if (wordIndex === -1) return true;
    
    const beforeWord = lineText.substring(0, wordIndex);
    const afterWord = lineText.substring(wordIndex + word.length);
    
    // 괄호 안에 있으면 제외
    const openBrackets = (beforeWord.match(/[\[\({\<]/g) || []).length;
    const closeBrackets = (beforeWord.match(/[\]\)}\>]/g) || []).length;
    
    if (openBrackets > closeBrackets) {
      return false; // 괄호 안에 있음
    }
    
    // 한국어 바로 뒤에 오는지 확인
    if (/[\u3131-\u3163\uac00-\ud7a3]\s*$/.test(beforeWord)) {
      return false; // 한국어 뒤에 있으면 제외
    }
    
    return true;
  },

  // 유효한 영어 단어 패턴인지 확인
  isValidEnglishWordPattern(word) {
    if (!word || typeof word !== 'string') return false;
    
    const trimmed = word.trim();
    
    // 기본 검증
    if (trimmed.length < 2 || trimmed.length > 20) return false;
    if (!/^[a-zA-Z'-]+$/.test(trimmed)) return false;
    if (/^['-]|['-]$|--+|''+/.test(trimmed)) return false;
    
    // 모음 포함 확인 (일부 예외 제외)
    if (!/[aeiou]/i.test(trimmed)) {
      const noVowelExceptions = ['by', 'cry', 'dry', 'fly', 'fry', 'my', 'pry', 'shy', 'sky', 'sly', 'spy', 'try', 'why'];
      if (!noVowelExceptions.includes(trimmed.toLowerCase())) {
        return false;
      }
    }
    
    // 반복 문자 패턴 제외
    if (/(.)\1{2,}/.test(trimmed)) return false;
    
    return true;
  },

  // fallback 단어 추출 (기존 방식)
  fallbackWordExtraction(result, enableDebug = false) {
    const words = [];
    
    // 기존 로직으로 단어 추출
    if (Array.isArray(result.words) && result.words.length > 0) {
      for (const wordObj of result.words) {
        const word = this.extractWordFromTesseractObject(wordObj);
        if (word && this.isHighQualityEnglishWord(word.text, word.confidence)) {
          words.push({
            word: word.text.toLowerCase(),
            confidence: word.confidence,
            bbox: word.bbox,
            source: 'fallback_extraction'
          });
        }
      }
    }
    
    return words;
  },

  // Tesseract 단어 객체에서 단어 추출
  extractWordFromTesseractObject(wordObj) {
    const text = wordObj.text || wordObj.word || '';
    const confidence = wordObj.confidence || 0;
    const bbox = wordObj.bbox || null;

    if (!text || confidence < 40) { // 신뢰도 임계값 상향 조정
      return null;
    }

    return {
      text: text.trim(),
      confidence,
      bbox
    };
  },

  // 텍스트 전처리 (단어 추출용)
  preprocessTextForWordExtraction(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      // 대괄호와 그 안의 내용 제거 [text] → 제거
      .replace(/\[[^\]]*\]/g, ' ')
      // 소괄호와 그 안의 내용 제거 (text) → 제거
      .replace(/\([^)]*\)/g, ' ')
      // 중괄호와 그 안의 내용 제거 {text} → 제거
      .replace(/\{[^}]*\}/g, ' ')
      // 꺾쇠 괄호와 그 안의 내용 제거 <text> → 제거
      .replace(/<[^>]*>/g, ' ')
      // 따옴표로 둘러싸인 내용 제거 "text" 또는 'text' → 제거
      .replace(/["'][^"']*["']/g, ' ')
      // 숫자가 포함된 단어 제거 (word123, 123word 등)
      .replace(/\b\w*\d\w*\b/g, ' ')
      // URL 패턴 제거
      .replace(/https?:\/\/[^\s]+/g, ' ')
      // 이메일 패턴 제거
      .replace(/\S+@\S+\.\S+/g, ' ')
      // 연속된 특수문자 제거
      .replace(/[^\w\s'-]{2,}/g, ' ')
      // 여러 공백을 하나로 합치기
      .replace(/\s+/g, ' ')
      .trim();
  },

  // 정제된 텍스트에서 단어 추출
  extractWordsFromCleanText(cleanText) {
    if (!cleanText || typeof cleanText !== 'string') return [];

    return cleanText
      .split(/\s+/)
      .map(word => word.toLowerCase().trim())
      .filter(word => this.isHighQualityEnglishWord(word, 75))
      .map(word => ({
        word,
        confidence: 75, // 텍스트 분할의 기본 신뢰도
        bbox: null
      }));
  },

  // 단어가 유효한 컨텍스트에 있는지 확인
  isWordInValidContext(word, cleanedText, originalText) {
    const wordLower = word.toLowerCase();
    
    // 1. 정제된 텍스트에 해당 단어가 있는지 확인
    if (!cleanedText.toLowerCase().includes(wordLower)) {
      return false;
    }

    // 2. 원본 텍스트에서 괄호 안에 있는지 확인
    const bracketPatterns = [
      new RegExp(`\\[([^\\]]*)\\b${word}\\b([^\\]]*)\\]`, 'i'), // [word]
      new RegExp(`\\(([^)]*)\\b${word}\\b([^)]*)\\)`, 'i'),     // (word)
      new RegExp(`\\{([^}]*)\\b${word}\\b([^}]*)\\}`, 'i'),     // {word}
      new RegExp(`<([^>]*)\\b${word}\\b([^>]*)>`, 'i'),         // <word>
      new RegExp(`["']([^"']*)\\b${word}\\b([^"']*["'])`, 'i')  // "word" 또는 'word'
    ];

    for (const pattern of bracketPatterns) {
      if (pattern.test(originalText)) {
        return false; // 괄호나 인용부호 안에 있으면 제외
      }
    }

    // 3. 숫자와 혼재되어 있는지 확인
    const numberMixPattern = new RegExp(`\\b\\w*\\d.*\\b${word}\\b.*\\d\\w*\\b|\\b\\d.*\\b${word}\\b.*\\w*\\b`, 'i');
    if (numberMixPattern.test(originalText)) {
      return false;
    }

    return true;
  },

  // 고품질 영어 단어 검증 (신뢰도 포함)
  isHighQualityEnglishWord(word, confidence) {
    if (!word || typeof word !== 'string') return false;
    
    const trimmedWord = word.trim();
    
    // 기본 길이 및 패턴 검사
    if (trimmedWord.length < 2 || trimmedWord.length > 30) return false;
    
    // 숫자 포함 단어 제외
    if (/\d/.test(trimmedWord)) return false;
    
    // 영어 알파벳만 허용 (하이픈, 아포스트로피 포함)
    if (!/^[a-zA-Z'-]+$/.test(trimmedWord)) return false;
    
    // 특수문자 패턴 검사
    if (/^['-]|['-]$|--+|''+/.test(trimmedWord)) return false;
    
    // 반복 문자 패턴 제외 (같은 문자 3개 이상 연속)
    if (/(.)\1{2,}/.test(trimmedWord)) return false;
    
    // 일반적이지 않은 패턴 제외
    if (this.isInvalidWordPattern(trimmedWord)) return false;
    
    // 신뢰도 기반 추가 검증
    if (confidence < 60) {
      // 신뢰도가 낮은 경우 더 엄격한 검증
      return this.isCommonEnglishWord(trimmedWord) && confidence >= 50;
    }
    
    return true;
  },

  // 무효한 단어 패턴 검사
  isInvalidWordPattern(word) {
    const wordLower = word.toLowerCase();
    
    // 자음만으로 이루어진 긴 단어 (3자 이상)
    if (word.length >= 3 && /^[bcdfghjklmnpqrstvwxyz]+$/i.test(word)) {
      // 일부 예외 허용 (cry, try, fly 등)
      const consonantExceptions = ['cry', 'dry', 'fly', 'fry', 'pry', 'shy', 'sky', 'sly', 'spy', 'try', 'why'];
      if (!consonantExceptions.includes(wordLower)) return true;
    }
    
    // 모음만으로 이루어진 긴 단어 (2자 이상)
    if (word.length >= 3 && /^[aeiou]+$/i.test(word)) return true;
    
    // 일반적이지 않은 문자 조합
    const invalidPatterns = [
      /^[qx][^u]/i,     // q나 x 뒤에 u가 없는 경우
      /[xyz]{2,}/i,     // x, y, z가 연속으로 2개 이상
      /^[jqxz]/i,       // j, q, x, z로 시작하는 짧은 단어 (일부 예외 제외)
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(word)) {
        // 일부 예외 단어 허용
        const exceptions = ['jo', 'qi', 'xi', 'xu', 'za', 'zo'];
        if (!exceptions.includes(wordLower)) return true;
      }
    }
    
    return false;
  },

  // 일반적인 영어 단어인지 확인 (간단한 휴리스틱)
  isCommonEnglishWord(word) {
    const wordLower = word.toLowerCase();
    
    // 매우 일반적인 영어 단어들
    const commonWords = [
      // 기본 단어들
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'you', 'your', 'have', 'had', 'his', 'her',
      'she', 'we', 'they', 'them', 'this', 'can', 'do', 'not', 'but', 'or',
      
      // 일반적인 명사들
      'time', 'year', 'way', 'day', 'man', 'thing', 'woman', 'life', 'child',
      'world', 'school', 'state', 'family', 'student', 'group', 'country',
      'problem', 'hand', 'part', 'place', 'case', 'week', 'company', 'system',
      'program', 'question', 'work', 'government', 'number', 'night', 'point',
      'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact',
      'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word', 'business',
      
      // 일반적인 동사들
      'see', 'get', 'make', 'go', 'know', 'take', 'say', 'come', 'could',
      'want', 'look', 'use', 'find', 'give', 'tell', 'ask', 'work', 'seem',
      'feel', 'try', 'leave', 'call', 'good', 'new', 'first', 'last', 'long',
      'great', 'little', 'own', 'other', 'old', 'right', 'big', 'high', 'different',
      'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public',
      'bad', 'same', 'able'
    ];
    
    if (commonWords.includes(wordLower)) return true;
    
    // 일반적인 영어 패턴 확인
    // 모음이 있는 단어
    if (!/[aeiou]/i.test(word)) {
      // 모음이 없는 경우는 매우 제한적으로만 허용
      const noVowelExceptions = ['by', 'cry', 'dry', 'fly', 'fry', 'my', 'pry', 'shy', 'sky', 'sly', 'spy', 'try', 'why'];
      return noVowelExceptions.includes(wordLower);
    }
    
    // 길이가 적당한 단어 (2-15자)
    if (word.length >= 2 && word.length <= 15) return true;
    
    return false;
  },

  // 최종 품질 검사
  passesQualityCheck(word, confidence) {
    if (!word || confidence < 40) return false;
    
    const wordLower = word.toLowerCase();
    
    // 매우 짧은 단어는 높은 신뢰도가 필요
    if (word.length <= 2 && confidence < 70) return false;
    
    // 일반적이지 않은 단어는 더 높은 신뢰도가 필요
    if (!this.isCommonEnglishWord(word) && confidence < 65) return false;
    
    // 블랙리스트 단어들 (OCR에서 자주 잘못 인식되는 것들)
    const blacklistWords = [
      'il', 'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', // 로마 숫자
      'aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'jj', 'kk', 'll', 'mm', 
      'nn', 'oo', 'pp', 'qq', 'rr', 'ss', 'tt', 'uu', 'vv', 'ww', 'xx', 'yy', 'zz', // 반복 문자
      'lol', 'lll', 'iii', 'ooo', 'uuu', // 무의미한 반복
    ];
    
    if (blacklistWords.includes(wordLower)) return false;
    
    return true;
  },

  // 향상된 영어 단어 유효성 검사 (하위 호환성)
  isValidEnglishWord(word, options = {}) {
    const {
      minLength = 2,
      maxLength = 30,
      allowNumbers = false,
      allowHyphens = true,
      allowApostrophes = true
    } = options;

    if (!word || typeof word !== 'string') return false;
    
    const trimmedWord = word.trim();
    
    // 길이 확인
    if (trimmedWord.length < minLength || trimmedWord.length > maxLength) {
      return false;
    }
    
    // 숫자 포함 확인
    if (!allowNumbers && /\d/.test(trimmedWord)) {
      return false;
    }
    
    // 허용된 문자만 포함하는지 확인
    let allowedPattern = 'a-zA-Z';
    if (allowNumbers) allowedPattern += '0-9';
    if (allowHyphens) allowedPattern += '-';
    if (allowApostrophes) allowedPattern += '\'';
    
    const regex = new RegExp(`^[${allowedPattern}]+$`);
    if (!regex.test(trimmedWord)) {
      return false;
    }
    
    // 특수한 패턴 제외
    if (allowHyphens && /^-|-$|--/.test(trimmedWord)) return false;
    if (allowApostrophes && /^'|'$|''/.test(trimmedWord)) return false;
    
    return true;
  },

  // 중복 단어 제거
  removeDuplicateWords(words) {
    const wordMap = new Map();
    
    for (const wordObj of words) {
      const key = wordObj.word.toLowerCase();
      const existing = wordMap.get(key);
      
      if (!existing || wordObj.confidence > existing.confidence) {
        wordMap.set(key, wordObj);
      }
    }
    
    return Array.from(wordMap.values());
  },

  // 대폭 향상된 이미지 전처리
  async preprocessImage(imageFile, options = {}) {
    const {
      enhance = true,
      resize = true,
      sharpen = true,
      binarize = true,
      denoise = true,
      autoRotate = true
    } = options;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        
        // 1. 크기 최적화
        if (resize) {
          const optimalDimension = 2000; // OCR을 위한 최적 크기
          const minDimension = 400;      // 최소 크기 보장
          
          if (Math.max(width, height) < minDimension) {
            // 너무 작으면 확대 (최소 400px)
            const scaleFactor = minDimension / Math.max(width, height);
            width *= scaleFactor;
            height *= scaleFactor;
          } else if (Math.max(width, height) > optimalDimension) {
            // 너무 크면 적절한 크기로 축소
            const scaleFactor = optimalDimension / Math.max(width, height);
            width *= scaleFactor;
            height *= scaleFactor;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // 초기 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);

        // 2. 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 3. 노이즈 제거 (가우시안 블러)
        if (denoise) {
          this.applyGaussianBlur(data, width, height, 1);
        }

        // 4. 대비 및 밝기 향상
        if (enhance) {
          this.enhanceContrastAndBrightness(data, {
            contrast: 1.4,    // 더 강한 대비
            brightness: 10,   // 밝기 조정
            gamma: 0.8        // 감마 보정
          });
        }

        // 5. 적응적 이진화 (텍스트 강조)
        if (binarize) {
          this.applyAdaptiveThreshold(data, width, height, {
            blockSize: 15,
            c: 8
          });
        }

        // 6. 선명화 (언샤프 마스킹)
        if (sharpen) {
          this.applyUnsharpMask(data, width, height, {
            amount: 1.5,
            radius: 1.5,
            threshold: 0
          });
        }

        // 7. 최종 대비 조정
        this.finalContrastAdjustment(data);

        // 결과 적용
        ctx.putImageData(imageData, 0, 0);

        // 고품질로 저장
        canvas.toBlob(resolve, 'image/png', 1.0);
      };

      img.src = URL.createObjectURL(imageFile);
    });
  },

  // 가우시안 블러 (노이즈 제거)
  applyGaussianBlur(data, width, height, radius) {
    const kernel = this.generateGaussianKernel(radius);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);
    const output = new Uint8ClampedArray(data);

    for (let y = half; y < height - half; y++) {
      for (let x = half; x < width - half; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const py = y + ky - half;
              const px = x + kx - half;
              const idx = (py * width + px) * 4 + c;
              sum += data[idx] * kernel[ky][kx];
            }
          }
          const idx = (y * width + x) * 4 + c;
          output[idx] = Math.min(255, Math.max(0, sum));
        }
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = output[i];
    }
  },

  // 가우시안 커널 생성
  generateGaussianKernel(radius) {
    const size = Math.ceil(radius) * 2 + 1;
    const kernel = [];
    const sigma = radius / 3;
    let sum = 0;

    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
        const value = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        kernel[y][x] = value;
        sum += value;
      }
    }

    // 정규화
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }

    return kernel;
  },

  // 대비 및 밝기 향상
  enhanceContrastAndBrightness(data, options) {
    const { contrast, brightness, gamma } = options;

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        
        // 감마 보정
        value = Math.pow(value / 255, gamma) * 255;
        
        // 대비 조정
        value = (value - 128) * contrast + 128;
        
        // 밝기 조정
        value += brightness;
        
        data[i + c] = Math.min(255, Math.max(0, value));
      }
    }
  },

  // 적응적 임계값 (이진화)
  applyAdaptiveThreshold(data, width, height, options) {
    const { blockSize, c } = options;
    const half = Math.floor(blockSize / 2);
    const grayData = new Uint8ClampedArray(width * height);

    // 그레이스케일 변환
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      grayData[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 적응적 임계값 적용
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // 주변 블록의 평균 계산
        for (let by = Math.max(0, y - half); by <= Math.min(height - 1, y + half); by++) {
          for (let bx = Math.max(0, x - half); bx <= Math.min(width - 1, x + half); bx++) {
            sum += grayData[by * width + bx];
            count++;
          }
        }

        const mean = sum / count;
        const threshold = mean - c;
        const idx = y * width + x;
        const pixelIdx = idx * 4;

        // 임계값과 비교하여 이진화
        const gray = grayData[idx];
        const binary = gray > threshold ? 255 : 0;

        // 텍스트 영역은 검은색, 배경은 흰색으로
        const finalValue = gray < threshold ? 0 : 255;

        data[pixelIdx] = finalValue;     // R
        data[pixelIdx + 1] = finalValue; // G
        data[pixelIdx + 2] = finalValue; // B
      }
    }
  },

  // 언샤프 마스킹 (선명화)
  applyUnsharpMask(data, width, height, options) {
    const { amount, radius, threshold } = options;
    const blurred = new Uint8ClampedArray(data);
    
    // 블러 적용
    this.applyGaussianBlur(blurred, width, height, radius);

    // 언샤프 마스크 적용
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const original = data[i + c];
        const blur = blurred[i + c];
        const diff = Math.abs(original - blur);

        if (diff > threshold) {
          const sharpened = original + amount * (original - blur);
          data[i + c] = Math.min(255, Math.max(0, sharpened));
        }
      }
    }
  },

  // 최종 대비 조정
  finalContrastAdjustment(data) {
    // 히스토그램 평활화
    const histogram = new Array(256).fill(0);
    const grayValues = [];

    // 히스토그램 계산
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
      grayValues.push(gray);
    }

    // 누적 분포 함수 계산
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // 정규화
    const totalPixels = grayValues.length;
    const lookupTable = cdf.map(val => Math.round((val * 255) / totalPixels));

    // 적용 (약하게)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const originalGray = grayValues[j];
      const enhancedGray = lookupTable[originalGray];
      
      // 원본과 향상된 값의 가중 평균 (70% 원본, 30% 향상)
      const factor = 0.3;
      const targetGray = originalGray * (1 - factor) + enhancedGray * factor;
      const adjustment = targetGray / originalGray;

      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.min(255, Math.max(0, data[i + c] * adjustment));
      }
    }
  },

  // 이미지 회전 감지 및 보정
  async detectAndCorrectRotation(imageFile) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = async () => {
        const { width, height } = img;
        
        // 빠른 OCR로 회전 각도 감지
        const rotationAngle = await this.detectImageRotation(img);
        
        if (rotationAngle === 0) {
          // 회전이 필요 없으면 원본 반환
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0);
        } else {
          // 회전 적용
          this.rotateImage(ctx, img, rotationAngle);
        }

        canvas.toBlob(resolve, 'image/png', 1.0);
      };

      img.src = URL.createObjectURL(imageFile);
    });
  },

  // 이미지 회전 각도 감지
  async detectImageRotation(img) {
    const testAngles = [0, 90, 180, 270];
    const results = [];

    for (const angle of testAngles) {
      try {
        // 작은 크기로 빠른 테스트
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        
        // 테스트용 작은 크기
        const testSize = Math.min(400, Math.max(img.width, img.height));
        const scale = testSize / Math.max(img.width, img.height);
        
        if (angle === 0) {
          testCanvas.width = img.width * scale;
          testCanvas.height = img.height * scale;
          testCtx.drawImage(img, 0, 0, testCanvas.width, testCanvas.height);
        } else {
          this.rotateImageForTest(testCtx, img, angle, scale);
        }

        // 작은 이미지로 빠른 OCR 테스트
        const testBlob = await new Promise(resolve => {
          testCanvas.toBlob(resolve, 'image/png', 0.8);
        });

        // 간단한 OCR 테스트 (PSM 8, 빠른 설정)
        const { data } = await Tesseract.recognize(testBlob, 'eng', {
          tessedit_pageseg_mode: '8',
          tessedit_ocr_engine_mode: '1',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
          logger: () => {} // 로그 비활성화
        });

        const score = this.calculateRotationScore(data);
        results.push({ angle, score, confidence: data.confidence || 0 });
        
      } catch (error) {
        console.warn(`회전 테스트 실패 (${angle}도):`, error);
        results.push({ angle, score: 0, confidence: 0 });
      }
    }

    // 최적 각도 선택
    const bestResult = results.reduce((best, current) => {
      return current.score > best.score ? current : best;
    });

    return bestResult.angle;
  },

  // 회전 점수 계산
  calculateRotationScore(data) {
    let score = 0;
    
    // 기본 신뢰도
    score += (data.confidence || 0) * 0.4;
    
    // 유효한 영어 단어 개수
    const words = data.words || [];
    const validWords = words.filter(wordObj => {
      const word = wordObj.text || '';
      return this.isValidEnglishWordPattern(word) && (wordObj.confidence || 0) > 30;
    });
    
    score += validWords.length * 15;
    
    // 텍스트 길이
    const textLength = (data.text || '').replace(/[^\w]/g, '').length;
    score += Math.min(textLength, 20) * 2;
    
    return score;
  },

  // 테스트용 이미지 회전
  rotateImageForTest(ctx, img, angle, scale = 1) {
    const width = img.width * scale;
    const height = img.height * scale;
    
    if (angle === 90 || angle === 270) {
      ctx.canvas.width = height;
      ctx.canvas.height = width;
      ctx.translate(height / 2, width / 2);
    } else {
      ctx.canvas.width = width;
      ctx.canvas.height = height;
      ctx.translate(width / 2, height / 2);
    }
    
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
  },

  // 실제 이미지 회전 적용
  rotateImage(ctx, img, angle) {
    const { width, height } = img;
    
    if (angle === 90 || angle === 270) {
      ctx.canvas.width = height;
      ctx.canvas.height = width;
      ctx.translate(height / 2, width / 2);
    } else {
      ctx.canvas.width = width;
      ctx.canvas.height = height;
      ctx.translate(width / 2, height / 2);
    }
    
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2);
  },

  // Base64 변환
  async imageToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Canvas에서 이미지 데이터 생성
  async captureFromCanvas(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png', 0.9); // PNG로 고품질 저장
    });
  }
};