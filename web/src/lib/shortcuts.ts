// ショートカットキーの定義と管理

export interface Shortcut {
  id: string;
  keys: string;
  description: string;
  action: () => void;
  category: 'editor' | 'srt' | 'media' | 'system';
  global?: boolean; // グローバルショートカット（フォーム内でも有効）
}

export interface ShortcutCategory {
  name: string;
  description: string;
  shortcuts: Shortcut[];
}

// ショートカットのヘルプ情報
export const shortcutCategories: Omit<ShortcutCategory, 'shortcuts'>[] = [
  {
    name: 'システム',
    description: 'アプリケーション全体の操作',
  },
  {
    name: 'エディタ',
    description: '台本エディタでの編集操作',
  },
  {
    name: '字幕',
    description: 'SRT字幕の編集操作',
  },
  {
    name: 'メディア',
    description: '音声・動画の制御',
  },
];

// キーの表示名変換
export const keyDisplayNames: Record<string, string> = {
  'mod': '⌘', // Mac: Cmd, Windows/Linux: Ctrl
  'cmd': '⌘',
  'ctrl': 'Ctrl',
  'alt': 'Alt',
  'shift': '⇧',
  'enter': 'Enter',
  'escape': 'Esc',
  'backspace': '⌫',
  'delete': 'Del',
  'tab': 'Tab',
  'space': 'Space',
  'up': '↑',
  'down': '↓',
  'left': '←',
  'right': '→',
  'plus': '+',
  'minus': '-',
};

/**
 * ショートカットキーを表示用の形式に変換
 */
export function formatShortcut(keys: string): string {
  return keys
    .split('+')
    .map(key => keyDisplayNames[key.toLowerCase()] || key.toUpperCase())
    .join(' + ');
}

/**
 * テキストエリアでの行分割機能
 */
export function splitLineAtCursor(textarea: HTMLTextAreaElement): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const beforeCursor = value.slice(0, selectionStart);
  const afterCursor = value.slice(selectionEnd);
  
  // カーソル位置で改行を挿入
  const newValue = beforeCursor + '\n' + afterCursor;
  const newCursorPos = selectionStart + 1;
  
  textarea.value = newValue;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  // 変更イベントを発火
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * テキストエリアでの句点置換機能
 */
export function replacePunctuation(textarea: HTMLTextAreaElement): void {
  const { selectionStart, selectionEnd, value } = textarea;
  
  // 選択範囲または全体のテキストを対象
  const targetText = selectionStart !== selectionEnd 
    ? value.slice(selectionStart, selectionEnd)
    : value;
  
  // 句点の置換パターン
  const replacements: [RegExp, string][] = [
    [/、/g, '，'], // 読点を全角コンマに
    [/。/g, '．'], // 句点を全角ピリオドに
    [/！/g, '!'],  // 全角感嘆符を半角に
    [/？/g, '?'],  // 全角疑問符を半角に
  ];
  
  let replacedText = targetText;
  replacements.forEach(([pattern, replacement]) => {
    replacedText = replacedText.replace(pattern, replacement);
  });
  
  // 変更があった場合のみ更新
  if (replacedText !== targetText) {
    const newValue = selectionStart !== selectionEnd
      ? value.slice(0, selectionStart) + replacedText + value.slice(selectionEnd)
      : replacedText;
    
    textarea.value = newValue;
    
    // カーソル位置を調整
    if (selectionStart !== selectionEnd) {
      const newSelectionEnd = selectionStart + replacedText.length;
      textarea.setSelectionRange(selectionStart, newSelectionEnd);
    }
    
    // 変更イベントを発火
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * SRTタイムコードの調整（±100ms）
 */
export function adjustSrtTiming(srtText: string, offsetMs: number): string {
  return srtText.replace(
    /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g,
    (match, hours, minutes, seconds, milliseconds) => {
      const totalMs = 
        parseInt(hours) * 3600000 +
        parseInt(minutes) * 60000 +
        parseInt(seconds) * 1000 +
        parseInt(milliseconds) +
        offsetMs;
      
      // 負の値は0にクランプ
      const clampedMs = Math.max(0, totalMs);
      
      const newHours = Math.floor(clampedMs / 3600000);
      const newMinutes = Math.floor((clampedMs % 3600000) / 60000);
      const newSeconds = Math.floor((clampedMs % 60000) / 1000);
      const newMilliseconds = clampedMs % 1000;
      
      return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')},${newMilliseconds.toString().padStart(3, '0')}`;
    }
  );
}

/**
 * エディタ用のテキスト操作ユーティリティ
 */
export class TextEditorUtils {
  /**
   * 選択範囲のテキストを取得
   */
  static getSelectedText(element: HTMLTextAreaElement | HTMLInputElement): string {
    const { selectionStart, selectionEnd, value } = element;
    return value.slice(selectionStart || 0, selectionEnd || 0);
  }
  
  /**
   * 選択範囲にテキストを挿入
   */
  static insertText(
    element: HTMLTextAreaElement | HTMLInputElement, 
    text: string,
    selectInserted: boolean = false
  ): void {
    const { selectionStart, selectionEnd, value } = element;
    const beforeSelection = value.slice(0, selectionStart || 0);
    const afterSelection = value.slice(selectionEnd || 0);
    
    const newValue = beforeSelection + text + afterSelection;
    const newCursorStart = (selectionStart || 0) + (selectInserted ? 0 : text.length);
    const newCursorEnd = (selectionStart || 0) + text.length;
    
    element.value = newValue;
    
    if (selectInserted) {
      element.setSelectionRange(selectionStart || 0, newCursorEnd);
    } else {
      element.setSelectionRange(newCursorStart, newCursorStart);
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.focus();
  }
  
  /**
   * 現在の行を取得
   */
  static getCurrentLine(element: HTMLTextAreaElement): { line: string; start: number; end: number } {
    const { selectionStart, value } = element;
    
    // カーソル位置から行の開始位置を見つける
    let lineStart = selectionStart || 0;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // カーソル位置から行の終了位置を見つける
    let lineEnd = selectionStart || 0;
    while (lineEnd < value.length && value[lineEnd] !== '\n') {
      lineEnd++;
    }
    
    return {
      line: value.slice(lineStart, lineEnd),
      start: lineStart,
      end: lineEnd,
    };
  }
  
  /**
   * 行頭・行末に文字を追加
   */
  static wrapCurrentLine(
    element: HTMLTextAreaElement, 
    prefix: string, 
    suffix: string = ''
  ): void {
    const { line, start, end } = this.getCurrentLine(element);
    const wrappedLine = prefix + line + suffix;
    
    element.setSelectionRange(start, end);
    this.insertText(element, wrappedLine);
  }
}

/**
 * ショートカットヘルプ用のデータ取得
 */
export function getShortcutHelp(): ShortcutCategory[] {
  const systemShortcuts: Shortcut[] = [
    {
      id: 'command-palette',
      keys: 'mod+k',
      description: 'コマンドパレットを開く',
      action: () => {},
      category: 'system',
      global: true,
    },
    {
      id: 'toggle-theme',
      keys: 'mod+shift+d',
      description: 'ダークモード切り替え',
      action: () => {},
      category: 'system',
      global: true,
    },
  ];
  
  const editorShortcuts: Shortcut[] = [
    {
      id: 'split-line',
      keys: 'ctrl+enter',
      description: 'カーソル位置で行分割',
      action: () => {},
      category: 'editor',
    },
    {
      id: 'replace-punctuation',
      keys: 'mod+shift+p',
      description: '句読点を置換',
      action: () => {},
      category: 'editor',
    },
    {
      id: 'insert-heading',
      keys: 'mod+shift+h',
      description: '見出しを挿入',
      action: () => {},
      category: 'editor',
    },
  ];
  
  const srtShortcuts: Shortcut[] = [
    {
      id: 'timing-plus',
      keys: 'mod+plus',
      description: 'タイミング +100ms',
      action: () => {},
      category: 'srt',
    },
    {
      id: 'timing-minus',
      keys: 'mod+minus',
      description: 'タイミング -100ms',
      action: () => {},
      category: 'srt',
    },
    {
      id: 'format-srt',
      keys: 'mod+shift+f',
      description: 'SRT整形実行',
      action: () => {},
      category: 'srt',
    },
  ];
  
  const mediaShortcuts: Shortcut[] = [
    {
      id: 'play-pause',
      keys: 'space',
      description: '再生・一時停止',
      action: () => {},
      category: 'media',
    },
    {
      id: 'render-video',
      keys: 'mod+r',
      description: '動画レンダリング開始',
      action: () => {},
      category: 'media',
    },
  ];
  
  return [
    { ...shortcutCategories[0], shortcuts: systemShortcuts },
    { ...shortcutCategories[1], shortcuts: editorShortcuts },
    { ...shortcutCategories[2], shortcuts: srtShortcuts },
    { ...shortcutCategories[3], shortcuts: mediaShortcuts },
  ];
}