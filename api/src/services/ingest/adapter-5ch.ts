// 5ch (2ch) スレッド取得アダプター

import axios from 'axios';
import * as cheerio from 'cheerio';
import { IngestAdapter } from './index';
import { AssetMetadata, ThreadMetadata } from '../../types/asset';
import { logger } from '../../lib/logger';

export class IngestAdapter5ch implements IngestAdapter {
  canHandle(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('5ch.net') || 
           hostname.includes('2ch.net') || 
           hostname.includes('2ch.sc') ||
           hostname.includes('open2ch.net');
  }

  getEstimatedTime(): number {
    return 3; // 3秒程度
  }

  async extract(url: string): Promise<AssetMetadata> {
    try {
      logger.info('Extracting 5ch thread', { url });

      // URLパース
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // 板名とスレッドIDを抽出
      const board = pathParts[1] || 'unknown';
      let threadId = pathParts[3] || pathParts[2];
      
      // スレッドID正規化（拡張子を削除）
      if (threadId && threadId.includes('.')) {
        threadId = threadId.split('.')[0];
      }

      // HTTPリクエスト（User-Agentを設定してブロックを回避）
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
        },
      });

      const $ = cheerio.load(response.data);
      
      // スレッドタイトルの取得
      let threadTitle = $('title').text().trim();
      if (!threadTitle || threadTitle === '') {
        // タイトルがない場合はh1から取得を試行
        threadTitle = $('h1').first().text().trim() || '無題のスレッド';
      }

      // レス（投稿）の取得
      const posts = this.extractPosts($);

      const threadMetadata: ThreadMetadata = {
        board,
        threadId: threadId || 'unknown',
        threadTitle,
        posts,
        totalPosts: posts.length,
      };

      // 説明文を生成（最初のレスの一部を使用）
      const description = posts.length > 0 
        ? posts[0].content.slice(0, 200) + (posts[0].content.length > 200 ? '...' : '')
        : '';

      return {
        title: threadTitle,
        description,
        siteName: urlObj.hostname,
        author: `${board}板`,
        threadMetadata,
      };

    } catch (error) {
      logger.error('5ch extraction failed', { url, error: error.message });
      
      // フォールバック（基本情報のみ）
      return {
        title: this.extractTitleFromUrl(url),
        description: '5chスレッドの内容を取得できませんでした',
        siteName: new URL(url).hostname,
        threadMetadata: {
          board: 'unknown',
          threadId: 'unknown',
          threadTitle: this.extractTitleFromUrl(url),
          posts: [],
          totalPosts: 0,
        },
      };
    }
  }

  /**
   * HTMLからレス（投稿）を抽出
   */
  private extractPosts($: cheerio.CheerioAPI): ThreadMetadata['posts'] {
    const posts: ThreadMetadata['posts'] = [];

    // 複数のセレクターパターンを試行（サイトによって構造が異なる）
    const selectors = [
      'article', // 新しい5ch
      '.post', // 一般的なクラス
      'dd', // 古い2ch形式
      'div[class*="post"]', // post系クラス
      'div[class*="res"]', // res系クラス
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((index, element) => {
          const post = this.parsePost($, $(element), index);
          if (post) {
            posts.push(post);
          }
        });
        break; // 最初に見つかったセレクターを使用
      }
    }

    // セレクターで見つからない場合は、テキスト全体からパース
    if (posts.length === 0) {
      return this.parseRawText($);
    }

    return posts;
  }

  /**
   * 個別レスをパース
   */
  private parsePost($: cheerio.CheerioAPI, element: cheerio.Cheerio, index: number): ThreadMetadata['posts'][0] | null {
    try {
      // 名前の抽出
      const nameElement = element.find('.name, .postername, b').first();
      const name = nameElement.text().trim() || '名無しさん';

      // 日付とIDの抽出
      const dateElement = element.find('.date, .postdate, .now').first();
      const dateText = dateElement.text().trim();
      
      // IDを抽出（ID:の後の文字列）
      const idMatch = dateText.match(/ID:([a-zA-Z0-9+/]+)/);
      const id = idMatch ? idMatch[1] : `id${index}`;

      // 本文の抽出
      const messageElement = element.find('.message, .postmessage, .msg').first();
      let content = messageElement.text().trim();
      
      // 本文が見つからない場合は要素全体から抽出
      if (!content) {
        content = element.text().trim();
        // 名前や日付部分を除去
        content = content.replace(name, '').replace(dateText, '').trim();
      }

      // AAや特殊文字を保持
      content = this.preserveAsciiArt(content);

      return {
        number: index + 1,
        name,
        date: dateText || new Date().toLocaleString('ja-JP'),
        id,
        content,
        isOp: index === 0, // 最初の投稿をOPとする
      };

    } catch (error) {
      logger.warn('Failed to parse post', { error: error.message, index });
      return null;
    }
  }

  /**
   * 生テキストからレスをパース（フォールバック）
   */
  private parseRawText($: cheerio.CheerioAPI): ThreadMetadata['posts'] {
    const fullText = $('body').text();
    const lines = fullText.split('\n').filter(line => line.trim());
    
    // 簡易パーサー（レス番号を探す）
    const posts: ThreadMetadata['posts'] = [];
    let currentPost = '';
    let postNumber = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\s+：/)) {
        // 新しいレスの開始
        if (currentPost) {
          posts.push({
            number: postNumber++,
            name: '名無しさん',
            date: new Date().toLocaleString('ja-JP'),
            id: `id${postNumber}`,
            content: currentPost.trim(),
            isOp: postNumber === 1,
          });
        }
        currentPost = trimmed;
      } else {
        currentPost += '\n' + trimmed;
      }
    }

    // 最後のレスを追加
    if (currentPost) {
      posts.push({
        number: postNumber,
        name: '名無しさん',
        date: new Date().toLocaleString('ja-JP'),
        id: `id${postNumber}`,
        content: currentPost.trim(),
        isOp: postNumber === 1,
      });
    }

    return posts;
  }

  /**
   * AA（アスキーアート）の保持
   */
  private preserveAsciiArt(text: string): string {
    // 連続する空白やタブ、特殊文字を保持
    return text
      .replace(/\s+/g, ' ') // 連続空白を単一空白に
      .replace(/　+/g, '　') // 全角空白は保持
      .trim();
  }

  /**
   * URLからタイトル推定（フォールバック）
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const board = pathParts[1] || 'unknown';
      return `${board}板のスレッド`;
    } catch {
      return '5chスレッド';
    }
  }
}