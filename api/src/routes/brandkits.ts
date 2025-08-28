import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BrandKitModel, CreateBrandKitSchema, UpdateBrandKitSchema } from '../models/brandkit';
import { BrandKit, ApiResponse } from '../types';
import { logger } from '../lib/logger';

const router = Router();

// Temporary in-memory storage (replace with Firestore in production)
const brandkits = new Map<string, BrandKit>();

// Initialize with a default brand kit
const defaultBrandKit: BrandKit = {
  id: 'default',
  name: 'デフォルトブランドキット',
  fonts: {
    subtitle: 'NotoSansCJKjp-Regular',
    title: 'NotoSansCJKjp-Bold',
  },
  colors: {
    primary: '#FFD400',
    accent: '#111111',
  },
  ttsPreset: {
    voice: 'ja-JP-A',
    rate: 1.02,
    pitch: 0.0,
    breakMs: 120,
  },
  subtitleStyle: {
    fontSize: 48,
    stroke: 3,
    position: 'bottom',
    alignment: 'center',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

brandkits.set('default', defaultBrandKit);

// GET /v1/brandkits
router.get('/', async (req: Request, res: Response<ApiResponse<BrandKit[]>>) => {
  try {
    logger.info('Fetching brand kits list');
    
    const brandkitList = Array.from(brandkits.values());
    
    res.json({
      success: true,
      data: brandkitList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('ブランドキット取得エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ブランドキットの取得に失敗しました',
        code: 'BRANDKIT_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/brandkits/:id
router.get('/:id', async (req: Request, res: Response<ApiResponse<BrandKit>>) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching brand kit: ${id}`);
    
    const brandkit = brandkits.get(id);
    
    if (!brandkit) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ブランドキットが見つかりません',
          code: 'BRANDKIT_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    res.json({
      success: true,
      data: brandkit,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`ブランドキット取得エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ブランドキットの取得に失敗しました',
        code: 'BRANDKIT_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /v1/brandkits
router.post('/', async (req: Request, res: Response<ApiResponse<BrandKit>>) => {
  try {
    const validatedData = CreateBrandKitSchema.parse(req.body);
    logger.info('Creating brand kit', { name: validatedData.name });
    
    const id = uuidv4();
    const brandkitData = BrandKitModel.create(validatedData);
    const brandkit: BrandKit = { id, ...brandkitData };
    
    brandkits.set(id, brandkit);
    
    res.status(201).json({
      success: true,
      data: brandkit,
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
    
    logger.error('ブランドキット作成エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ブランドキットの作成に失敗しました',
        code: 'BRANDKIT_CREATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /v1/brandkits/:id
router.put('/:id', async (req: Request, res: Response<ApiResponse<BrandKit>>) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateBrandKitSchema.parse(req.body);
    logger.info(`Updating brand kit: ${id}`, validatedData);
    
    const existing = brandkits.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ブランドキットが見つかりません',
          code: 'BRANDKIT_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const updated = BrandKitModel.update(existing, validatedData);
    brandkits.set(id, updated);
    
    res.json({
      success: true,
      data: updated,
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
    
    logger.error(`ブランドキット更新エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ブランドキットの更新に失敗しました',
        code: 'BRANDKIT_UPDATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /v1/brandkits/:id
router.delete('/:id', async (req: Request, res: Response<ApiResponse<void>>) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting brand kit: ${id}`);
    
    // Prevent deletion of default brand kit
    if (id === 'default') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'デフォルトブランドキットは削除できません',
          code: 'CANNOT_DELETE_DEFAULT',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (!brandkits.has(id)) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ブランドキットが見つかりません',
          code: 'BRANDKIT_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    brandkits.delete(id);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`ブランドキット削除エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ブランドキットの削除に失敗しました',
        code: 'BRANDKIT_DELETE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as brandkitRoutes };
