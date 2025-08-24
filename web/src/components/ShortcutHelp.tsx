import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { formatShortcut, getShortcutHelp } from '@/lib/shortcuts';

interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps) {
  const shortcutCategories = getShortcutHelp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              ショートカットキー
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ショートカット一覧 */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {shortcutCategories.map((category) => (
              <div key={category.name} className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.description}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {shortcut.description}
                        </div>
                        {shortcut.global && (
                          <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                            グローバル
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <kbd className="px-3 py-1.5 text-sm font-mono text-gray-700 bg-white dark:bg-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm">
                          {formatShortcut(shortcut.keys)}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* 使用方法の説明 */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              使用方法のヒント
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• ⌘ はMacでは Cmd キー、WindowsとLinuxでは Ctrl キーを表します</li>
              <li>• 「グローバル」と表示されているショートカットは、フォーム入力中でも使用できます</li>
              <li>• エディタ系のショートカットは、台本エディタにフォーカスがある時に使用できます</li>
              <li>• メディア系のショートカットは、プレビューエリアにフォーカスがある時に使用できます</li>
            </ul>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              ショートカットキーを使って効率的に作業しましょう
            </div>
            <div className="flex items-center space-x-2">
              <span>ヘルプを閉じる:</span>
              <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded">Esc</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}