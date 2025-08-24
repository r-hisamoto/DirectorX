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
                  <div class="flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">台本エディタ</h2>
                    <div id="script-status" class="text-sm text-gray-500"></div>
                  </div>
                </div>
                <div class="flex-1 p-4">
                  <div class="flex mb-2 gap-2">
                    <button id="generate-srt-btn" class="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600">
                      🎬 SRT生成
                    </button>
                    <button id="clear-script-btn" class="px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500">
                      クリア
                    </button>
                  </div>
                  <textarea 
                    id="script-area"
                    class="w-full h-full resize-none border border-gray-300 rounded-md p-3 text-sm"
                    placeholder="左の素材トレイからアセットを選択すると、自動で台本が生成されます。&#13;&#10;&#13;&#10;または直接入力してください..."
                  ># DirectorX Studio

左の素材トレイからアセットを選択すると、自動で台本が生成されます。

## 機能

- 📱 URL貼り付けでアセット取得（5ch、X/Twitter、YouTube対応）
- 📁 ファイルドラッグ&ドロップ  
- ✨ 選択アセットから自動台本生成
- 📝 リアルタイム編集
- 🎬 日本語SRT生成

## 使い方

1. 左の「+ URL追加」ボタンでURLを入力
2. または既存のアセットをクリック
3. 自動で台本が生成されます！</textarea>
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
      
      // SRT生成ボタン
      const generateSrtBtn = document.getElementById('generate-srt-btn');
      generateSrtBtn.addEventListener('click', () => {
        const scriptArea = document.getElementById('script-area');
        const content = scriptArea.value;
        
        if (!content.trim()) {
          alert('台本が入力されていません');
          return;
        }
        
        const srt = generateSrtFromScript(content);
        scriptArea.value = srt;
        
        const statusDiv = document.getElementById('script-status');
        if (statusDiv) {
          statusDiv.textContent = '🎬 SRTに変換しました';
          statusDiv.className = 'text-sm text-blue-600';
          setTimeout(() => {
            statusDiv.textContent = '';
          }, 3000);
        }
      });
      
      // クリアボタン
      const clearScriptBtn = document.getElementById('clear-script-btn');
      clearScriptBtn.addEventListener('click', () => {
        const scriptArea = document.getElementById('script-area');
        scriptArea.value = \`# DirectorX Studio

左の素材トレイからアセットを選択すると、自動で台本が生成されます。

## 機能

- 📱 URL貼り付けでアセット取得（5ch、X/Twitter、YouTube対応）
- 📁 ファイルドラッグ&ドロップ  
- ✨ 選択アセットから自動台本生成
- 📝 リアルタイム編集
- 🎬 日本語SRT生成

## 使い方

1. 左の「+ URL追加」ボタンでURLを入力
2. または既存のアセットをクリック
3. 自動で台本が生成されます！\`;
      });
      
      // Load assets on page load
      loadAssets();
    }
    
    function generateSrtFromScript(script) {
      // ヘッダーやマークダウン記号を除去
      const cleanText = script
        .replace(/^#+\\s+.*/gm, '') // ヘッダー除去
        .replace(/\\*\\*(.+?)\\*\\*/g, '$1') // 太字除去
        .replace(/\\[.+?\\]\\(.+?\\)/g, '') // リンク除去
        .replace(/\\n{2,}/g, '\\n') // 連続改行を単一に
        .trim();
      
      const lines = cleanText.split('\\n').filter(line => line.trim());
      let srt = '';
      let currentTime = 0;
      
      lines.forEach((line, index) => {
        if (line.trim()) {
          // 日本語の文字数に基づく読み時間計算（1文字約0.2秒）
          const charCount = line.length;
          const duration = Math.max(2, Math.min(8, charCount * 0.2));
          
          const startTimeStr = formatSrtTime(currentTime);
          const endTimeStr = formatSrtTime(currentTime + duration);
          
          srt += \`\${index + 1}\\n\`;
          srt += \`\${startTimeStr} --> \${endTimeStr}\\n\`;
          srt += \`\${line}\\n\\n\`;
          
          currentTime += duration + 0.5; // 間隔を追加
        }
      });
      
      return srt;
    }
    
    function formatSrtTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      
      return \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')},\${ms.toString().padStart(3, '0')}\`;
    }
    
    function generateScriptFromAsset(asset) {
      const scriptArea = document.querySelector('#script-area');
      if (!scriptArea) return;
      
      let script = '';
      
      // タイトル生成
      script += \`# \${asset.title}\\n\\n\`;
      
      // イントロ生成
      script += \`はい、どうも。今回は\${asset.source}から気になる話題を取り上げました。早速チェックしていきましょう。\\n\\n\`;
      
      // メイン内容
      script += \`## メイン内容\\n\\n\`;
      
      if (asset.type === 'social' && asset.source === '5ch') {
        script += \`\${asset.metadata?.threadMetadata?.board || ''}板の「\${asset.title}」スレッドからです。\\n\\n\`;
        if (asset.metadata?.threadMetadata?.posts) {
          script += \`主要な投稿を紹介します：\\n\\n\`;
          asset.metadata.threadMetadata.posts.slice(0, 3).forEach(post => {
            script += \`**\${post.number}番**（\${post.name}）\\n\`;
            script += \`\${post.content}\\n\\n\`;
          });
        }
      } else if (asset.type === 'social' && asset.source === 'x-twitter') {
        const social = asset.metadata?.socialMetadata;
        if (social) {
          script += \`\${social.platform}の\${social.displayName}さん（@\${social.username}）による投稿です。\\n\\n\`;
          if (social.postText) {
            script += \`投稿内容：\\n> \${social.postText}\\n\\n\`;
          }
          if (social.likes || social.retweets) {
            script += \`この投稿は\${social.likes || 0}いいね、\${social.retweets || 0}リポストを獲得しており、注目度の高い内容となっています。\\n\\n\`;
          }
        }
      } else if (asset.type === 'url') {
        if (asset.metadata?.siteName) {
          script += \`\${asset.metadata.siteName}からの記事です。\\n\\n\`;
        }
        if (asset.description) {
          script += \`\${asset.description}\\n\\n\`;
        }
      }
      
      if (asset.content) {
        script += \`コメント：\${asset.content}\\n\\n\`;
      }
      
      // アウトロ
      script += \`## まとめ\\n\\n\`;
      script += \`はい、ということで今回は以上になります。また面白い話題を見つけたら紹介しますので、チャンネル登録よろしくお願いします。それではまた！\`;
      
      scriptArea.value = script;
      
      // 生成完了メッセージ
      const statusDiv = document.getElementById('script-status');
      if (statusDiv) {
        statusDiv.textContent = '✨ アセットから台本を生成しました';
        statusDiv.className = 'mt-2 text-sm text-green-600';
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 3000);
      }
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
              <div class="mb-2 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer asset-item" data-asset-id="\${asset.id}">
                <div class="font-medium text-sm text-gray-900">\${asset.title || 'untitled'}</div>
                <div class="text-xs text-gray-500 mt-1">\${asset.source} • \${asset.type}</div>
                \${asset.description ? \`<div class="text-xs text-gray-600 mt-1">\${asset.description}</div>\` : ''}
              </div>
            \`).join('');
            
            // アセットクリックイベントを追加
            document.querySelectorAll('.asset-item').forEach(item => {
              item.addEventListener('click', () => {
                const assetId = item.dataset.assetId;
                const asset = result.assets.find(a => a.id === assetId);
                if (asset) {
                  generateScriptFromAsset(asset);
                  
                  // 選択状態の表示更新
                  document.querySelectorAll('.asset-item').forEach(i => i.classList.remove('bg-blue-50', 'border-blue-300'));
                  item.classList.add('bg-blue-50', 'border-blue-300');
                }
              });
            });
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