/**
 * DirectorX Cloud Tasks Integration Service
 * Google Cloud Tasksを使用したバックグラウンドジョブ処理
 */

import { CloudTasksClient } from '@google-cloud/tasks';
import { google } from '@google-cloud/tasks/build/protos/protos';
import { logger } from '../../lib/logger.js';

export interface TaskPayload {
  jobId: string;
  type: TaskType;
  priority: TaskPriority;
  data: any;
  retryConfig?: RetryConfig;
  scheduledTime?: Date;
}

export enum TaskType {
  RENDER_VIDEO = 'render_video',
  RENDER_AUDIO = 'render_audio',
  QC_CHECK = 'qc_check',
  THUMBNAIL_GENERATE = 'thumbnail_generate',
  NLP_PROCESS = 'nlp_process',
  ASSET_PROCESS = 'asset_process',
  BATCH_OPERATION = 'batch_operation'
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

export interface RetryConfig {
  maxAttempts: number;
  minBackoffDelay: number; // seconds
  maxBackoffDelay: number; // seconds
  maxDoublings: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  retryCount: number;
}

export class CloudTasksService {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;
  private queueName: string;
  private serviceUrl: string;

  // キューの設定
  private readonly QUEUE_CONFIGS = {
    [TaskType.RENDER_VIDEO]: {
      queueName: 'render-video-queue',
      maxConcurrency: 3, // 高負荷なので制限
      rateLimits: { maxBurstSize: 5, maxConcurrentDispatches: 3 }
    },
    [TaskType.RENDER_AUDIO]: {
      queueName: 'render-audio-queue', 
      maxConcurrency: 5,
      rateLimits: { maxBurstSize: 10, maxConcurrentDispatches: 5 }
    },
    [TaskType.QC_CHECK]: {
      queueName: 'qc-queue',
      maxConcurrency: 10,
      rateLimits: { maxBurstSize: 20, maxConcurrentDispatches: 10 }
    },
    [TaskType.THUMBNAIL_GENERATE]: {
      queueName: 'thumbnail-queue',
      maxConcurrency: 8,
      rateLimits: { maxBurstSize: 15, maxConcurrentDispatches: 8 }
    },
    [TaskType.NLP_PROCESS]: {
      queueName: 'nlp-queue',
      maxConcurrency: 5,
      rateLimits: { maxBurstSize: 10, maxConcurrentDispatches: 5 }
    },
    [TaskType.ASSET_PROCESS]: {
      queueName: 'asset-queue',
      maxConcurrency: 15,
      rateLimits: { maxBurstSize: 30, maxConcurrentDispatches: 15 }
    },
    [TaskType.BATCH_OPERATION]: {
      queueName: 'batch-queue',
      maxConcurrency: 2,
      rateLimits: { maxBurstSize: 5, maxConcurrentDispatches: 2 }
    }
  };

  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID || '';
    this.location = process.env.CLOUD_TASKS_LOCATION || 'asia-northeast1';
    this.queueName = process.env.CLOUD_TASKS_QUEUE || 'directorx-tasks';
    this.serviceUrl = process.env.CLOUD_TASKS_SERVICE_URL || 'https://directorx-api-xxxxx-an.a.run.app';
    
    this.client = new CloudTasksClient();
    this.initializeQueues();
  }

  // キューの初期化・設定
  private async initializeQueues(): Promise<void> {
    try {
      for (const [taskType, config] of Object.entries(this.QUEUE_CONFIGS)) {
        await this.createOrUpdateQueue(config.queueName, {
          rateLimits: config.rateLimits,
          retryConfig: {
            maxAttempts: 5,
            minBackoff: { seconds: 10 },
            maxBackoff: { seconds: 300 },
            maxDoublings: 3
          }
        });
      }
      
      logger.info('Cloud Tasks queues initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Cloud Tasks queues:', error);
    }
  }

  // キューの作成または更新
  private async createOrUpdateQueue(queueName: string, config: any): Promise<void> {
    try {
      const parent = this.client.locationPath(this.projectId, this.location);
      const queuePath = this.client.queuePath(this.projectId, this.location, queueName);

      // キューが存在するかチェック
      try {
        await this.client.getQueue({ name: queuePath });
        logger.debug(`Queue ${queueName} already exists`);
      } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND
          // キューが存在しない場合は作成
          await this.client.createQueue({
            parent,
            queue: {
              name: queuePath,
              rateLimits: config.rateLimits,
              retryConfig: config.retryConfig
            }
          });
          logger.info(`Created queue: ${queueName}`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(`Failed to create/update queue ${queueName}:`, error);
    }
  }

  // タスクの作成・エンキュー
  async enqueueTask(payload: TaskPayload): Promise<string> {
    try {
      const config = this.QUEUE_CONFIGS[payload.type];
      const queuePath = this.client.queuePath(this.projectId, this.location, config.queueName);
      
      const task: google.cloud.tasks.v2.ITask = {
        httpRequest: {
          httpMethod: 'POST',
          url: `${this.serviceUrl}/v1/tasks/process`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getServiceAccountToken()}`
          },
          body: Buffer.from(JSON.stringify({
            jobId: payload.jobId,
            type: payload.type,
            priority: payload.priority,
            data: payload.data,
            enqueuedAt: new Date().toISOString()
          }))
        }
      };

      // スケジュール設定
      if (payload.scheduledTime) {
        const scheduleTime = Math.floor(payload.scheduledTime.getTime() / 1000);
        task.scheduleTime = { seconds: scheduleTime };
      }

      // リトライ設定
      if (payload.retryConfig) {
        task.httpRequest!.headers!['X-Retry-Config'] = JSON.stringify(payload.retryConfig);
      }

      const [response] = await this.client.createTask({
        parent: queuePath,
        task
      });

      const taskId = response.name?.split('/').pop() || '';
      
      logger.info('Task enqueued', {
        taskId,
        jobId: payload.jobId,
        type: payload.type,
        priority: payload.priority,
        queue: config.queueName
      });

      return taskId;
    } catch (error) {
      logger.error('Failed to enqueue task:', error);
      throw new Error(`Failed to enqueue task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 並列レンダリングタスクの作成
  async enqueueParallelRenderTasks(jobId: string, renderConfig: any): Promise<string[]> {
    const tasks: TaskPayload[] = [];
    
    // 動画レンダリングタスク
    if (renderConfig.video?.enabled) {
      tasks.push({
        jobId,
        type: TaskType.RENDER_VIDEO,
        priority: TaskPriority.HIGH,
        data: {
          videoConfig: renderConfig.video,
          segments: renderConfig.segments || []
        },
        retryConfig: {
          maxAttempts: 3,
          minBackoffDelay: 60,
          maxBackoffDelay: 600,
          maxDoublings: 2
        }
      });
    }

    // 音声レンダリングタスク
    if (renderConfig.audio?.enabled) {
      tasks.push({
        jobId,
        type: TaskType.RENDER_AUDIO,
        priority: TaskPriority.HIGH,
        data: {
          audioConfig: renderConfig.audio,
          segments: renderConfig.segments || []
        },
        retryConfig: {
          maxAttempts: 3,
          minBackoffDelay: 30,
          maxBackoffDelay: 300,
          maxDoublings: 2
        }
      });
    }

    // サムネイル生成タスク（3案）
    if (renderConfig.thumbnails?.enabled) {
      for (let i = 0; i < 3; i++) {
        tasks.push({
          jobId,
          type: TaskType.THUMBNAIL_GENERATE,
          priority: TaskPriority.NORMAL,
          data: {
            thumbnailConfig: renderConfig.thumbnails,
            variantIndex: i,
            layoutType: ['split', 'overlay', 'minimal'][i]
          },
          retryConfig: {
            maxAttempts: 2,
            minBackoffDelay: 10,
            maxBackoffDelay: 60,
            maxDoublings: 1
          }
        });
      }
    }

    // QCチェックタスク
    if (renderConfig.qc?.enabled) {
      tasks.push({
        jobId,
        type: TaskType.QC_CHECK,
        priority: TaskPriority.NORMAL,
        data: {
          qcConfig: renderConfig.qc,
          checkTypes: ['audio', 'video', 'content']
        },
        retryConfig: {
          maxAttempts: 2,
          minBackoffDelay: 15,
          maxBackoffDelay: 120,
          maxDoublings: 1
        }
      });
    }

    // 並列エンキュー
    const taskIds = await Promise.all(
      tasks.map(task => this.enqueueTask(task))
    );

    logger.info('Parallel render tasks enqueued', {
      jobId,
      taskCount: tasks.length,
      taskIds,
      taskTypes: tasks.map(t => t.type)
    });

    return taskIds;
  }

  // バッチ処理タスクの作成
  async enqueueBatchTasks(batchId: string, operations: any[]): Promise<string[]> {
    const chunkSize = 10; // バッチサイズ
    const chunks = this.chunkArray(operations, chunkSize);
    
    const tasks: TaskPayload[] = chunks.map((chunk, index) => ({
      jobId: `${batchId}_chunk_${index}`,
      type: TaskType.BATCH_OPERATION,
      priority: TaskPriority.NORMAL,
      data: {
        batchId,
        chunkIndex: index,
        totalChunks: chunks.length,
        operations: chunk
      },
      retryConfig: {
        maxAttempts: 3,
        minBackoffDelay: 30,
        maxBackoffDelay: 300,
        maxDoublings: 2
      }
    }));

    const taskIds = await Promise.all(
      tasks.map(task => this.enqueueTask(task))
    );

    logger.info('Batch tasks enqueued', {
      batchId,
      totalOperations: operations.length,
      chunkCount: chunks.length,
      taskIds
    });

    return taskIds;
  }

  // タスクのキャンセル
  async cancelTask(taskId: string, queueName: string): Promise<void> {
    try {
      const taskPath = this.client.taskPath(this.projectId, this.location, queueName, taskId);
      await this.client.deleteTask({ name: taskPath });
      
      logger.info('Task cancelled', { taskId, queueName });
    } catch (error) {
      logger.error('Failed to cancel task:', error);
      throw new Error(`Failed to cancel task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // キューの一時停止
  async pauseQueue(taskType: TaskType): Promise<void> {
    try {
      const config = this.QUEUE_CONFIGS[taskType];
      const queuePath = this.client.queuePath(this.projectId, this.location, config.queueName);
      
      await this.client.pauseQueue({ name: queuePath });
      logger.info(`Queue paused: ${config.queueName}`);
    } catch (error) {
      logger.error('Failed to pause queue:', error);
      throw error;
    }
  }

  // キューの再開
  async resumeQueue(taskType: TaskType): Promise<void> {
    try {
      const config = this.QUEUE_CONFIGS[taskType];
      const queuePath = this.client.queuePath(this.projectId, this.location, config.queueName);
      
      await this.client.resumeQueue({ name: queuePath });
      logger.info(`Queue resumed: ${config.queueName}`);
    } catch (error) {
      logger.error('Failed to resume queue:', error);
      throw error;
    }
  }

  // キューの統計情報取得
  async getQueueStats(taskType: TaskType): Promise<any> {
    try {
      const config = this.QUEUE_CONFIGS[taskType];
      const queuePath = this.client.queuePath(this.projectId, this.location, config.queueName);
      
      const [tasks] = await this.client.listTasks({
        parent: queuePath,
        responseView: 'BASIC'
      });

      return {
        queueName: config.queueName,
        totalTasks: tasks.length,
        pendingTasks: tasks.filter(task => task.scheduleTime && new Date(task.scheduleTime.seconds! * 1000) > new Date()).length,
        runningTasks: tasks.filter(task => !task.scheduleTime).length,
        maxConcurrency: config.maxConcurrency
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      return null;
    }
  }

  // 全キューの統計情報取得
  async getAllQueuesStats(): Promise<any[]> {
    const stats = await Promise.all(
      Object.keys(this.QUEUE_CONFIGS).map(taskType => 
        this.getQueueStats(taskType as TaskType)
      )
    );
    
    return stats.filter(stat => stat !== null);
  }

  // サービスアカウントトークン取得
  private async getServiceAccountToken(): Promise<string> {
    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      
      return accessToken.token || '';
    } catch (error) {
      logger.error('Failed to get service account token:', error);
      return '';
    }
  }

  // ユーティリティ関数
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      // 基本的なCloud Tasks APIの接続確認
      const parent = this.client.locationPath(this.projectId, this.location);
      await this.client.listQueues({ parent });
      return true;
    } catch (error) {
      logger.error('Cloud Tasks health check failed:', error);
      return false;
    }
  }
}

export default CloudTasksService;