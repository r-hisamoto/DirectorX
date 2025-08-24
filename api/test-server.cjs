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
        title: 'ChatGPTの活用法について議論するスレ',
        description: '最近話題のAI活用法について住民が議論中',
        url: 'https://5ch.net/test/thread/1',
        originalUrl: 'https://5ch.net/test/thread/1',
        metadata: {
          author: 'anonymous',
          threadMetadata: {
            board: 'ニュース速報+',
            threadId: '1',
            threadTitle: 'ChatGPTの活用法について議論するスレ',
            posts: [
              {
                number: 1,
                name: '名無しさん',
                date: '2024/01/15(月) 12:00:00.00',
                id: 'abc123',
                content: 'ChatGPT使い始めたんだけど、みんなどんな風に活用してる？',
                isOp: true
              },
              {
                number: 2,
                name: '名無しさん',
                date: '2024/01/15(月) 12:01:00.00',
                id: 'def456',
                content: 'プログラミングのコードレビューに使ってるわ。結構便利',
                isOp: false
              },
              {
                number: 3,
                name: '名無しさん',
                date: '2024/01/15(月) 12:02:00.00',
                id: 'ghi789',
                content: '翻訳とかドキュメント作成が捗る。手放せない',
                isOp: false
              }
            ]
          }
        },
        content: 'ChatGPTの様々な活用法について住民が議論しているスレッド。プログラミング支援から日常業務まで幅広い用途で使われている様子。',
        tags: ['AI', 'ChatGPT', '議論'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'social',
        source: 'x-twitter',
        title: 'AI技術の最新動向についてのツイート',
        description: 'AI研究者による最新AI技術のトレンド解説',
        url: 'https://x.com/ai_researcher/status/123456789',
        originalUrl: 'https://x.com/ai_researcher/status/123456789',
        metadata: {
          author: 'AI Researcher',
          socialMetadata: {
            platform: 'x',
            username: 'ai_researcher',
            displayName: 'AI研究者 田中',
            postId: '123456789',
            postText: '2024年のAI技術トレンド予測：\n1. マルチモーダルAIの普及\n2. エッジAIの進化\n3. AI倫理規制の強化\n4. 生成AI の実用化加速\n\n特に注目すべきは、リアルタイム処理能力の向上と、プライバシー保護技術の統合です。',
            likes: 1250,
            retweets: 340,
            replies: 89
          }
        },
        content: '2024年AI技術のトレンド予測について詳しく解説。マルチモーダルAI、エッジAI、AI倫理、生成AIの4つの重要なポイントを指摘。',
        tags: ['AI', 'トレンド', '技術'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        type: 'url',
        source: 'url',
        title: 'Next.js 14の新機能解説記事',
        description: 'Next.js 14で追加された新機能の詳細解説',
        url: 'https://example-tech-blog.com/nextjs14-features',
        originalUrl: 'https://example-tech-blog.com/nextjs14-features',
        metadata: {
          author: 'テックライター 佐藤',
          siteName: 'Tech Blog JP',
          publishedAt: new Date().toISOString()
        },
        content: 'Next.js 14では、Server Actions、Partial Prerendering、そして改良されたTurbopackが主な新機能として追加されました。これらの機能により、開発体験とパフォーマンスが大幅に向上しています。特にServer Actionsは、従来のAPI Routes に代わる新しいアプローチとして注目されています。',
        tags: ['Next.js', 'React', 'Web開発'],
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

    // Find asset from mock data
    const mockAsset = mockAssets.find(asset => asset.id === id);
    
    if (mockAsset) {
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