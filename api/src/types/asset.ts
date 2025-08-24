// Asset (素材) 関連の型定義

export interface Asset {
  id: string;
  workspaceId?: string;
  type: AssetType;
  source: AssetSource;
  url?: string;
  originalUrl?: string; // 元のURL（リダイレクト前）
  title?: string;
  description?: string;
  content?: string;
  metadata: AssetMetadata;
  license?: LicenseInfo;
  status?: AssetStatus;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type AssetType = 'url' | 'file' | 'social' | 'thread' | 'video' | 'image' | 'audio' | 'text' | 'webpage' | 'social-post';

export type AssetSource = 'upload' | 'url' | 'x-twitter' | '5ch' | 'youtube' | 'generated';

export type AssetStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface AssetMetadata {
  // 共通メタデータ
  title?: string;
  description?: string;
  fileSize?: number;
  mimeType?: string;
  
  // メディア固有
  duration?: number; // 音声・動画の長さ（秒）
  dimensions?: {
    width: number;
    height: number;
  };
  
  // ウェブページ固有
  siteName?: string;
  author?: string;
  publishedAt?: Date;
  
  // SNS固有
  socialMetadata?: SocialMetadata;
  
  // 5ch固有  
  threadMetadata?: ThreadMetadata;
}

export interface SocialMetadata {
  platform: 'x' | 'twitter';
  username: string;
  displayName: string;
  postId: string;
  postText: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  attachments?: {
    type: 'image' | 'video' | 'gif';
    url: string;
    altText?: string;
  }[];
}

export interface ThreadMetadata {
  board: string; // 板名
  threadId: string;
  threadTitle: string;
  posts: {
    number: number;
    name: string;
    email?: string;
    date: string;
    id: string;
    content: string;
    isOp?: boolean; // スレ主かどうか
  }[];
  totalPosts?: number;
}

export interface LicenseInfo {
  type: 'cc0' | 'cc-by' | 'cc-by-sa' | 'fair-use' | 'unknown';
  attribution?: string;
  url?: string;
  restrictions?: string[];
}

// インジェスト（取得）リクエスト
export interface IngestRequest {
  sourceType?: AssetSource;
  url?: string;
  file?: {
    path: string;
    originalName: string;
    mimeType?: string;
    size?: number;
  };
  workspaceId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: Partial<AssetMetadata>;
}

// インジェスト結果
export interface IngestResult {
  success: boolean;
  asset?: Asset;
  assetId?: string;
  status?: AssetStatus;
  message?: string;
  error?: string;
  estimatedProcessingTime?: number; // 秒
}

// リストアセット用の型
export interface ListAssetsRequest {
  page: number;
  limit: number;
  type?: AssetType;
  source?: string;
  search?: string;
}

export interface ListAssetsResponse {
  assets: Asset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// アセット削除用の型
export interface DeleteAssetRequest {
  id: string;
}

export interface DeleteAssetResponse {
  success: boolean;
  id: string;
}

// 検索・フィルター
export interface AssetFilter {
  workspaceId: string;
  types?: AssetType[];
  sources?: AssetSource[];
  status?: AssetStatus[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AssetSearchResult {
  assets: Asset[];
  total: number;
  hasMore: boolean;
}