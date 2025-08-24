/**
 * DirectorX Render API Routes
 * 動画レンダリング・エンコーディングAPI
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import FFmpegService, { RenderOptions, RenderJob } from '../services/render/ffmpeg.js';
import { logger } from '../lib/logger.js';

const router = Router();
const ffmpegService = new FFmpegService();

// リクエストスキーマ
const CreateRenderJobSchema = z.object({
  inputs: z.object({
    video: z.string().optional(),
    audio: z.string().optional(),
    srt: z.string().optional(),
    images: z.array(z.string()).optional()
  }),
  options: z.object({
    resolution: z.enum(['1920x1080', '1280x720', '2160x2160']),
    bitrate: z.string().default('2500k'),
    frameRate: z.number().min(24).max(60).default(30),
    audioCodec: z.enum(['aac', 'mp3']).default('aac'),
    videoCodec: z.enum(['libx264', 'libx265']).default('libx264'),
    subtitleBurnIn: z.boolean().default(true),
    thumbnailFormat: z.enum(['png', 'jpg']).default('png'),
    quality: z.enum(['low', 'medium', 'high', 'ultra']).default('medium'),
    preset: z.enum(['ultrafast', 'fast', 'medium', 'slow', 'veryslow']).default('medium')
  }),
  channelId: z.string().optional(),
  recipeId: z.string().optional()
});

const RetryJobSchema = z.object({
  mode: z.enum(['full', 'effects-only', 'resume']).default('full')
});

// POST /v1/render - レンダリングジョブ作成・開始
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = CreateRenderJobSchema.parse(req.body);
    
    // 品質プリセット適用
    const qualityPreset = FFmpegService.getQualityPreset(body.options.quality);
    const options: RenderOptions = { ...body.options, ...qualityPreset };

    // レンダリングジョブ作成
    const job = await ffmpegService.createRenderJob(body.inputs, options);

    // バックグラウンドでレンダリング開始
    ffmpegService.renderVideo(job.id).catch(error => {
      logger.error(`Background render failed for job ${job.id}:`, error);
    });

    res.status(201).json({
      jobId: job.id,
      status: job.status,
      message: 'Render job created and started'
    });

  } catch (error) {
    logger.error('Render job creation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/render/jobs/:id - ジョブ状態取得
router.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = ffmpegService.getJob(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    // 完了時間の計算
    const duration = job.endTime 
      ? job.endTime.getTime() - job.startTime.getTime()
      : Date.now() - job.startTime.getTime();

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      inputs: job.inputs,
      outputs: job.outputs,
      options: job.options,
      error: job.error,
      startTime: job.startTime.toISOString(),
      endTime: job.endTime?.toISOString(),
      duration: Math.round(duration / 1000) // 秒
    });

  } catch (error) {
    logger.error('Job status retrieval failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/render/jobs - 全ジョブ取得
router.get('/jobs', (req: Request, res: Response) => {
  try {
    const jobs = ffmpegService.getAllJobs();
    
    const jobSummaries = jobs.map(job => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      startTime: job.startTime.toISOString(),
      endTime: job.endTime?.toISOString(),
      error: job.error
    }));

    res.json({
      jobs: jobSummaries,
      total: jobs.length
    });

  } catch (error) {
    logger.error('Jobs listing failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /v1/render/jobs/:id/retry - ジョブ再実行
router.post('/jobs/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = RetryJobSchema.parse(req.body);

    const job = ffmpegService.getJob(id);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    // バックグラウンドで再実行
    ffmpegService.retryJob(id, body.mode).catch(error => {
      logger.error(`Job retry failed for ${id}:`, error);
    });

    res.json({
      jobId: id,
      mode: body.mode,
      message: `Job retry started in ${body.mode} mode`
    });

  } catch (error) {
    logger.error('Job retry failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// DELETE /v1/render/jobs/:id - ジョブ削除
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ffmpegService.deleteJob(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      jobId: id,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    logger.error('Job deletion failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;