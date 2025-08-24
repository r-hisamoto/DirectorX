const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Static files from src directory
app.use('/src', express.static(path.join(__dirname, 'src')));

// Node modules for dependencies
app.use('/node_modules', express.static(path.join(__dirname, '..', 'node_modules')));

// Main HTML file with module imports
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DirectorX - Studio</title>
  <script type="importmap">
  {
    "imports": {
      "react": "/node_modules/react/index.js",
      "react-dom": "/node_modules/react-dom/index.js",
      "react-dom/client": "/node_modules/react-dom/client.js"
    }
  }
  </script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script>
    // Basic React development setup
    window.React = window.React || {};
    window.ReactDOM = window.ReactDOM || {};
    
    // Mock implementation for testing
    const mockApp = {
      render: () => {
        const root = document.getElementById('root');
        root.innerHTML = \`
          <div class="h-screen bg-gray-100 flex flex-col">
            <!-- Header -->
            <header class="bg-white border-b border-gray-200 px-6 py-4">
              <h1 class="text-2xl font-bold text-gray-900">DirectorX Studio</h1>
            </header>
            
            <!-- Main Layout -->
            <div class="flex-1 flex overflow-hidden">
              <!-- Left: Asset Tray -->
              <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div class="p-4 border-b border-gray-200">
                  <h2 class="text-lg font-semibold text-gray-900">素材トレイ</h2>
                  <button id="add-url-btn" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    + URL追加
                  </button>
                </div>
                
                <!-- URL Input -->
                <div id="url-input-section" class="p-4 border-b border-gray-200 hidden">
                  <input 
                    id="url-input" 
                    type="text" 
                    placeholder="URLを貼り付けてください (5ch, X/Twitter, YouTube対応)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <div class="mt-2 flex gap-2">
                    <button id="ingest-btn" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">
                      インジェスト
                    </button>
                    <button id="cancel-btn" class="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500">
                      キャンセル
                    </button>
                  </div>
                  <div id="ingest-status" class="mt-2 text-sm text-gray-600"></div>
                </div>
                
                <!-- Assets List -->
                <div class="flex-1 p-4">
                  <div id="assets-list">
                    <div class="text-sm text-gray-500">アセットを読み込み中...</div>
                  </div>
                </div>
              </div>
              
              <!-- Center: Script Editor -->
              <div class="flex-1 bg-white flex flex-col">
                <div class="p-4 border-b border-gray-200">
                  <h2 class="text-lg font-semibold text-gray-900">台本エディタ</h2>
                </div>
                <div class="flex-1 p-4">
                  <textarea 
                    class="w-full h-full resize-none border border-gray-300 rounded-md p-3 text-sm"
                    placeholder="選択した素材から台本を生成するか、直接入力してください..."
                  ></textarea>
                </div>
              </div>
              
              <!-- Right: Preview -->
              <div class="w-96 bg-white border-l border-gray-200 flex flex-col">
                <div class="p-4 border-b border-gray-200">
                  <h2 class="text-lg font-semibold text-gray-900">プレビュー/制御</h2>
                </div>
                <div class="flex-1 p-4">
                  <div class="text-sm text-gray-500">プレビュー機能は今後実装予定</div>
                </div>
              </div>
            </div>
          </div>
        \`;
        
        // Setup event listeners
        setupEventListeners();
      }
    };
    
    function setupEventListeners() {
      const addUrlBtn = document.getElementById('add-url-btn');
      const urlInputSection = document.getElementById('url-input-section');
      const urlInput = document.getElementById('url-input');
      const ingestBtn = document.getElementById('ingest-btn');
      const cancelBtn = document.getElementById('cancel-btn');
      const ingestStatus = document.getElementById('ingest-status');
      
      addUrlBtn.addEventListener('click', () => {
        urlInputSection.classList.toggle('hidden');
        if (!urlInputSection.classList.contains('hidden')) {
          urlInput.focus();
        }
      });
      
      cancelBtn.addEventListener('click', () => {
        urlInputSection.classList.add('hidden');
        urlInput.value = '';
        ingestStatus.textContent = '';
      });
      
      ingestBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;
        
        ingestStatus.textContent = 'インジェスト中...';
        ingestStatus.className = 'mt-2 text-sm text-blue-600';
        
        try {
          const response = await fetch('${process.env.API_URL || 'https://8000-i8123u3ztk2ny75osf66g-6532622b.e2b.dev'}/v1/ingest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url,
              title: \`URL: \${url}\`,
              tags: ['test', 'imported']
            })
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            ingestStatus.textContent = 'インジェスト完了！';
            ingestStatus.className = 'mt-2 text-sm text-green-600';
            urlInput.value = '';
            loadAssets(); // Refresh assets list
          } else {
            ingestStatus.textContent = \`エラー: \${result.error || result.message || '不明なエラー'}\`;
            ingestStatus.className = 'mt-2 text-sm text-red-600';
          }
        } catch (error) {
          ingestStatus.textContent = \`通信エラー: \${error.message}\`;
          ingestStatus.className = 'mt-2 text-sm text-red-600';
        }
      });
      
      // Load assets on page load
      loadAssets();
    }
    
    async function loadAssets() {
      const assetsList = document.getElementById('assets-list');
      
      try {
        const response = await fetch('${process.env.API_URL || 'https://8000-i8123u3ztk2ny75osf66g-6532622b.e2b.dev'}/v1/assets');
        const result = await response.json();
        
        if (response.ok && result.assets) {
          if (result.assets.length === 0) {
            assetsList.innerHTML = '<div class="text-sm text-gray-500">アセットがありません</div>';
          } else {
            assetsList.innerHTML = result.assets.map(asset => \`
              <div class="mb-2 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                <div class="font-medium text-sm text-gray-900">\${asset.title || 'untitled'}</div>
                <div class="text-xs text-gray-500 mt-1">\${asset.source} • \${asset.type}</div>
                \${asset.description ? \`<div class="text-xs text-gray-600 mt-1">\${asset.description}</div>\` : ''}
              </div>
            \`).join('');
          }
        } else {
          assetsList.innerHTML = '<div class="text-sm text-red-500">アセット読み込みエラー</div>';
        }
      } catch (error) {
        assetsList.innerHTML = '<div class="text-sm text-red-500">通信エラー</div>';
      }
    }
    
    // Start the app
    mockApp.render();
  </script>
</body>
</html>`;
  
  res.send(html);
});

// API proxy for development
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API not available in static mode' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DirectorX Frontend (Static) running on port ${PORT}`);
  console.log(`🔗 Application: http://localhost:${PORT}`);
});