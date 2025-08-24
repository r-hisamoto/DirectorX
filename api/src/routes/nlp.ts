/**
 * DirectorX NLP API Routes
 * 台本生成・5chコメント生成API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import LLMService, { ScriptGenerationRequest, CommentsGenerationRequest } from '../services/llm/index.js';
import { logger } from '../lib/logger.js';

const router = Router();
const llmService = new LLMService();

// リクエストスキーマ
const ScriptGenerationSchema = z.object({
  assetIds: z.array(z.string()),
  sourceContent: z.string().min(1),
  style: z.enum(['narrative', 'commentary', 'news', 'discussion']).default('commentary'),
  maxLength: z.number().min(500).max(5000).default(2500),
  channelInfo: z.object({
    name: z.string(),
    theme: z.string(),
    tone: z.string()
  }).optional()
});

const CommentsGenerationSchema = z.object({
  assetId: z.string(),
  sourceContent: z.string().min(1),
  count: z.number().min(1).max(50).default(30),
  style: z.enum(['5ch', 'youtube', 'twitter']).default('5ch'),
  channelContext: z.string().optional()
});

// POST /v1/script - 台本生成
router.post('/script', async (req: Request, res: Response) => {
  try {
    const body = ScriptGenerationSchema.parse(req.body);
    
    const request: ScriptGenerationRequest = {
      assetIds: body.assetIds,
      sourceContent: body.sourceContent,
      style: body.style,
      maxLength: body.maxLength,
      channelInfo: body.channelInfo
    };

    // 台本生成実行
    const result = await llmService.generateScript(request);

    res.json({
      success: true,
      result,
      message: `${result.metadata.wordCount}文字の台本が生成されました（推定再生時間: ${Math.round(result.metadata.estimatedDuration / 60)}分）`
    });

  } catch (error) {
    logger.error('Script generation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Script generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/comments5ch - 5chコメント生成
router.post('/comments5ch', async (req: Request, res: Response) => {
  try {
    const body = CommentsGenerationSchema.parse(req.body);
    
    const request: CommentsGenerationRequest = {
      assetId: body.assetId,
      sourceContent: body.sourceContent,
      count: body.count,
      style: body.style,
      channelContext: body.channelContext
    };

    // コメント生成実行
    const result = await llmService.generateComments(request);

    res.json({
      success: true,
      result,
      message: `${result.metadata.total}件のコメントが生成されました`
    });

  } catch (error) {
    logger.error('Comments generation failed:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    } else {
      res.status(500).json({
        error: 'Comments generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// POST /v1/script/summarize - 要旨化
router.post('/script/summarize', async (req: Request, res: Response) => {
  try {
    const { sourceContent, maxLength = 800 } = req.body;

    if (!sourceContent) {
      return res.status(400).json({
        error: 'sourceContent is required'
      });
    }

    // 要旨化用の簡易リクエスト
    const request: ScriptGenerationRequest = {
      assetIds: [],
      sourceContent,
      style: 'commentary',
      maxLength
    };

    // システムプロンプトを要旨化用に変更
    const summarizePrompt = `あなたは日本語文章の要旨化専門家です。
与えられた文章から重要なポイントを抽出し、${maxLength}文字以内で要旨をまとめてください。

出力は以下のJSON形式:
{
  "title": "要旨のタイトル",
  "outline": ["ポイント1", "ポイント2", "ポイント3"],
  "body": "要旨本文（${maxLength}文字以内）"
}`;

    const result = await llmService.generateScript(request);

    res.json({
      success: true,
      result,
      message: `${result.metadata.wordCount}文字の要旨が生成されました`
    });

  } catch (error) {
    logger.error('Summarization failed:', error);
    res.status(500).json({
      error: 'Summarization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /v1/script/styles - 利用可能なスタイル一覧
router.get('/styles', (req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      {
        id: 'narrative',
        name: '物語系',
        description: '物語風の構成で、導入→展開→結論の流れ'
      },
      {
        id: 'commentary',
        name: '解説系',
        description: '情報を分かりやすく解説する形式'
      },
      {
        id: 'news',
        name: 'ニュース系',
        description: '客観的で簡潔な報道スタイル'
      },
      {
        id: 'discussion',
        name: '討論系',
        description: '複数の視点を提示する議論形式'
      }
    ]
  });
});

// GET /v1/comments5ch/styles - 利用可能なコメントスタイル一覧
router.get('/comments5ch/styles', (req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      {
        id: '5ch',
        name: '5ちゃんねる風',
        description: '略語・顔文字・ネットスラングを使用'
      },
      {
        id: 'youtube',
        name: 'YouTube風',
        description: '絵文字使用、ポジティブな反応多め'
      },
      {
        id: 'twitter',
        name: 'Twitter風',
        description: 'ハッシュタグ・簡潔な表現'
      }
    ]
  });
});

// GET /v1/nlp/health - LLMサービスヘルスチェック
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await llmService.healthCheck();
    
    const isHealthy = health.openai || health.anthropic;
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      providers: health,
      message: isHealthy 
        ? 'LLMサービスは正常に動作しています'
        : 'すべてのLLMプロバイダーが利用できません'
    });

  } catch (error) {
    logger.error('LLM health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;