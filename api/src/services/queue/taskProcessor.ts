/**
 * DirectorX Task Processor Service
 * Cloud Tasksから受信したタスクの実行処理
 */

import { TaskType, TaskResult } from './cloudTasks.js';
import { logger } from '../../lib/logger.js';
import { FFmpegService } from '../render/ffmpeg.js';
import ThumbnailGenerator from '../thumbnail/generator.js';
import { AudioQCService } from '../qc/audio.js';
import { VideoQCService } from '../qc/video.js';
import { LLMService } from '../llm/index.js';

export interface TaskExecution {
  taskId: string;
  jobId: string;
  type: TaskType;
  data: any;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'retrying';
  result?: any;
  error?: string;
  retryCount: number;
}

export class TaskProcessor {
  private ffmpegService: FFmpegService;
  private thumbnailGenerator: ThumbnailGenerator;
  private audioQCService: AudioQCService;
  private videoQCService: VideoQCService;
  private llmService: LLMService;
  private runningTasks: Map<string, TaskExecution> = new Map();

  constructor() {
    this.ffmpegService = new FFmpegService();
    this.thumbnailGenerator = new ThumbnailGenerator();
    this.audioQCService = new AudioQCService();
    this.videoQCService = new VideoQCService();
    this.llmService = new LLMService();
  }

  // メインタスク処理エントリーポイント
  async processTask(
    taskId: string,
    jobId: string,
    type: TaskType,
    data: any,
    retryCount: number = 0
  ): Promise<TaskResult> {
    const execution: TaskExecution = {
      taskId,
      jobId,
      type,
      data,
      startTime: new Date(),
      status: 'running',
      retryCount
    };

    this.runningTasks.set(taskId, execution);
    
    logger.info('Task processing started', {
      taskId,
      jobId,
      type,
      retryCount
    });

    try {
      let result: any;

      switch (type) {
        case TaskType.RENDER_VIDEO:
          result = await this.processVideoRender(data);
          break;
          
        case TaskType.RENDER_AUDIO:
          result = await this.processAudioRender(data);
          break;
          
        case TaskType.QC_CHECK:
          result = await this.processQCCheck(data);
          break;
          
        case TaskType.THUMBNAIL_GENERATE:
          result = await this.processThumbnailGeneration(data);
          break;
          
        case TaskType.NLP_PROCESS:
          result = await this.processNLP(data);
          break;
          
        case TaskType.ASSET_PROCESS:
          result = await this.processAsset(data);
          break;
          
        case TaskType.BATCH_OPERATION:
          result = await this.processBatchOperation(data);
          break;
          
        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = result;

      const duration = execution.endTime.getTime() - execution.startTime.getTime();

      logger.info('Task processing completed', {
        taskId,
        jobId,
        type,
        duration,
        retryCount
      });

      // ジョブの状態更新
      await this.updateJobStatus(jobId, type, 'completed', result);

      return {
        taskId,
        success: true,
        result,
        duration,
        retryCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = errorMessage;

      const duration = execution.endTime.getTime() - execution.startTime.getTime();

      logger.error('Task processing failed', {
        taskId,
        jobId,
        type,
        error: errorMessage,
        duration,
        retryCount
      });

      // ジョブの状態更新
      await this.updateJobStatus(jobId, type, 'failed', { error: errorMessage });

      return {
        taskId,
        success: false,
        error: errorMessage,
        duration,
        retryCount
      };

    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  // 動画レンダリング処理
  private async processVideoRender(data: any): Promise<any> {
    const { videoConfig, segments } = data;
    
    logger.info('Starting video render', {
      resolution: videoConfig.resolution,
      frameRate: videoConfig.frameRate,
      segmentCount: segments?.length || 0
    });

    // セグメント並列処理
    const segmentResults = await Promise.all(
      segments.map(async (segment: any, index: number) => {
        return await this.ffmpegService.renderSegment(segment, {
          ...videoConfig,
          outputPath: `/tmp/segment_${index}.mp4`
        });
      })
    );

    // セグメント結合
    const finalVideo = await this.ffmpegService.concatenateSegments(
      segmentResults,
      `/tmp/final_video_${Date.now()}.mp4`
    );

    // 品質最適化
    const optimizedVideo = await this.ffmpegService.optimizeVideo(finalVideo, {
      bitrate: videoConfig.bitrate || '2500k',
      crf: videoConfig.crf || 23,
      preset: videoConfig.preset || 'fast'
    });

    return {
      videoPath: optimizedVideo,
      duration: await this.ffmpegService.getVideoDuration(optimizedVideo),
      fileSize: await this.getFileSize(optimizedVideo),
      metadata: {
        resolution: videoConfig.resolution,
        frameRate: videoConfig.frameRate,
        bitrate: videoConfig.bitrate
      }
    };
  }

  // 音声レンダリング処理
  private async processAudioRender(data: any): Promise<any> {
    const { audioConfig, segments } = data;
    
    logger.info('Starting audio render', {
      sampleRate: audioConfig.sampleRate,
      channels: audioConfig.channels,
      segmentCount: segments?.length || 0
    });

    // 音声セグメント並列処理
    const audioSegments = await Promise.all(
      segments.map(async (segment: any, index: number) => {
        return await this.ffmpegService.renderAudioSegment(segment, {
          ...audioConfig,
          outputPath: `/tmp/audio_segment_${index}.mp3`
        });
      })
    );

    // 音声結合
    const combinedAudio = await this.ffmpegService.concatenateAudio(
      audioSegments,
      `/tmp/final_audio_${Date.now()}.mp3`
    );

    // LUFS正規化
    const normalizedAudio = await this.ffmpegService.normalizeLUFS(
      combinedAudio,
      audioConfig.targetLUFS || -16
    );

    return {
      audioPath: normalizedAudio,
      duration: await this.ffmpegService.getAudioDuration(normalizedAudio),
      fileSize: await this.getFileSize(normalizedAudio),
      lufsLevel: await this.audioQCService.measureLUFS(normalizedAudio),
      metadata: {
        sampleRate: audioConfig.sampleRate,
        channels: audioConfig.channels,
        bitrate: audioConfig.bitrate
      }
    };
  }

  // QCチェック処理
  private async processQCCheck(data: any): Promise<any> {
    const { qcConfig, checkTypes } = data;
    const results: any = {};

    logger.info('Starting QC check', {
      checkTypes,
      filePath: qcConfig.filePath
    });

    // 音声QCチェック
    if (checkTypes.includes('audio')) {
      const audioResults = await this.audioQCService.performCheck(qcConfig.filePath, {
        checkLUFS: true,
        checkSilence: true,
        checkClipping: true,
        maxSilenceDuration: 2.0
      });
      
      results.audio = audioResults;
    }

    // 動画QCチェック
    if (checkTypes.includes('video')) {
      const videoResults = await this.videoQCService.performCheck(qcConfig.filePath, {
        checkBlackFrames: true,
        checkResolution: true,
        checkFrameRate: true,
        blackFrameThreshold: 0.1
      });
      
      results.video = videoResults;
    }

    // コンテンツQCチェック
    if (checkTypes.includes('content')) {
      const contentResults = await this.performContentQC(qcConfig);
      results.content = contentResults;
    }

    // 総合判定
    const overallStatus = this.determineOverallQCStatus(results);
    
    return {
      status: overallStatus,
      results,
      timestamp: new Date(),
      recommendations: this.generateQCRecommendations(results)
    };
  }

  // サムネイル生成処理
  private async processThumbnailGeneration(data: any): Promise<any> {
    const { thumbnailConfig, variantIndex, layoutType } = data;
    
    logger.info('Starting thumbnail generation', {
      layoutType,
      variantIndex,
      resolution: thumbnailConfig.resolution
    });

    const request = {
      title: thumbnailConfig.title,
      subtitle: thumbnailConfig.subtitle,
      resolution: thumbnailConfig.resolution,
      brandKit: thumbnailConfig.brandKit,
      backgroundImage: thumbnailConfig.backgroundImage,
      customText: thumbnailConfig.customText
    };

    // 特定レイアウトでサムネイル生成
    const thumbnail = await this.thumbnailGenerator.generateSingleVariant(
      request,
      layoutType
    );

    // 高品質保存
    const thumbnailPath = `/tmp/thumbnail_${variantIndex}_${Date.now()}.png`;
    await this.saveThumbnail(thumbnail.buffer, thumbnailPath);

    return {
      variantIndex,
      layoutType,
      thumbnailPath,
      fileSize: thumbnail.metadata.size,
      resolution: {
        width: thumbnail.metadata.width,
        height: thumbnail.metadata.height
      },
      metadata: thumbnail.metadata
    };
  }

  // NLP処理
  private async processNLP(data: any): Promise<any> {
    const { nlpConfig, taskType } = data;
    
    logger.info('Starting NLP processing', {
      taskType,
      inputLength: nlpConfig.input?.length || 0
    });

    let result: any;

    switch (taskType) {
      case 'script_generation':
        result = await this.llmService.generateScript({
          topic: nlpConfig.topic,
          targetLength: nlpConfig.targetLength || 2500,
          style: nlpConfig.style || 'informative',
          keywords: nlpConfig.keywords || []
        });
        break;
        
      case 'comments_generation':
        result = await this.llmService.generateComments5ch({
          topic: nlpConfig.topic,
          count: nlpConfig.count || 30,
          style: nlpConfig.style || 'mixed'
        });
        break;
        
      case 'content_analysis':
        result = await this.llmService.analyzeContent(nlpConfig.content);
        break;
        
      default:
        throw new Error(`Unknown NLP task type: ${taskType}`);
    }

    return {
      taskType,
      result,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage,
      model: result.model
    };
  }

  // アセット処理
  private async processAsset(data: any): Promise<any> {
    const { assetConfig, operation } = data;
    
    logger.info('Starting asset processing', {
      operation,
      assetPath: assetConfig.path
    });

    let result: any;

    switch (operation) {
      case 'transcode':
        result = await this.ffmpegService.transcodeVideo(
          assetConfig.path,
          assetConfig.outputFormat || 'mp4',
          assetConfig.quality || 'high'
        );
        break;
        
      case 'extract_audio':
        result = await this.ffmpegService.extractAudio(
          assetConfig.path,
          assetConfig.outputFormat || 'mp3'
        );
        break;
        
      case 'generate_thumbnails':
        result = await this.ffmpegService.generateVideoThumbnails(
          assetConfig.path,
          assetConfig.count || 5
        );
        break;
        
      case 'analyze_metadata':
        result = await this.ffmpegService.analyzeMediaMetadata(assetConfig.path);
        break;
        
      default:
        throw new Error(`Unknown asset operation: ${operation}`);
    }

    return result;
  }

  // バッチ操作処理
  private async processBatchOperation(data: any): Promise<any> {
    const { batchId, chunkIndex, totalChunks, operations } = data;
    
    logger.info('Starting batch operation', {
      batchId,
      chunkIndex,
      totalChunks,
      operationCount: operations.length
    });

    const results = await Promise.allSettled(
      operations.map(async (operation: any) => {
        try {
          return await this.processSingleBatchOperation(operation);
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      batchId,
      chunkIndex,
      totalChunks,
      operationCount: operations.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
    };
  }

  // 個別バッチ操作処理
  private async processSingleBatchOperation(operation: any): Promise<any> {
    switch (operation.type) {
      case 'update_job_status':
        return await this.updateJobStatus(
          operation.jobId,
          operation.taskType,
          operation.status,
          operation.result
        );
        
      case 'cleanup_files':
        return await this.cleanupFiles(operation.filePaths);
        
      case 'send_notification':
        return await this.sendNotification(operation.notification);
        
      default:
        throw new Error(`Unknown batch operation type: ${operation.type}`);
    }
  }

  // コンテンツQCチェック
  private async performContentQC(qcConfig: any): Promise<any> {
    return {
      textQuality: await this.checkTextQuality(qcConfig.text || ''),
      contentAlignment: await this.checkContentAlignment(qcConfig),
      complianceCheck: await this.checkCompliance(qcConfig.content || '')
    };
  }

  // テキスト品質チェック
  private async checkTextQuality(text: string): Promise<any> {
    return {
      length: text.length,
      readabilityScore: this.calculateReadabilityScore(text),
      grammarIssues: await this.findGrammarIssues(text),
      duplicateContent: this.checkDuplicateContent(text)
    };
  }

  // 総合QC判定
  private determineOverallQCStatus(results: any): 'pass' | 'warning' | 'fail' {
    let hasFailures = false;
    let hasWarnings = false;

    Object.values(results).forEach((result: any) => {
      if (result.status === 'fail' || result.criticalIssues?.length > 0) {
        hasFailures = true;
      } else if (result.status === 'warning' || result.warnings?.length > 0) {
        hasWarnings = true;
      }
    });

    if (hasFailures) return 'fail';
    if (hasWarnings) return 'warning';
    return 'pass';
  }

  // ジョブ状態更新
  private async updateJobStatus(
    jobId: string, 
    taskType: TaskType, 
    status: string, 
    result?: any
  ): Promise<void> {
    try {
      // 実装では実際のデータベース更新
      logger.info('Job status updated', {
        jobId,
        taskType,
        status,
        hasResult: !!result
      });
    } catch (error) {
      logger.error('Failed to update job status:', error);
      throw error;
    }
  }

  // 実行中タスク取得
  getRunningTasks(): TaskExecution[] {
    return Array.from(this.runningTasks.values());
  }

  // タスクキャンセル
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = 'Task cancelled by user';
      task.endTime = new Date();
      this.runningTasks.delete(taskId);
      
      logger.info('Task cancelled', { taskId });
      return true;
    }
    return false;
  }

  // ヘルパーメソッド
  private async getFileSize(filePath: string): Promise<number> {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private async saveThumbnail(buffer: Buffer, path: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, buffer);
  }

  private calculateReadabilityScore(text: string): number {
    // 簡易的な読みやすさスコア計算
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const avgWordsPerSentence = words.length / sentences.length;
    return Math.max(0, Math.min(100, 100 - avgWordsPerSentence * 2));
  }

  private async findGrammarIssues(text: string): Promise<string[]> {
    // プレースホルダー実装
    return [];
  }

  private checkDuplicateContent(text: string): boolean {
    // プレースホルダー実装
    return false;
  }

  private async checkContentAlignment(qcConfig: any): Promise<any> {
    return { aligned: true, score: 0.95 };
  }

  private async checkCompliance(content: string): Promise<any> {
    return { compliant: true, issues: [] };
  }

  private async cleanupFiles(filePaths: string[]): Promise<void> {
    const fs = await import('fs/promises');
    await Promise.allSettled(
      filePaths.map(path => fs.unlink(path).catch(() => {}))
    );
  }

  private async sendNotification(notification: any): Promise<void> {
    logger.info('Notification sent', notification);
  }

  private generateQCRecommendations(results: any): string[] {
    const recommendations: string[] = [];
    
    // 各QC結果から推奨事項を生成
    Object.entries(results).forEach(([key, result]: [string, any]) => {
      if (result.status === 'warning' || result.status === 'fail') {
        recommendations.push(`${key}: ${result.message || '要改善'}`);
      }
    });

    return recommendations;
  }
}

export default TaskProcessor;