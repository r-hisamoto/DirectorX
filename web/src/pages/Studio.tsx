import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { ScriptEditor } from '@/components/ScriptEditor';
import { AssetTray } from '@/components/AssetTray';
import type { Asset } from '@/types/asset';

export function Studio() {
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  
  const handleAssetSelect = (asset: Asset | Asset[]) => {
    const assetsArray = Array.isArray(asset) ? asset : [asset];
    setSelectedAssets(assetsArray);
    // TODO: Auto-populate script editor with selected assets
    console.log('Selected assets:', assetsArray);
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
            initialContent="# サンプル台本\n\nここに台本を入力するか、素材から生成できます。\n\nショートカットキーを使って効率的に編集しましょう：\n- ⌘+K: コマンドパレット\n- ⌘+Shift+H: 見出し挿入\n- Ctrl+Enter: 行分割\n- ⌘+Shift+P: 句読点置換\n\nSRTモードでは：\n- ⌘+Shift+F: 整形\n- ⌘++: +100ms調整\n- ⌘+-: -100ms調整"
            onChange={(content) => console.log('Content changed:', content.length, 'chars')}
            onGenerate={(type) => console.log('Generate:', type)}
          />
        </div>

        {/* Right: Preview & Controls */}
        <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              プレビュー/制御
            </h2>
          </div>
          <div className="flex-1 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              近似プレビュー、進捗管理、バッチ実行、QC結果
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}