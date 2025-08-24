import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceModel, CreateWorkspaceSchema, UpdateWorkspaceSchema } from '../models/workspace';
import { Workspace, ApiResponse } from '../types';
import { logger } from '../lib/logger';

const router = Router();

// Temporary in-memory storage (replace with Firestore in production)
const workspaces = new Map<string, Workspace>();

// GET /v1/workspaces
router.get('/', async (req: Request, res: Response<ApiResponse<Workspace[]>>) => {
  try {
    logger.info('Fetching workspaces list');
    
    const workspaceList = Array.from(workspaces.values());
    
    res.json({
      success: true,
      data: workspaceList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('ワークスペース取得エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ワークスペースの取得に失敗しました',
        code: 'WORKSPACE_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/workspaces/:id
router.get('/:id', async (req: Request, res: Response<ApiResponse<Workspace>>) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching workspace: ${id}`);
    
    const workspace = workspaces.get(id);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ワークスペースが見つかりません',
          code: 'WORKSPACE_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    res.json({
      success: true,
      data: workspace,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`ワークスペース取得エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ワークスペースの取得に失敗しました',
        code: 'WORKSPACE_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /v1/workspaces
router.post('/', async (req: Request, res: Response<ApiResponse<Workspace>>) => {
  try {
    const validatedData = CreateWorkspaceSchema.parse(req.body);
    logger.info('Creating workspace', { name: validatedData.name });
    
    // TODO: Get user ID from JWT token
    const ownerId = 'user-1'; // Temporary user ID
    
    const id = uuidv4();
    const workspaceData = WorkspaceModel.create({ ...validatedData, ownerId });
    const workspace: Workspace = { id, ...workspaceData };
    
    workspaces.set(id, workspace);
    
    res.status(201).json({
      success: true,
      data: workspace,
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
    
    logger.error('ワークスペース作成エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ワークスペースの作成に失敗しました',
        code: 'WORKSPACE_CREATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /v1/workspaces/:id
router.put('/:id', async (req: Request, res: Response<ApiResponse<Workspace>>) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateWorkspaceSchema.parse(req.body);
    logger.info(`Updating workspace: ${id}`, validatedData);
    
    const existing = workspaces.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ワークスペースが見つかりません',
          code: 'WORKSPACE_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const updated = WorkspaceModel.update(existing, validatedData);
    workspaces.set(id, updated);
    
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
    
    logger.error(`ワークスペース更新エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ワークスペースの更新に失敗しました',
        code: 'WORKSPACE_UPDATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /v1/workspaces/:id
router.delete('/:id', async (req: Request, res: Response<ApiResponse<void>>) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting workspace: ${id}`);
    
    if (!workspaces.has(id)) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'ワークスペースが見つかりません',
          code: 'WORKSPACE_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    workspaces.delete(id);
    
    res.status(204).json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`ワークスペース削除エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'ワークスペースの削除に失敗しました',
        code: 'WORKSPACE_DELETE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as workspaceRoutes };