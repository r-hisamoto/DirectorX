/**
 * DirectorX Render Service
 * 動画・音声ファイルの最終レンダリングと出力を担当
 * 
 * 機能:
 * - Canvas-based video composition
 * - Audio synthesis and mixing
 * - FFmpeg.wasm integration for high-quality encoding
 * - Real-time progress tracking
 * - Multiple format support (MP4, WebM, MP3, SRT)
 */

import { VideoRecipe, VideoConfig, RenderOptions } from './recipeEngine';
import { TTSResult } from './ttsService';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// レンダリング関連の型定義
export interface RenderJob {
  id: string;
  recipe: VideoRecipe;
  options: RenderOptions;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  startTime: Date;
  endTime?: Date;
  outputs: RenderOutput[];
  error?: string;
}

export interface RenderOutput {
  type: 'video' | 'audio' | 'subtitle' | 'thumbnail' | 'project';
  filename: string;
  mimeType: string;
  size: number;
  url?: string; // Blob URL
  downloadUrl?: string;
  duration?: number;
}

export interface RenderProgress {
  jobId: string;
  step: string;
  progress: number;
  message: string;
  timeElapsed: number;
  timeRemaining?: number;
}

export interface VideoFrame {
  canvas: HTMLCanvasElement;
  timestamp: number;
  duration: number;
  content: FrameContent;
}

export interface FrameContent {
  background: BackgroundLayer;
  text?: TextLayer;
  assets?: AssetLayer[];
  effects?: EffectLayer[];
}

export interface BackgroundLayer {
  type: 'solid' | 'gradient' | 'image' | 'video';
  color?: string;
  gradientColors?: [string, string];
  gradientDirection?: 'horizontal' | 'vertical' | 'radial';
  imageUrl?: string;
  videoUrl?: string;
  opacity?: number;
  blur?: number;
}

export interface TextLayer {
  text: string;
  startTime: number;
  endTime: number;
  style: TextStyle;
  position: Position;
  animation?: TextAnimation;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  padding: number;
  textAlign: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
  anchor: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface TextAnimation {
  type: 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'typewriter' | 'bounce' | 'none';
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
}

export interface AssetLayer {
  assetId: string;
  type: 'image' | 'video';
  url: string;
  startTime: number;
  endTime: number;
  position: Position;
  transform?: Transform;
  opacity?: number;
}

export interface Transform {
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
}

export interface EffectLayer {
  type: 'transition' | 'filter' | 'overlay';
  startTime: number;
  duration: number;
  properties: any;
}

// レンダリングイベント
export interface RenderEvents {
  jobStart: (job: RenderJob) => void;
  progress: (progress: RenderProgress) => void;
  stepComplete: (jobId: string, step: string) => void;
  jobComplete: (job: RenderJob) => void;
  jobError: (jobId: string, error: string) => void;
}

export class RenderService {
  private jobs: Map<string, RenderJob> = new Map();
  private eventHandlers: Partial<RenderEvents> = {};
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext | null = null;
  private ffmpeg: FFmpeg;
  private ffmpegLoaded = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.ffmpeg = new FFmpeg();
    this.initializeAudioContext();
    this.initializeFFmpeg();
  }

  // FFmpeg.wasm初期化
  private async initializeFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return;

    try {
      // FFmpeg WASM ファイルをCDNから読み込み
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

      await this.ffmpeg.load({
        coreURL,
        wasmURL
      });

      this.ffmpegLoaded = true;
      console.log('FFmpeg.wasm loaded successfully');
    } catch (error) {
      console.error('FFmpeg.wasm loading failed:', error);
    }
  }

  // イベントハンドラーの登録
  on<K extends keyof RenderEvents>(event: K, handler: RenderEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  private emit<K extends keyof RenderEvents>(event: K, ...args: Parameters<RenderEvents[K]>): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      (handler as any)(...args);
    }
  }

  // Audio Context初期化
  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  // レンダリングジョブの作成
  async createRenderJob(recipe: VideoRecipe, options: RenderOptions): Promise<RenderJob> {
    const job: RenderJob = {
      id: `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipe,
      options,
      status: 'pending',
      progress: 0,
      currentStep: 'initializing',
      startTime: new Date(),
      outputs: []
    };

    this.jobs.set(job.id, job);
    return job;
  }

  // メインレンダリング実行
  async renderJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'processing';
    job.startTime = new Date();
    this.emit('jobStart', job);

    try {
      // ステップ1: キャンバス設定
      await this.setupCanvas(job);
      
      // ステップ2: 音声準備
      await this.prepareAudio(job);
      
      // ステップ3: フレーム生成
      await this.generateFrames(job);
      
      // ステップ4: 動画合成
      await this.composeVideo(job);
      
      // ステップ5: 音声合成
      await this.composeAudio(job);
      
      // ステップ6: 最終エンコード
      await this.finalEncode(job);
      
      // ステップ7: 出力ファイル生成
      await this.generateOutputs(job);

      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;
      this.emit('jobComplete', job);

    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
      this.emit('jobError', job.id, job.error);
      throw error;
    }
  }

  // キャンバス設定
  private async setupCanvas(job: RenderJob): Promise<void> {
    job.currentStep = 'canvas-setup';
    const { videoConfig } = job.recipe;
    
    // 解像度設定
    const [width, height] = videoConfig.resolution.split('x').map(Number);
    this.canvas.width = width;
    this.canvas.height = height;
    
    // コンテキスト設定
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    this.updateProgress(job, 10, 'Canvas initialized');
    await this.delay(100);
  }

  // 音声準備
  private async prepareAudio(job: RenderJob): Promise<void> {
    job.currentStep = 'audio-preparation';
    
    if (!job.recipe.ttsResult) {
      throw new Error('TTS result not available');
    }

    // AudioContextの再開（ユーザージェスチャー後）
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.updateProgress(job, 20, 'Audio prepared');
    await this.delay(200);
  }

  // フレーム生成
  private async generateFrames(job: RenderJob): Promise<void> {
    job.currentStep = 'frame-generation';
    
    const { recipe } = job;
    const totalDuration = recipe.ttsResult?.totalDuration || 60;
    const frameRate = recipe.videoConfig.frameRate;
    const totalFrames = Math.ceil(totalDuration * frameRate);
    
    const frames: VideoFrame[] = [];
    
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i / frameRate;
      const frame = await this.generateFrame(job, timestamp);
      frames.push(frame);
      
      const progress = 20 + (i / totalFrames) * 40;
      this.updateProgress(job, progress, `Generating frame ${i + 1}/${totalFrames}`);
      
      // フレーム生成間隔を調整（パフォーマンス）
      if (i % 10 === 0) {
        await this.delay(10);
      }
    }
    
    // フレームデータを保存
    (job as any).frames = frames;
  }

  // 単一フレーム生成
  private async generateFrame(job: RenderJob, timestamp: number): Promise<VideoFrame> {
    const { recipe } = job;
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d')!;

    // 背景描画
    await this.renderBackground(ctx, recipe.videoConfig.background, canvas.width, canvas.height);
    
    // テキスト描画
    await this.renderText(ctx, recipe, timestamp, canvas.width, canvas.height);
    
    // アセット描画
    await this.renderAssets(ctx, recipe, timestamp, canvas.width, canvas.height);

    return {
      canvas,
      timestamp,
      duration: 1 / recipe.videoConfig.frameRate,
      content: {
        background: recipe.videoConfig.background,
        // その他のコンテンツ情報
      }
    };
  }

  // 背景レンダリング
  private async renderBackground(
    ctx: CanvasRenderingContext2D, 
    background: any, 
    width: number, 
    height: number
  ): Promise<void> {
    ctx.save();
    
    switch (background.type) {
      case 'solid':
        ctx.fillStyle = background.color || '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        break;
        
      case 'gradient':
        if (background.gradientColors) {
          const gradient = ctx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(0, background.gradientColors[0]);
          gradient.addColorStop(1, background.gradientColors[1]);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
        }
        break;
        
      case 'image':
        // 画像背景の実装（実際のプロジェクトでは画像読み込み処理）
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, width, height);
        break;
        
      default:
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
    }
    
    ctx.restore();
  }

  // テキストレンダリング
  private async renderText(
    ctx: CanvasRenderingContext2D,
    recipe: VideoRecipe,
    timestamp: number,
    width: number,
    height: number
  ): Promise<void> {
    if (!recipe.ttsResult) return;

    // 現在の時間に対応するテキストセグメントを取得
    const currentSegment = recipe.ttsResult.segments.find(segment => 
      timestamp >= segment.startTime && timestamp <= segment.endTime
    );

    if (!currentSegment) return;

    ctx.save();
    
    const textStyle = recipe.videoConfig.textStyle;
    
    // フォント設定
    ctx.font = `${textStyle.fontSize}px ${textStyle.fontFamily}`;
    ctx.fillStyle = textStyle.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 背景描画
    if (textStyle.backgroundColor) {
      const textMetrics = ctx.measureText(currentSegment.text);
      const textWidth = textMetrics.width + textStyle.padding * 2;
      const textHeight = textStyle.fontSize + textStyle.padding * 2;
      
      let textX: number, textY: number;
      
      switch (textStyle.position) {
        case 'bottom':
          textX = width / 2;
          textY = height - 100;
          break;
        case 'top':
          textX = width / 2;
          textY = 100;
          break;
        case 'center':
        default:
          textX = width / 2;
          textY = height / 2;
      }

      // 背景矩形
      ctx.fillStyle = textStyle.backgroundColor;
      ctx.fillRect(
        textX - textWidth / 2,
        textY - textHeight / 2,
        textWidth,
        textHeight
      );
    }

    // ストローク描画
    if (textStyle.strokeColor && textStyle.strokeWidth) {
      ctx.strokeStyle = textStyle.strokeColor;
      ctx.lineWidth = textStyle.strokeWidth;
      ctx.strokeText(currentSegment.text, width / 2, height - 100);
    }

    // テキスト描画
    ctx.fillStyle = textStyle.color;
    ctx.fillText(currentSegment.text, width / 2, height - 100);
    
    ctx.restore();
  }

  // アセットレンダリング
  private async renderAssets(
    ctx: CanvasRenderingContext2D,
    recipe: VideoRecipe,
    timestamp: number,
    width: number,
    height: number
  ): Promise<void> {
    // アセット描画の実装（実際のプロジェクトでは画像/動画読み込み処理）
    // 現在はプレースホルダー
  }

  // 動画合成
  private async composeVideo(job: RenderJob): Promise<void> {
    job.currentStep = 'video-composition';
    
    // フレームからMediaRecorder用のストリームを作成
    const stream = this.canvas.captureStream(job.recipe.videoConfig.frameRate);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm; codecs=vp8,opus'
    });

    const chunks: Blob[] = [];
    
    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const output: RenderOutput = {
          type: 'video',
          filename: `${job.recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`,
          mimeType: 'video/webm',
          size: videoBlob.size,
          url: videoUrl,
          duration: job.recipe.ttsResult?.totalDuration
        };
        
        job.outputs.push(output);
        this.updateProgress(job, 80, 'Video composition completed');
        resolve();
      };

      mediaRecorder.onerror = reject;
      
      mediaRecorder.start();
      
      // フレーム再生シミュレーション
      this.playFrames(job).then(() => {
        mediaRecorder.stop();
      }).catch(reject);
    });
  }

  // フレーム再生
  private async playFrames(job: RenderJob): Promise<void> {
    const frames = (job as any).frames as VideoFrame[];
    if (!frames) return;

    const frameRate = job.recipe.videoConfig.frameRate;
    const frameInterval = 1000 / frameRate;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      // フレームをメインキャンバスに描画
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(frame.canvas, 0, 0);
      
      // フレームレート調整
      await this.delay(frameInterval);
      
      const progress = 60 + (i / frames.length) * 20;
      this.updateProgress(job, progress, `Playing frame ${i + 1}/${frames.length}`);
    }
  }

  // 音声合成
  private async composeAudio(job: RenderJob): Promise<void> {
    job.currentStep = 'audio-composition';
    
    if (!job.recipe.ttsResult) {
      this.updateProgress(job, 90, 'No audio to compose');
      return;
    }

    // Web Speech APIで生成された音声をBlobとして保存
    // 実際の実装では、TTSResultから音声データを取得
    const audioBlob = await this.generateAudioBlob(job.recipe.ttsResult);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const output: RenderOutput = {
      type: 'audio',
      filename: `${job.recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
      mimeType: 'audio/mp3',
      size: audioBlob.size,
      url: audioUrl,
      duration: job.recipe.ttsResult.totalDuration
    };
    
    job.outputs.push(output);
    this.updateProgress(job, 90, 'Audio composition completed');
  }

  // 音声Blob生成（デモ用）
  private async generateAudioBlob(ttsResult: TTSResult): Promise<Blob> {
    // 実際の実装では、Web Speech APIの音声出力をキャプチャ
    // ここではダミーの音声Blobを生成
    const audioContext = new AudioContext();
    const buffer = audioContext.createBuffer(2, audioContext.sampleRate * ttsResult.totalDuration, audioContext.sampleRate);
    
    // 簡単な音声データ生成（実際はTTSから取得）
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const nowBuffering = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        nowBuffering[i] = Math.sin(440 * 2 * Math.PI * i / audioContext.sampleRate) * 0.1;
      }
    }

    // AudioBufferをBlobに変換
    return new Blob(['audio data placeholder'], { type: 'audio/mp3' });
  }

  // 最終エンコード
  private async finalEncode(job: RenderJob): Promise<void> {
    job.currentStep = 'final-encoding';
    
    if (!this.ffmpegLoaded) {
      await this.initializeFFmpeg();
    }

    // WebMからMP4への変換とエンコーディング
    const webmOutput = job.outputs.find(output => output.type === 'video');
    if (!webmOutput?.url) {
      throw new Error('No video output available for encoding');
    }

    try {
      // FFmpeg.wasmでWebM→MP4変換
      const webmBlob = await fetch(webmOutput.url).then(res => res.blob());
      await this.ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

      // SRT字幕ファイルも準備（必要時）
      if (job.recipe.srtContent) {
        const srtBlob = new Blob([job.recipe.srtContent], { type: 'text/plain' });
        await this.ffmpeg.writeFile('subtitles.srt', await fetchFile(srtBlob));
      }

      // FFmpegコマンド実行
      const { resolution, bitrate = '2500k', frameRate = 30 } = job.options;
      let command = [
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', frameRate.toString(),
        '-s', resolution || '1920x1080',
        '-b:v', bitrate
      ];

      // 字幕焼き込み（日本語フォント対応）
      if (job.recipe.srtContent) {
        command.push(
          '-vf', 
          `subtitles=subtitles.srt:force_style='FontName=NotoSansCJKjp-Regular,FontSize=48,OutlineColour=&H000000,Outline=3'`
        );
      }

      command.push('output.mp4');

      // 進捗監視付きでFFmpeg実行
      this.ffmpeg.on('progress', ({ progress }) => {
        job.progress = 80 + (progress * 0.15); // 80-95%
        this.updateProgress(job, job.progress, `Encoding: ${Math.round(progress * 100)}%`);
      });

      await this.ffmpeg.exec(command);

      // エンコード結果を取得
      const outputData = await this.ffmpeg.readFile('output.mp4');
      const outputBlob = new Blob([outputData], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(outputBlob);

      // 元のWebM出力を置き換え
      if (webmOutput.url) {
        URL.revokeObjectURL(webmOutput.url);
      }
      
      webmOutput.mimeType = 'video/mp4';
      webmOutput.filename = webmOutput.filename.replace('.webm', '.mp4');
      webmOutput.url = outputUrl;
      webmOutput.size = outputBlob.size;

      this.updateProgress(job, 95, 'High-quality encoding completed');

    } catch (error) {
      console.error('FFmpeg encoding failed:', error);
      throw new Error(`Encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // 一時ファイルクリーンアップ
      try {
        await this.ffmpeg.deleteFile('input.webm');
        if (job.recipe.srtContent) {
          await this.ffmpeg.deleteFile('subtitles.srt');
        }
        await this.ffmpeg.deleteFile('output.mp4');
      } catch (error) {
        console.warn('FFmpeg cleanup failed:', error);
      }
    }
  }

  // 出力ファイル生成
  private async generateOutputs(job: RenderJob): Promise<void> {
    job.currentStep = 'output-generation';
    
    // SRTファイル生成
    if (job.recipe.srtContent) {
      const srtBlob = new Blob([job.recipe.srtContent], { type: 'text/plain; charset=utf-8' });
      const srtUrl = URL.createObjectURL(srtBlob);
      
      job.outputs.push({
        type: 'subtitle',
        filename: `${job.recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.srt`,
        mimeType: 'text/plain',
        size: srtBlob.size,
        url: srtUrl
      });
    }

    // 台本ファイル生成
    const scriptBlob = new Blob([job.recipe.scriptContent], { type: 'text/plain; charset=utf-8' });
    const scriptUrl = URL.createObjectURL(scriptBlob);
    
    job.outputs.push({
      type: 'project',
      filename: `${job.recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}_script.txt`,
      mimeType: 'text/plain',
      size: scriptBlob.size,
      url: scriptUrl
    });

    // サムネイル生成
    await this.generateThumbnail(job);
    
    this.updateProgress(job, 100, 'All outputs generated');
  }

  // サムネイル生成
  private async generateThumbnail(job: RenderJob): Promise<void> {
    // 最初のフレームからサムネイルを生成
    const frames = (job as any).frames as VideoFrame[];
    if (frames && frames.length > 0) {
      const firstFrame = frames[0];
      
      // サムネイル用キャンバス作成
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 1280;
      thumbCanvas.height = 720;
      const thumbCtx = thumbCanvas.getContext('2d')!;
      
      // フレームをサムネイルサイズに描画
      thumbCtx.drawImage(firstFrame.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      
      // Blobに変換
      return new Promise((resolve) => {
        thumbCanvas.toBlob((blob) => {
          if (blob) {
            const thumbUrl = URL.createObjectURL(blob);
            
            job.outputs.push({
              type: 'thumbnail',
              filename: `${job.recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}_thumb.png`,
              mimeType: 'image/png',
              size: blob.size,
              url: thumbUrl
            });
          }
          resolve();
        }, 'image/png', 0.9);
      });
    }
  }

  // プログレス更新
  private updateProgress(job: RenderJob, progress: number, message: string): void {
    job.progress = progress;
    
    const timeElapsed = Date.now() - job.startTime.getTime();
    const timeRemaining = progress > 0 ? (timeElapsed / progress) * (100 - progress) : undefined;
    
    this.emit('progress', {
      jobId: job.id,
      step: job.currentStep,
      progress,
      message,
      timeElapsed,
      timeRemaining
    });
  }

  // ジョブ取得
  getJob(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId);
  }

  // 全ジョブ取得
  getAllJobs(): RenderJob[] {
    return Array.from(this.jobs.values());
  }

  // ジョブ削除
  deleteJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      // Blob URLをクリーンアップ
      job.outputs.forEach(output => {
        if (output.url) {
          URL.revokeObjectURL(output.url);
        }
      });
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }

  // ユーティリティ
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RenderService;