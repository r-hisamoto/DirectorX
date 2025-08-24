/**
 * DirectorX Jobs API Routes
 * 制作ジョブ管理API
 */

import { Router, Request, Response } from 'express';
import JobModel, { CreateJobSchema, UpdateJobSchema, JobFilterSchema, Job } from '../models/job.js';
import ReviewModel, { CreateReviewSchema, Review } from '../models/review.js';
import { logger } from '../lib/logger.js';

const router = Router();

// POST /v1/jobs - ジョブ作成
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = CreateJobSchema.parse(req.body);
    const userId = req.headers['x-user-id'] as string || 'demo-user'; // 仮の認証

    const job = await JobModel.create(body, userId);

    res.status(201).json({
      success: true,
      job,
      message: 'ジョブが作成されました'
    });

  } catch (error) {
    logger.error('Job creation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Job creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/jobs - ジョブ一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const filter = JobFilterSchema.parse(req.query);
    const result = await JobModel.findMany(filter);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Jobs listing failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Jobs listing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/jobs/:id - ジョブ詳細取得
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await JobModel.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    // 関連レビューも取得
    const reviews = await ReviewModel.findByJobId(id);

    res.json({
      success: true,
      job,
      reviews,
      message: 'ジョブ詳細を取得しました'
    });

  } catch (error) {
    logger.error('Job retrieval failed:', error);
    res.status(500).json({
      error: 'Job retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /v1/jobs/:id - ジョブ更新
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = UpdateJobSchema.parse(req.body);

    const job = await JobModel.update(id, body);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      success: true,
      job,
      message: 'ジョブが更新されました'
    });

  } catch (error) {
    logger.error('Job update failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Job update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/jobs/:id/workflow/:action - ワークフロー進行
router.post('/:id/workflow/:action', async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    
    const actionStatusMap: Record<string, any> = {
      'start': 'processing',
      'submit-for-review': 'review',
      'approve': 'approved',
      'reject': 'rejected',
      'complete': 'completed',
      'cancel': 'cancelled'
    };

    const targetStatus = actionStatusMap[action];
    if (!targetStatus) {
      return res.status(400).json({
        error: 'Invalid workflow action',
        action,
        validActions: Object.keys(actionStatusMap)
      });
    }

    const job = await JobModel.advanceWorkflow(id, targetStatus);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      success: true,
      job,
      message: `ワークフロー実行: ${action}`
    });

  } catch (error) {
    logger.error('Workflow action failed:', error);
    res.status(400).json({
      error: 'Workflow action failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /v1/jobs/:id/progress - 進捗更新
router.post('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { progress, message, step } = req.body;

    if (typeof progress !== 'number' || !message) {
      return res.status(400).json({
        error: 'progress (number) and message (string) are required'
      });
    }

    const job = await JobModel.updateProgress(id, progress, message, step);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      success: true,
      progress: job.progress,
      message: job.progressMessage,
      currentStep: job.currentStep
    });

  } catch (error) {
    logger.error('Progress update failed:', error);
    res.status(500).json({
      error: 'Progress update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /v1/jobs/:id - ジョブ削除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await JobModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      success: true,
      message: 'ジョブが削除されました',
      jobId: id
    });

  } catch (error) {
    logger.error('Job deletion failed:', error);
    res.status(500).json({
      error: 'Job deletion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/jobs/stats - ジョブ統計
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { workspaceId, channelId, period = '7d' } = req.query;
    
    // 期間フィルタ
    const now = new Date();
    const days = parseInt(period.toString().replace('d', ''));
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const filter = {
      workspaceId: workspaceId as string,
      channelId: channelId as string,
      dateFrom: fromDate.toISOString(),
      page: 1,
      limit: 1000
    };

    const { jobs } = await JobModel.findMany(filter);

    // 統計計算
    const stats = {
      total: jobs.length,
      byStatus: {} as Record<string, number>,
      byStep: {} as Record<string, number>,
      avgProcessingTime: 0,
      successRate: 0,
      totalCost: 0
    };

    // ステータス別集計
    for (const job of jobs) {
      stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;
      stats.byStep[job.currentStep] = (stats.byStep[job.currentStep] || 0) + 1;
      
      if (job.metrics) {
        stats.totalCost += job.metrics.cost.total;
      }
    }

    // 成功率計算
    const completedJobs = stats.byStatus['completed'] || 0;
    const totalProcessed = jobs.filter(j => j.status !== 'draft').length;
    stats.successRate = totalProcessed > 0 ? (completedJobs / totalProcessed) * 100 : 0;

    // 平均処理時間
    const processedJobs = jobs.filter(j => j.startedAt && j.completedAt);
    if (processedJobs.length > 0) {
      const totalTime = processedJobs.reduce((sum, job) => {
        const duration = job.completedAt!.getTime() - job.startedAt!.getTime();
        return sum + duration;
      }, 0);
      stats.avgProcessingTime = Math.round(totalTime / processedJobs.length / 1000); // 秒
    }

    res.json({
      success: true,
      stats,
      period: `${days}日間`
    });

  } catch (error) {
    logger.error('Job stats failed:', error);
    res.status(500).json({
      error: 'Job stats failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;