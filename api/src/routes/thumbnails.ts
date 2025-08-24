/**
 * DirectorX Thumbnails API Routes
 * サムネイル生成・ダウンロードAPI
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import ThumbnailGenerator, { ThumbnailRequest } from '../services/thumbnail/generator.js';
import { logger } from '../lib/logger.js';

const router = Router();
const thumbnailGenerator = new ThumbnailGenerator();

// リクエストスキーマ
const ThumbnailGenerationSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(50).optional(),
  resolution: z.enum(['1280x720', '2160x2160', '1920x1080']).default('1280x720'),
  brandKit: z.object({
    colors: z.object({
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      text: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
    }),
    fonts: z.object({
      title: z.string(),
      subtitle: z.string()
    })
  }).optional(),
  backgroundImage: z.string().url().optional(),
  customText: z.array(z.string()).optional()
});

const BatchThumbnailSchema = z.object({
  requests: z.array(ThumbnailGenerationSchema).min(1).max(10)
});

// POST /v1/thumbnails/generate - サムネイル3案生成
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const body = ThumbnailGenerationSchema.parse(req.body);
    
    const request: ThumbnailRequest = {
      title: body.title,
      subtitle: body.subtitle,
      resolution: body.resolution,
      brandKit: body.brandKit,
      backgroundImage: body.backgroundImage,
      customText: body.customText
    };

    // 3案生成
    const variants = await thumbnailGenerator.generateVariants(request);

    // Base64エンコーディング（プレビュー用）
    const variantsWithPreview = variants.map(variant => ({
      id: variant.id,
      name: variant.name,
      description: variant.description,
      layout: variant.layout,
      metadata: variant.metadata,
      preview: `data:image/png;base64,${variant.buffer.toString('base64')}`
    }));

    res.json({
      success: true,
      variants: variantsWithPreview,
      total: variants.length,
      message: `${variants.length}案のサムネイルが生成されました`
    });

  } catch (error) {
    logger.error('Thumbnail generation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Thumbnail generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/thumbnails/batch - バッチ生成
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const body = BatchThumbnailSchema.parse(req.body);
    
    const requests: ThumbnailRequest[] = body.requests.map(req => ({
      title: req.title,
      subtitle: req.subtitle,
      resolution: req.resolution,
      brandKit: req.brandKit,
      backgroundImage: req.backgroundImage,
      customText: req.customText
    }));

    // バッチ生成
    const batchResults = await thumbnailGenerator.generateBatch(requests);

    // レスポンス形成
    const results = batchResults.map((variants, index) => ({
      requestIndex: index,
      title: requests[index].title,
      variants: variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        description: variant.description,
        layout: variant.layout,
        metadata: variant.metadata,
        preview: `data:image/png;base64,${variant.buffer.toString('base64')}`
      }))
    }));

    const totalVariants = batchResults.flat().length;

    res.json({
      success: true,
      results,
      summary: {
        totalRequests: requests.length,
        totalVariants,
        avgVariantsPerRequest: Math.round(totalVariants / requests.length)
      },
      message: `${requests.length}件のリクエストで合計${totalVariants}案のサムネイルが生成されました`
    });

  } catch (error) {
    logger.error('Batch thumbnail generation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Batch thumbnail generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// GET /v1/thumbnails/download/:jobId/:variantId - サムネイルダウンロード
router.get('/download/:jobId/:variantId', async (req: Request, res: Response) => {
  try {
    const { jobId, variantId } = req.params;
    
    // 実際の実装では、ジョブからサムネイルデータを取得
    // 現在は簡易的なレスポンス
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="thumbnail_${jobId}_${variantId}.png"`);
    
    // プレースホルダー画像
    const canvas = require('canvas').createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFD400';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sample Thumbnail', 640, 360);
    
    const buffer = canvas.toBuffer('image/png');
    res.send(buffer);

  } catch (error) {
    logger.error('Thumbnail download failed:', error);
    res.status(500).json({
      error: 'Thumbnail download failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/thumbnails/presets - レイアウトプリセット一覧
router.get('/presets', (req: Request, res: Response) => {
  try {
    const presets = [
      {
        id: 'split',
        name: '分割レイアウト',
        description: '下部テキスト・グラデーション背景',
        preview: '/assets/presets/split.png',
        bestFor: ['ニュース系', '解説動画', '一般コンテンツ']
      },
      {
        id: 'overlay',
        name: 'オーバーレイ',
        description: '中央テキスト・背景画像重ね',
        preview: '/assets/presets/overlay.png',
        bestFor: ['ゲーム実況', 'レビュー動画', 'エンタメ']
      },
      {
        id: 'minimal',
        name: 'ミニマル',
        description: '上部テキスト・シンプル',
        preview: '/assets/presets/minimal.png',
        bestFor: ['教育コンテンツ', 'ビジネス', 'インタビュー']
      }
    ];

    res.json({
      success: true,
      presets
    });

  } catch (error) {
    logger.error('Presets listing failed:', error);
    res.status(500).json({
      error: 'Presets listing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/thumbnails/resolutions - 対応解像度一覧
router.get('/resolutions', (req: Request, res: Response) => {
  try {
    const resolutions = [
      {
        id: '1280x720',
        name: 'YouTube Standard',
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        recommended: ['YouTube', 'Vimeo', '一般的なプラットフォーム']
      },
      {
        id: '1920x1080',
        name: 'Full HD',
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        recommended: ['高解像度配信', 'プレミアムコンテンツ']
      },
      {
        id: '2160x2160',
        name: 'Square HD',
        width: 2160,
        height: 2160,
        aspectRatio: '1:1',
        recommended: ['Instagram', 'TikTok', 'SNS正方形']
      }
    ];

    res.json({
      success: true,
      resolutions
    });

  } catch (error) {
    logger.error('Resolutions listing failed:', error);
    res.status(500).json({
      error: 'Resolutions listing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;