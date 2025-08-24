// TTS音声生成サービス

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  gender: 'male' | 'female' | 'neutral';
  description: string;
  available: boolean;
}

export interface TTSOptions {
  voice?: TTSVoice;
  rate?: number;        // 0.1 - 10 (速度)
  pitch?: number;       // 0 - 2 (ピッチ)
  volume?: number;      // 0 - 1 (音量)
}

export interface TTSSegment {
  id: string;
  text: string;
  startTime: number;    // 秒
  endTime: number;      // 秒
  audioBlob?: Blob;
  audioUrl?: string;
}

export interface TTSResult {
  success: boolean;
  segments: TTSSegment[];
  totalDuration: number;
  audioBlob?: Blob;
  error?: string;
}

export class TTSService {
  private synthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoices();
  }

  /**
   * 音声エンジンの初期化
   */
  private async initializeVoices(): Promise<void> {
    return new Promise((resolve) => {
      // 音声リストが既に利用可能な場合
      if (this.synthesis.getVoices().length > 0) {
        this.voices = this.synthesis.getVoices();
        this.isInitialized = true;
        resolve();
        return;
      }

      // 音声リストの読み込み完了を待つ
      this.synthesis.onvoiceschanged = () => {
        this.voices = this.synthesis.getVoices();
        this.isInitialized = true;
        resolve();
      };

      // タイムアウト設定（5秒）
      setTimeout(() => {
        if (!this.isInitialized) {
          console.warn('TTS voices loading timeout');
          this.voices = this.synthesis.getVoices();
          this.isInitialized = true;
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * 利用可能な音声一覧を取得
   */
  async getAvailableVoices(): Promise<TTSVoice[]> {
    if (!this.isInitialized) {
      await this.initializeVoices();
    }

    return this.voices
      .filter(voice => voice.lang.startsWith('ja') || voice.lang.startsWith('en'))
      .map(voice => ({
        id: voice.name,
        name: voice.name,
        lang: voice.lang,
        gender: this.detectGender(voice.name),
        description: `${voice.lang} - ${voice.name}`,
        available: true
      }));
  }

  /**
   * 音声名から性別を推定
   */
  private detectGender(voiceName: string): 'male' | 'female' | 'neutral' {
    const name = voiceName.toLowerCase();
    
    // 日本語音声の判定
    if (name.includes('female') || name.includes('woman') || name.includes('woman') ||
        name.includes('kyoko') || name.includes('otoya') || name.includes('haruka')) {
      return 'female';
    }
    
    if (name.includes('male') || name.includes('man') || 
        name.includes('takeshi') || name.includes('ichiro')) {
      return 'male';
    }

    // 英語音声の判定
    if (name.includes('samantha') || name.includes('alice') || name.includes('susan') ||
        name.includes('victoria') || name.includes('karen') || name.includes('serena')) {
      return 'female';
    }

    if (name.includes('alex') || name.includes('daniel') || name.includes('fred') ||
        name.includes('oliver') || name.includes('thomas')) {
      return 'male';
    }

    return 'neutral';
  }

  /**
   * 台本テキストから音声生成
   */
  async generateFromScript(
    scriptContent: string, 
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    try {
      if (!this.isInitialized) {
        await this.initializeVoices();
      }

      // テキストを文単位に分割
      const segments = this.parseScriptToSegments(scriptContent);
      
      if (segments.length === 0) {
        return {
          success: false,
          segments: [],
          totalDuration: 0,
          error: '音声生成対象のテキストがありません'
        };
      }

      // 各セグメントの音声生成
      const processedSegments: TTSSegment[] = [];
      let totalDuration = 0;

      for (const segment of segments) {
        try {
          const audioResult = await this.synthesizeText(segment.text, options);
          
          if (audioResult.success && audioResult.audioBlob) {
            const segmentWithAudio: TTSSegment = {
              ...segment,
              audioBlob: audioResult.audioBlob,
              audioUrl: URL.createObjectURL(audioResult.audioBlob),
              endTime: segment.startTime + audioResult.duration
            };
            
            processedSegments.push(segmentWithAudio);
            totalDuration = segmentWithAudio.endTime;
          } else {
            // エラーセグメントも記録
            processedSegments.push(segment);
          }
        } catch (error) {
          console.error(`Segment synthesis failed:`, error);
          processedSegments.push(segment);
        }
      }

      return {
        success: true,
        segments: processedSegments,
        totalDuration,
      };

    } catch (error) {
      return {
        success: false,
        segments: [],
        totalDuration: 0,
        error: `TTS generation failed: ${error.message}`
      };
    }
  }

  /**
   * SRTテキストから音声生成
   */
  async generateFromSRT(
    srtContent: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    try {
      const segments = this.parseSRTToSegments(srtContent);
      
      const processedSegments: TTSSegment[] = [];
      let totalDuration = 0;

      for (const segment of segments) {
        const audioResult = await this.synthesizeText(segment.text, options);
        
        if (audioResult.success && audioResult.audioBlob) {
          const segmentWithAudio: TTSSegment = {
            ...segment,
            audioBlob: audioResult.audioBlob,
            audioUrl: URL.createObjectURL(audioResult.audioBlob)
          };
          
          processedSegments.push(segmentWithAudio);
          totalDuration = Math.max(totalDuration, segment.endTime);
        } else {
          processedSegments.push(segment);
        }
      }

      return {
        success: true,
        segments: processedSegments,
        totalDuration,
      };

    } catch (error) {
      return {
        success: false,
        segments: [],
        totalDuration: 0,
        error: `SRT TTS generation failed: ${error.message}`
      };
    }
  }

  /**
   * 個別テキストの音声合成
   */
  private async synthesizeText(
    text: string, 
    options: TTSOptions = {}
  ): Promise<{ success: boolean; audioBlob?: Blob; duration: number; error?: string }> {
    return new Promise((resolve) => {
      if (!text.trim()) {
        resolve({ success: false, duration: 0, error: 'Empty text' });
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 音声設定
      if (options.voice) {
        const voice = this.voices.find(v => v.name === options.voice?.id);
        if (voice) {
          utterance.voice = voice;
        }
      } else {
        // デフォルトで日本語音声を選択
        const japaneseVoice = this.voices.find(v => v.lang.startsWith('ja'));
        if (japaneseVoice) {
          utterance.voice = japaneseVoice;
        }
      }

      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // 音声データの録音（Web Audio API使用）
      if (typeof MediaRecorder !== 'undefined') {
        this.recordSpeechSynthesis(utterance, resolve);
      } else {
        // フォールバック: 録音なしで実行
        utterance.onend = () => {
          const estimatedDuration = this.estimateDuration(text, options.rate || 1.0);
          resolve({ 
            success: true, 
            duration: estimatedDuration 
          });
        };

        utterance.onerror = (event) => {
          resolve({ 
            success: false, 
            duration: 0, 
            error: `Speech synthesis error: ${event.error}` 
          });
        };

        this.synthesis.speak(utterance);
      }
    });
  }

  /**
   * 音声合成の録音（実験的機能）
   */
  private recordSpeechSynthesis(
    utterance: SpeechSynthesisUtterance,
    callback: (result: { success: boolean; audioBlob?: Blob; duration: number; error?: string }) => void
  ): void {
    // 音声録音は複雑なため、現在は推定時間のみ返す
    const estimatedDuration = this.estimateDuration(utterance.text, utterance.rate);

    utterance.onend = () => {
      callback({
        success: true,
        duration: estimatedDuration
      });
    };

    utterance.onerror = (event) => {
      callback({
        success: false,
        duration: 0,
        error: `Speech synthesis error: ${event.error}`
      });
    };

    this.synthesis.speak(utterance);
  }

  /**
   * テキスト読み上げ時間の推定
   */
  private estimateDuration(text: string, rate: number = 1.0): number {
    // 日本語: 1文字あたり約0.2秒、英語: 1単語あたり約0.6秒
    const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
    const englishWords = text.split(/\s+/).filter(word => /[a-zA-Z]/.test(word)).length;
    
    const baseDuration = (japaneseChars * 0.2) + (englishWords * 0.6);
    return Math.max(0.5, baseDuration / rate); // 最低0.5秒
  }

  /**
   * 台本テキストをセグメントに分割
   */
  private parseScriptToSegments(scriptContent: string): TTSSegment[] {
    const segments: TTSSegment[] = [];
    let currentTime = 0;

    // ヘッダーとマークダウンを除去してクリーンなテキストに
    const cleanText = scriptContent
      .replace(/^#+\s+.*/gm, '') // ヘッダー除去
      .replace(/\*\*(.+?)\*\*/g, '$1') // 太字除去
      .replace(/\[.+?\]\(.+?\)/g, '') // リンク除去
      .trim();

    // 文単位で分割
    const sentences = cleanText
      .split(/[。！？\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    sentences.forEach((sentence, index) => {
      const duration = this.estimateDuration(sentence);
      
      segments.push({
        id: `segment-${index}`,
        text: sentence,
        startTime: currentTime,
        endTime: currentTime + duration
      });

      currentTime += duration + 0.5; // 0.5秒の間隔
    });

    return segments;
  }

  /**
   * SRTテキストをセグメントに分割
   */
  private parseSRTToSegments(srtContent: string): TTSSegment[] {
    const segments: TTSSegment[] = [];
    const blocks = srtContent.split('\n\n').filter(block => block.trim());

    blocks.forEach(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const id = lines[0].trim();
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        
        if (timeMatch) {
          const startTime = this.parseTimeToSeconds(timeMatch.slice(1, 5));
          const endTime = this.parseTimeToSeconds(timeMatch.slice(5, 9));
          const text = lines.slice(2).join(' ').trim();

          segments.push({
            id: `srt-${id}`,
            text,
            startTime,
            endTime
          });
        }
      }
    });

    return segments;
  }

  /**
   * SRT時間フォーマットを秒に変換
   */
  private parseTimeToSeconds(timeParts: string[]): number {
    const [hours, minutes, seconds, milliseconds] = timeParts.map(Number);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  /**
   * 音声合成の停止
   */
  stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
  }

  /**
   * 音声合成の一時停止
   */
  pause(): void {
    if (this.synthesis.speaking) {
      this.synthesis.pause();
    }
  }

  /**
   * 音声合成の再開
   */
  resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  /**
   * 現在の合成状態を取得
   */
  getStatus(): {
    speaking: boolean;
    paused: boolean;
    pending: boolean;
  } {
    return {
      speaking: this.synthesis.speaking,
      paused: this.synthesis.paused,
      pending: this.synthesis.pending
    };
  }
}

// シングルトンインスタンス
export const ttsService = new TTSService();