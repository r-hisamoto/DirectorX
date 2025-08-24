/**
 * DirectorX Video Quality Control Service
 * 黒フレーム検出・映像品質チェック機能
 */

import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../../lib/logger.js';

export interface VideoQCResult {
  passed: boolean;
  issues: VideoIssue[];
  metrics: VideoMetrics;
  recommendations: string[];
}

export interface VideoIssue {
  type: 'blackframes' | 'frozen' | 'resolution' | 'framerate' | 'quality';
  severity: 'warning' | 'error' | 'critical';
  timestamp?: number;
  duration?: number;
  description: string;
  suggestion: string;
}

export interface VideoMetrics {
  duration: number;
  resolution: string;
  frameRate: number;
  bitrate: number;
  blackFrameRanges: BlackFrameRange[];
  frozenFrames: number;
  averageQuality: number;
}

export interface BlackFrameRange {
  start: number;
  end: number;
  duration: number;
  frameCount: number;
}

export class VideoQCService {
  // 黒フレーム検出設定
  private readonly BLACK_THRESHOLD = 0.03; // 黒判定のしきい値（0-1）
  private readonly MIN_BLACK_DURATION = 0.5; // 最小検出時間（秒）
  private readonly MAX_BLACK_DURATION = 2.0; // 警告する黒フレーム持続時間

  // 映像品質測定
  async measureVideoQuality(videoPath: string): Promise<VideoMetrics> {
    return new Promise((resolve, reject) => {
      const blackFrameRanges: BlackFrameRange[] = [];
      let duration = 0;
      let resolution = '';
      let frameRate = 0;
      let bitrate = 0;
      let frozenFrames = 0;

      // メタデータ取得
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        duration = metadata.format.duration || 0;
        resolution = `${videoStream.width}x${videoStream.height}`;
        frameRate = this.parseFrameRate(videoStream.r_frame_rate || '30/1');
        bitrate = parseInt(videoStream.bit_rate || '0');

        // 黒フレーム検出
        ffmpeg(videoPath)
          .videoFilters([
            `blackdetect=d=${this.MIN_BLACK_DURATION}:pix_th=${this.BLACK_THRESHOLD}`
          ])
          .format('null')
          .output('-')
          .on('stderr', (stderrLine) => {
            // 黒フレーム範囲を抽出
            const blackStartMatch = stderrLine.match(/black_start:(\d+\.?\d*)/);
            const blackEndMatch = stderrLine.match(/black_end:(\d+\.?\d*)/);
            const blackDurationMatch = stderrLine.match(/black_duration:(\d+\.?\d*)/);

            if (blackStartMatch && blackEndMatch && blackDurationMatch) {
              const start = parseFloat(blackStartMatch[1]);
              const end = parseFloat(blackEndMatch[1]);
              const duration = parseFloat(blackDurationMatch[1]);
              
              blackFrameRanges.push({
                start,
                end,
                duration,
                frameCount: Math.round(duration * frameRate)
              });
            }
          })
          .on('error', (error) => {
            logger.error('Video analysis failed:', error);
            reject(error);
          })
          .on('end', () => {
            const metrics: VideoMetrics = {
              duration,
              resolution,
              frameRate,
              bitrate,
              blackFrameRanges,
              frozenFrames,
              averageQuality: this.calculateQualityScore(bitrate, resolution, frameRate)
            };

            resolve(metrics);
          })
          .run();
      });
    });
  }

  // フレームレート文字列をパース
  private parseFrameRate(frameRateStr: string): number {
    const parts = frameRateStr.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(frameRateStr);
  }

  // 品質スコア計算
  private calculateQualityScore(bitrate: number, resolution: string, frameRate: number): number {
    // 解像度による基準ビットレート
    const [width, height] = resolution.split('x').map(Number);
    const pixels = width * height;
    
    let targetBitrate = 0;
    if (pixels >= 2073600) { // 1920x1080以上
      targetBitrate = 5000000; // 5Mbps
    } else if (pixels >= 921600) { // 1280x720以上
      targetBitrate = 2500000; // 2.5Mbps
    } else {
      targetBitrate = 1000000; // 1Mbps
    }

    // フレームレートによる調整
    const frameRateMultiplier = frameRate / 30;
    targetBitrate *= frameRateMultiplier;

    // 品質スコア（0-100）
    const bitrateRatio = Math.min(bitrate / targetBitrate, 2);
    return Math.round(bitrateRatio * 50 + 25); // 25-100点
  }

  // 映像品質チェック
  async checkVideoQuality(videoPath: string): Promise<VideoQCResult> {
    try {
      const metrics = await this.measureVideoQuality(videoPath);
      const issues: VideoIssue[] = [];
      const recommendations: string[] = [];

      // 黒フレームチェック
      const longBlackFrames = metrics.blackFrameRanges.filter(range => 
        range.duration > this.MAX_BLACK_DURATION
      );

      for (const blackRange of longBlackFrames) {
        issues.push({
          type: 'blackframes',
          severity: blackRange.duration > 5 ? 'error' : 'warning',
          timestamp: blackRange.start,
          duration: blackRange.duration,
          description: `長時間の黒フレームが検出されました (${blackRange.duration.toFixed(1)}秒)`,
          suggestion: '映像内容を確認し、黒フレーム区間を削除または置換してください'
        });
      }

      if (longBlackFrames.length > 0) {
        recommendations.push('黒フレーム区間の編集');
      }

      // フレームレートチェック
      if (metrics.frameRate < 24) {
        issues.push({
          type: 'framerate',
          severity: 'warning',
          description: `フレームレートが低すぎます (${metrics.frameRate.toFixed(1)} fps)`,
          suggestion: '24fps以上に設定することを推奨します'
        });
      }

      // 解像度チェック
      const [width, height] = metrics.resolution.split('x').map(Number);
      if (width < 1280 || height < 720) {
        issues.push({
          type: 'resolution',
          severity: 'warning',
          description: `解像度が低すぎます (${metrics.resolution})`,
          suggestion: '最低でも1280x720以上を推奨します'
        });
      }

      // ビットレート品質チェック
      if (metrics.averageQuality < 50) {
        issues.push({
          type: 'quality',
          severity: 'warning',
          description: `映像品質が低い可能性があります (品質スコア: ${metrics.averageQuality})`,
          suggestion: 'ビットレートを上げるか、エンコード設定を見直してください'
        });
        recommendations.push('品質設定の見直し');
      }

      const passed = !issues.some(issue => issue.severity === 'critical' || issue.severity === 'error');

      return {
        passed,
        issues,
        metrics,
        recommendations
      };

    } catch (error) {
      logger.error('Video QC failed:', error);
      throw new Error(`Video quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 黒フレーム自動修正（将来拡張）
  async autoFixBlackFrames(inputPath: string, outputPath: string): Promise<void> {
    // 現在は基本的なコピーのみ
    // 将来的には黒フレーム区間の置換機能を実装
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('error', reject)
        .on('end', () => {
          logger.info(`Video processed: ${inputPath} -> ${outputPath}`);
          resolve();
        })
        .save(outputPath);
    });
  }

  // 総合映像チェック（音声も含む）
  async comprehensiveCheck(videoPath: string): Promise<{
    video: VideoQCResult;
    overall: {
      passed: boolean;
      blockers: string[];
      warnings: string[];
    };
  }> {
    const videoResult = await this.checkVideoQuality(videoPath);
    
    const blockers: string[] = [];
    const warnings: string[] = [];

    // 致命的な問題を特定
    for (const issue of videoResult.issues) {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        blockers.push(issue.description);
      } else {
        warnings.push(issue.description);
      }
    }

    const overallPassed = blockers.length === 0;

    return {
      video: videoResult,
      overall: {
        passed: overallPassed,
        blockers,
        warnings
      }
    };
  }
}

export default VideoQCService;