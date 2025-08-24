import { z } from 'zod';
import { Asset, AssetType, AssetSource, AssetMetadata, IngestRequest } from '../types/asset';

// Zodスキーマ定義
const AssetTypeSchema = z.enum(['image', 'audio', 'video', 'text', 'webpage', 'social-post']);
const AssetSourceSchema = z.enum(['upload', 'url', 'x-twitter', '5ch', 'youtube', 'generated']);

const AssetMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  duration: z.number().optional(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  siteName: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.date().optional(),
  socialMetadata: z.object({
    platform: z.enum(['x', 'twitter']),
    username: z.string(),
    displayName: z.string(),
    postId: z.string(),
    postText: z.string(),
    likes: z.number().optional(),
    retweets: z.number().optional(),
    replies: z.number().optional(),
    attachments: z.array(z.object({
      type: z.enum(['image', 'video', 'gif']),
      url: z.string(),
      altText: z.string().optional(),
    })).optional(),
  }).optional(),
  threadMetadata: z.object({
    board: z.string(),
    threadId: z.string(),
    threadTitle: z.string(),
    posts: z.array(z.object({
      number: z.number(),
      name: z.string(),
      email: z.string().optional(),
      date: z.string(),
      id: z.string(),
      content: z.string(),
      isOp: z.boolean().optional(),
    })),
    totalPosts: z.number().optional(),
  }).optional(),
});

export const IngestRequestSchema = z.object({
  sourceType: AssetSourceSchema,
  url: z.string().url('有効なURLを入力してください').optional(),
  workspaceId: z.string().min(1, 'ワークスペースIDは必須です'),
  metadata: AssetMetadataSchema.partial().optional(),
}).refine(
  (data) => {
    // URLかファイルのどちらかが必要
    if (data.sourceType !== 'upload' && !data.url) {
      return false;
    }
    return true;
  },
  {
    message: 'URLまたはファイルが必要です',
    path: ['url'],
  }
);

export const AssetFilterSchema = z.object({
  workspaceId: z.string().min(1),
  types: z.array(AssetTypeSchema).optional(),
  sources: z.array(AssetSourceSchema).optional(),
  status: z.array(z.enum(['pending', 'processing', 'ready', 'error'])).optional(),
  search: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type IngestRequestType = z.infer<typeof IngestRequestSchema>;
export type AssetFilterType = z.infer<typeof AssetFilterSchema>;

export class AssetModel {
  static create(data: IngestRequestType): Omit<Asset, 'id'> {
    const now = new Date();
    
    // ソースタイプから初期のAssetTypeを推定
    const inferredType = this.inferAssetType(data.sourceType, data.url);
    
    return {
      workspaceId: data.workspaceId,
      type: inferredType,
      source: data.sourceType,
      url: data.url || '',
      originalUrl: data.url,
      metadata: data.metadata || {},
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }

  static update(existing: Asset, updates: Partial<Asset>): Asset {
    return {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
  }

  private static inferAssetType(source: AssetSource, url?: string): AssetType {
    switch (source) {
      case 'x-twitter':
        return 'social-post';
      case '5ch':
        return 'text';
      case 'youtube':
        return 'video';
      case 'url':
        if (url) {
          // URLの拡張子から推定
          const ext = url.split('.').pop()?.toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            return 'image';
          }
          if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
            return 'video';
          }
          if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
            return 'audio';
          }
        }
        return 'webpage';
      case 'upload':
        return 'image'; // アップロード時はMIMEタイプで後で修正
      case 'generated':
        return 'text';
      default:
        return 'webpage';
    }
  }

  /**
   * URLからドメインとソースタイプを推定
   */
  static detectSourceFromUrl(url: string): { source: AssetSource; confidence: number } {
    const domain = new URL(url).hostname.toLowerCase();
    
    // X (Twitter)
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return { source: 'x-twitter', confidence: 1.0 };
    }
    
    // 5ch系
    if (domain.includes('5ch.net') || 
        domain.includes('2ch.net') || 
        domain.includes('2ch.sc') ||
        domain.includes('open2ch.net')) {
      return { source: '5ch', confidence: 1.0 };
    }
    
    // YouTube
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return { source: 'youtube', confidence: 1.0 };
    }
    
    // 一般URL
    return { source: 'url', confidence: 0.8 };
  }

  /**
   * URLの正規化
   */
  static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // X (Twitter) URLの正規化
      if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
        // モバイル版を削除
        urlObj.hostname = urlObj.hostname.replace('mobile.', '');
        // 不要なパラメータを削除
        urlObj.search = '';
        return urlObj.toString();
      }
      
      // 5ch URLの正規化
      if (urlObj.hostname.includes('5ch.net')) {
        // 不要なパラメータを削除
        const cleanParams = new URLSearchParams();
        urlObj.search = cleanParams.toString();
        return urlObj.toString();
      }
      
      return url;
    } catch (error) {
      return url; // 無効なURLの場合はそのまま返す
    }
  }
}