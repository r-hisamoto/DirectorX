/**
 * DirectorX FFmpeg Service
 * 高品質動画エンコーディングと日本語字幕焼き込み機能
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { logger } from '../../lib/logger.js';

export interface RenderJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  inputs: {
    video?: string;
    audio?: string;
    srt?: string;
    images?: string[];
  };
  outputs: {
    video?: string;
    thumbnail?: string;
  };
  options: RenderOptions;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface RenderOptions {
  resolution: '1920x1080' | '1280x720' | '2160x2160';
  bitrate: string;
  frameRate: number;
  audioCodec: 'aac' | 'mp3';
  videoCodec: 'libx264' | 'libx265';
  subtitleBurnIn: boolean;
  thumbnailFormat: 'png' | 'jpg';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: 'top' | 'center' | 'bottom';
  marginVertical: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
}

export class FFmpegService {
  private jobs: Map<string, RenderJob> = new Map();
  private defaultSubtitleStyle: SubtitleStyle = {
    fontFamily: 'Noto Sans CJK JP',
    fontSize: 48,
    fontColor: 'white',
    strokeColor: 'black',
    strokeWidth: 3,
    position: 'bottom',
    marginVertical: 100
  };

  constructor() {
    // FFmpegバイナリパスの設定（Docker環境）
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
  }

  // レンダリングジョブ作成
  async createRenderJob(
    inputs: RenderJob['inputs'],
    options: RenderOptions
  ): Promise<RenderJob> {
    const job: RenderJob = {
      id: `ffmpeg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
      currentStep: 'initializing',
      inputs,
      outputs: {},
      options,
      startTime: new Date()
    };

    this.jobs.set(job.id, job);
    logger.info(`FFmpeg render job created: ${job.id}`);
    return job;
  }

  // メインレンダリング実行
  async renderVideo(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'processing';
    job.startTime = new Date();

    try {
      // ステップ1: 入力検証
      await this.validateInputs(job);

      // ステップ2: 字幕処理（必要時）
      if (job.inputs.srt && job.options.subtitleBurnIn) {
        await this.processSubtitles(job);
      }

      // ステップ3: メイン動画エンコーディング
      await this.encodeVideo(job);

      // ステップ4: サムネイル生成
      await this.generateThumbnail(job);

      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;

      logger.info(`FFmpeg render job completed: ${job.id}`);

    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
      
      logger.error(`FFmpeg render job failed: ${job.id}`, error);
      throw error;
    }
  }

  // 入力ファイル検証
  private async validateInputs(job: RenderJob): Promise<void> {
    job.currentStep = 'input-validation';
    job.progress = 5;

    if (!job.inputs.video && !job.inputs.images?.length) {
      throw new Error('Video or images are required');
    }

    // ファイル存在確認
    if (job.inputs.video) {
      try {
        await fs.access(job.inputs.video);
      } catch {
        throw new Error(`Video file not found: ${job.inputs.video}`);
      }
    }

    if (job.inputs.audio) {
      try {
        await fs.access(job.inputs.audio);
      } catch {
        throw new Error(`Audio file not found: ${job.inputs.audio}`);
      }
    }
  }

  // 字幕処理
  private async processSubtitles(job: RenderJob): Promise<void> {
    job.currentStep = 'subtitle-processing';
    job.progress = 15;

    if (!job.inputs.srt) return;

    // SRTファイルの存在確認と前処理
    try {
      const srtContent = await fs.readFile(job.inputs.srt, 'utf-8');
      
      // TODO: 日本語SRT整形機能を統合
      // - 20文字折り返し
      // - 禁則処理
      
      logger.info(`Subtitle file validated: ${job.inputs.srt}`);
    } catch (error) {
      throw new Error(`Subtitle file processing failed: ${error}`);
    }
  }

  // メイン動画エンコーディング
  private async encodeVideo(job: RenderJob): Promise<void> {
    job.currentStep = 'video-encoding';
    
    const outputPath = `/tmp/output_${job.id}.mp4`;
    const { resolution, bitrate, frameRate, preset, videoCodec } = job.options;

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // 入力設定
      if (job.inputs.video) {
        command = command.input(job.inputs.video);
      } else if (job.inputs.images?.length) {
        // 画像スライドショー作成
        command = command.input(job.inputs.images[0])
          .inputOptions([`-framerate ${frameRate}`]);
      }

      // 音声入力
      if (job.inputs.audio) {
        command = command.input(job.inputs.audio);
      }

      // 動画設定
      command = command
        .videoCodec(videoCodec)
        .videoBitrate(bitrate)
        .fps(frameRate)
        .size(resolution)
        .preset(preset);

      // 字幕焼き込み（日本語フォント指定）
      if (job.inputs.srt && job.options.subtitleBurnIn) {
        const subtitleFilter = this.buildSubtitleFilter(job.inputs.srt);
        command = command.videoFilters(subtitleFilter);
      }

      // 音声設定
      if (job.inputs.audio) {
        command = command.audioCodec(job.options.audioCodec);
      }

      // 進捗監視
      command.on('progress', (progress) => {
        job.progress = 20 + (progress.percent || 0) * 0.6; // 20-80%
        logger.debug(`FFmpeg progress: ${job.progress}%`);
      });

      // エラー処理
      command.on('error', (error) => {
        logger.error(`FFmpeg encoding error for job ${job.id}:`, error);
        reject(error);
      });

      // 完了処理
      command.on('end', () => {
        job.outputs.video = outputPath;
        job.progress = 80;
        logger.info(`Video encoding completed for job ${job.id}`);
        resolve();
      });

      // 出力開始
      command.save(outputPath);
    });
  }

  // 日本語字幕フィルター構築
  private buildSubtitleFilter(srtPath: string): string {
    const style = this.defaultSubtitleStyle;
    
    // 日本語フォントパス（Dockerコンテナ内）
    const fontPath = '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc';
    
    const fontStyle = [
      `FontName=${style.fontFamily}`,
      `FontSize=${style.fontSize}`,
      `FontColour=&H${this.colorToHex(style.fontColor)}`,
      `OutlineColour=&H${this.colorToHex(style.strokeColor)}`,
      `Outline=${style.strokeWidth}`,
      `MarginV=${style.marginVertical}`,
      `Alignment=2` // 中央下
    ].join(',');

    return `subtitles=${srtPath}:force_style='${fontStyle}':fontfile='${fontPath}'`;
  }

  // 色コードをHex形式に変換
  private colorToHex(color: string): string {
    if (color.startsWith('#')) {
      return color.substring(1);
    }
    
    // 色名の変換（簡易版）
    const colorMap: Record<string, string> = {
      'white': 'ffffff',
      'black': '000000',
      'red': 'ff0000',
      'blue': '0000ff',
      'green': '00ff00'
    };
    
    return colorMap[color.toLowerCase()] || '000000';
  }

  // サムネイル生成
  private async generateThumbnail(job: RenderJob): Promise<void> {
    job.currentStep = 'thumbnail-generation';
    job.progress = 85;

    if (!job.outputs.video) {
      throw new Error('Video output not available for thumbnail generation');
    }

    const thumbnailPath = `/tmp/thumb_${job.id}.${job.options.thumbnailFormat}`;

    return new Promise((resolve, reject) => {
      ffmpeg(job.outputs.video!)
        .screenshots({
          count: 1,
          folder: '/tmp',
          filename: `thumb_${job.id}.${job.options.thumbnailFormat}`,
          size: job.options.resolution === '2160x2160' ? '2160x2160' : '1280x720'
        })
        .on('end', () => {
          job.outputs.thumbnail = thumbnailPath;
          job.progress = 95;
          logger.info(`Thumbnail generated for job ${job.id}`);
          resolve();
        })
        .on('error', (error) => {
          logger.error(`Thumbnail generation failed for job ${job.id}:`, error);
          reject(error);
        });
    });
  }

  // 品質プリセット取得
  static getQualityPreset(quality: RenderOptions['quality']): Partial<RenderOptions> {
    switch (quality) {
      case 'low':
        return {
          bitrate: '1000k',
          preset: 'fast',
          videoCodec: 'libx264'
        };
      case 'medium':
        return {
          bitrate: '2500k',
          preset: 'medium',
          videoCodec: 'libx264'
        };
      case 'high':
        return {
          bitrate: '5000k',
          preset: 'slow',
          videoCodec: 'libx264'
        };
      case 'ultra':
        return {
          bitrate: '8000k',
          preset: 'veryslow',
          videoCodec: 'libx265'
        };
      default:
        return {
          bitrate: '2500k',
          preset: 'medium',
          videoCodec: 'libx264'
        };
    }
  }

  // ジョブ状態取得
  getJob(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId);
  }

  // 全ジョブ取得
  getAllJobs(): RenderJob[] {
    return Array.from(this.jobs.values());
  }

  // ジョブ削除
  async deleteJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // 一時ファイルクリーンアップ
    try {
      if (job.outputs.video) {
        await fs.unlink(job.outputs.video);
      }
      if (job.outputs.thumbnail) {
        await fs.unlink(job.outputs.thumbnail);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup files for job ${jobId}:`, error);
    }

    this.jobs.delete(jobId);
    return true;
  }

  // 再実行モード
  async retryJob(jobId: string, mode: 'full' | 'effects-only' | 'resume'): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'processing';
    job.progress = 0;
    job.error = undefined;

    switch (mode) {
      case 'full':
        // フル再実行
        await this.renderVideo(jobId);
        break;
      case 'effects-only':
        // エフェクトのみ再実行（素材DLスキップ）
        job.progress = 20; // 素材準備完了とみなす
        await this.encodeVideo(job);
        await this.generateThumbnail(job);
        break;
      case 'resume':
        // 最後の成功ステップから再開
        const lastStep = job.currentStep;
        if (lastStep === 'video-encoding') {
          await this.generateThumbnail(job);
        } else {
          await this.renderVideo(jobId);
        }
        break;
    }
  }
}

export default FFmpegService;