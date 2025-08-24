import React, { useState } from 'react';
import { formatSrt, textToSimpleSrt, parseSrt } from '@/lib/srt';

export function SrtDemo() {
  const [inputText, setInputText] = useState('これは、非常に長いテキストです。句読点が行頭に来ないようにします。「括弧」や【記号】も適切に処理されます！このように、長い文章でも美しい字幕として表示できます。');
  const [formattedSrt, setFormattedSrt] = useState('');
  
  const handleFormat = () => {
    try {
      const srt = textToSimpleSrt(inputText, 120);
      const formatted = formatSrt(srt, { maxZenkaku: 20 });
      setFormattedSrt(formatted);
    } catch (error) {
      console.error('SRT formatting error:', error);
      setFormattedSrt('エラーが発生しました：' + error.message);
    }
  };

  const handleFormatExisting = () => {
    try {
      const formatted = formatSrt(inputText, { maxZenkaku: 20 });
      setFormattedSrt(formatted);
    } catch (error) {
      console.error('SRT formatting error:', error);
      setFormattedSrt('エラーが発生しました：' + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-jp">
          日本語SRT整形デモ
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              入力テキスト（または既存SRT）
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:text-white font-jp"
              placeholder="テキストまたはSRTを入力してください..."
            />
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={handleFormat}
              className="px-4 py-2 bg-brand-primary text-black font-medium rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
            >
              テキストからSRT生成
            </button>
            <button
              onClick={handleFormatExisting}
              className="px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              既存SRTを整形
            </button>
          </div>
          
          {formattedSrt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                整形後のSRT
              </label>
              <pre className="w-full p-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">
                {formattedSrt}
              </pre>
              
              {/* 統計情報 */}
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex space-x-4">
                  <span>エントリ数: {formattedSrt ? parseSrt(formattedSrt).length : 0}</span>
                  <span>文字数: {formattedSrt.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 機能説明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
          機能説明
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• 全角20文字で自動折り返し（半角文字は0.5幅として計算）</li>
          <li>• 行頭禁則：句読点「、。！？」などが行頭に来ないよう調整</li>
          <li>• 行末禁則：開き括弧「（【『」などが行末に来ないよう調整</li>
          <li>• SRTフォーマットの維持：タイムコードと構造を保持</li>
        </ul>
      </div>
    </div>
  );
}