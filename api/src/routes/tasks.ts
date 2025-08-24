/**
 * DirectorX Tasks API Routes
 * Cloud Tasks管理・並列処理API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import CloudTasksService, { TaskType, TaskPriority } from '../services/queue/cloudTasks.js';
import TaskProcessor from '../services/queue/taskProcessor.js';
import {
  AuthenticatedRequest,
  requirePermissions,
  requireEditor
} from '../middleware/rbac.js';
import { Permission } from '../models/user.js';
import { logger } from '../lib/logger.js';

const router = Router();
const cloudTasksService = new CloudTasksService();
const taskProcessor = new TaskProcessor();

// リクエストスキーマ
const EnqueueTaskSchema = z.object({
  jobId: z.string().min(1),
  type: z.nativeEnum(TaskType),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
  data: z.record(z.any()),
  scheduledTime: z.string().datetime().optional(),
  retryConfig: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    minBackoffDelay: z.number().min(1).max(3600).default(30),
    maxBackoffDelay: z.number().min(60).max(7200).default(300),
    maxDoublings: z.number().min(0).max(5).default(2)
  }).optional()
});

const ParallelRenderSchema = z.object({
  jobId: z.string().min(1),
  renderConfig: z.object({
    video: z.object({
      enabled: z.boolean(),
      resolution: z.string().default('1920x1080'),
      frameRate: z.number().default(30),
      bitrate: z.string().default('2500k'),
      preset: z.string().default('fast'),
      crf: z.number().min(0).max(51).default(23)
    }).optional(),
    audio: z.object({
      enabled: z.boolean(),
      sampleRate: z.number().default(44100),
      channels: z.number().min(1).max(8).default(2),
      bitrate: z.string().default('192k'),
      targetLUFS: z.number().default(-16)
    }).optional(),
    thumbnails: z.object({
      enabled: z.boolean(),
      resolution: z.string().default('1280x720'),
      title: z.string(),
      subtitle: z.string().optional(),
      brandKit: z.any().optional()
    }).optional(),
    qc: z.object({
      enabled: z.boolean(),
      checkTypes: z.array(z.string()).default(['audio', 'video', 'content'])
    }).optional(),
    segments: z.array(z.any()).optional()
  })
});

const BatchOperationSchema = z.object({
  batchId: z.string().min(1),
  operations: z.array(z.object({
    type: z.string(),
    data: z.record(z.any())
  })).min(1).max(1000)
});

// POST /v1/tasks/enqueue - 単一タスクのエンキュー
router.post('/enqueue',
  requireEditor(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = EnqueueTaskSchema.parse(req.body);
      
      const payload = {
        jobId: body.jobId,
        type: body.type,
        priority: body.priority,
        data: body.data,
        retryConfig: body.retryConfig,
        scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : undefined
      };

      const taskId = await cloudTasksService.enqueueTask(payload);

      logger.info('Task enqueued via API', {
        taskId,
        jobId: body.jobId,
        type: body.type,
        userId: req.user?.id
      });

      res.json({
        success: true,
        taskId,
        message: 'タスクがキューに追加されました'
      });

    } catch (error) {
      logger.error('Failed to enqueue task:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to enqueue task',
          message: 'タスクのエンキューに失敗しました'
        });
      }
    }
  }
);

// POST /v1/tasks/render/parallel - 並列レンダリングタスクの作成
router.post('/render/parallel',
  requirePermissions(Permission.RENDER_EXECUTE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = ParallelRenderSchema.parse(req.body);
      
      const taskIds = await cloudTasksService.enqueueParallelRenderTasks(
        body.jobId,
        body.renderConfig
      );

      logger.info('Parallel render tasks created', {
        jobId: body.jobId,
        taskCount: taskIds.length,
        taskIds,
        userId: req.user?.id
      });

      res.json({
        success: true,
        jobId: body.jobId,
        taskIds,
        taskCount: taskIds.length,
        message: `${taskIds.length}個の並列レンダリングタスクが作成されました`
      });

    } catch (error) {
      logger.error('Failed to create parallel render tasks:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to create parallel render tasks',
          message: '並列レンダリングタスクの作成に失敗しました'
        });
      }
    }
  }
);

// POST /v1/tasks/batch - バッチ操作タスクの作成
router.post('/batch',
  requirePermissions([Permission.JOB_EXECUTE, Permission.RENDER_EXECUTE]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = BatchOperationSchema.parse(req.body);
      
      const taskIds = await cloudTasksService.enqueueBatchTasks(
        body.batchId,
        body.operations
      );

      logger.info('Batch tasks created', {
        batchId: body.batchId,
        operationCount: body.operations.length,
        taskCount: taskIds.length,
        userId: req.user?.id
      });

      res.json({
        success: true,
        batchId: body.batchId,
        taskIds,
        operationCount: body.operations.length,
        taskCount: taskIds.length,
        message: `${body.operations.length}個の操作を${taskIds.length}個のタスクに分割して実行開始しました`
      });

    } catch (error) {
      logger.error('Failed to create batch tasks:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to create batch tasks',
          message: 'バッチタスクの作成に失敗しました'
        });
      }
    }
  }
);

// POST /v1/tasks/process - Cloud Tasksからのタスク実行（内部API）
router.post('/process',
  async (req: Request, res: Response) => {
    try {
      // Cloud Tasksからのリクエスト認証
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Invalid authorization header',
          message: '認証ヘッダーが無効です'
        });
        return;
      }

      const { jobId, type, data, retryCount = 0 } = req.body;
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const result = await taskProcessor.processTask(
        taskId,
        jobId,
        type,
        data,
        retryCount
      );

      if (result.success) {
        res.json({
          success: true,
          taskId: result.taskId,
          result: result.result,
          duration: result.duration,
          message: 'タスクが正常に完了しました'
        });
      } else {
        res.status(500).json({
          success: false,
          taskId: result.taskId,
          error: result.error,
          duration: result.duration,
          message: 'タスクの実行に失敗しました'
        });
      }

    } catch (error) {
      logger.error('Task processing error:', error);
      res.status(500).json({
        error: 'Task processing failed',
        message: 'タスクの処理中にエラーが発生しました'
      });
    }
  }
);

// GET /v1/tasks/running - 実行中タスクの一覧
router.get('/running',
  requirePermissions(Permission.JOB_READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const runningTasks = taskProcessor.getRunningTasks();

      res.json({
        success: true,
        tasks: runningTasks.map(task => ({
          taskId: task.taskId,
          jobId: task.jobId,
          type: task.type,
          status: task.status,
          startTime: task.startTime,
          duration: task.endTime 
            ? task.endTime.getTime() - task.startTime.getTime()
            : Date.now() - task.startTime.getTime(),
          retryCount: task.retryCount
        })),
        count: runningTasks.length
      });

    } catch (error) {
      logger.error('Failed to get running tasks:', error);
      res.status(500).json({
        error: 'Failed to get running tasks',
        message: '実行中タスクの取得に失敗しました'
      });
    }
  }
);

// DELETE /v1/tasks/:taskId/cancel - タスクのキャンセル
router.delete('/:taskId/cancel',
  requirePermissions(Permission.JOB_UPDATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const { queueName } = req.body;

      // 実行中タスクのキャンセル
      const cancelled = await taskProcessor.cancelTask(taskId);
      
      if (cancelled) {
        logger.info('Task cancelled', {
          taskId,
          userId: req.user?.id
        });

        res.json({
          success: true,
          message: 'タスクがキャンセルされました'
        });
      } else {
        // キューからのタスク削除を試行
        if (queueName) {
          await cloudTasksService.cancelTask(taskId, queueName);
          res.json({
            success: true,
            message: 'タスクがキューから削除されました'
          });
        } else {
          res.status(404).json({
            error: 'Task not found',
            message: 'タスクが見つかりません'
          });
        }
      }

    } catch (error) {
      logger.error('Failed to cancel task:', error);
      res.status(500).json({
        error: 'Failed to cancel task',
        message: 'タスクのキャンセルに失敗しました'
      });
    }
  }
);

// GET /v1/tasks/queues/stats - キュー統計情報
router.get('/queues/stats',
  requirePermissions(Permission.JOB_READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await cloudTasksService.getAllQueuesStats();

      res.json({
        success: true,
        queues: stats,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      res.status(500).json({
        error: 'Failed to get queue stats',
        message: 'キュー統計情報の取得に失敗しました'
      });
    }
  }
);

// POST /v1/tasks/queues/:taskType/pause - キューの一時停止
router.post('/queues/:taskType/pause',
  requirePermissions(Permission.JOB_UPDATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskType = req.params.taskType as TaskType;
      
      if (!Object.values(TaskType).includes(taskType)) {
        res.status(400).json({
          error: 'Invalid task type',
          message: '無効なタスクタイプです'
        });
        return;
      }

      await cloudTasksService.pauseQueue(taskType);

      logger.info('Queue paused', {
        taskType,
        userId: req.user?.id
      });

      res.json({
        success: true,
        message: `${taskType}キューが一時停止されました`
      });

    } catch (error) {
      logger.error('Failed to pause queue:', error);
      res.status(500).json({
        error: 'Failed to pause queue',
        message: 'キューの一時停止に失敗しました'
      });
    }
  }
);

// POST /v1/tasks/queues/:taskType/resume - キューの再開
router.post('/queues/:taskType/resume',
  requirePermissions(Permission.JOB_UPDATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskType = req.params.taskType as TaskType;
      
      if (!Object.values(TaskType).includes(taskType)) {
        res.status(400).json({
          error: 'Invalid task type',
          message: '無効なタスクタイプです'
        });
        return;
      }

      await cloudTasksService.resumeQueue(taskType);

      logger.info('Queue resumed', {
        taskType,
        userId: req.user?.id
      });

      res.json({
        success: true,
        message: `${taskType}キューが再開されました`
      });

    } catch (error) {
      logger.error('Failed to resume queue:', error);
      res.status(500).json({
        error: 'Failed to resume queue',
        message: 'キューの再開に失敗しました'
      });
    }
  }
);

// GET /v1/tasks/types - 利用可能なタスクタイプ一覧
router.get('/types',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskTypes = Object.values(TaskType).map(type => ({
        type,
        description: getTaskTypeDescription(type),
        permissions: getRequiredPermissions(type),
        estimatedDuration: getEstimatedDuration(type),
        resourceUsage: getResourceUsage(type)
      }));

      res.json({
        success: true,
        taskTypes
      });

    } catch (error) {
      logger.error('Failed to get task types:', error);
      res.status(500).json({
        error: 'Failed to get task types',
        message: 'タスクタイプの取得に失敗しました'
      });
    }
  }
);

// GET /v1/tasks/health - タスクシステムのヘルスチェック
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      const cloudTasksHealthy = await cloudTasksService.healthCheck();
      const runningTasksCount = taskProcessor.getRunningTasks().length;

      const status = cloudTasksHealthy ? 'healthy' : 'unhealthy';

      res.json({
        status,
        cloudTasks: cloudTasksHealthy,
        runningTasks: runningTasksCount,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Task health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'ヘルスチェックに失敗しました'
      });
    }
  }
);

// ヘルパー関数
function getTaskTypeDescription(type: TaskType): string {
  const descriptions = {
    [TaskType.RENDER_VIDEO]: '動画レンダリング処理',
    [TaskType.RENDER_AUDIO]: '音声レンダリング処理',
    [TaskType.QC_CHECK]: 'QC品質チェック',
    [TaskType.THUMBNAIL_GENERATE]: 'サムネイル生成',
    [TaskType.NLP_PROCESS]: 'NLP自然言語処理',
    [TaskType.ASSET_PROCESS]: 'アセット処理',
    [TaskType.BATCH_OPERATION]: 'バッチ操作'
  };
  return descriptions[type] || type;
}

function getRequiredPermissions(type: TaskType): Permission[] {
  const permissionMap = {
    [TaskType.RENDER_VIDEO]: [Permission.RENDER_EXECUTE],
    [TaskType.RENDER_AUDIO]: [Permission.RENDER_EXECUTE],
    [TaskType.QC_CHECK]: [Permission.QC_EXECUTE],
    [TaskType.THUMBNAIL_GENERATE]: [Permission.THUMBNAIL_GENERATE],
    [TaskType.NLP_PROCESS]: [Permission.NLP_EXECUTE],
    [TaskType.ASSET_PROCESS]: [Permission.ASSET_UPDATE],
    [TaskType.BATCH_OPERATION]: [Permission.JOB_EXECUTE]
  };
  return permissionMap[type] || [];
}

function getEstimatedDuration(type: TaskType): string {
  const durations = {
    [TaskType.RENDER_VIDEO]: '5-30分',
    [TaskType.RENDER_AUDIO]: '2-10分',
    [TaskType.QC_CHECK]: '1-5分',
    [TaskType.THUMBNAIL_GENERATE]: '30秒-2分',
    [TaskType.NLP_PROCESS]: '30秒-3分',
    [TaskType.ASSET_PROCESS]: '1-10分',
    [TaskType.BATCH_OPERATION]: '変動'
  };
  return durations[type] || '不明';
}

function getResourceUsage(type: TaskType): string {
  const usage = {
    [TaskType.RENDER_VIDEO]: '高（CPU・メモリ集約）',
    [TaskType.RENDER_AUDIO]: '中（CPU集約）',
    [TaskType.QC_CHECK]: '中（CPU・I/O集約）',
    [TaskType.THUMBNAIL_GENERATE]: '低（CPU・メモリ）',
    [TaskType.NLP_PROCESS]: '中（API呼び出し）',
    [TaskType.ASSET_PROCESS]: '中（CPU・I/O集約）',
    [TaskType.BATCH_OPERATION]: '変動'
  };
  return usage[type] || '不明';
}

export default router;