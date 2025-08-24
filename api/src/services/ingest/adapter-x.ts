// X (Twitter) ポスト取得アダプター

import axios from 'axios';
import * as cheerio from 'cheerio';
import { IngestAdapter } from './index';
import { AssetMetadata, SocialMetadata } from '../../types/asset';
import { logger } from '../../lib/logger';

export class IngestAdapterX implements IngestAdapter {
  canHandle(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('twitter.com') || hostname.includes('x.com');
  }

  getEstimatedTime(): number {
    return 2; // 2秒程度
  }

  async extract(url: string): Promise<AssetMetadata> {
    try {
      logger.info('Extracting X (Twitter) post', { url });

      // URLの正規化とポストID抽出
      const normalizedUrl = this.normalizeXUrl(url);
      const postInfo = this.parseXUrl(normalizedUrl);
      
      if (!postInfo.postId) {
        throw new Error('Invalid X/Twitter URL format');
      }

      // メタデータを取得（複数の方法を試行）
      let socialMetadata: SocialMetadata | null = null;
      
      try {
        // 方法1: Open Graph メタデータの取得
        socialMetadata = await this.extractFromOpenGraph(normalizedUrl);
      } catch (error) {
        logger.warn('Open Graph extraction failed, trying alternative methods', { 
          url: normalizedUrl, 
          error: error.message 
        });
        
        // 方法2: フォールバック（基本情報のみ）
        socialMetadata = this.createFallbackMetadata(postInfo);
      }

      return {
        title: `@${socialMetadata.username}のポスト`,
        description: socialMetadata.postText.slice(0, 200) + 
                    (socialMetadata.postText.length > 200 ? '...' : ''),
        siteName: 'X (Twitter)',
        author: socialMetadata.displayName,
        socialMetadata,
      };

    } catch (error) {
      logger.error('X extraction failed', { url, error: error.message });
      
      // 完全フォールバック
      const postInfo = this.parseXUrl(url);
      return {
        title: 'Xのポスト',
        description: 'ポストの内容を取得できませんでした',
        siteName: 'X (Twitter)',
        socialMetadata: this.createFallbackMetadata(postInfo),
      };
    }
  }

  /**
   * X URLの正規化
   */
  private normalizeXUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // x.comに統一
      urlObj.hostname = 'x.com';
      
      // 不要なパラメータを削除
      const allowedParams = ['s']; // 必要最小限のパラメータのみ保持
      const newSearch = new URLSearchParams();
      
      for (const [key, value] of urlObj.searchParams) {
        if (allowedParams.includes(key)) {
          newSearch.append(key, value);
        }
      }
      
      urlObj.search = newSearch.toString();
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * X URLからユーザー名とポストIDを抽出
   */
  private parseXUrl(url: string): { username: string; postId: string } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      
      // パターン: /username/status/postId
      if (pathParts.length >= 3 && pathParts[1] === 'status') {
        return {
          username: pathParts[0],
          postId: pathParts[2],
        };
      }
      
      // その他のパターンに対応
      if (pathParts.length >= 1) {
        return {
          username: pathParts[0],
          postId: pathParts[pathParts.length - 1] || 'unknown',
        };
      }
      
      throw new Error('Cannot parse X URL');
    } catch {
      return {
        username: 'unknown',
        postId: 'unknown',
      };
    }
  }

  /**
   * Open Graph メタデータからソーシャルメタデータを抽出
   */
  private async extractFromOpenGraph(url: string): Promise<SocialMetadata> {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    const $ = cheerio.load(response.data);
    const postInfo = this.parseXUrl(url);

    // Open Graph タグから情報を抽出
    const title = $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    // Twitter Card から追加情報を取得
    const site = $('meta[name="twitter:site"]').attr('content') || '';
    const creator = $('meta[name="twitter:creator"]').attr('content') || '';

    // ユーザー名とポスト本文の推定
    let username = postInfo.username;
    let displayName = title;
    let postText = description;

    // タイトルからユーザー情報を抽出（パターン: "Display Name (@username) / X"）
    const titleMatch = title.match(/^(.+?)\s*\(@([^)]+)\)/);
    if (titleMatch) {
      displayName = titleMatch[1].trim();
      username = titleMatch[2];
    }

    // 投稿本文を整理
    if (description.startsWith('"') && description.endsWith('"')) {
      postText = description.slice(1, -1); // クォートを削除
    }

    // 添付メディアの検出
    const attachments: SocialMetadata['attachments'] = [];
    if (image) {
      attachments.push({
        type: 'image',
        url: image,
        altText: 'Attached image',
      });
    }

    return {
      platform: 'x',
      username: username.replace('@', ''), // @ を削除
      displayName: displayName || username,
      postId: postInfo.postId,
      postText: postText || '投稿内容を取得できませんでした',
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }

  /**
   * フォールバック用のメタデータ作成
   */
  private createFallbackMetadata(postInfo: { username: string; postId: string }): SocialMetadata {
    return {
      platform: 'x',
      username: postInfo.username,
      displayName: postInfo.username,
      postId: postInfo.postId,
      postText: 'ポストの内容を取得できませんでした。APIアクセスが制限されているか、ポストが削除された可能性があります。',
    };
  }

  /**
   * エンゲージメント数の抽出（HTMLから）
   */
  private extractEngagementNumbers($: cheerio.CheerioAPI): {
    likes?: number;
    retweets?: number;
    replies?: number;
  } {
    const engagement: { likes?: number; retweets?: number; replies?: number } = {};

    try {
      // いいね数
      const likesText = $('[data-testid="like"] span, [aria-label*="いいね"] span').first().text();
      if (likesText) {
        engagement.likes = this.parseEngagementNumber(likesText);
      }

      // リツイート数
      const retweetText = $('[data-testid="retweet"] span, [aria-label*="リツイート"] span').first().text();
      if (retweetText) {
        engagement.retweets = this.parseEngagementNumber(retweetText);
      }

      // 返信数
      const replyText = $('[data-testid="reply"] span, [aria-label*="返信"] span').first().text();
      if (replyText) {
        engagement.replies = this.parseEngagementNumber(replyText);
      }
    } catch (error) {
      logger.warn('Failed to extract engagement numbers', { error: error.message });
    }

    return engagement;
  }

  /**
   * エンゲージメント数のパース（"1.2K" -> 1200）
   */
  private parseEngagementNumber(text: string): number {
    const cleanText = text.trim().replace(/,/g, '');
    
    if (cleanText.includes('K')) {
      return Math.round(parseFloat(cleanText.replace('K', '')) * 1000);
    }
    
    if (cleanText.includes('M')) {
      return Math.round(parseFloat(cleanText.replace('M', '')) * 1000000);
    }
    
    return parseInt(cleanText) || 0;
  }
}