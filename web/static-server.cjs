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
              
              <!-- Right: Preview Control -->
              <div class="w-96 bg-white border-l border-gray-200 flex flex-col">
                <!-- Tab Headers -->
                <div class="p-4 border-b border-gray-200">
                  <div class="flex space-x-2">
                    <button id="tab-preview" class="tab-btn active px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700">
                      👁 プレビュー
                    </button>
                    <button id="tab-progress" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      📊 進捗
                    </button>
                    <button id="tab-control" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      ⚡ 制御
                    </button>
                    <button id="tab-tts" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      🎧 TTS
                    </button>
                    <button id="tab-recipe" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      ⚡ レシピ
                    </button>
                    <button id="tab-render" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      🎬 レンダリング
                    </button>
                    <button id="tab-qc" class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100">
                      ✅ QC
                    </button>
                  </div>
                </div>

                <!-- Tab Content -->
                <div class="flex-1 p-4 overflow-y-auto">
                  <!-- Preview Tab -->
                  <div id="preview-content" class="tab-content">
                    <div class="space-y-4">
                      <!-- Video Preview -->
                      <div class="bg-gray-900 rounded-lg p-4 text-white">
                        <div class="aspect-video bg-gray-800 rounded flex items-center justify-center mb-4">
                          <div class="text-center">
                            <div class="text-4xl mb-2">👁</div>
                            <p class="text-sm text-gray-400">プレビュー生成中...</p>
                          </div>
                        </div>
                        
                        <!-- Media Controls -->
                        <div class="flex items-center space-x-4">
                          <button id="play-btn" class="p-2 bg-blue-600 hover:bg-blue-700 rounded-full">
                            ▶️
                          </button>
                          <button class="p-2 hover:bg-gray-700 rounded">⏮</button>
                          <button class="p-2 hover:bg-gray-700 rounded">⏭</button>
                          <div class="flex-1 mx-4">
                            <div class="flex items-center space-x-2 text-xs text-gray-400">
                              <span id="current-time">0:00</span>
                              <div class="flex-1 bg-gray-700 rounded-full h-1">
                                <div id="progress-bar" class="bg-blue-500 h-1 rounded-full w-0"></div>
                              </div>
                              <span>2:00</span>
                            </div>
                          </div>
                          <button id="volume-btn" class="p-2 hover:bg-gray-700 rounded">🔊</button>
                        </div>
                      </div>
                      
                      <!-- Script Preview -->
                      <div id="script-preview" class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-2">現在の台本</h4>
                        <div class="text-sm text-gray-700 max-h-32 overflow-y-auto">
                          台本がここに表示されます...
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Progress Tab -->
                  <div id="progress-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-4 flex items-center">
                          📊 処理進捗
                        </h4>
                        <div id="progress-steps" class="space-y-3">
                          <!-- Progress steps will be populated here -->
                        </div>
                      </div>
                      
                      <!-- Statistics -->
                      <div class="grid grid-cols-2 gap-3">
                        <div class="bg-blue-50 rounded-lg p-3">
                          <div class="text-xs text-blue-600">アセット数</div>
                          <div id="asset-count" class="text-lg font-bold text-blue-700">0</div>
                        </div>
                        <div class="bg-green-50 rounded-lg p-3">
                          <div class="text-xs text-green-600">文字数</div>
                          <div id="char-count" class="text-lg font-bold text-green-700">0</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Control Tab -->
                  <div id="control-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-4">⚡ バッチ制御</h4>
                        <div class="space-y-3">
                          <button id="start-processing" class="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
                            <span>▶️</span>
                            <span>全工程実行</span>
                          </button>
                          
                          <div class="grid grid-cols-2 gap-2">
                            <button class="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                              <span>🎧</span>
                              <span>TTS</span>
                            </button>
                            <button class="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                              <span>🎬</span>
                              <span>動画</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Settings -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">⚙️ 設定</h4>
                        <div class="space-y-3 text-sm">
                          <div class="flex justify-between items-center">
                            <span class="text-gray-700">音声品質</span>
                            <select class="px-2 py-1 border border-gray-300 rounded text-xs">
                              <option>標準</option>
                              <option>高音質</option>
                            </select>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="text-gray-700">動画解像度</span>
                            <select class="px-2 py-1 border border-gray-300 rounded text-xs">
                              <option>1080p</option>
                              <option>720p</option>
                              <option>4K</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- TTS Tab -->
                  <div id="tts-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <!-- Voice Selection -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">🎧 音声選択</h4>
                        <div class="space-y-2">
                          <div class="text-xs text-gray-600 mb-1">男性音声</div>
                          <div class="grid grid-cols-1 gap-1">
                            <button id="voice-male-1" class="voice-btn text-left px-2 py-1.5 rounded text-xs border border-gray-200 hover:bg-gray-50 text-gray-700">
                              <div class="font-medium">日本語男性音声</div>
                              <div class="text-gray-500 text-xs">ja-JP</div>
                            </button>
                          </div>
                          
                          <div class="text-xs text-gray-600 mb-1 mt-3">女性音声</div>
                          <div class="grid grid-cols-1 gap-1">
                            <button id="voice-female-1" class="voice-btn text-left px-2 py-1.5 rounded text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 border-blue-300 bg-blue-50 text-blue-700">
                              <div class="font-medium">日本語女性音声</div>
                              <div class="text-gray-500 text-xs">ja-JP</div>
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- TTS Settings -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">⚙️ 音声設定</h4>
                        <div class="space-y-2">
                          <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-700">速度</span>
                            <div class="flex items-center space-x-2">
                              <input id="tts-rate" type="range" min="0.5" max="2.0" step="0.1" value="1.0" class="w-16 h-1">
                              <span id="tts-rate-value" class="text-xs text-gray-500 w-8">1.0</span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-700">ピッチ</span>
                            <div class="flex items-center space-x-2">
                              <input id="tts-pitch" type="range" min="0.5" max="2.0" step="0.1" value="1.0" class="w-16 h-1">
                              <span id="tts-pitch-value" class="text-xs text-gray-500 w-8">1.0</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Preview -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">🎤 プレビュー</h4>
                        <div class="bg-white rounded p-3 mb-3">
                          <div id="tts-preview-text" class="text-sm text-gray-700">
                            台本がここに表示されます...
                          </div>
                        </div>
                        <div class="flex space-x-2">
                          <button id="tts-preview-play" class="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium">
                            <span>▶️</span>
                            <span>試聴</span>
                          </button>
                          <button id="tts-preview-stop" class="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium">
                            <span>⏹</span>
                            <span>停止</span>
                          </button>
                        </div>
                      </div>

                      <!-- Generate -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">📄 音声生成</h4>
                        <button id="tts-generate" class="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium">
                          <span>🎧</span>
                          <span>音声生成開始</span>
                        </button>
                        <div id="tts-status" class="mt-2 text-sm"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Recipe Tab -->
                  <div id="recipe-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <!-- 基本設定 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">⚙️ 基本設定</h4>
                        <div class="space-y-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">動画タイトル</label>
                            <input type="text" id="video-title" value="新しい動画" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
                            <textarea id="video-description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="動画の説明（オプション）"></textarea>
                          </div>
                        </div>
                      </div>

                      <!-- テンプレート選択 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">📋 テンプレート</h4>
                        <div class="space-y-2">
                          <div class="template-option p-3 border border-purple-300 bg-purple-50 rounded-lg cursor-pointer" data-template="news-style">
                            <div class="font-medium text-sm">ニュース風テンプレート</div>
                            <div class="text-xs text-gray-600 mt-1">情報系動画に最適なシンプルなテンプレート</div>
                          </div>
                          <div class="template-option p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-300" data-template="commentary">
                            <div class="font-medium text-sm">解説動画テンプレート</div>
                            <div class="text-xs text-gray-600 mt-1">解説系コンテンツ向けの読みやすいテンプレート</div>
                          </div>
                          <div class="template-option p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-300" data-template="social-media">
                            <div class="font-medium text-sm">SNS投稿紹介テンプレート</div>
                            <div class="text-xs text-gray-600 mt-1">X/Twitter、5ch等のSNS内容を紹介する動画用</div>
                          </div>
                        </div>
                      </div>

                      <!-- 動画設定 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">🎬 動画設定</h4>
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">解像度</label>
                            <select id="resolution-select" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="1280x720">HD (720p)</option>
                              <option value="1920x1080" selected>Full HD (1080p)</option>
                              <option value="3840x2160">4K (2160p)</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">フレームレート</label>
                            <select id="framerate-select" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="30" selected>30 FPS</option>
                              <option value="60">60 FPS</option>
                            </select>
                          </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">品質</label>
                            <select id="quality-select" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="draft">ドラフト</option>
                              <option value="standard" selected>標準</option>
                              <option value="high">高品質</option>
                              <option value="ultra">最高品質</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">出力形式</label>
                            <select id="format-select" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="mp4" selected>MP4</option>
                              <option value="webm">WebM</option>
                              <option value="mov">MOV</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <!-- レシピ状態 -->
                      <div id="recipe-status" class="bg-gray-50 rounded-lg p-4 hidden">
                        <h4 class="font-medium text-gray-900 mb-3">📊 レシピ状態</h4>
                        <div class="bg-white rounded-lg p-3 mb-3">
                          <div class="text-sm font-medium text-gray-900 mb-1" id="recipe-title-display">-</div>
                          <div class="text-xs text-gray-600" id="recipe-details">-</div>
                        </div>
                        
                        <!-- ステップ進行状況 -->
                        <div id="recipe-steps" class="space-y-2">
                          <div class="text-sm font-medium text-gray-900">進行状況</div>
                          <div class="space-y-1" id="recipe-step-list">
                            <!-- ステップが動的に追加される -->
                          </div>
                        </div>
                      </div>

                      <!-- 統計情報 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">📈 統計情報</h4>
                        <div class="space-y-2 text-sm text-gray-600">
                          <div class="flex justify-between">
                            <span>アセット数:</span>
                            <span id="recipe-asset-count">0</span>
                          </div>
                          <div class="flex justify-between">
                            <span>台本文字数:</span>
                            <span id="recipe-char-count">0</span>
                          </div>
                          <div class="flex justify-between">
                            <span>推定動画長:</span>
                            <span id="recipe-estimated-duration">-</span>
                          </div>
                        </div>
                      </div>

                      <!-- アクションボタン -->
                      <div class="space-y-2">
                        <button id="create-recipe-btn" class="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium">
                          📋 レシピ作成
                        </button>
                        <button id="execute-recipe-btn" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium" disabled>
                          🎬 動画生成実行
                        </button>
                        <div id="recipe-current-step" class="text-center text-sm text-gray-600 hidden">
                          <!-- 現在のステップ表示 -->
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Render Tab -->
                  <div id="render-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <!-- プレビューエリア -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          👁 プレビュー
                          <div class="flex space-x-1 ml-auto">
                            <button id="preview-video" class="preview-mode-btn px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">動画</button>
                            <button id="preview-audio" class="preview-mode-btn px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100">音声</button>
                            <button id="preview-thumbnail" class="preview-mode-btn px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100">サムネ</button>
                          </div>
                        </h4>
                        
                        <div id="render-preview" class="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                          <div class="text-center text-gray-400">
                            <div class="text-4xl mb-2">👁</div>
                            <p class="text-sm">プレビューなし</p>
                          </div>
                        </div>
                      </div>

                      <!-- レンダリング設定 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">⚙️ レンダリング設定</h4>
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">出力形式</label>
                            <select id="render-format" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="mp4" selected>MP4</option>
                              <option value="webm">WebM</option>
                              <option value="mov">MOV</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">品質</label>
                            <select id="render-quality" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="draft">ドラフト</option>
                              <option value="standard" selected>標準</option>
                              <option value="high">高品質</option>
                              <option value="ultra">最高品質</option>
                            </select>
                          </div>
                        </div>
                        
                        <div class="mt-3">
                          <label class="text-sm font-medium text-gray-700">含める要素</label>
                          <div class="grid grid-cols-2 gap-2 mt-1">
                            <label class="flex items-center space-x-2">
                              <input type="checkbox" id="include-audio" checked class="rounded border-gray-300 text-red-600">
                              <span class="text-sm">音声</span>
                            </label>
                            <label class="flex items-center space-x-2">
                              <input type="checkbox" id="include-subtitles" checked class="rounded border-gray-300 text-red-600">
                              <span class="text-sm">字幕</span>
                            </label>
                            <label class="flex items-center space-x-2">
                              <input type="checkbox" id="include-thumbnail" checked class="rounded border-gray-300 text-red-600">
                              <span class="text-sm">サムネイル</span>
                            </label>
                            <label class="flex items-center space-x-2">
                              <input type="checkbox" id="include-script" checked class="rounded border-gray-300 text-red-600">
                              <span class="text-sm">台本</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <!-- レンダリング進捗 -->
                      <div id="render-progress-section" class="bg-gray-50 rounded-lg p-4 hidden">
                        <h4 class="font-medium text-gray-900 mb-3">🔄 レンダリング進捗</h4>
                        <div class="mb-2">
                          <div class="flex justify-between text-sm">
                            <span id="render-current-step">初期化中...</span>
                            <span id="render-progress-percent">0%</span>
                          </div>
                          <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div id="render-progress-bar" class="bg-red-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                          </div>
                        </div>
                        <div class="flex justify-between text-xs text-gray-500">
                          <span id="render-progress-message">準備中...</span>
                          <span id="render-time-info">経過: 0秒</span>
                        </div>
                      </div>

                      <!-- 出力ファイル -->
                      <div id="render-outputs" class="bg-gray-50 rounded-lg p-4 hidden">
                        <h4 class="font-medium text-gray-900 mb-3">📥 出力ファイル</h4>
                        <div id="output-files" class="space-y-2">
                          <!-- ファイル一覧が動的に追加される -->
                        </div>
                      </div>

                      <!-- 統計情報 -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">📊 統計情報</h4>
                        <div class="space-y-2 text-sm text-gray-600">
                          <div class="flex justify-between">
                            <span>レシピ:</span>
                            <span id="render-recipe-title">-</span>
                          </div>
                          <div class="flex justify-between">
                            <span>推定時間:</span>
                            <span id="render-estimated-time">-</span>
                          </div>
                          <div class="flex justify-between">
                            <span>解像度:</span>
                            <span id="render-resolution">-</span>
                          </div>
                          <div class="flex justify-between">
                            <span>フレームレート:</span>
                            <span id="render-framerate">-</span>
                          </div>
                        </div>
                      </div>

                      <!-- レンダリングボタン -->
                      <div class="space-y-2">
                        <button id="start-render-btn" class="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 font-medium" disabled>
                          🎬 レンダリング開始
                        </button>
                        <p id="render-status-message" class="text-xs text-gray-500 text-center">
                          レシピタブでレシピを作成してください
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- QC Tab -->
                  <div id="qc-content" class="tab-content hidden">
                    <div class="space-y-4">
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-4">✅ 品質チェック結果</h4>
                        <div id="qc-results" class="space-y-3">
                          <!-- QC results will be populated here -->
                        </div>
                      </div>

                      <!-- Downloads -->
                      <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3">📥 出力ファイル</h4>
                        <div class="space-y-2">
                          <button class="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                            <span>台本.txt</span>
                            <span>📥</span>
                          </button>
                          <button class="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                            <span>字幕.srt</span>
                            <span>📥</span>
                          </button>
                          <button class="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 opacity-50 cursor-not-allowed">
                            <span>動画.mp4</span>
                            <span>⏱</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        \`;
        
        // Setup event listeners
        setupEventListeners();
      }
    };
    
    function setupTTSEvents() {
      let selectedVoice = null;
      let ttsRate = 1.0;
      let ttsPitch = 1.0;
      let ttsGenerated = false;
      
      // Voice selection
      document.querySelectorAll('.voice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Remove selection from all voices
          document.querySelectorAll('.voice-btn').forEach(b => {
            b.classList.remove('border-blue-300', 'bg-blue-50', 'text-blue-700');
            b.classList.add('border-gray-200', 'text-gray-700');
          });
          
          // Select clicked voice
          btn.classList.add('border-blue-300', 'bg-blue-50', 'text-blue-700');
          btn.classList.remove('border-gray-200', 'text-gray-700');
          
          selectedVoice = btn.id.includes('female') ? 'female' : 'male';
          console.log('Selected voice:', selectedVoice);
        });
      });
      
      // TTS settings sliders
      const rateSlider = document.getElementById('tts-rate');
      const rateValue = document.getElementById('tts-rate-value');
      const pitchSlider = document.getElementById('tts-pitch');
      const pitchValue = document.getElementById('tts-pitch-value');
      
      rateSlider.addEventListener('input', (e) => {
        ttsRate = parseFloat(e.target.value);
        rateValue.textContent = ttsRate.toFixed(1);
      });
      
      pitchSlider.addEventListener('input', (e) => {
        ttsPitch = parseFloat(e.target.value);
        pitchValue.textContent = ttsPitch.toFixed(1);
      });
      
      // Preview play
      document.getElementById('tts-preview-play').addEventListener('click', () => {
        const previewText = document.getElementById('tts-preview-text').textContent;
        
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(previewText);
          
          // Apply settings
          utterance.rate = ttsRate;
          utterance.pitch = ttsPitch;
          utterance.volume = 1.0;
          
          // Try to select appropriate voice
          const voices = speechSynthesis.getVoices();
          const japaneseVoice = voices.find(voice => 
            voice.lang.startsWith('ja') && 
            (selectedVoice === 'female' ? 
              voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('kyoko') :
              voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('takeshi'))
          ) || voices.find(voice => voice.lang.startsWith('ja'));
          
          if (japaneseVoice) {
            utterance.voice = japaneseVoice;
          }
          
          speechSynthesis.speak(utterance);
        } else {
          alert('お使いのブラウザはWeb Speech APIに対応していません');
        }
      });
      
      // Preview stop
      document.getElementById('tts-preview-stop').addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
        }
      });
      
      // TTS Generate
      document.getElementById('tts-generate').addEventListener('click', () => {
        const statusDiv = document.getElementById('tts-status');
        const generateBtn = document.getElementById('tts-generate');
        
        if (!selectedVoice) {
          statusDiv.textContent = '❌ 音声を選択してください';
          statusDiv.className = 'mt-2 text-sm text-red-600';
          return;
        }
        
        const scriptArea = document.getElementById('script-area');
        if (!scriptArea || !scriptArea.value.trim()) {
          statusDiv.textContent = '❌ 台本が入力されていません';
          statusDiv.className = 'mt-2 text-sm text-red-600';
          return;
        }
        
        // Start generation
        statusDiv.textContent = '🔄 音声生成中...';
        statusDiv.className = 'mt-2 text-sm text-blue-600';
        generateBtn.disabled = true;
        
        // Simulate TTS generation
        setTimeout(() => {
          ttsGenerated = true;
          statusDiv.textContent = '✅ 音声生成完了！';
          statusDiv.className = 'mt-2 text-sm text-green-600';
          generateBtn.disabled = false;
          
          // Update processing steps
          processingSteps[1].status = 'completed';
          updateProgressSteps();
          
          // Switch to progress tab
          document.getElementById('tab-progress').click();
        }, 3000);
      });
      
      // Update preview text when script changes
      const observer = new MutationObserver(() => {
        const scriptArea = document.getElementById('script-area');
        if (scriptArea) {
          const previewDiv = document.getElementById('tts-preview-text');
          if (previewDiv && scriptArea.value) {
            const lines = scriptArea.value.split('\\n').filter(line => 
              line.trim() && !line.startsWith('#')
            ).slice(0, 2);
            const preview = lines.join(' ').slice(0, 100);
            previewDiv.textContent = preview + (preview.length >= 100 ? '...' : '');
          }
        }
      });
      
      // Observe script area changes
      setTimeout(() => {
        const scriptArea = document.getElementById('script-area');
        if (scriptArea) {
          observer.observe(scriptArea, { 
            attributes: true, 
            childList: true, 
            subtree: true,
            characterData: true 
          });
          
          scriptArea.addEventListener('input', () => {
            const previewDiv = document.getElementById('tts-preview-text');
            if (previewDiv && scriptArea.value) {
              const lines = scriptArea.value.split('\\n').filter(line => 
                line.trim() && !line.startsWith('#')
              ).slice(0, 2);
              const preview = lines.join(' ').slice(0, 100);
              previewDiv.textContent = preview + (preview.length >= 100 ? '...' : '');
            }
          });
        }
      }, 1000);
      
      // Initialize default selection
      document.getElementById('voice-female-1').click();
    }

    function setupPreviewControlEvents() {
      // Tab switching
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Remove active state from all tabs
          document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active', 'bg-blue-100', 'text-blue-700');
            b.classList.add('text-gray-500');
          });
          
          // Hide all tab contents
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
          });
          
          // Show selected tab
          btn.classList.add('active', 'bg-blue-100', 'text-blue-700');
          btn.classList.remove('text-gray-500');
          
          const tabId = btn.id.replace('tab-', '');
          const content = document.getElementById(\`\${tabId}-content\`);
          if (content) {
            content.classList.remove('hidden');
          }
        });
      });
      
      // Processing steps management
      let processingSteps = [
        { id: 'script', name: '台本生成', status: 'completed', icon: '📝' },
        { id: 'tts', name: 'TTS生成', status: 'pending', icon: '🎧' },
        { id: 'video', name: '動画生成', status: 'pending', icon: '🎬' },
        { id: 'qc', name: '品質チェック', status: 'pending', icon: '✅' }
      ];
      
      function updateProgressSteps() {
        const container = document.getElementById('progress-steps');
        if (!container) return;
        
        container.innerHTML = processingSteps.map(step => {
          const statusIcon = step.status === 'completed' ? '✅' : 
                           step.status === 'processing' ? '🔄' : 
                           step.status === 'error' ? '❌' : '⏳';
          
          const progressWidth = step.status === 'completed' ? '100%' : 
                              step.status === 'processing' ? '60%' : '0%';
          
          const progressColor = step.status === 'completed' ? 'bg-green-500' :
                               step.status === 'processing' ? 'bg-blue-500' :
                               step.status === 'error' ? 'bg-red-500' : 'bg-gray-300';
          
          return \`
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0">\${statusIcon}</div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-900">\${step.name}</span>
                </div>
                <div class="mt-1 bg-gray-200 rounded-full h-1.5">
                  <div class="\${progressColor} h-1.5 rounded-full transition-all" style="width: \${progressWidth}"></div>
                </div>
              </div>
            </div>
          \`;
        }).join('');
      }
      
      // QC Results management
      function updateQCResults() {
        const container = document.getElementById('qc-results');
        if (!container) return;
        
        const qcResults = [
          { category: '台本品質', status: 'pass', message: '適切な長さと構成' },
          { category: 'SRT形式', status: 'warning', message: '一部の行が長すぎます' },
          { category: 'アセット品質', status: 'pass', message: '全アセットが利用可能' }
        ];
        
        container.innerHTML = qcResults.map(result => {
          const bgColor = result.status === 'pass' ? 'bg-green-50 border-green-200 text-green-700' :
                         result.status === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                         'bg-red-50 border-red-200 text-red-700';
          
          const icon = result.status === 'pass' ? '✅' : 
                      result.status === 'warning' ? '⚠️' : '❌';
          
          return \`
            <div class="p-3 rounded-lg border \${bgColor}">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-medium text-sm">\${result.category}</div>
                  <div class="text-sm mt-1">\${result.message}</div>
                </div>
                <div class="flex-shrink-0 ml-2">\${icon}</div>
              </div>
            </div>
          \`;
        }).join('');
      }
      
      // Start processing handler
      document.getElementById('start-processing').addEventListener('click', () => {
        console.log('Starting batch processing...');
        
        // Simulate TTS processing
        processingSteps[1].status = 'processing';
        updateProgressSteps();
        
        setTimeout(() => {
          processingSteps[1].status = 'completed';
          processingSteps[2].status = 'processing';
          updateProgressSteps();
        }, 3000);
        
        setTimeout(() => {
          processingSteps[2].status = 'completed';
          processingSteps[3].status = 'processing';
          updateProgressSteps();
        }, 8000);
        
        setTimeout(() => {
          processingSteps[3].status = 'completed';
          updateProgressSteps();
          updateQCResults();
          
          // Switch to QC tab
          document.getElementById('tab-qc').click();
        }, 10000);
      });
      
      // Media controls
      let isPlaying = false;
      let currentTime = 0;
      let totalTime = 120;
      let playInterval;
      
      const playBtn = document.getElementById('play-btn');
      const progressBar = document.getElementById('progress-bar');
      const currentTimeSpan = document.getElementById('current-time');
      
      playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? '⏸️' : '▶️';
        
        if (isPlaying) {
          playInterval = setInterval(() => {
            currentTime += 1;
            if (currentTime >= totalTime) {
              currentTime = 0;
              isPlaying = false;
              playBtn.textContent = '▶️';
              clearInterval(playInterval);
            }
            
            const progress = (currentTime / totalTime) * 100;
            progressBar.style.width = \`\${progress}%\`;
            
            const minutes = Math.floor(currentTime / 60);
            const seconds = currentTime % 60;
            currentTimeSpan.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
          }, 1000);
        } else {
          clearInterval(playInterval);
        }
      });
      
      // Initialize
      updateProgressSteps();
      updateQCResults();
    }

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
      
      // Setup preview control events
      setupPreviewControlEvents();
      
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
      
      // Update preview panel
      updatePreviewContent(script);
      updateStatistics(1, script.length);
    }
    
    function updatePreviewContent(script) {
      const previewDiv = document.querySelector('#script-preview .text-sm');
      if (previewDiv) {
        const lines = script.split('\\n').slice(0, 6);
        previewDiv.innerHTML = lines.map(line => \`<p class="mb-1">\${line}</p>\`).join('') + 
          (script.split('\\n').length > 6 ? '<p class="text-gray-500 italic">...</p>' : '');
      }
    }
    
    function updateStatistics(assetCount, charCount) {
      const assetCountDiv = document.getElementById('asset-count');
      const charCountDiv = document.getElementById('char-count');
      
      if (assetCountDiv) assetCountDiv.textContent = assetCount;
      if (charCountDiv) charCountDiv.textContent = charCount;
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
    
    // TTS関連の設定
    function setupTTSEvents() {
      const voiceSelect = document.getElementById('voice-select');
      const rateSlider = document.getElementById('rate-slider');
      const pitchSlider = document.getElementById('pitch-slider');
      const volumeSlider = document.getElementById('volume-slider');
      const rateValue = document.getElementById('rate-value');
      const pitchValue = document.getElementById('pitch-value');
      const volumeValue = document.getElementById('volume-value');
      const previewBtn = document.getElementById('preview-tts-btn');
      const generateTtsBtn = document.getElementById('generate-tts-btn');
      
      // 音声一覧の初期化
      function loadVoices() {
        const voices = window.speechSynthesis.getVoices();
        const japaneseVoices = voices.filter(voice => voice.lang.startsWith('ja'));
        
        voiceSelect.innerHTML = '<option value="">音声を選択してください</option>';
        
        if (japaneseVoices.length > 0) {
          japaneseVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
          });
        } else {
          voiceSelect.innerHTML = '<option value="">日本語音声が利用できません</option>';
        }
      }
      
      // 音声読み込み（ブラウザによって遅延が必要）
      if (window.speechSynthesis) {
        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = loadVoices;
        }
      }
      
      // スライダーの値表示更新
      rateSlider.addEventListener('input', () => {
        rateValue.textContent = rateSlider.value;
      });
      
      pitchSlider.addEventListener('input', () => {
        pitchValue.textContent = pitchSlider.value;
      });
      
      volumeSlider.addEventListener('input', () => {
        volumeValue.textContent = volumeSlider.value;
      });
      
      // プレビュー再生
      previewBtn.addEventListener('click', () => {
        const selectedVoiceIndex = voiceSelect.value;
        if (!selectedVoiceIndex) {
          alert('音声を選択してください');
          return;
        }
        
        const voices = window.speechSynthesis.getVoices();
        const japaneseVoices = voices.filter(voice => voice.lang.startsWith('ja'));
        const selectedVoice = japaneseVoices[parseInt(selectedVoiceIndex)];
        
        const utterance = new SpeechSynthesisUtterance('これはプレビューテストです。音声の設定を確認してください。');
        utterance.voice = selectedVoice;
        utterance.rate = parseFloat(rateSlider.value);
        utterance.pitch = parseFloat(pitchSlider.value);
        utterance.volume = parseFloat(volumeSlider.value);
        
        // 既存の音声を停止
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        
        previewBtn.textContent = '再生中...';
        previewBtn.disabled = true;
        
        utterance.onend = () => {
          previewBtn.textContent = 'プレビュー再生';
          previewBtn.disabled = false;
        };
        
        utterance.onerror = () => {
          previewBtn.textContent = 'プレビュー再生';
          previewBtn.disabled = false;
          alert('音声再生でエラーが発生しました');
        };
      });
      
      // TTS生成（実際のAPIではなくデモ用）
      generateTtsBtn.addEventListener('click', () => {
        const scriptArea = document.getElementById('script-area');
        const content = scriptArea.value;
        
        if (!content.trim()) {
          alert('台本が入力されていません');
          return;
        }
        
        const selectedVoiceIndex = voiceSelect.value;
        if (!selectedVoiceIndex) {
          alert('音声を選択してください');
          return;
        }
        
        generateTtsBtn.textContent = '生成中...';
        generateTtsBtn.disabled = true;
        
        // デモ用の処理（実際は音声ファイル生成）
        setTimeout(() => {
          generateTtsBtn.textContent = 'TTS音声生成';
          generateTtsBtn.disabled = false;
          
          // プレビューコントロールに結果を表示
          const processingSteps = document.getElementById('processing-steps');
          if (processingSteps) {
            const ttsStep = processingSteps.querySelector('[data-step="tts"]');
            if (ttsStep) {
              const status = ttsStep.querySelector('.status');
              const duration = ttsStep.querySelector('.duration');
              
              if (status) status.textContent = '完了';
              if (duration) duration.textContent = '推定 120.5秒';
              
              ttsStep.className = 'flex justify-between items-center p-2 bg-green-50 border border-green-200 rounded';
            }
          }
          
          alert('TTS音声生成が完了しました（デモ）\\n\\n実際の実装では音声ファイルが生成されます。');
        }, 2000);
      });
    }

    // レシピエンジンの設定
    function setupRecipeEvents() {
      let currentRecipe = null;
      let selectedTemplate = 'news-style';
      
      // テンプレート選択
      document.querySelectorAll('.template-option').forEach(option => {
        option.addEventListener('click', () => {
          // 選択状態のリセット
          document.querySelectorAll('.template-option').forEach(opt => {
            opt.classList.remove('border-purple-300', 'bg-purple-50');
            opt.classList.add('border-gray-200');
          });
          
          // 新しい選択
          option.classList.add('border-purple-300', 'bg-purple-50');
          option.classList.remove('border-gray-200');
          
          selectedTemplate = option.dataset.template;
          console.log('Selected template:', selectedTemplate);
        });
      });
      
      // レシピ作成ボタン
      document.getElementById('create-recipe-btn').addEventListener('click', () => {
        const scriptArea = document.getElementById('script-area');
        const videoTitle = document.getElementById('video-title').value;
        const videoDescription = document.getElementById('video-description').value;
        
        if (!scriptArea || !scriptArea.value.trim()) {
          alert('台本が入力されていません');
          return;
        }
        
        // レシピオブジェクト作成
        currentRecipe = {
          id: `recipe_${Date.now()}`,
          title: videoTitle,
          description: videoDescription,
          template: selectedTemplate,
          scriptContent: scriptArea.value,
          resolution: document.getElementById('resolution-select').value,
          frameRate: document.getElementById('framerate-select').value,
          quality: document.getElementById('quality-select').value,
          format: document.getElementById('format-select').value,
          createdAt: new Date(),
          steps: [
            { id: 'validate-assets', name: 'アセット検証', status: 'pending', progress: 0 },
            { id: 'generate-srt', name: 'SRT生成', status: 'pending', progress: 0 },
            { id: 'generate-tts', name: 'TTS音声生成', status: 'pending', progress: 0 },
            { id: 'prepare-media', name: 'メディア準備', status: 'pending', progress: 0 },
            { id: 'video-composition', name: '動画合成', status: 'pending', progress: 0 },
            { id: 'generate-thumbnail', name: 'サムネイル生成', status: 'pending', progress: 0 },
            { id: 'quality-check', name: '品質チェック', status: 'pending', progress: 0 },
            { id: 'export-files', name: 'ファイル出力', status: 'pending', progress: 0 }
          ]
        };
        
        // レシピ状態表示の更新
        const recipeStatus = document.getElementById('recipe-status');
        const recipeTitleDisplay = document.getElementById('recipe-title-display');
        const recipeDetails = document.getElementById('recipe-details');
        const executeBtn = document.getElementById('execute-recipe-btn');
        
        recipeStatus.classList.remove('hidden');
        recipeTitleDisplay.textContent = currentRecipe.title;
        recipeDetails.textContent = `作成: ${currentRecipe.createdAt.toLocaleString()} | テンプレート: ${selectedTemplate}`;
        executeBtn.disabled = false;
        
        // ステップ表示の更新
        const stepList = document.getElementById('recipe-step-list');
        stepList.innerHTML = currentRecipe.steps.map(step => `
          <div class="flex items-center gap-3 step-item" data-step-id="${step.id}">
            <div class="flex-shrink-0">
              <div class="step-icon w-4 h-4 rounded-full bg-gray-300"></div>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium step-name">${step.name}</span>
                <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 step-status">待機中</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="step-progress bg-gray-300 h-1.5 rounded-full w-0"></div>
              </div>
            </div>
          </div>
        `).join('');
        
        // 統計情報更新
        document.getElementById('recipe-asset-count').textContent = '1';
        document.getElementById('recipe-char-count').textContent = currentRecipe.scriptContent.length;
        document.getElementById('recipe-estimated-duration').textContent = Math.ceil(currentRecipe.scriptContent.length * 0.2) + '秒';
        
        alert('レシピが作成されました！\\n\\n「動画生成実行」ボタンで処理を開始できます。');
      });
      
      // レシピ実行ボタン
      document.getElementById('execute-recipe-btn').addEventListener('click', () => {
        if (!currentRecipe) {
          alert('レシピが作成されていません');
          return;
        }
        
        const executeBtn = document.getElementById('execute-recipe-btn');
        const currentStepDiv = document.getElementById('recipe-current-step');
        
        executeBtn.disabled = true;
        executeBtn.textContent = '🔄 実行中...';
        currentStepDiv.classList.remove('hidden');
        
        // ステップを順次実行（デモ用シミュレーション）
        executeRecipeSteps(currentRecipe, 0);
      });
      
      // レシピステップ実行のシミュレーション
      function executeRecipeSteps(recipe, stepIndex) {
        if (stepIndex >= recipe.steps.length) {
          // 全ステップ完了
          const executeBtn = document.getElementById('execute-recipe-btn');
          const currentStepDiv = document.getElementById('recipe-current-step');
          
          executeBtn.disabled = false;
          executeBtn.textContent = '✅ 完了';
          currentStepDiv.textContent = '🎉 動画生成完了！';
          
          setTimeout(() => {
            executeBtn.textContent = '🎬 動画生成実行';
            currentStepDiv.classList.add('hidden');
          }, 3000);
          
          return;
        }
        
        const step = recipe.steps[stepIndex];
        const stepElement = document.querySelector(`[data-step-id="${step.id}"]`);
        const stepIcon = stepElement.querySelector('.step-icon');
        const stepStatus = stepElement.querySelector('.step-status');
        const stepProgress = stepElement.querySelector('.step-progress');
        const currentStepDiv = document.getElementById('recipe-current-step');
        
        // ステップ開始
        step.status = 'running';
        stepIcon.className = 'step-icon w-4 h-4 rounded-full bg-blue-500';
        stepStatus.textContent = '実行中';
        stepStatus.className = 'text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 step-status';
        currentStepDiv.textContent = `${step.name}: 0%`;
        
        // プログレスバーアニメーション
        const duration = Math.random() * 2000 + 1000; // 1-3秒
        const intervals = 20;
        const intervalTime = duration / intervals;
        let progress = 0;
        
        const progressInterval = setInterval(() => {
          progress += 100 / intervals;
          step.progress = Math.min(progress, 100);
          stepProgress.style.width = `${step.progress}%`;
          stepProgress.className = 'step-progress bg-blue-500 h-1.5 rounded-full';
          currentStepDiv.textContent = `${step.name}: ${Math.round(step.progress)}%`;
          
          if (progress >= 100) {
            clearInterval(progressInterval);
            
            // ステップ完了
            step.status = 'completed';
            stepIcon.className = 'step-icon w-4 h-4 rounded-full bg-green-500';
            stepStatus.textContent = '完了';
            stepStatus.className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 step-status';
            stepProgress.className = 'step-progress bg-green-500 h-1.5 rounded-full';
            
            // 次のステップへ
            setTimeout(() => {
              executeRecipeSteps(recipe, stepIndex + 1);
            }, 300);
          }
        }, intervalTime);
      }
      
      // 初期統計情報の更新
      const updateRecipeStats = () => {
        const scriptArea = document.getElementById('script-area');
        if (scriptArea) {
          document.getElementById('recipe-char-count').textContent = scriptArea.value.length;
          document.getElementById('recipe-estimated-duration').textContent = Math.ceil(scriptArea.value.length * 0.2) + '秒';
        }
      };
      
      // 台本変更時の統計更新
      const scriptArea = document.getElementById('script-area');
      if (scriptArea) {
        scriptArea.addEventListener('input', updateRecipeStats);
      }
      
      // 初期状態の統計更新
      updateRecipeStats();
    }

    // レンダリングの設定
    function setupRenderEvents() {
      let isRendering = false;
      let currentRenderJob = null;
      let renderOutputs = [];
      let previewMode = 'video';
      
      // プレビューモード切り替え
      document.querySelectorAll('.preview-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // 選択状態のリセット
          document.querySelectorAll('.preview-mode-btn').forEach(b => {
            b.classList.remove('bg-blue-100', 'text-blue-700');
            b.classList.add('text-gray-500');
          });
          
          // 新しい選択
          btn.classList.add('bg-blue-100', 'text-blue-700');
          btn.classList.remove('text-gray-500');
          
          previewMode = btn.id.replace('preview-', '');
          updateRenderPreview();
        });
      });
      
      // レンダリング開始ボタン
      document.getElementById('start-render-btn').addEventListener('click', () => {
        if (isRendering) return;
        
        // レシピの確認
        if (!currentRecipe) {
          alert('レシピが作成されていません。\\nレシピタブでレシピを作成してください。');
          return;
        }
        
        startRendering();
      });
      
      // レンダリング実行
      async function startRendering() {
        isRendering = true;
        const startBtn = document.getElementById('start-render-btn');
        const progressSection = document.getElementById('render-progress-section');
        const statusMessage = document.getElementById('render-status-message');
        
        startBtn.textContent = '🔄 レンダリング中...';
        startBtn.disabled = true;
        progressSection.classList.remove('hidden');
        statusMessage.textContent = '';
        
        // レンダリングステップの定義
        const renderSteps = [
          { name: 'キャンバス設定', duration: 1000 },
          { name: '音声準備', duration: 800 },
          { name: 'フレーム生成', duration: 3000 },
          { name: '動画合成', duration: 2500 },
          { name: '音声合成', duration: 1500 },
          { name: '最終エンコード', duration: 2000 },
          { name: 'ファイル出力', duration: 1000 }
        ];
        
        let totalProgress = 0;
        const stepWeight = 100 / renderSteps.length;
        
        try {
          for (let i = 0; i < renderSteps.length; i++) {
            const step = renderSteps[i];
            
            updateRenderProgress(step.name, totalProgress, step.name + '中...');
            
            // ステップ実行シミュレーション
            await simulateRenderStep(step, (progress) => {
              const currentStepProgress = totalProgress + (progress * stepWeight / 100);
              updateRenderProgress(step.name, currentStepProgress, step.name + '中...');
            });
            
            totalProgress += stepWeight;
          }
          
          // レンダリング完了
          updateRenderProgress('完了', 100, 'レンダリングが完了しました！');
          
          // 出力ファイル生成
          generateRenderOutputs();
          
          // 完了状態に更新
          startBtn.textContent = '✅ 完了';
          startBtn.disabled = false;
          
          setTimeout(() => {
            startBtn.textContent = '🎬 レンダリング開始';
            progressSection.classList.add('hidden');
          }, 3000);
          
        } catch (error) {
          updateRenderProgress('エラー', 0, 'レンダリングでエラーが発生しました');
          startBtn.textContent = '🎬 レンダリング開始';
          startBtn.disabled = false;
          
          setTimeout(() => {
            progressSection.classList.add('hidden');
          }, 3000);
        }
        
        isRendering = false;
      }
      
      // レンダリングステップシミュレーション
      function simulateRenderStep(step, onProgress) {
        return new Promise((resolve) => {
          const intervals = 20;
          const intervalTime = step.duration / intervals;
          let progress = 0;
          
          const interval = setInterval(() => {
            progress += 100 / intervals;
            onProgress(Math.min(progress, 100));
            
            if (progress >= 100) {
              clearInterval(interval);
              resolve();
            }
          }, intervalTime);
        });
      }
      
      // プログレス更新
      function updateRenderProgress(step, progress, message) {
        document.getElementById('render-current-step').textContent = step;
        document.getElementById('render-progress-percent').textContent = Math.round(progress) + '%';
        document.getElementById('render-progress-bar').style.width = progress + '%';
        document.getElementById('render-progress-message').textContent = message;
        
        // 経過時間更新（簡易版）
        const timeInfo = document.getElementById('render-time-info');
        if (timeInfo) {
          const elapsed = Math.floor(Date.now() / 1000) % 3600; // デモ用
          timeInfo.textContent = `経過: ${elapsed}秒`;
        }
      }
      
      // 出力ファイル生成
      function generateRenderOutputs() {
        renderOutputs = [
          {
            type: 'video',
            filename: currentRecipe.title.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4',
            size: '15.2 MB',
            icon: '🎬',
            color: 'text-blue-500'
          },
          {
            type: 'audio',
            filename: currentRecipe.title.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3',
            size: '2.1 MB',
            icon: '🎵',
            color: 'text-green-500'
          },
          {
            type: 'subtitle',
            filename: currentRecipe.title.replace(/[^a-zA-Z0-9]/g, '_') + '.srt',
            size: '1.5 KB',
            icon: '📝',
            color: 'text-purple-500'
          },
          {
            type: 'thumbnail',
            filename: currentRecipe.title.replace(/[^a-zA-Z0-9]/g, '_') + '_thumb.png',
            size: '245 KB',
            icon: '🖼️',
            color: 'text-orange-500'
          },
          {
            type: 'script',
            filename: currentRecipe.title.replace(/[^a-zA-Z0-9]/g, '_') + '_script.txt',
            size: '2.8 KB',
            icon: '📄',
            color: 'text-gray-500'
          }
        ];
        
        const outputsSection = document.getElementById('render-outputs');
        const outputFilesList = document.getElementById('output-files');
        
        outputFilesList.innerHTML = renderOutputs.map(output => `
          <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div class="flex items-center gap-3">
              <span class="${output.color}">${output.icon}</span>
              <div>
                <div class="font-medium text-sm">${output.filename}</div>
                <div class="text-xs text-gray-500">${output.size}</div>
              </div>
            </div>
            <button onclick="downloadRenderFile('${output.filename}')" class="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              📥 DL
            </button>
          </div>
        `).join('');
        
        outputsSection.classList.remove('hidden');
        updateRenderPreview();
      }
      
      // プレビュー更新
      function updateRenderPreview() {
        const previewDiv = document.getElementById('render-preview');
        
        if (renderOutputs.length === 0) {
          previewDiv.innerHTML = `
            <div class="text-center text-gray-400">
              <div class="text-4xl mb-2">👁</div>
              <p class="text-sm">プレビューなし</p>
            </div>
          `;
          return;
        }
        
        switch (previewMode) {
          case 'video':
            previewDiv.innerHTML = `
              <div class="w-full h-full bg-black rounded-lg flex items-center justify-center">
                <div class="text-center text-white">
                  <div class="text-6xl mb-4">🎬</div>
                  <p class="text-sm">動画プレビュー</p>
                  <p class="text-xs text-gray-300 mt-1">${currentRecipe ? currentRecipe.title : ''}</p>
                  <div class="mt-4 flex justify-center space-x-2">
                    <button class="px-3 py-1 bg-blue-600 rounded text-xs">▶️ 再生</button>
                    <button class="px-3 py-1 bg-gray-600 rounded text-xs">⏸️ 停止</button>
                  </div>
                </div>
              </div>
            `;
            break;
            
          case 'audio':
            previewDiv.innerHTML = `
              <div class="w-full h-full bg-gradient-to-br from-purple-900 to-blue-900 rounded-lg flex items-center justify-center">
                <div class="text-center text-white">
                  <div class="text-6xl mb-4">🎵</div>
                  <p class="text-sm">音声プレビュー</p>
                  <div class="mt-4 w-48 h-2 bg-white bg-opacity-30 rounded-full mx-auto">
                    <div class="h-full bg-white rounded-full w-1/3"></div>
                  </div>
                  <p class="text-xs mt-2">00:45 / 02:15</p>
                </div>
              </div>
            `;
            break;
            
          case 'thumbnail':
            previewDiv.innerHTML = `
              <div class="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <div class="text-center text-white">
                  <div class="text-6xl mb-4">🖼️</div>
                  <p class="text-sm">サムネイルプレビュー</p>
                  <div class="mt-4 w-32 h-20 bg-gray-600 rounded mx-auto flex items-center justify-center">
                    <span class="text-xs">1920x1080</span>
                  </div>
                </div>
              </div>
            `;
            break;
        }
      }
      
      // レシピ更新時の統計情報更新
      const updateRenderStats = () => {
        const titleElement = document.getElementById('render-recipe-title');
        const timeElement = document.getElementById('render-estimated-time');
        const resolutionElement = document.getElementById('render-resolution');
        const framerateElement = document.getElementById('render-framerate');
        const startBtn = document.getElementById('start-render-btn');
        const statusMessage = document.getElementById('render-status-message');
        
        if (currentRecipe) {
          titleElement.textContent = currentRecipe.title;
          timeElement.textContent = Math.ceil(currentRecipe.scriptContent.length * 0.2) + '秒';
          resolutionElement.textContent = currentRecipe.resolution || '1920x1080';
          framerateElement.textContent = (currentRecipe.frameRate || 30) + ' FPS';
          
          startBtn.disabled = false;
          statusMessage.textContent = '設定を確認してレンダリングを開始してください';
        } else {
          titleElement.textContent = '-';
          timeElement.textContent = '-';
          resolutionElement.textContent = '-';
          framerateElement.textContent = '-';
          
          startBtn.disabled = true;
          statusMessage.textContent = 'レシピタブでレシピを作成してください';
        }
      };
      
      // 初期統計更新
      updateRenderStats();
      
      // レシピ変更の監視（グローバル変数を監視）
      setInterval(() => {
        updateRenderStats();
      }, 1000);
    }

    // ダウンロード関数（グローバル）
    window.downloadRenderFile = function(filename) {
      // 実際の実装では、ファイルのBlobURLを使用
      const link = document.createElement('a');
      link.download = filename;
      
      // デモ用のダミーデータ作成
      let content = '';
      if (filename.includes('.txt') || filename.includes('.srt')) {
        content = currentRecipe ? currentRecipe.scriptContent || 'デモファイル内容' : 'デモファイル内容';
      } else {
        content = 'バイナリファイル（デモ）';
      }
      
      const blob = new Blob([content], { type: 'text/plain' });
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      
      // ダウンロード完了メッセージ
      const statusMessage = document.getElementById('render-status-message');
      if (statusMessage) {
        statusMessage.textContent = `✅ ${filename} をダウンロードしました`;
        statusMessage.className = 'text-xs text-green-600 text-center';
        
        setTimeout(() => {
          statusMessage.textContent = '設定を確認してレンダリングを開始してください';
          statusMessage.className = 'text-xs text-gray-500 text-center';
        }, 3000);
      }
    };

    // Start the app
    mockApp.render();
    
    // Initialize TTS events after DOM is ready
    setTimeout(() => {
      setupTTSEvents();
      setupRecipeEvents();
      setupRenderEvents();
    }, 100);
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