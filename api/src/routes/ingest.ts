import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { IngestService } from '../services/ingest';
import { IngestRequestSchema } from '../models/asset';
import { Asset, ApiResponse, IngestResult } from '../types';
import { AssetFilterSchema } from '../models/asset';
import { logger } from '../lib/logger';

const router = Router();

// Multer設定（ファイルアップロード用）
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB制限
  },
  fileFilter: (req, file, cb) => {
    // 許可するファイルタイプ
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'text/plain',
      'application/pdf',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`サポートされていないファイル形式です: ${file.mimetype}`));
    }
  },
});

// インジェストサービスのインスタンス
const ingestService = new IngestService();

// POST /v1/ingest - 素材をインジェスト
router.post('/', upload.single('file'), async (req: Request, res: Response<ApiResponse<IngestResult>>) => {
  try {
    logger.info('Ingest request received', {
      sourceType: req.body.sourceType,
      url: req.body.url,
      hasFile: !!req.file,
    });

    // リクエストの検証
    const requestData = {
      sourceType: req.body.sourceType,
      url: req.body.url,
      workspaceId: req.body.workspaceId,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
    };

    const validatedData = IngestRequestSchema.parse(requestData);

    // ファイルアップロードの処理
    if (validatedData.sourceType === 'upload' && req.file) {
      // ファイルを一時的に保存（実際の実装では永続ストレージに保存）
      const fileUrl = await saveUploadedFile(req.file);
      validatedData.url = fileUrl;
      
      // メタデータにファイル情報を追加
      validatedData.metadata = {
        ...validatedData.metadata,
        title: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };
    }

    // インジェスト実行
    const result = await ingestService.ingest(validatedData);

    res.status(201).json({
      success: true,
      data: result,
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

    logger.error('Ingest failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        message: error.message || '素材の取得に失敗しました',
        code: 'INGEST_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/ingest/assets - 素材一覧取得
router.get('/assets', async (req: Request, res: Response<ApiResponse<Asset[]>>) => {
  try {
    const filter = AssetFilterSchema.parse({
      workspaceId: req.query.workspaceId,
      types: req.query.types ? (req.query.types as string).split(',') : undefined,
      sources: req.query.sources ? (req.query.sources as string).split(',') : undefined,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });

    let assets: Asset[];
    
    if (filter.search) {
      assets = ingestService.searchAssets(
        filter.workspaceId, 
        filter.search, 
        filter.types
      );
    } else {
      assets = ingestService.getAssetsByWorkspace(
        filter.workspaceId,
        filter.limit,
        filter.offset
      );
    }

    res.json({
      success: true,
      data: assets,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.errors[0]?.message || '検索パラメータが無効です',
          code: 'VALIDATION_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }

    logger.error('Asset list retrieval failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        message: '素材一覧の取得に失敗しました',
        code: 'ASSET_LIST_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/ingest/assets/:id - 特定素材の取得
router.get('/assets/:id', async (req: Request, res: Response<ApiResponse<Asset>>) => {
  try {
    const { id } = req.params;
    const asset = ingestService.getAsset(id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: {
          message: '素材が見つかりません',
          code: 'ASSET_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: asset,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Asset retrieval failed', { id: req.params.id, error: error.message });
    res.status(500).json({
      success: false,
      error: {
        message: '素材の取得に失敗しました',
        code: 'ASSET_RETRIEVAL_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /v1/ingest/detect-source - URLからソース種別を自動判定
router.post('/detect-source', async (req: Request, res: Response<ApiResponse<{
  sourceType: string;
  confidence: number;
  suggestions: { type: string; reason: string }[];
}>>) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'URLは必須です',
          code: 'URL_REQUIRED',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const detection = AssetModel.detectSourceFromUrl(url);
    
    // 判定理由の生成
    const suggestions = [];
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      suggestions.push({
        type: 'x-twitter',
        reason: 'X (Twitter) のドメインが検出されました',
      });
    } else if (hostname.includes('5ch.net') || hostname.includes('2ch')) {
      suggestions.push({
        type: '5ch',
        reason: '5ch/2ch系のドメインが検出されました',
      });
    } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      suggestions.push({
        type: 'youtube',
        reason: 'YouTube のドメインが検出されました',
      });
    } else {
      suggestions.push({
        type: 'url',
        reason: '一般的なウェブページとして処理されます',
      });
    }

    res.json({
      success: true,
      data: {
        sourceType: detection.source,
        confidence: detection.confidence,
        suggestions,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Source detection failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        message: 'ソースの自動判定に失敗しました',
        code: 'DETECTION_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * アップロードされたファイルを保存（実装例）
 */
async function saveUploadedFile(file: Express.Multer.File): Promise<string> {
  // 実際の実装では、Google Cloud Storage や AWS S3 などに保存
  // ここでは仮のURLを返す
  const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
  const fileUrl = `https://storage.example.com/assets/${filename}`;
  
  // TODO: 実際のファイル保存処理を実装
  logger.info('File uploaded (mock)', {
    originalname: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    savedAs: fileUrl,
  });
  
  return fileUrl;
}

export { router as ingestRoutes };