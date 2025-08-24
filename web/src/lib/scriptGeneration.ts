import type { Asset } from '@/types/asset';

export interface ScriptGenerationOptions {
  includeTimestamps?: boolean;
  includeSourceInfo?: boolean;
  style?: 'narrative' | 'commentary' | 'news' | 'discussion';
  maxLength?: number;
}

/**
 * アセットの内容から台本を自動生成
 */
export function generateScriptFromAssets(
  assets: Asset[], 
  options: ScriptGenerationOptions = {}
): string {
  if (assets.length === 0) {
    return '';
  }

  const {
    includeTimestamps = false,
    includeSourceInfo = true,
    style = 'commentary',
    maxLength = 2000
  } = options;

  let script = '';

  // タイトル生成
  const title = generateTitle(assets);
  script += `# ${title}\n\n`;

  // イントロ生成
  script += generateIntro(assets, style) + '\n\n';

  // 各アセットから内容生成
  assets.forEach((asset, index) => {
    const section = generateAssetSection(asset, index + 1, {
      includeSourceInfo,
      style
    });
    script += section + '\n\n';
  });

  // アウトロ生成
  script += generateOutro(assets, style) + '\n\n';

  // 長さ制限
  if (script.length > maxLength) {
    script = script.substring(0, maxLength) + '...\n\n---\n※ 内容が長いため省略されました';
  }

  // タイムスタンプ付加（SRT形式準備）
  if (includeTimestamps) {
    script += '\n\n---\n※ SRT変換準備完了\n';
  }

  return script;
}

/**
 * アセットからタイトルを生成
 */
function generateTitle(assets: Asset[]): string {
  if (assets.length === 1) {
    const asset = assets[0];
    return asset.title || `${asset.source}コンテンツの解説`;
  }

  const sources = [...new Set(assets.map(a => a.source))];
  if (sources.length === 1) {
    return `${sources[0]}まとめ - ${assets.length}件のコンテンツ`;
  }

  return `マルチソース解説 - ${sources.join('・')}から`;
}

/**
 * イントロ生成
 */
function generateIntro(assets: Asset[], style: string): string {
  const assetCount = assets.length;
  const sources = [...new Set(assets.map(a => a.source))];

  switch (style) {
    case 'news':
      return `こんにちは。今回は${sources.join('や')}から注目のトピック${assetCount}件をお伝えします。`;
    
    case 'discussion':
      return `皆さん、こんにちは。今日は${sources.join('、')}で話題になっているこちらの内容について、詳しく見ていきたいと思います。`;
    
    case 'narrative':
      return `今回ご紹介するのは、${sources.join('や')}で見つけた興味深い${assetCount}件の話題です。それでは順番に見ていきましょう。`;
    
    case 'commentary':
    default:
      return `はい、どうも。今回は${sources.join('、')}から気になる話題を${assetCount}件ピックアップしてきました。早速チェックしていきましょう。`;
  }
}

/**
 * アセット個別セクション生成
 */
function generateAssetSection(
  asset: Asset, 
  index: number, 
  options: { includeSourceInfo: boolean; style: string }
): string {
  let section = '';

  // セクションヘッダー
  section += `## ${index}. ${asset.title || `${asset.source}コンテンツ`}\n\n`;

  // ソース情報
  if (options.includeSourceInfo) {
    section += `**ソース**: ${asset.source}`;
    if (asset.originalUrl) {
      section += ` ([リンク](${asset.originalUrl}))`;
    }
    section += '\n\n';
  }

  // メイン内容
  section += generateAssetContent(asset, options.style);

  return section;
}

/**
 * アセットタイプ別の内容生成
 */
function generateAssetContent(asset: Asset, style: string): string {
  switch (asset.type) {
    case 'social':
      return generateSocialContent(asset, style);
    
    case 'thread':
      return generateThreadContent(asset, style);
    
    case 'url':
      return generateUrlContent(asset, style);
    
    case 'video':
      return generateVideoContent(asset, style);
    
    default:
      return generateGenericContent(asset, style);
  }
}

/**
 * SNS投稿コンテンツ生成
 */
function generateSocialContent(asset: Asset, style: string): string {
  let content = '';
  
  if (asset.metadata?.socialMetadata) {
    const social = asset.metadata.socialMetadata;
    content += `${social.platform}の${social.displayName}さん（@${social.username}）による投稿です。\n\n`;
    
    if (social.postText) {
      content += `投稿内容：\n> ${social.postText}\n\n`;
    }
    
    if (social.likes || social.retweets) {
      content += `この投稿は`;
      if (social.likes) content += `${social.likes}いいね`;
      if (social.retweets) content += `、${social.retweets}リポスト`;
      content += `を獲得しており、注目度の高い内容となっています。\n\n`;
    }
  }

  if (asset.content) {
    content += `コメント：${asset.content}`;
  }

  return content;
}

/**
 * スレッドコンテンツ生成
 */
function generateThreadContent(asset: Asset, style: string): string {
  let content = '';
  
  if (asset.metadata?.threadMetadata) {
    const thread = asset.metadata.threadMetadata;
    content += `${thread.board}板の「${thread.threadTitle}」スレッドからです。\n\n`;
    
    if (thread.posts && thread.posts.length > 0) {
      content += `主要な投稿を紹介します：\n\n`;
      
      // 最初の数件の投稿を紹介
      thread.posts.slice(0, 3).forEach((post, index) => {
        content += `**${post.number}番**（${post.name}）\n`;
        content += `${post.content}\n\n`;
      });
      
      if (thread.posts.length > 3) {
        content += `他にも${thread.posts.length - 3}件の投稿があり、活発な議論が続いています。`;
      }
    }
  }

  if (asset.content && !asset.metadata?.threadMetadata) {
    content += `スレッド内容：\n${asset.content}`;
  }

  return content;
}

/**
 * URL/ウェブページコンテンツ生成
 */
function generateUrlContent(asset: Asset, style: string): string {
  let content = '';
  
  if (asset.metadata?.siteName) {
    content += `${asset.metadata.siteName}からの記事です。\n\n`;
  }
  
  if (asset.description) {
    content += `${asset.description}\n\n`;
  }
  
  if (asset.content) {
    content += `記事内容：\n${asset.content.slice(0, 500)}${asset.content.length > 500 ? '...' : ''}`;
  }

  return content;
}

/**
 * 動画コンテンツ生成
 */
function generateVideoContent(asset: Asset, style: string): string {
  let content = '';
  
  content += `動画コンテンツ「${asset.title}」です。\n\n`;
  
  if (asset.metadata?.duration) {
    const minutes = Math.floor(asset.metadata.duration / 60);
    const seconds = asset.metadata.duration % 60;
    content += `再生時間: ${minutes}分${seconds}秒\n\n`;
  }
  
  if (asset.description) {
    content += `概要：\n${asset.description}\n\n`;
  }
  
  if (asset.content) {
    content += `内容解説：\n${asset.content}`;
  }

  return content;
}

/**
 * 汎用コンテンツ生成
 */
function generateGenericContent(asset: Asset, style: string): string {
  let content = '';
  
  if (asset.description) {
    content += `${asset.description}\n\n`;
  }
  
  if (asset.content) {
    content += asset.content;
  } else {
    content += 'このアセットの詳細な内容は現在取得中です。';
  }

  return content;
}

/**
 * アウトロ生成
 */
function generateOutro(assets: Asset[], style: string): string {
  const assetCount = assets.length;
  
  switch (style) {
    case 'news':
      return `以上、${assetCount}件のトピックをお伝えしました。続報があり次第、またお知らせします。`;
    
    case 'discussion':
      return `いかがでしたでしょうか。皆さんはどう思われますか？コメント欄で感想をお聞かせください。`;
    
    case 'narrative':
      return `以上で今回の話題は終わりです。他にも興味深い内容を見つけたら、またご紹介していきたいと思います。`;
    
    case 'commentary':
    default:
      return `はい、ということで今回は以上になります。また面白い話題を見つけたら紹介しますので、チャンネル登録よろしくお願いします。それではまた！`;
  }
}

/**
 * アセットから簡易SRT生成
 */
export function generateSrtFromAssets(
  assets: Asset[],
  options: { wordsPerMinute?: number; startTime?: number } = {}
): string {
  const { wordsPerMinute = 150, startTime = 0 } = options;
  
  const script = generateScriptFromAssets(assets, {
    includeTimestamps: false,
    style: 'commentary'
  });
  
  // 改行とヘッダーを除去してクリーンなテキストに
  const cleanText = script
    .replace(/^#+\s+.*/gm, '') // ヘッダー除去
    .replace(/\*\*(.+?)\*\*/g, '$1') // 太字除去
    .replace(/\[.+?\]\(.+?\)/g, '') // リンク除去
    .replace(/\n{2,}/g, '\n') // 連続改行を単一に
    .trim();
  
  // SRT生成
  const lines = cleanText.split('\n').filter(line => line.trim());
  let srt = '';
  let currentTime = startTime;
  
  lines.forEach((line, index) => {
    const wordCount = line.split(' ').length;
    const duration = Math.max(2, (wordCount / wordsPerMinute) * 60);
    
    const startTimeStr = formatSrtTime(currentTime);
    const endTimeStr = formatSrtTime(currentTime + duration);
    
    srt += `${index + 1}\n`;
    srt += `${startTimeStr} --> ${endTimeStr}\n`;
    srt += `${line}\n\n`;
    
    currentTime += duration;
  });
  
  return srt;
}

/**
 * 秒をSRT時間フォーマットに変換
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}