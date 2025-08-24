// Asset (素材) 関連の型定義 (フロントエンド用)

export interface Asset {
  id: string;
  workspaceId?: string;
  type: AssetType;
  source: AssetSource;
  url?: string;
  originalUrl?: string;
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
  title?: string;
  description?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  siteName?: string;
  author?: string;
  publishedAt?: Date;
  socialMetadata?: SocialMetadata;
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
  board: string;
  threadId: string;
  threadTitle: string;
  posts: {
    number: number;
    name: string;
    email?: string;
    date: string;
    id: string;
    content: string;
    isOp?: boolean;
  }[];
  totalPosts?: number;
}

export interface LicenseInfo {
  type: 'cc0' | 'cc-by' | 'cc-by-sa' | 'fair-use' | 'unknown';
  attribution?: string;
  url?: string;
  restrictions?: string[];
}

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

export interface IngestResult {
  success: boolean;
  asset?: Asset;
  assetId?: string;
  status?: AssetStatus;
  message?: string;
  error?: string;
  estimatedProcessingTime?: number;
}

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

export interface SourceDetectionResult {
  sourceType: AssetSource;
  confidence: number;
  suggestions: {
    type: string;
    reason: string;
  }[];
}