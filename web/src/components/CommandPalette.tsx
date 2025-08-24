import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Search, 
  Plus, 
  FileText, 
  Hash, 
  Scissors, 
  Volume2, 
  Play,
  Settings,
  Palette,
  Clock,
  RotateCcw
} from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords: string[];
  icon?: React.ReactNode;
  action: () => void;
  category: 'asset' | 'script' | 'srt' | 'audio' | 'video' | 'system';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand?: (command: Command) => void;
}

export function CommandPalette({ isOpen, onClose, onCommand }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // デフォルトコマンド定義
  const commands: Command[] = useMemo(() => [
    // 素材関連
    {
      id: 'add-asset-url',
      label: '素材を追加 (URL)',
      description: 'URLから素材を取得',
      keywords: ['素材', '追加', 'url', 'asset', 'add'],
      icon: <Plus className="w-4 h-4" />,
      action: () => console.log('Add asset from URL'),
      category: 'asset',
    },
    {
      id: 'add-asset-5ch',
      label: '5chスレッドを追加',
      description: '5chからスレッド本文/レスを取得',
      keywords: ['5ch', '2ch', 'スレッド', 'レス', '掲示板'],
      icon: <Hash className="w-4 h-4" />,
      action: () => console.log('Add 5ch thread'),
      category: 'asset',
    },
    {
      id: 'add-asset-x',
      label: 'X（Twitter）ポストを追加',
      description: 'Xからポスト本文/画像を取得',
      keywords: ['twitter', 'x', 'ツイッター', 'ポスト', 'tweet'],
      icon: <Hash className="w-4 h-4" />,
      action: () => console.log('Add X post'),
      category: 'asset',
    },
    
    // 台本関連
    {
      id: 'generate-script-summary',
      label: '要旨を生成',
      description: '素材から要旨を自動生成',
      keywords: ['要旨', '生成', 'summary', '台本', 'script'],
      icon: <FileText className="w-4 h-4" />,
      action: () => console.log('Generate summary'),
      category: 'script',
    },
    {
      id: 'generate-script-full',
      label: '台本を生成',
      description: '2000〜3000字の台本を生成',
      keywords: ['台本', '生成', 'script', '文章', 'シナリオ'],
      icon: <FileText className="w-4 h-4" />,
      action: () => console.log('Generate script'),
      category: 'script',
    },
    {
      id: 'generate-5ch-comments',
      label: '5chコメントを生成',
      description: '台本から5ch風コメント30件を生成',
      keywords: ['5ch', 'コメント', '生成', 'レス', '掲示板'],
      icon: <Hash className="w-4 h-4" />,
      action: () => console.log('Generate 5ch comments'),
      category: 'script',
    },
    
    // SRT関連
    {
      id: 'format-srt',
      label: 'SRTを整形',
      description: '20字折返し+禁則処理を適用',
      keywords: ['srt', '整形', '字幕', 'format', '禁則'],
      icon: <Scissors className="w-4 h-4" />,
      action: () => console.log('Format SRT'),
      category: 'srt',
    },
    {
      id: 'srt-adjust-timing',
      label: 'タイミング調整 (+100ms)',
      description: 'SRTのタイミングを100ms後ろにずらす',
      keywords: ['srt', 'タイミング', '調整', '+100ms', 'timing'],
      icon: <Clock className="w-4 h-4" />,
      action: () => console.log('Adjust SRT timing +100ms'),
      category: 'srt',
    },
    {
      id: 'srt-adjust-timing-minus',
      label: 'タイミング調整 (-100ms)',
      description: 'SRTのタイミングを100ms前にずらす',
      keywords: ['srt', 'タイミング', '調整', '-100ms', 'timing'],
      icon: <Clock className="w-4 h-4" />,
      action: () => console.log('Adjust SRT timing -100ms'),
      category: 'srt',
    },
    
    // 音声関連
    {
      id: 'generate-tts',
      label: 'TTSを生成',
      description: '台本から日本語音声を生成',
      keywords: ['tts', '音声', '生成', 'voice', 'audio'],
      icon: <Volume2 className="w-4 h-4" />,
      action: () => console.log('Generate TTS'),
      category: 'audio',
    },
    
    // 動画関連
    {
      id: 'render-video',
      label: '動画をレンダリング',
      description: 'レシピを適用して動画を生成',
      keywords: ['動画', 'レンダリング', 'render', '生成', 'video'],
      icon: <Play className="w-4 h-4" />,
      action: () => console.log('Render video'),
      category: 'video',
    },
    {
      id: 'retry-render',
      label: 'レンダリング再実行',
      description: '失敗したレンダリングを再実行',
      keywords: ['再実行', 'retry', 'レンダリング', '再試行'],
      icon: <RotateCcw className="w-4 h-4" />,
      action: () => console.log('Retry render'),
      category: 'video',
    },
    
    // システム関連
    {
      id: 'open-settings',
      label: '設定を開く',
      description: 'アプリケーション設定',
      keywords: ['設定', 'settings', '環境設定', 'preferences'],
      icon: <Settings className="w-4 h-4" />,
      action: () => console.log('Open settings'),
      category: 'system',
    },
    {
      id: 'switch-brandkit',
      label: 'ブランドキットを切り替え',
      description: '別のブランドキットに切り替え',
      keywords: ['ブランドキット', '切り替え', 'brandkit', 'switch'],
      icon: <Palette className="w-4 h-4" />,
      action: () => console.log('Switch brandkit'),
      category: 'system',
    },
  ], []);

  // 検索結果のフィルタリング
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    
    const searchLower = search.toLowerCase();
    return commands.filter(command => 
      command.label.toLowerCase().includes(searchLower) ||
      command.description?.toLowerCase().includes(searchLower) ||
      command.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
    );
  }, [commands, search]);

  // カテゴリ別グループ化
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    
    filteredCommands.forEach(command => {
      if (!groups[command.category]) {
        groups[command.category] = [];
      }
      groups[command.category].push(command);
    });
    
    return groups;
  }, [filteredCommands]);

  const categoryNames: Record<string, string> = {
    asset: '素材',
    script: '台本',
    srt: '字幕',
    audio: '音声',
    video: '動画',
    system: 'システム',
  };

  // キーボードナビゲーション
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
      return;
    }
    
    // フォーカス設定
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // キーボードイベントハンドリング
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleCommandSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  const handleCommandSelect = (command: Command) => {
    command.action();
    onCommand?.(command);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        {/* 検索入力 */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="コマンドを検索... (例: 台本生成, SRT整形)"
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
          />
          <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
            Esc
          </kbd>
        </div>

        {/* コマンドリスト */}
        <div 
          ref={listRef}
          className="max-h-96 overflow-y-auto scrollbar-thin"
        >
          {Object.entries(groupedCommands).length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              コマンドが見つかりませんでした
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700">
                  {categoryNames[category] || category}
                </div>
                {categoryCommands.map((command, index) => {
                  const globalIndex = filteredCommands.findIndex(c => c.id === command.id);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <button
                      key={command.id}
                      onClick={() => handleCommandSelect(command)}
                      className={`w-full px-4 py-3 flex items-center space-x-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        isSelected ? 'bg-brand-primary bg-opacity-10 dark:bg-brand-primary dark:bg-opacity-20' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 text-gray-400">
                        {command.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {command.label}
                        </div>
                        {command.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {command.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <kbd className="px-1 bg-white dark:bg-gray-600 rounded">↑↓</kbd>
                <span className="ml-1">移動</span>
              </span>
              <span className="flex items-center">
                <kbd className="px-1 bg-white dark:bg-gray-600 rounded">Enter</kbd>
                <span className="ml-1">実行</span>
              </span>
            </div>
            <span>{filteredCommands.length} 件のコマンド</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// コマンドパレット用フック
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  // ⌘K (Cmd+K) または Ctrl+K でコマンドパレットを開く
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setIsOpen(true);
  }, { enableOnFormTags: ['INPUT', 'TEXTAREA'] });

  // ESC でコマンドパレットを閉じる
  useHotkeys('escape', () => {
    setIsOpen(false);
  }, { enableOnFormTags: ['INPUT', 'TEXTAREA'], enabled: isOpen });

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}