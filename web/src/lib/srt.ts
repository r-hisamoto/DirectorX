// 日本語 SRT 整形ライブラリ (フロントエンド用)

/**
 * 文字の幅を計算（全角=1.0、半角=0.5）
 */
function getCharWidth(char: string): number {
  // ASCII文字 (0x00-0x7F) は半角
  if (char.charCodeAt(0) <= 0x7F) {
    return 0.5;
  }
  
  // 半角カタカナ (0xFF61-0xFF9F)
  const code = char.charCodeAt(0);
  if (code >= 0xFF61 && code <= 0xFF9F) {
    return 0.5;
  }
  
  // その他は全角
  return 1.0;
}

/**
 * テキストの総幅を計算
 */
function getTextWidth(text: string): number {
  return text.split('').reduce((total, char) => total + getCharWidth(char), 0);
}

/**
 * 禁則文字の定義
 */
const KINSOKU_RULES = {
  // 行頭に来てはいけない文字
  startForbidden: ['、', '。', '！', '？', '：', '；', '）', ']', '】', '』', '」', '>', '≫', '…', 'ー'],
  // 行末に来てはいけない文字  
  endForbidden: ['（', '[', '【', '『', '「', '<', '≪'],
};

/**
 * 1行の最大文字幅（全角換算）
 */
const MAX_LINE_WIDTH = 20;

/**
 * テキストを行頭禁則を考慮して折り返す
 */
function wrapTextWithKinsoku(text: string, maxWidth: number = MAX_LINE_WIDTH): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  
  const chars = text.split('');
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const charWidth = getCharWidth(char);
    
    // 現在の文字を追加した時の幅
    const newWidth = currentWidth + charWidth;
    
    // 最大幅を超える場合の処理
    if (newWidth > maxWidth && currentLine.length > 0) {
      // 行頭禁則チェック
      if (KINSOKU_RULES.startForbidden.includes(char)) {
        // 禁則文字は前の行に追加
        currentLine += char;
        lines.push(currentLine);
        currentLine = '';
        currentWidth = 0;
        continue;
      }
      
      // 現在の行の行末禁則チェック
      const lastChar = currentLine[currentLine.length - 1];
      if (KINSOKU_RULES.endForbidden.includes(lastChar)) {
        // 行末禁則文字を次の行に移動
        const forbiddenChar = currentLine.slice(-1);
        currentLine = currentLine.slice(0, -1);
        lines.push(currentLine);
        currentLine = forbiddenChar + char;
        currentWidth = getCharWidth(forbiddenChar) + charWidth;
        continue;
      }
      
      // 通常の改行
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      // 文字を現在の行に追加
      currentLine += char;
      currentWidth = newWidth;
    }
  }
  
  // 最後の行を追加
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * SRTエントリの型定義
 */
export interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * タイムコードをミリ秒に変換
 */
function timeToMilliseconds(time: string): number {
  const match = time.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  
  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(milliseconds)
  );
}

/**
 * ミリ秒をタイムコードに変換
 */
function millisecondsToTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * SRTテキストをパース
 */
export function parseSrt(srtText: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = srtText.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    const index = parseInt(lines[0]);
    const timeLine = lines[1];
    const text = lines.slice(2).join('\n');
    
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    
    entries.push({
      index,
      startTime: timeMatch[1],
      endTime: timeMatch[2],
      text,
    });
  }
  
  return entries;
}

/**
 * SRTエントリを文字列に変換
 */
export function stringifySrt(entries: SrtEntry[]): string {
  return entries
    .map(entry => `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`)
    .join('\n\n');
}

/**
 * SRT整形オプション
 */
export interface FormatSrtOptions {
  maxZenkaku?: number;
  forbidLeading?: string[];
  addBreakAfterPunctuation?: boolean;
  breakDuration?: number; // ms
}

/**
 * メインのSRT整形関数
 */
export function formatSrt(
  srtText: string, 
  options: FormatSrtOptions = {}
): string {
  const {
    maxZenkaku = MAX_LINE_WIDTH,
    forbidLeading = KINSOKU_RULES.startForbidden,
    addBreakAfterPunctuation = false,
    breakDuration = 120,
  } = options;
  
  // SRTをパース
  const entries = parseSrt(srtText);
  
  // 各エントリを整形
  const formattedEntries: SrtEntry[] = [];
  
  for (const entry of entries) {
    // テキストを行で分割して整形
    const paragraphs = entry.text.split('\n');
    const formattedParagraphs: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        formattedParagraphs.push('');
        continue;
      }
      
      // 禁則処理を適用して折り返し
      const wrappedLines = wrapTextWithKinsoku(paragraph.trim(), maxZenkaku);
      formattedParagraphs.push(...wrappedLines);
    }
    
    // 句読点後の間を追加する場合
    let formattedText = formattedParagraphs.join('\n');
    
    if (addBreakAfterPunctuation) {
      // 句読点後に短いポーズを追加する処理
      // (実際のTTSで使用する場合のプレースホルダー)
      formattedText = formattedText.replace(/([、。！？])(?!\s)/g, `$1 `);
    }
    
    formattedEntries.push({
      ...entry,
      text: formattedText,
    });
  }
  
  return stringifySrt(formattedEntries);
}

/**
 * テキストから簡易SRTを生成（デモ用）
 */
// 内部関数もエクスポート（テスト用）
export { getCharWidth, getTextWidth, wrapTextWithKinsoku, KINSOKU_RULES, MAX_LINE_WIDTH };

export function textToSimpleSrt(text: string, durationPerChar = 150): string {
  const sentences = text.split(/[。！？]/).filter(s => s.trim());
  const entries: SrtEntry[] = [];
  
  let currentTime = 0;
  
  sentences.forEach((sentence, index) => {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) return;
    
    const duration = cleanSentence.length * durationPerChar;
    const startTime = millisecondsToTime(currentTime);
    const endTime = millisecondsToTime(currentTime + duration);
    
    // 文章を禁則処理で整形
    const formattedLines = wrapTextWithKinsoku(cleanSentence + '。');
    
    entries.push({
      index: index + 1,
      startTime,
      endTime,
      text: formattedLines.join('\n'),
    });
    
    currentTime += duration + 300; // 300ms の間隔
  });
  
  return stringifySrt(entries);
}