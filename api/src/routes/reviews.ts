/**
 * DirectorX Reviews API Routes
 * レビュー・承認・差し戻し機能API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import ReviewModel, { CreateReviewSchema, UpdateReviewSchema, AddCommentSchema, Review } from '../models/review.js';
import JobModel from '../models/job.js';
import { logger } from '../lib/logger.js';

const router = Router();

// POST /v1/reviews - レビュー作成
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = CreateReviewSchema.parse(req.body);
    const reviewerName = req.headers['x-user-name'] as string || 'Demo Reviewer';

    // ジョブ存在確認
    const job = await JobModel.findById(body.jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: body.jobId
      });
    }

    // ジョブステータス確認
    if (job.status !== 'review') {
      return res.status(400).json({
        error: 'Job is not ready for review',
        currentStatus: job.status,
        jobId: body.jobId
      });
    }

    const review = await ReviewModel.create(body, reviewerName);

    // ジョブのレビュー担当者を設定
    await JobModel.update(body.jobId, { assignedTo: body.reviewerId });

    res.status(201).json({
      success: true,
      review,
      message: 'レビューが作成されました'
    });

  } catch (error) {
    logger.error('Review creation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Review creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/reviews/:id - レビュー詳細取得
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const review = await ReviewModel.findById(id);

    if (!review) {
      return res.status(404).json({
        error: 'Review not found',
        reviewId: id
      });
    }

    // 関連ジョブ情報も取得
    const job = await JobModel.findById(review.jobId);

    res.json({
      success: true,
      review,
      job,
      message: 'レビュー詳細を取得しました'
    });

  } catch (error) {
    logger.error('Review retrieval failed:', error);
    res.status(500).json({
      error: 'Review retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /v1/reviews/:id - レビュー更新
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = UpdateReviewSchema.parse(req.body);

    const review = await ReviewModel.update(id, body);

    if (!review) {
      return res.status(404).json({
        error: 'Review not found',
        reviewId: id
      });
    }

    // ジョブステータスも更新
    if (body.decision) {
      const targetJobStatus = body.decision.type === 'approve' ? 'approved' : 'rejected';
      await JobModel.advanceWorkflow(review.jobId, targetJobStatus);
    }

    res.json({
      success: true,
      review,
      message: 'レビューが更新されました'
    });

  } catch (error) {
    logger.error('Review update failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Review update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/reviews/:id/comments - コメント追加
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = AddCommentSchema.parse(req.body);
    const authorId = req.headers['x-user-id'] as string || 'demo-user';
    const authorName = req.headers['x-user-name'] as string || 'Demo User';

    const review = await ReviewModel.addComment(id, body, authorId, authorName);

    if (!review) {
      return res.status(404).json({
        error: 'Review not found',
        reviewId: id
      });
    }

    res.status(201).json({
      success: true,
      comment: review.comments[review.comments.length - 1],
      message: 'コメントが追加されました'
    });

  } catch (error) {
    logger.error('Comment addition failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Comment addition failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// PUT /v1/reviews/:id/checklist - チェックリスト更新
router.put('/:id/checklist', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        error: 'updates must be an array of {id, checked} objects'
      });
    }

    const review = await ReviewModel.updateChecklist(id, updates);

    if (!review) {
      return res.status(404).json({
        error: 'Review not found',
        reviewId: id
      });
    }

    res.json({
      success: true,
      checklist: review.checklist,
      message: 'チェックリストが更新されました'
    });

  } catch (error) {
    logger.error('Checklist update failed:', error);
    res.status(500).json({
      error: 'Checklist update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/reviews/job/:jobId - ジョブのレビュー一覧
router.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const reviews = await ReviewModel.findByJobId(jobId);

    res.json({
      success: true,
      reviews,
      total: reviews.length
    });

  } catch (error) {
    logger.error('Job reviews retrieval failed:', error);
    res.status(500).json({
      error: 'Job reviews retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/reviews/reviewer/:reviewerId - レビュアーのレビュー一覧
router.get('/reviewer/:reviewerId', async (req: Request, res: Response) => {
  try {
    const { reviewerId } = req.params;
    const reviews = await ReviewModel.findByReviewerId(reviewerId);

    res.json({
      success: true,
      reviews,
      total: reviews.length
    });

  } catch (error) {
    logger.error('Reviewer reviews retrieval failed:', error);
    res.status(500).json({
      error: 'Reviewer reviews retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/reviews/templates - レビューテンプレート一覧
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = ReviewModel.listTemplates();

    res.json({
      success: true,
      templates
    });

  } catch (error) {
    logger.error('Templates listing failed:', error);
    res.status(500).json({
      error: 'Templates listing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/reviews/templates/:id - レビューテンプレート詳細
router.get('/templates/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = ReviewModel.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        templateId: id
      });
    }

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error('Template retrieval failed:', error);
    res.status(500).json({
      error: 'Template retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;