import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChannelModel, CreateChannelSchema, UpdateChannelSchema } from '../models/channel';
import { Channel, ApiResponse } from '../types';
import { logger } from '../lib/logger';

const router = Router();

// Temporary in-memory storage (replace with Firestore in production)
const channels = new Map<string, Channel>();

// GET /v1/channels
router.get('/', async (req: Request, res: Response<ApiResponse<Channel[]>>) => {
  try {
    const { workspaceId } = req.query;
    logger.info('Fetching channels list', { workspaceId });
    
    let channelList = Array.from(channels.values());
    
    // Filter by workspace if specified
    if (workspaceId) {
      channelList = channelList.filter(channel => channel.workspaceId === workspaceId);
    }
    
    res.json({
      success: true,
      data: channelList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('チャンネル取得エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'チャンネルの取得に失敗しました',
        code: 'CHANNEL_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /v1/channels/:id
router.get('/:id', async (req: Request, res: Response<ApiResponse<Channel>>) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching channel: ${id}`);
    
    const channel = channels.get(id);
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'チャンネルが見つかりません',
          code: 'CHANNEL_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    res.json({
      success: true,
      data: channel,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`チャンネル取得エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'チャンネルの取得に失敗しました',
        code: 'CHANNEL_FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /v1/channels
router.post('/', async (req: Request, res: Response<ApiResponse<Channel>>) => {
  try {
    const validatedData = CreateChannelSchema.parse(req.body);
    logger.info('Creating channel', { name: validatedData.name });
    

    
    const id = uuidv4();
    const channelData = ChannelModel.create(validatedData);
    const channel: Channel = { id, ...channelData };
    
    channels.set(id, channel);
    
    res.status(201).json({
      success: true,
      data: channel,
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
    
    logger.error('チャンネル作成エラー', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'チャンネルの作成に失敗しました',
        code: 'CHANNEL_CREATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /v1/channels/:id
router.put('/:id', async (req: Request, res: Response<ApiResponse<Channel>>) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateChannelSchema.parse(req.body);
    logger.info(`Updating channel: ${id}`, validatedData);
    
    const existing = channels.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'チャンネルが見つかりません',
          code: 'CHANNEL_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const updated = ChannelModel.update(existing, validatedData);
    channels.set(id, updated);
    
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
    
    logger.error(`チャンネル更新エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'チャンネルの更新に失敗しました',
        code: 'CHANNEL_UPDATE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /v1/channels/:id
router.delete('/:id', async (req: Request, res: Response<ApiResponse<void>>) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting channel: ${id}`);
    
    if (!channels.has(id)) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'チャンネルが見つかりません',
          code: 'CHANNEL_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    channels.delete(id);
    
    res.status(204).json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`チャンネル削除エラー: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'チャンネルの削除に失敗しました',
        code: 'CHANNEL_DELETE_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as channelRoutes };