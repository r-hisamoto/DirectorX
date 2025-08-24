// YouTube動画取得アダプター

import axios from 'axios';
import * as cheerio from 'cheerio';
import { IngestAdapter } from './index';
import { AssetMetadata } from '../../types/asset';
import { logger } from '../../lib/logger';

export class IngestAdapterYoutube implements IngestAdapter {
  canHandle(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  }

  getEstimatedTime(): number {
    return 3; // 3秒程度
  }

  async extract(url: string): Promise<AssetMetadata> {
    try {
      logger.info('Extracting YouTube video metadata', { url });

      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL format');
      }

      // YouTube oembed APIを使用（公式で利用可能）
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      
      try {
        const oembedResponse = await axios.get(oembedUrl, { timeout: 5000 });
        const oembedData = oembedResponse.data;

        return {
          title: oembedData.title || 'YouTube動画',
          description: this.cleanDescription(oembedData.title),
          siteName: 'YouTube',
          author: oembedData.author_name,
          duration: this.parseDuration(oembedData.duration), // oembedには含まれない場合が多い
          dimensions: {
            width: oembedData.width || 1280,
            height: oembedData.height || 720,
          },
          mimeType: 'video/mp4',
        };
      } catch (oembedError) {
        logger.warn('YouTube oembed failed, trying HTML extraction', { 
          videoId, 
          error: oembedError.message 
        });
        
        // フォールバック: HTMLから抽出
        return await this.extractFromHtml(url, videoId);
      }

    } catch (error) {
      logger.error('YouTube extraction failed', { url, error: error.message });
      
      // 完全フォールバック
      return this.createFallbackMetadata(url);
    }
  }

  /**
   * YouTube URLから動画IDを抽出
   */
  private extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      // パターン1: youtube.com/watch?v=VIDEO_ID
      if (urlObj.hostname.includes('youtube.com')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;
        
        // パターン2: youtube.com/embed/VIDEO_ID
        const embedMatch = urlObj.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
        if (embedMatch) return embedMatch[1];
        
        // パターン3: youtube.com/v/VIDEO_ID
        const vMatch = urlObj.pathname.match(/\/v\/([a-zA-Z0-9_-]+)/);
        if (vMatch) return vMatch[1];
      }
      
      // パターン4: youtu.be/VIDEO_ID
      if (urlObj.hostname.includes('youtu.be')) {
        const videoId = urlObj.pathname.slice(1); // "/" を除去
        if (videoId) return videoId;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * HTMLから動画メタデータを抽出（フォールバック）
   */
  private async extractFromHtml(url: string, videoId: string): Promise<AssetMetadata> {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    const $ = cheerio.load(response.data);

    // タイトルの抽出
    const title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text().replace(' - YouTube', '') ||
      'YouTube動画';

    // 説明の抽出
    const description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // チャンネル名の抽出
    const channelName = 
      $('meta[name="author"]').attr('content') ||
      $('link[itemprop="url"]').prev().text() ||
      'Unknown Channel';

    // 動画の長さを抽出（JSON-LDから）
    let duration: number | undefined;
    try {
      const jsonLdScript = $('script[type="application/ld+json"]').html();
      if (jsonLdScript) {
        const jsonLd = JSON.parse(jsonLdScript);
        if (jsonLd.duration) {
          duration = this.parseIsoDuration(jsonLd.duration);
        }
      }
    } catch (e) {
      // JSON-LD parsing failed
    }

    // サムネイル画像の取得
    const thumbnailUrl = 
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return {
      title: title.trim(),
      description: this.cleanDescription(description.trim()),
      siteName: 'YouTube',
      author: channelName.trim(),
      duration,
      dimensions: {
        width: 1280,
        height: 720,
      },
      mimeType: 'video/mp4',
    };
  }

  /**
   * ISO 8601 duration (PT4M13S) を秒数に変換
   */
  private parseIsoDuration(isoDuration: string): number | undefined {
    try {
      const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return undefined;

      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');

      return hours * 3600 + minutes * 60 + seconds;
    } catch {
      return undefined;
    }
  }

  /**
   * 時間文字列（4:13など）を秒数に変換
   */
  private parseDuration(durationStr?: string): number | undefined {
    if (!durationStr) return undefined;

    try {
      const parts = durationStr.split(':').reverse(); // 秒、分、時の順
      let totalSeconds = 0;
      
      // 秒
      if (parts[0]) totalSeconds += parseInt(parts[0]);
      
      // 分
      if (parts[1]) totalSeconds += parseInt(parts[1]) * 60;
      
      // 時
      if (parts[2]) totalSeconds += parseInt(parts[2]) * 3600;
      
      return totalSeconds;
    } catch {
      return undefined;
    }
  }

  /**
   * 説明文のクリーンアップ
   */
  private cleanDescription(description: string): string {
    if (!description) return '';
    
    // YouTubeの説明文は長すぎることがあるので適当な長さに制限
    let cleaned = description
      .replace(/\n+/g, ' ') // 改行を空白に
      .replace(/\s+/g, ' ') // 連続空白を単一空白に
      .trim();
    
    // 最大500文字に制限
    if (cleaned.length > 500) {
      cleaned = cleaned.slice(0, 497) + '...';
    }
    
    return cleaned;
  }

  /**
   * フォールバックメタデータの作成
   */
  private createFallbackMetadata(url: string): AssetMetadata {
    const videoId = this.extractVideoId(url);
    
    return {
      title: videoId ? `YouTube動画 (${videoId})` : 'YouTube動画',
      description: '動画の詳細情報を取得できませんでした',
      siteName: 'YouTube',
      author: 'Unknown Channel',
      mimeType: 'video/mp4',
      dimensions: {
        width: 1280,
        height: 720,
      },
    };
  }

  /**
   * YouTube動画のサムネイルURLを生成
   */
  static getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high'): string {
    const qualityMap = {
      'default': 'default.jpg',      // 120x90
      'medium': 'mqdefault.jpg',     // 320x180
      'high': 'hqdefault.jpg',       // 480x360
      'standard': 'sddefault.jpg',   // 640x480
      'maxres': 'maxresdefault.jpg', // 1280x720
    };
    
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
  }
}