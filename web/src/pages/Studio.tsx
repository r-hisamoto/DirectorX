import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { ScriptEditor } from '@/components/ScriptEditor';
import { AssetTray } from '@/components/AssetTray';
import { PreviewControl } from '@/components/PreviewControl';
import type { Asset } from '@/types/asset';

export function Studio() {
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [scriptContent, setScriptContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleAssetSelect = (asset: Asset | Asset[]) => {
    const assetsArray = Array.isArray(asset) ? asset : [asset];
    setSelectedAssets(assetsArray);
    console.log('Selected assets:', assetsArray);
  };

  const handleScriptChange = (content: string) => {
    setScriptContent(content);
    console.log('Content changed:', content.length, 'chars');
  };

  const handleStartProcessing = () => {
    console.log('Starting processing pipeline...');
    setIsGenerating(true);
    
    // 10秒後にリセット（デモ用）
    setTimeout(() => {
      setIsGenerating(false);
    }, 10000);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Main content - 3 column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Asset Tray */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <AssetTray
            onAssetSelect={handleAssetSelect}
            selectedAssets={selectedAssets}
            multiSelect={true}
          />
        </div>

        {/* Center: Script Editor */}
        <div className="flex-1 bg-white dark:bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
          <ScriptEditor
            initialContent={selectedAssets.length === 0 ? 
              "# DirectorX Studio\n\n左の素材トレイからアセットを選択すると、自動で台本が生成されます。\n\n## 機能\n\n- 📱 URL貼り付けでアセット取得（5ch、X/Twitter、YouTube対応）\n- 📁 ファイルドラッグ&ドロップ\n- ✨ 選択アセットから自動台本生成\n- 📝 リアルタイム編集とショートカット\n- 🎬 日本語SRT生成\n\n## ショートカットキー\n\n- ⌘+K: コマンドパレット\n- ⌘+Shift+H: 見出し挿入\n- Ctrl+Enter: 行分割\n- ⌘+Shift+P: 句読点置換\n\n### SRTモード\n\n- ⌘+Shift+F: 整形\n- ⌘++: +100ms調整\n- ⌘+-: -100ms調整" : 
              undefined
            }
            selectedAssets={selectedAssets}
            onChange={handleScriptChange}
            onGenerate={(type) => console.log('Generate:', type)}
          />
        </div>

        {/* Right: Preview & Controls */}
        <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <PreviewControl
            scriptContent={scriptContent}
            selectedAssets={selectedAssets}
            isGenerating={isGenerating}
            onStartProcessing={handleStartProcessing}
          />
        </div>
      </div>
    </div>
  );
}