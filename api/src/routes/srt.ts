import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { formatSrt, textToSimpleSrt, FormatSrtOptions } from '../lib/srt';
import { ApiResponse } from '../types';
import { logger } from '../lib/logger';

const router = Router();

// SRT整形リクエストのスキーマ
const FormatSrtSchema = z.object({
  srt: z.string().min(1, 'SRTテキストは必須です'),
  maxZenkaku: z.number().min(10).max(50).default(20),
  forbidLeading: z.array(z.string()).optional(),
  addBreakAfterPunctuation: z.boolean().default(false),
  breakDuration: z.number().min(50).max(500).default(120),
});

// テキストからSRT生成リクエストのスキーマ
const TextToSrtSchema = z.object({
  text: z.string().min(1, 'テキストは必須です'),
  durationPerChar: z.number().min(50).max(500).default(150),
});

// POST /v1/srt/format - SRT整形
router.post('/format', async (req: Request, res: Response<ApiResponse<{ srt: string }>>) => {
  try {
    const validatedData = FormatSrtSchema.parse(req.body);
    logger.info('SRT formatting request received', {
      srtLength: validatedData.srt.length,
      maxZenkaku: validatedData.maxZenkaku,
    });

    const options: FormatSrtOptions = {
      maxZenkaku: validatedData.maxZenkaku,
      forbidLeading: validatedData.forbidLeading,
      addBreakAfterPunctuation: validatedData.addBreakAfterPunctuation,
      breakDuration: validatedData.breakDuration,
    };

    const formattedSrt = formatSrt(validatedData.srt, options);
    
    logger.info('SRT formatting completed', {
      originalLength: validatedData.srt.length,
      formattedLength: formattedSrt.length,
    });

    res.json({
      success: true,
      data: { srt: formattedSrt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.errors[0]?.message || '入力データが無効です',
          code: 'VALIDATION_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }

    logger.error('SRT整形エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'SRTの整形に失敗しました',
        code: 'SRT_FORMAT_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /v1/srt/from-text - テキストからSRT生成
router.post('/from-text', async (req: Request, res: Response<ApiResponse<{ srt: string }>>) => {
  try {
    const validatedData = TextToSrtSchema.parse(req.body);
    logger.info('Text to SRT conversion request received', {
      textLength: validatedData.text.length,
      durationPerChar: validatedData.durationPerChar,
    });

    const srt = textToSimpleSrt(validatedData.text, validatedData.durationPerChar);
    
    logger.info('Text to SRT conversion completed', {
      originalLength: validatedData.text.length,
      srtLength: srt.length,
    });

    res.json({
      success: true,
      data: { srt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.errors[0]?.message || '入力データが無効です',
          code: 'VALIDATION_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }

    logger.error('テキストからSRT生成エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'テキストからSRTの生成に失敗しました',
        code: 'TEXT_TO_SRT_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/srt/demo - デモ用のサンプルSRT
router.get('/demo', async (req: Request, res: Response<ApiResponse<{ srt: string }>>) => {
  try {
    const sampleText = `
これは日本語字幕の整形デモです。
全角20文字で自動的に折り返されます。
行頭に句読点が来ないように禁則処理が適用されています。
「括弧」や【記号】も適切に処理されます！
このように、長い文章でも美しい字幕として表示できます。
    `.trim();

    const srt = textToSimpleSrt(sampleText);
    
    logger.info('Demo SRT generated');

    res.json({
      success: true,
      data: { srt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('デモSRT生成エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'デモSRTの生成に失敗しました',
        code: 'DEMO_SRT_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as srtRoutes };