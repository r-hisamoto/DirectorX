// Simple test for API functionality
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DirectorX API is running',
    timestamp: new Date().toISOString() 
  });
});

// Simple test data
const workspaces = [
  { id: '1', name: 'テストワークスペース', createdAt: new Date(), updatedAt: new Date() },
];

const channels = [
  { id: '1', workspaceId: '1', name: 'テストチャンネル', createdAt: new Date(), updatedAt: new Date() },
];

const brandkits = [
  { 
    id: 'default', 
    name: 'デフォルトブランドキット', 
    colors: { primary: '#FFD400', accent: '#111111' },
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
];

// API routes
app.get('/api/v1/workspaces', (req, res) => {
  res.json({ success: true, data: workspaces, timestamp: new Date().toISOString() });
});

app.get('/api/v1/channels', (req, res) => {
  const { workspaceId } = req.query;
  let result = channels;
  if (workspaceId) {
    result = channels.filter(ch => ch.workspaceId === workspaceId);
  }
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

app.get('/api/v1/brandkits', (req, res) => {
  res.json({ success: true, data: brandkits, timestamp: new Date().toISOString() });
});

// SRT formatting endpoint (simple implementation for testing)
app.post('/api/v1/srt/format', (req, res) => {
  const { srt, maxZenkaku = 20 } = req.body;
  
  if (!srt) {
    return res.status(400).json({ 
      success: false, 
      error: { message: 'SRTテキストは必須です', code: 'VALIDATION_ERROR' } 
    });
  }
  
  // Simple formatting (actual implementation would use the SRT library)
  const formatted = srt.replace(/(.{1,20})/g, '$1\n').trim();
  
  res.json({ 
    success: true, 
    data: { srt: formatted }, 
    timestamp: new Date().toISOString() 
  });
});

// SRT demo endpoint
app.get('/api/v1/srt/demo', (req, res) => {
  const demoSrt = `1
00:00:00,000 --> 00:00:03,000
これは日本語字幕の整形
デモです。

2
00:00:03,000 --> 00:00:06,000
全角20文字で自動的に
折り返されます。

3
00:00:06,000 --> 00:00:09,000
行頭に句読点が来ないよ
うに禁則処理が適用されて
います。`;

  res.json({ 
    success: true, 
    data: { srt: demoSrt }, 
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 DirectorX Test API server running on port ${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
});