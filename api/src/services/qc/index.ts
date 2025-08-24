/**
 * DirectorX 統合品質管理サービス
 * 音声・映像・テキストの総合品質チェック
 */

import AudioQCService, { AudioQCResult } from './audio.js';
import VideoQCService, { VideoQCResult } from './video.js';
import NGWordService, { NGWordResult } from './ngwords.js';
import { logger } from '../../lib/logger.js';

export interface ComprehensiveQCResult {
  overall: {
    passed: boolean;
    score: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  audio?: AudioQCResult;
  video?: VideoQCResult;
  content?: NGWordResult;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  timestamp: string;
  processingTime: number;
}

export interface QCOptions {
  checkAudio: boolean;
  checkVideo: boolean;
  checkContent: boolean;
  ngwordProfile: string;
  autoFix: boolean;
}

export class QualityControlService {
  private audioQC: AudioQCService;
  private videoQC: VideoQCService;
  private ngwordQC: NGWordService;

  constructor() {
    this.audioQC = new AudioQCService();
    this.videoQC = new VideoQCService();
    this.ngwordQC = new NGWordService();
  }

  // 総合品質チェック
  async runComprehensiveQC(
    inputs: {
      videoPath?: string;
      audioPath?: string;
      scriptContent?: string;
      srtContent?: string;
    },
    options: QCOptions = {
      checkAudio: true,
      checkVideo: true,
      checkContent: true,
      ngwordProfile: 'youtube',
      autoFix: false
    }
  ): Promise<ComprehensiveQCResult> {
    const startTime = Date.now();
    logger.info('Starting comprehensive QC check');

    const result: ComprehensiveQCResult = {
      overall: {
        passed: true,
        score: 100,
        riskLevel: 'low'
      },
      blockers: [],
      warnings: [],
      recommendations: [],
      timestamp: new Date().toISOString(),
      processingTime: 0
    };

    try {
      // 並列でQCチェックを実行
      const qcPromises: Promise<any>[] = [];

      // 音声QC
      if (options.checkAudio && inputs.audioPath) {
        qcPromises.push(
          this.audioQC.checkAudioQuality(inputs.audioPath)
            .then(audioResult => ({ type: 'audio', result: audioResult }))
            .catch(error => ({ type: 'audio', error }))
        );
      }

      // 映像QC
      if (options.checkVideo && inputs.videoPath) {
        qcPromises.push(
          this.videoQC.checkVideoQuality(inputs.videoPath)
            .then(videoResult => ({ type: 'video', result: videoResult }))
            .catch(error => ({ type: 'video', error }))
        );
      }

      // NGワードQC
      if (options.checkContent) {
        const contentToCheck = [
          inputs.scriptContent || '',
          inputs.srtContent || ''
        ].filter(Boolean).join('\n');

        if (contentToCheck.trim()) {
          qcPromises.push(
            this.ngwordQC.checkContent(contentToCheck, options.ngwordProfile)
              .then(contentResult => ({ type: 'content', result: contentResult }))
              .catch(error => ({ type: 'content', error }))
          );
        }
      }

      // 並列実行
      const qcResults = await Promise.allSettled(qcPromises);

      // 結果を統合
      for (const qcResult of qcResults) {
        if (qcResult.status === 'fulfilled' && qcResult.value.result) {
          const { type, result } = qcResult.value;
          
          switch (type) {
            case 'audio':
              result.audio = result;
              this.processAudioResult(result.audio, result);
              break;
            case 'video':
              result.video = result;
              this.processVideoResult(result.video, result);
              break;
            case 'content':
              result.content = result;
              this.processContentResult(result.content, result);
              break;
          }
        } else if (qcResult.status === 'fulfilled' && qcResult.value.error) {
          logger.error(`QC check failed for ${qcResult.value.type}:`, qcResult.value.error);
          result.warnings.push(`${qcResult.value.type}品質チェックでエラーが発生しました`);
        }
      }

      // 総合評価
      this.calculateOverallResult(result);

      // 自動修正（オプション）
      if (options.autoFix && !result.overall.passed) {
        await this.autoFixIssues(inputs, result);
      }

    } catch (error) {
      logger.error('Comprehensive QC failed:', error);
      result.overall.passed = false;
      result.overall.score = 0;
      result.overall.riskLevel = 'critical';
      result.blockers.push('品質チェック実行中にエラーが発生しました');
    }

    result.processingTime = Date.now() - startTime;
    logger.info(`Comprehensive QC completed in ${result.processingTime}ms`);

    return result;
  }

  // 音声結果処理
  private processAudioResult(audioResult: AudioQCResult, overall: ComprehensiveQCResult): void {
    for (const issue of audioResult.issues) {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        overall.blockers.push(issue.description);
        overall.overall.passed = false;
      } else {
        overall.warnings.push(issue.description);
      }
    }
    overall.recommendations.push(...audioResult.recommendations);
  }

  // 映像結果処理
  private processVideoResult(videoResult: VideoQCResult, overall: ComprehensiveQCResult): void {
    for (const issue of videoResult.issues) {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        overall.blockers.push(issue.description);
        overall.overall.passed = false;
      } else {
        overall.warnings.push(issue.description);
      }
    }
    overall.recommendations.push(...videoResult.recommendations);
  }

  // コンテンツ結果処理
  private processContentResult(contentResult: NGWordResult, overall: ComprehensiveQCResult): void {
    for (const violation of contentResult.violations) {
      if (violation.severity === 'critical' || violation.severity === 'error') {
        overall.blockers.push(`NGワード検出: ${violation.word} (${violation.context})`);
        overall.overall.passed = false;
      } else {
        overall.warnings.push(`注意表現: ${violation.word}`);
      }
    }
    overall.recommendations.push(...contentResult.recommendations);
  }

  // 総合評価計算
  private calculateOverallResult(result: ComprehensiveQCResult): void {
    let score = 100;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // スコア減点
    score -= result.blockers.length * 30;    // ブロッカー: -30点
    score -= result.warnings.length * 5;     // 警告: -5点

    // リスクレベル判定
    if (result.blockers.length > 0) {
      riskLevel = result.blockers.some(b => b.includes('個人情報') || b.includes('著作権')) 
        ? 'critical' : 'high';
    } else if (result.warnings.length > 10) {
      riskLevel = 'medium';
    }

    result.overall.score = Math.max(0, score);
    result.overall.riskLevel = riskLevel;

    // 配信阻止判定
    if (riskLevel === 'critical' || score < 50) {
      result.overall.passed = false;
    }
  }

  // 自動修正
  private async autoFixIssues(
    inputs: any,
    qcResult: ComprehensiveQCResult
  ): Promise<void> {
    const fixPromises: Promise<void>[] = [];

    // 音声自動修正
    if (qcResult.audio && !qcResult.audio.passed && inputs.audioPath) {
      const fixedAudioPath = inputs.audioPath.replace(/(\.[^.]+)$/, '_fixed$1');
      fixPromises.push(
        this.audioQC.autoFixAudioIssues(inputs.audioPath, fixedAudioPath, qcResult.audio)
          .then(() => {
            inputs.audioPath = fixedAudioPath;
            logger.info('Audio auto-fix completed');
          })
      );
    }

    // 映像自動修正（基本処理のみ）
    if (qcResult.video && !qcResult.video.passed && inputs.videoPath) {
      const fixedVideoPath = inputs.videoPath.replace(/(\.[^.]+)$/, '_fixed$1');
      fixPromises.push(
        this.videoQC.autoFixBlackFrames(inputs.videoPath, fixedVideoPath)
          .then(() => {
            inputs.videoPath = fixedVideoPath;
            logger.info('Video auto-fix completed');
          })
      );
    }

    await Promise.allSettled(fixPromises);
  }

  // 品質レポート生成
  generateReport(qcResult: ComprehensiveQCResult): string {
    const lines: string[] = [];
    
    lines.push('=== DirectorX 品質チェックレポート ===');
    lines.push(`実行日時: ${qcResult.timestamp}`);
    lines.push(`処理時間: ${qcResult.processingTime}ms`);
    lines.push(`総合評価: ${qcResult.overall.passed ? '✅ 合格' : '❌ 不合格'}`);
    lines.push(`品質スコア: ${qcResult.overall.score}/100`);
    lines.push(`リスクレベル: ${qcResult.overall.riskLevel.toUpperCase()}`);
    lines.push('');

    if (qcResult.blockers.length > 0) {
      lines.push('🚫 配信阻止事項:');
      qcResult.blockers.forEach(blocker => lines.push(`  • ${blocker}`));
      lines.push('');
    }

    if (qcResult.warnings.length > 0) {
      lines.push('⚠️ 注意事項:');
      qcResult.warnings.forEach(warning => lines.push(`  • ${warning}`));
      lines.push('');
    }

    if (qcResult.recommendations.length > 0) {
      lines.push('💡 推奨事項:');
      qcResult.recommendations.forEach(rec => lines.push(`  • ${rec}`));
      lines.push('');
    }

    lines.push('=== レポート終了 ===');
    
    return lines.join('\n');
  }
}

export default QualityControlService;
export * from './audio.js';
export * from './video.js';
export * from './ngwords.js';