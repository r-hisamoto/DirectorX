/**
 * DirectorX Audio Quality Control Service
 * 音量正規化・無音検出・LUFS測定機能
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { logger } from '../../lib/logger.js';

export interface AudioQCResult {
  passed: boolean;
  issues: AudioIssue[];
  metrics: AudioMetrics;
  recommendations: string[];
}

export interface AudioIssue {
  type: 'volume' | 'silence' | 'clipping' | 'noise';
  severity: 'warning' | 'error' | 'critical';
  timestamp?: number;
  duration?: number;
  description: string;
  suggestion: string;
}

export interface AudioMetrics {
  lufs: number; // Loudness Units relative to Full Scale
  peak: number; // ピーク音量 (dBFS)
  silenceRanges: SilenceRange[];
  duration: number;
  dynamicRange: number;
  signalToNoise: number;
}

export interface SilenceRange {
  start: number;
  end: number;
  duration: number;
}

export class AudioQCService {
  // LUFS推奨レベル（放送基準）
  private readonly TARGET_LUFS = -16; // dB LUFS
  private readonly MIN_LUFS = -14;
  private readonly MAX_LUFS = -18;
  
  // 無音検出設定
  private readonly SILENCE_THRESHOLD = -60; // dB
  private readonly MAX_SILENCE_DURATION = 2; // seconds

  // 音量測定・LUFS計算
  async measureAudioQuality(audioPath: string): Promise<AudioMetrics> {
    return new Promise((resolve, reject) => {
      let lufs = 0;
      let peak = 0;
      let duration = 0;
      const silenceRanges: SilenceRange[] = [];

      // FFmpegでAudioの詳細分析
      ffmpeg(audioPath)
        .audioFilters([
          // LUFS測定（EBU R128基準）
          'loudnorm=print_format=json',
          // 無音検出
          `silencedetect=noise=${this.SILENCE_THRESHOLD}dB:duration=${this.MAX_SILENCE_DURATION}`
        ])
        .format('null')
        .output('-')
        .on('stderr', (stderrLine) => {
          // LUFS値を抽出
          const lufsMatch = stderrLine.match(/input_i:\s*(-?\d+\.?\d*)/);
          if (lufsMatch) {
            lufs = parseFloat(lufsMatch[1]);
          }

          // ピーク値を抽出
          const peakMatch = stderrLine.match(/input_tp:\s*(-?\d+\.?\d*)/);
          if (peakMatch) {
            peak = parseFloat(peakMatch[1]);
          }

          // 無音範囲を抽出
          const silenceStartMatch = stderrLine.match(/silence_start:\s*(\d+\.?\d*)/);
          const silenceEndMatch = stderrLine.match(/silence_end:\s*(\d+\.?\d*)/);
          
          if (silenceStartMatch && silenceEndMatch) {
            const start = parseFloat(silenceStartMatch[1]);
            const end = parseFloat(silenceEndMatch[1]);
            silenceRanges.push({
              start,
              end,
              duration: end - start
            });
          }
        })
        .on('error', (error) => {
          logger.error('Audio analysis failed:', error);
          reject(error);
        })
        .on('end', () => {
          // メタデータを収集
          ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err) {
              reject(err);
              return;
            }

            duration = metadata.format.duration || 0;
            
            const metrics: AudioMetrics = {
              lufs,
              peak,
              silenceRanges,
              duration,
              dynamicRange: Math.abs(peak - lufs),
              signalToNoise: lufs - this.SILENCE_THRESHOLD
            };

            resolve(metrics);
          });
        })
        .run();
    });
  }

  // 音量正規化
  async normalizeAudio(inputPath: string, outputPath: string, targetLufs = this.TARGET_LUFS): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          // EBU R128基準での音量正規化
          `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${targetLufs}:measured_LRA=11:measured_TP=-1.5:measured_thresh=-26.0:offset=0.0`
        ])
        .audioCodec('aac')
        .audioBitrate('128k')
        .on('progress', (progress) => {
          logger.debug(`Audio normalization progress: ${progress.percent}%`);
        })
        .on('error', (error) => {
          logger.error('Audio normalization failed:', error);
          reject(error);
        })
        .on('end', () => {
          logger.info(`Audio normalized: ${inputPath} -> ${outputPath}`);
          resolve();
        })
        .save(outputPath);
    });
  }

  // 音声品質チェック
  async checkAudioQuality(audioPath: string): Promise<AudioQCResult> {
    try {
      const metrics = await this.measureAudioQuality(audioPath);
      const issues: AudioIssue[] = [];
      const recommendations: string[] = [];

      // LUFS レベルチェック
      if (metrics.lufs > this.MIN_LUFS) {
        issues.push({
          type: 'volume',
          severity: 'warning',
          description: `音量が低すぎます (${metrics.lufs.toFixed(1)} LUFS)`,
          suggestion: `${this.TARGET_LUFS} LUFS に正規化することを推奨します`
        });
        recommendations.push('音量正規化を実行');
      } else if (metrics.lufs < this.MAX_LUFS) {
        issues.push({
          type: 'volume',
          severity: 'error',
          description: `音量が高すぎます (${metrics.lufs.toFixed(1)} LUFS)`,
          suggestion: `${this.TARGET_LUFS} LUFS に正規化が必要です`
        });
        recommendations.push('音量正規化が必須');
      }

      // ピーク音量チェック
      if (metrics.peak > -1) {
        issues.push({
          type: 'clipping',
          severity: 'critical',
          description: `クリッピングが発生しています (${metrics.peak.toFixed(1)} dBFS)`,
          suggestion: 'ピーク制限を適用してください'
        });
        recommendations.push('ピーク制限適用');
      }

      // 無音区間チェック
      const longSilences = metrics.silenceRanges.filter(range => range.duration > this.MAX_SILENCE_DURATION);
      for (const silence of longSilences) {
        issues.push({
          type: 'silence',
          severity: 'warning',
          timestamp: silence.start,
          duration: silence.duration,
          description: `長時間の無音が検出されました (${silence.duration.toFixed(1)}秒)`,
          suggestion: '無音区間の削除またはBGM追加を検討してください'
        });
      }

      if (longSilences.length > 0) {
        recommendations.push('無音区間の確認・編集');
      }

      // ダイナミックレンジチェック
      if (metrics.dynamicRange < 6) {
        issues.push({
          type: 'volume',
          severity: 'warning',
          description: `ダイナミックレンジが狭すぎます (${metrics.dynamicRange.toFixed(1)} dB)`,
          suggestion: '音声の圧縮を見直してください'
        });
      }

      const passed = !issues.some(issue => issue.severity === 'critical' || issue.severity === 'error');

      return {
        passed,
        issues,
        metrics,
        recommendations
      };

    } catch (error) {
      logger.error('Audio QC failed:', error);
      throw new Error(`Audio quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 自動修正処理
  async autoFixAudioIssues(inputPath: string, outputPath: string, qcResult: AudioQCResult): Promise<void> {
    if (qcResult.passed) {
      // 問題がない場合はコピーのみ
      await fs.copyFile(inputPath, outputPath);
      return;
    }

    let needsNormalization = false;
    let needsPeakLimiting = false;

    // 修正が必要な問題を特定
    for (const issue of qcResult.issues) {
      if (issue.type === 'volume') {
        needsNormalization = true;
      }
      if (issue.type === 'clipping') {
        needsPeakLimiting = true;
      }
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // 音量正規化
      if (needsNormalization) {
        command = command.audioFilters([
          `loudnorm=I=${this.TARGET_LUFS}:TP=-1.5:LRA=11`
        ]);
      }

      // ピーク制限
      if (needsPeakLimiting) {
        command = command.audioFilters([
          'alimiter=limit=-1.0dB:attack=5:release=50'
        ]);
      }

      command
        .audioCodec('aac')
        .audioBitrate('128k')
        .on('error', reject)
        .on('end', () => {
          logger.info(`Audio auto-fix completed: ${inputPath} -> ${outputPath}`);
          resolve();
        })
        .save(outputPath);
    });
  }
}

export default AudioQCService;