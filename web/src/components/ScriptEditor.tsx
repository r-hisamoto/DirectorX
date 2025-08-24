import React, { useRef, useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  FileText, 
  Hash, 
  Scissors, 
  Volume2, 
  RotateCcw,
  Save,
  Clock,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { 
  splitLineAtCursor, 
  replacePunctuation, 
  adjustSrtTiming,
  TextEditorUtils 
} from '@/lib/shortcuts';
import { formatSrt, textToSimpleSrt } from '@/lib/srt';
import { generateScriptFromAssets, generateSrtFromAssets, type ScriptGenerationOptions } from '@/lib/scriptGeneration';

import type { Asset } from '@/types/asset';

interface ScriptEditorProps {
  initialContent?: string;
  selectedAssets?: Asset[];
  onChange?: (content: string) => void;
  onGenerate?: (type: 'summary' | 'script' | '5ch-comments' | 'srt') => void;
}

export function ScriptEditor({ 
  initialContent = '', 
  selectedAssets = [],
  onChange, 
  onGenerate 
}: ScriptEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<'script' | 'srt'>('script');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStyle, setGenerationStyle] = useState<'commentary' | 'news' | 'discussion' | 'narrative'>('commentary');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // アセット選択時の自動台本生成
  useEffect(() => {
    if (selectedAssets.length > 0) {
      handleAutoGenerate();
    }
  }, [selectedAssets]);

  // 自動台本生成
  const handleAutoGenerate = async () => {
    if (selectedAssets.length === 0) return;
    
    setIsGenerating(true);
    try {
      // 少し遅延を入れてUIの反応を見せる
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const generatedScript = generateScriptFromAssets(selectedAssets, {
        style: generationStyle,
        includeSourceInfo: true,
        maxLength: 3000
      });
      
      handleContentChange(generatedScript);
    } catch (error) {
      console.error('Script generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // テキスト変更ハンドラ
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onChange?.(newContent);
  };

  // ショートカット: 行分割 (Ctrl+Enter)
  useHotkeys('ctrl+enter', (e) => {
    e.preventDefault();
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      splitLineAtCursor(textareaRef.current);
      handleContentChange(textareaRef.current.value);
    }
  });

  // ショートカット: 句読点置換 (⌘+Shift+P)
  useHotkeys('mod+shift+p', (e) => {
    e.preventDefault();
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      replacePunctuation(textareaRef.current);
      handleContentChange(textareaRef.current.value);
    }
  });

  // ショートカット: 見出し挿入 (⌘+Shift+H)
  useHotkeys('mod+shift+h', (e) => {
    e.preventDefault();
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      TextEditorUtils.wrapCurrentLine(textareaRef.current, '## ', '');
      handleContentChange(textareaRef.current.value);
    }
  });

  // ショートカット: SRT整形 (⌘+Shift+F)
  useHotkeys('mod+shift+f', (e) => {
    e.preventDefault();
    if (mode === 'srt' && content.trim()) {
      try {
        const formatted = formatSrt(content);
        handleContentChange(formatted);
      } catch (error) {
        console.error('SRT formatting error:', error);
      }
    }
  });

  // ショートカット: タイミング調整 +100ms (⌘++)
  useHotkeys('mod+plus', (e) => {
    e.preventDefault();
    if (mode === 'srt' && content.trim()) {
      const adjusted = adjustSrtTiming(content, 100);
      handleContentChange(adjusted);
    }
  });

  // ショートカット: タイミング調整 -100ms (⌘+-)
  useHotkeys('mod+minus', (e) => {
    e.preventDefault();
    if (mode === 'srt' && content.trim()) {
      const adjusted = adjustSrtTiming(content, -100);
      handleContentChange(adjusted);
    }
  });

  // 生成ボタンのハンドラ
  const handleGenerate = async (type: 'summary' | 'script' | '5ch-comments' | 'srt' | 'from-assets') => {
    onGenerate?.(type);
    setIsGenerating(true);
    
    try {
      // 少し遅延を入れてUIの反応を見せる
      await new Promise(resolve => setTimeout(resolve, 300));
      
      switch (type) {
        case 'from-assets':
          if (selectedAssets.length > 0) {
            const generatedScript = generateScriptFromAssets(selectedAssets, {
              style: generationStyle,
              includeSourceInfo: true,
              maxLength: 3000
            });
            handleContentChange(generatedScript);
          }
          break;
          
        case 'summary':
          if (selectedAssets.length > 0) {
            // アセットから要旨生成
            const summary = generateScriptFromAssets(selectedAssets, {
              style: 'news',
              includeSourceInfo: false,
              maxLength: 800
            });
            handleContentChange('# 要旨\n\n' + summary);
          } else {
            // 既存コンテンツから要旨生成
            handleContentChange('# 要旨\n\n' + content.slice(0, 200) + '...\n\n## 主なポイント\n\n1. ポイント1\n2. ポイント2\n3. ポイント3');
          }
          break;
          
        case 'script':
          if (selectedAssets.length > 0) {
            const script = generateScriptFromAssets(selectedAssets, {
              style: generationStyle,
              includeSourceInfo: true,
              maxLength: 3000
            });
            handleContentChange(script);
          } else {
            handleContentChange('# 台本タイトル\n\n## イントロ\n\nこんにちは、今回は...\n\n## 本編\n\n' + content + '\n\n## まとめ\n\n以上、ご視聴ありがとうございました。');
          }
          break;
          
        case '5ch-comments':
          // 5chアセットがある場合はその内容から、ない場合はデモ生成
          const fivechAssets = selectedAssets.filter(a => a.source === '5ch');
          if (fivechAssets.length > 0) {
            const comments = fivechAssets[0].metadata?.threadMetadata?.posts || [];
            if (comments.length > 0) {
              const formattedComments = comments.slice(0, 5).map(post => 
                `${post.number} ${post.name} ${post.date} ID:${post.id}\n${post.content}`
              ).join('\n\n');
              handleContentChange(formattedComments);
            }
          } else {
            const comments = [
              '1 名無しさん sage 2024/01/01(月) 12:00:00.00 ID:abcd1234\nこれはいいネタだな',
              '2 名無しさん 2024/01/01(月) 12:01:00.00 ID:efgh5678\nソース確認した。マジじゃん',
              '3 名無しさん sage 2024/01/01(月) 12:02:00.00 ID:ijkl9012\n>>1\n詳しく頼む'
            ];
            handleContentChange(comments.join('\n\n'));
          }
          break;
          
        case 'srt':
          if (selectedAssets.length > 0) {
            // アセットから直接SRT生成
            const srt = generateSrtFromAssets(selectedAssets, {
              wordsPerMinute: 120
            });
            handleContentChange(srt);
            setMode('srt');
          } else if (content.trim()) {
            // 既存コンテンツをSRT化
            const srt = textToSimpleSrt(content, 120);
            handleContentChange(srt);
            setMode('srt');
          }
          break;
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* ツールバー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {/* モード切り替え */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('script')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                mode === 'script'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              台本
            </button>
            <button
              onClick={() => setMode('srt')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                mode === 'srt'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              SRT
            </button>
          </div>

          {/* スタイル選択 */}
          {selectedAssets.length > 0 && (
            <select
              value={generationStyle}
              onChange={(e) => setGenerationStyle(e.target.value as any)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="commentary">解説系</option>
              <option value="news">ニュース系</option>
              <option value="discussion">討論系</option>
              <option value="narrative">物語系</option>
            </select>
          )}

          {/* アセット選択状況 */}
          {selectedAssets.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span>{selectedAssets.length}件選択中</span>
              {isGenerating && (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              )}
            </div>
          )}
        </div>

        {/* 生成ボタン */}
        <div className="flex items-center space-x-2">
          {mode === 'script' ? (
            <>
              {selectedAssets.length > 0 && (
                <button
                  onClick={() => handleGenerate('from-assets')}
                  disabled={isGenerating}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>アセットから生成</span>
                </button>
              )}
              <button
                onClick={() => handleGenerate('summary')}
                disabled={isGenerating}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 rounded-md"
              >
                <FileText className="w-4 h-4" />
                <span>要旨</span>
              </button>
              <button
                onClick={() => handleGenerate('script')}
                disabled={isGenerating}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 rounded-md"
              >
                <FileText className="w-4 h-4" />
                <span>台本</span>
              </button>
              <button
                onClick={() => handleGenerate('5ch-comments')}
                disabled={isGenerating}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 rounded-md"
              >
                <Hash className="w-4 h-4" />
                <span>5ch</span>
              </button>
              <button
                onClick={() => handleGenerate('srt')}
                disabled={isGenerating}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-white bg-brand-primary hover:bg-yellow-500 disabled:opacity-50 rounded-md"
              >
                <Scissors className="w-4 h-4" />
                <span>SRT化</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  try {
                    const formatted = formatSrt(content);
                    handleContentChange(formatted);
                  } catch (error) {
                    console.error('SRT formatting error:', error);
                  }
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <Scissors className="w-4 h-4" />
                <span>整形</span>
              </button>
              <button
                onClick={() => {
                  const adjusted = adjustSrtTiming(content, 100);
                  handleContentChange(adjusted);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <Clock className="w-4 h-4" />
                <span>+100ms</span>
              </button>
              <button
                onClick={() => {
                  const adjusted = adjustSrtTiming(content, -100);
                  handleContentChange(adjusted);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <Clock className="w-4 h-4" />
                <span>-100ms</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* エディタエリア */}
      <div className="flex-1 p-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full h-full resize-none border-0 focus:ring-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 font-jp"
          placeholder={
            mode === 'script' 
              ? "台本を入力するか、素材から生成してください...\n\n⌘+Shift+H: 見出し挿入\nCtrl+Enter: 行分割\n⌘+Shift+P: 句読点置換"
              : "SRTを入力するか、台本から生成してください...\n\n⌘+Shift+F: SRT整形\n⌘++: +100ms調整\n⌘+-: -100ms調整"
          }
          spellCheck={false}
        />
      </div>

      {/* ステータスバー */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>文字数: {content.length}</span>
            <span>行数: {content.split('\n').length}</span>
            {mode === 'srt' && (
              <span>エントリ数: {content.match(/^\d+$/gm)?.length || 0}</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>モード: {mode === 'script' ? '台本' : 'SRT'}</span>
            {content && (
              <Save className="w-3 h-3 text-green-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}