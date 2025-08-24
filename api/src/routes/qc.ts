/**
 * DirectorX Quality Control API Routes
 * 品質管理・自動QC機能のAPI
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import QualityControlService, { QCOptions, ComprehensiveQCResult } from '../services/qc/index.js';
import AudioQCService from '../services/qc/audio.js';
import VideoQCService from '../services/qc/video.js';
import NGWordService from '../services/qc/ngwords.js';
import { logger } from '../lib/logger.js';

const router = Router();
const qcService = new QualityControlService();
const audioQC = new AudioQCService();
const videoQC = new VideoQCService();
const ngwordQC = new NGWordService();

// リクエストスキーマ
const QCRequestSchema = z.object({
  inputs: z.object({
    videoPath: z.string().optional(),
    audioPath: z.string().optional(),
    scriptContent: z.string().optional(),
    srtContent: z.string().optional()
  }),
  options: z.object({
    checkAudio: z.boolean().default(true),
    checkVideo: z.boolean().default(true),
    checkContent: z.boolean().default(true),
    ngwordProfile: z.string().default('youtube'),
    autoFix: z.boolean().default(false)
  }).optional()
});

const NGWordCheckSchema = z.object({
  text: z.string().min(1),
  profile: z.string().default('youtube'),
  context: z.string().default('script')
});

// POST /v1/qc/check - 総合品質チェック
router.post('/check', async (req: Request, res: Response) => {
  try {
    const body = QCRequestSchema.parse(req.body);
    const { inputs, options = {} } = body;

    // 入力検証
    if (!inputs.videoPath && !inputs.audioPath && !inputs.scriptContent && !inputs.srtContent) {
      return res.status(400).json({
        error: 'At least one input must be provided',
        details: 'videoPath, audioPath, scriptContent, or srtContent is required'
      });
    }

    // QCオプションのデフォルト設定
    const qcOptions: QCOptions = {
      checkAudio: options.checkAudio ?? true,
      checkVideo: options.checkVideo ?? true,
      checkContent: options.checkContent ?? true,
      ngwordProfile: options.ngwordProfile || 'youtube',
      autoFix: options.autoFix ?? false
    };

    // 品質チェック実行
    const qcResult = await qcService.runComprehensiveQC(inputs, qcOptions);

    // レスポンス
    res.json({
      success: true,
      result: qcResult,
      report: qcService.generateReport(qcResult)
    });

  } catch (error) {
    logger.error('QC check failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'QC check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/qc/audio - 音声品質チェック
router.post('/audio', async (req: Request, res: Response) => {
  try {
    const { audioPath, autoFix = false } = req.body;

    if (!audioPath) {
      return res.status(400).json({
        error: 'audioPath is required'
      });
    }

    // 音声品質チェック
    const audioResult = await audioQC.checkAudioQuality(audioPath);

    // 自動修正（オプション）
    let fixedPath: string | undefined;
    if (autoFix && !audioResult.passed) {
      fixedPath = audioPath.replace(/(\.[^.]+)$/, '_normalized$1');
      await audioQC.autoFixAudioIssues(audioPath, fixedPath, audioResult);
    }

    res.json({
      success: true,
      result: audioResult,
      fixedPath,
      message: audioResult.passed 
        ? '音声品質に問題ありません'
        : `${audioResult.issues.length}件の問題が検出されました`
    });

  } catch (error) {
    logger.error('Audio QC failed:', error);
    res.status(500).json({
      error: 'Audio QC failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /v1/qc/video - 映像品質チェック
router.post('/video', async (req: Request, res: Response) => {
  try {
    const { videoPath } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        error: 'videoPath is required'
      });
    }

    // 映像品質チェック
    const videoResult = await videoQC.checkVideoQuality(videoPath);

    res.json({
      success: true,
      result: videoResult,
      message: videoResult.passed 
        ? '映像品質に問題ありません'
        : `${videoResult.issues.length}件の問題が検出されました`
    });

  } catch (error) {
    logger.error('Video QC failed:', error);
    res.status(500).json({
      error: 'Video QC failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /v1/qc/content - NGワードチェック
router.post('/content', async (req: Request, res: Response) => {
  try {
    const body = NGWordCheckSchema.parse(req.body);
    const { text, profile, context } = body;

    // NGワードチェック
    const contentResult = await ngwordQC.checkContent(text, profile, context);

    res.json({
      success: true,
      result: contentResult,
      message: contentResult.passed 
        ? 'コンテンツに問題ありません'
        : `${contentResult.violations.length}件の問題が検出されました`
    });

  } catch (error) {
    logger.error('Content QC failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Content QC failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/qc/profiles - NGワードプロファイル一覧
router.get('/profiles', (req: Request, res: Response) => {
  try {
    const profiles = ngwordQC.listProfiles();
    
    res.json({
      success: true,
      profiles: profiles.map(name => {
        const profile = ngwordQC.getProfile(name);
        return {
          name,
          description: profile?.description || '',
          categories: profile ? Object.keys(profile.categories) : []
        };
      })
    });

  } catch (error) {
    logger.error('Profiles listing failed:', error);
    res.status(500).json({
      error: 'Failed to list profiles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /v1/qc/normalize-audio - 音声正規化
router.post('/normalize-audio', async (req: Request, res: Response) => {
  try {
    const { inputPath, outputPath, targetLufs = -16 } = req.body;

    if (!inputPath || !outputPath) {
      return res.status(400).json({
        error: 'inputPath and outputPath are required'
      });
    }

    // 音声正規化実行
    await audioQC.normalizeAudio(inputPath, outputPath, targetLufs);

    res.json({
      success: true,
      message: `Audio normalized to ${targetLufs} LUFS`,
      outputPath
    });

  } catch (error) {
    logger.error('Audio normalization failed:', error);
    res.status(500).json({
      error: 'Audio normalization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;