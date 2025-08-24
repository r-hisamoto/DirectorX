// 一般URL（ウェブページ）取得アダプター

import axios from 'axios';
import * as cheerio from 'cheerio';
import { IngestAdapter } from './index';
import { AssetMetadata } from '../../types/asset';
import { logger } from '../../lib/logger';

export class IngestAdapterUrl implements IngestAdapter {
  canHandle(url: string): boolean {
    // 他の専用アダプターでハンドルされないURLはすべて処理
    return true;
  }

  getEstimatedTime(): number {
    return 4; // 4秒程度（一般的なウェブページは重い場合がある）
  }

  async extract(url: string): Promise<AssetMetadata> {
    try {
      logger.info('Extracting web page metadata', { url });

      // ファイル拡張子の確認
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // 直接ファイル（画像、動画、音声）の場合
      if (this.isDirectMediaFile(pathname)) {
        return this.extractDirectFileMetadata(url, pathname);
      }

      // HTMLページの場合
      const response = await axios.get(url, {
        timeout: 10000,
        maxContentLength: 5 * 1024 * 1024, // 5MB制限
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      });

      // Content-Typeの確認
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        // HTML以外のファイル
        return this.extractFromHeaders(url, response.headers);
      }

      const $ = cheerio.load(response.data);

      // メタデータの抽出
      const metadata = this.extractHtmlMetadata($, url);
      
      return metadata;

    } catch (error) {
      logger.error('URL extraction failed', { url, error: error.message });
      
      // フォールバック
      return this.createFallbackMetadata(url, error.message);
    }
  }

  /**
   * 直接メディアファイルかどうかの判定
   */
  private isDirectMediaFile(pathname: string): boolean {
    const mediaExtensions = [
      // 画像
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
      // 動画
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v',
      // 音声
      '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma',
      // ドキュメント
      '.pdf', '.doc', '.docx', '.txt', '.rtf',
    ];

    return mediaExtensions.some(ext => pathname.endsWith(ext));
  }

  /**
   * 直接ファイルのメタデータ抽出
   */
  private extractDirectFileMetadata(url: string, pathname: string): AssetMetadata {
    const filename = pathname.split('/').pop() || 'unknown';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // ファイルタイプの判定
    let fileType = 'file';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      fileType = 'image';
    } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
      fileType = 'video';
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
      fileType = 'audio';
    }

    return {
      title: filename,
      description: `${fileType.toUpperCase()}ファイル (${extension.toUpperCase()})`,
      mimeType: this.getMimeType(extension),
      siteName: new URL(url).hostname,
    };
  }

  /**
   * HTTPヘッダーからメタデータを抽出
   */
  private extractFromHeaders(url: string, headers: any): AssetMetadata {
    const contentType = headers['content-type'] || '';
    const contentLength = headers['content-length'];
    const lastModified = headers['last-modified'];

    const filename = url.split('/').pop() || 'unknown';
    
    return {
      title: filename,
      description: `ファイル (${contentType})`,
      mimeType: contentType,
      fileSize: contentLength ? parseInt(contentLength) : undefined,
      siteName: new URL(url).hostname,
      publishedAt: lastModified ? new Date(lastModified) : undefined,
    };
  }

  /**
   * HTMLからメタデータを抽出
   */
  private extractHtmlMetadata($: cheerio.CheerioAPI, url: string): AssetMetadata {
    const urlObj = new URL(url);

    // タイトルの取得（優先順位）
    const title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text() ||
      'Untitled Page';

    // 説明の取得
    const description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      this.extractTextFromBody($) ||
      '';

    // サイト名の取得
    const siteName = 
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="application-name"]').attr('content') ||
      urlObj.hostname;

    // 著者の取得
    const author = 
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('.author, .byline, [rel="author"]').first().text() ||
      undefined;

    // 公開日の取得
    let publishedAt: Date | undefined;
    const dateString = 
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish_date"]').attr('content') ||
      $('time[datetime]').attr('datetime') ||
      $('.date, .publish-date, .published').first().text();
    
    if (dateString) {
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate;
      }
    }

    // 画像の取得
    const imageUrl = 
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="image_src"]').attr('href');

    // ページタイプの判定
    const pageType = $('meta[property="og:type"]').attr('content') || 'website';

    return {
      title: title.trim(),
      description: description.trim().slice(0, 500), // 500文字に制限
      siteName: siteName,
      author: author?.trim(),
      publishedAt,
      mimeType: 'text/html',
    };
  }

  /**
   * ページ本文からテキストを抽出（説明用）
   */
  private extractTextFromBody($: cheerio.CheerioAPI): string {
    // メインコンテンツの候補セレクター
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0) {
        const text = content.text().trim();
        if (text.length > 50) { // 十分なテキストがある場合
          return text.slice(0, 200);
        }
      }
    }

    // フォールバック: 最初のpタグから抽出
    const firstP = $('p').first().text().trim();
    if (firstP.length > 20) {
      return firstP.slice(0, 200);
    }

    return '';
  }

  /**
   * 拡張子からMIMEタイプを取得
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      // 画像
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      
      // 動画
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      
      // 音声
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      
      // ドキュメント
      'pdf': 'application/pdf',
      'txt': 'text/plain',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * フォールバックメタデータの作成
   */
  private createFallbackMetadata(url: string, errorMessage: string): AssetMetadata {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'unknown';
      
      return {
        title: filename || urlObj.hostname,
        description: `コンテンツの取得に失敗しました: ${errorMessage}`,
        siteName: urlObj.hostname,
        mimeType: 'text/html',
      };
    } catch {
      return {
        title: 'Unknown Content',
        description: `無効なURLまたは取得に失敗しました: ${errorMessage}`,
        mimeType: 'text/html',
      };
    }
  }
}