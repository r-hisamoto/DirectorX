const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://3000-i8123u3ztk2ny75osf66g-6532622b.e2b.dev',
    /^https:\/\/3000-.*\.e2b\.dev$/
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API root endpoint
app.get('/v1', (req, res) => {
  res.json({ 
    message: 'DirectorX API v1.0 (Test Server)', 
    timestamp: new Date().toISOString(),
    endpoints: {
      ingest: '/v1/ingest',
      assets: '/v1/assets'
    }
  });
});

// Mock ingest endpoint
app.post('/v1/ingest', async (req, res) => {
  try {
    const { url, file, title, description, tags } = req.body;
    
    console.log('Ingest request:', { url: url || 'file upload', title });
    
    // Basic validation
    if (!url && !file) {
      return res.status(400).json({
        error: 'Either URL or file must be provided'
      });
    }
    
    // Mock successful ingest
    const mockAsset = {
      id: Date.now().toString(),
      type: url ? (url.includes('5ch') ? 'social' : 'url') : 'file',
      source: url ? (url.includes('5ch') ? '5ch' : 'url') : 'upload',
      title: title || 'インジェスト済みアセット',
      description: description || 'テスト用のアセットです',
      url: url,
      originalUrl: url,
      metadata: {
        author: 'test-user',
        ...(url && url.includes('5ch') && {
          threadMetadata: {
            board: 'test',
            threadId: 'mock-thread',
            threadTitle: title || 'テストスレッド',
            posts: []
          }
        })
      },
      content: 'モックコンテンツ',
      tags: tags || ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = {
      success: true,
      asset: mockAsset,
      assetId: mockAsset.id,
      status: 'ready',
      message: 'インジェストが完了しました'
    };

    res.status(201).json(result);
  } catch (error) {
    console.error('Ingest failed:', error);
    res.status(500).json({
      error: 'Failed to ingest content',
      message: error.message
    });
  }
});

// Mock assets list endpoint
app.get('/v1/assets', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const { type, source, search } = req.query;
    
    console.log('List assets request:', { page, limit, type, source, search });

    // Mock assets data
    const mockAssets = [
      {
        id: '1',
        type: 'social',
        source: '5ch',
        title: 'サンプルスレッド',
        description: 'テスト用のサンプルスレッドです',
        url: 'https://example.com/thread/1',
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
        tags: ['test', 'sample'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'url',
        source: 'url',
        title: 'テストURL',
        description: 'URLアセットのテストです',
        url: 'https://example.com/page',
        originalUrl: 'https://example.com/page',
        metadata: {
          author: 'webmaster',
          siteName: 'Test Site'
        },
        content: 'ウェブページの内容',
        tags: ['url', 'test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Apply filtering
    let filteredAssets = mockAssets;
    if (type) {
      filteredAssets = filteredAssets.filter(asset => asset.type === type);
    }
    if (source) {
      filteredAssets = filteredAssets.filter(asset => asset.source === source);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAssets = filteredAssets.filter(asset => 
        asset.title.toLowerCase().includes(searchLower) ||
        asset.description.toLowerCase().includes(searchLower) ||
        asset.content.toLowerCase().includes(searchLower)
      );
    }

    const response = {
      assets: filteredAssets,
      pagination: {
        page,
        limit,
        total: filteredAssets.length,
        totalPages: Math.ceil(filteredAssets.length / limit)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to list assets:', error);
    res.status(500).json({
      error: 'Failed to list assets',
      message: error.message
    });
  }
});

// Mock get asset endpoint
app.get('/v1/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Get asset request:', { id });

    if (id === '1' || id === '2') {
      const mockAsset = {
        id: id,
        type: id === '1' ? 'social' : 'url',
        source: id === '1' ? '5ch' : 'url',
        title: id === '1' ? 'サンプルスレッド' : 'テストURL',
        description: id === '1' ? 'テスト用のサンプルスレッドです' : 'URLアセットのテストです',
        url: `https://example.com/${id === '1' ? 'thread/1' : 'page'}`,
        originalUrl: `https://example.com/${id === '1' ? 'thread/1' : 'page'}`,
        metadata: {
          author: id === '1' ? 'anonymous' : 'webmaster',
          ...(id === '1' && {
            threadMetadata: {
              board: 'sample',
              threadId: '1',
              threadTitle: 'サンプルスレッド',
              posts: []
            }
          }),
          ...(id === '2' && {
            siteName: 'Test Site'
          })
        },
        content: id === '1' ? 'スレッドの内容' : 'ウェブページの内容',
        tags: id === '1' ? ['test', 'sample'] : ['url', 'test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(mockAsset);
    } else {
      res.status(404).json({
        error: 'Asset not found',
        id
      });
    }
  } catch (error) {
    console.error('Failed to get asset:', error);
    res.status(500).json({
      error: 'Failed to get asset',
      message: error.message
    });
  }
});

// Mock delete asset endpoint
app.delete('/v1/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Delete asset request:', { id });

    res.json({
      success: true,
      id
    });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    res.status(500).json({
      error: 'Failed to delete asset',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DirectorX Test API server running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API root: http://localhost:${PORT}/v1`);
});