import { Router } from 'express';
import { IngestService } from '../services/ingest';
import { logger } from '../lib/logger';
import type { 
  IngestRequest, 
  IngestResult, 
  Asset,
  ListAssetsRequest,
  ListAssetsResponse,
  DeleteAssetRequest,
  DeleteAssetResponse
} from '../types/asset';

const router = Router();
const ingestService = new IngestService();

// Simple validation helper
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * POST /ingest - Ingest content from URL or uploaded file
 */
router.post('/ingest', async (req, res) => {
  try {
    const { url, file, title, description, tags } = req.body as IngestRequest;
    
    // Basic validation
    if (!url && !file) {
      return res.status(400).json({
        error: 'Either URL or file must be provided'
      });
    }
    
    if (url && !isValidUrl(url)) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    logger.info('Ingesting content', { url: url || 'file upload', title });

    const result: IngestResult = await ingestService.ingest({
      url,
      file,
      title,
      description,
      tags
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error('Ingest failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Failed to ingest content',
      message: error.message
    });
  }
});

/**
 * GET /assets - List assets with pagination and filtering
 */
router.get('/assets', async (req, res) => {
  try {
    const params: ListAssetsRequest = {
      page: Math.max(1, parseInt(req.query.page as string) || 1),
      limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)),
      type: req.query.type as any,
      source: req.query.source as string,
      search: req.query.search as string,
    };

    logger.info('Listing assets', params);

    // Mock implementation for now - replace with actual database queries
    const mockAssets: Asset[] = [
      {
        id: '1',
        type: 'social',
        source: '5ch',
        title: 'サンプルスレッド',
        description: 'テスト用のサンプルスレッドです',
        originalUrl: 'https://example.com/thread/1',
        metadata: {
          author: 'anonymous',
          threadMetadata: {
            board: 'sample',
            threadId: '1',
            threadTitle: 'サンプルスレッド',
            posts: []
          }
        },
        content: 'スレッドの内容',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const response: ListAssetsResponse = {
      assets: mockAssets,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: mockAssets.length,
        totalPages: Math.ceil(mockAssets.length / params.limit)
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to list assets', { error: error.message });
    res.status(500).json({
      error: 'Failed to list assets',
      message: error.message
    });
  }
});

/**
 * GET /assets/:id - Get specific asset by ID
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        error: 'Asset ID is required'
      });
    }
    
    logger.info('Getting asset', { id });

    // Mock implementation - replace with actual database query
    if (id === '1') {
      const asset: Asset = {
        id: '1',
        type: 'social',
        source: '5ch',
        title: 'サンプルスレッド',
        description: 'テスト用のサンプルスレッドです',
        originalUrl: 'https://example.com/thread/1',
        metadata: {
          author: 'anonymous',
          threadMetadata: {
            board: 'sample',
            threadId: '1',
            threadTitle: 'サンプルスレッド',
            posts: []
          }
        },
        content: 'スレッドの内容',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(asset);
    } else {
      res.status(404).json({
        error: 'Asset not found',
        id
      });
    }
  } catch (error) {
    logger.error('Failed to get asset', { error: error.message, id: req.params.id });
    res.status(500).json({
      error: 'Failed to get asset',
      message: error.message
    });
  }
});

/**
 * DELETE /assets/:id - Delete asset
 */
router.delete('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        error: 'Asset ID is required'
      });
    }
    
    logger.info('Deleting asset', { id });

    // Mock implementation - replace with actual database operations
    const response: DeleteAssetResponse = {
      success: true,
      id
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to delete asset', { error: error.message, id: req.params.id });
    res.status(500).json({
      error: 'Failed to delete asset',
      message: error.message
    });
  }
});

/**
 * POST /assets/batch - Batch ingest multiple URLs
 */
router.post('/assets/batch', async (req, res) => {
  try {
    const { requests } = req.body as { requests: IngestRequest[] };
    
    if (!Array.isArray(requests) || requests.length === 0 || requests.length > 10) {
      return res.status(400).json({
        error: 'Requests must be an array with 1-10 items'
      });
    }
    
    // Validate each request
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      if (request.url && !isValidUrl(request.url)) {
        return res.status(400).json({
          error: `Invalid URL at index ${i}: ${request.url}`
        });
      }
    }
    
    logger.info('Batch ingesting', { count: requests.length });

    const results = await Promise.allSettled(
      requests.map(request => ingestService.ingest(request))
    );

    const response = {
      results: results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled',
        ...(result.status === 'fulfilled' 
          ? { data: result.value }
          : { error: result.reason.message }
        )
      }))
    };

    res.json(response);
  } catch (error) {
    logger.error('Batch ingest failed', { error: error.message });
    res.status(500).json({
      error: 'Batch ingest failed',
      message: error.message
    });
  }
});

export { router as assetRoutes };