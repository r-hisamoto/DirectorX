// インジェストサービスのメインエントリーポイント

import { Asset, IngestRequest, IngestResult, AssetMetadata } from '../../types/asset';
import { AssetModel } from '../../models/asset';
import { logger } from '../../lib/logger';
import { IngestAdapter5ch } from './adapter-5ch';
import { IngestAdapterX } from './adapter-x';
import { IngestAdapterUrl } from './adapter-url';
import { IngestAdapterYoutube } from './adapter-youtube';

export interface IngestAdapter {
  canHandle(url: string): boolean;
  extract(url: string): Promise<AssetMetadata>;
  getEstimatedTime(): number; // 推定処理時間（秒）
}

export class IngestService {
  private adapters: Map<string, IngestAdapter> = new Map();

  constructor() {
    // アダプターを登録
    this.adapters.set('5ch', new IngestAdapter5ch());
    this.adapters.set('x-twitter', new IngestAdapterX());
    this.adapters.set('url', new IngestAdapterUrl());
    this.adapters.set('youtube', new IngestAdapterYoutube());
  }

  /**
   * 素材をインジェスト（取得・処理）する
   */
  async ingest(request: IngestRequest): Promise<IngestResult> {
    try {
      logger.info('Starting asset ingestion', {
        sourceType: request.sourceType,
        url: request.url,
        workspaceId: request.workspaceId,
      });

      // URLの正規化
      if (request.url) {
        request.url = AssetModel.normalizeUrl(request.url);
      }

      // アダプターの選択
      const adapter = this.selectAdapter(request);
      if (!adapter) {
        throw new Error(`Unsupported source type: ${request.sourceType}`);
      }

      // メタデータの抽出（非同期で実行される場合もある）
      let metadata: AssetMetadata = request.metadata || {};
      
      if (request.url) {
        try {
          const extractedMetadata = await adapter.extract(request.url);
          metadata = { ...metadata, ...extractedMetadata };
        } catch (extractError) {
          logger.warn('Metadata extraction failed, continuing with basic info', {
            url: request.url,
            error: extractError.message,
          });
          
          // 基本的なメタデータを設定
          metadata = {
            ...metadata,
            title: this.extractTitleFromUrl(request.url),
          };
        }
      }

      // Assetエンティティの作成
      const assetData = AssetModel.create({
        ...request,
        metadata,
      });

      // 一意IDの生成
      const assetId = this.generateAssetId();
      const asset: Asset = {
        id: assetId,
        ...assetData,
        status: 'ready', // 基本的には即座に ready にする
      };

      // 保存（実際の実装では永続化ストレージに保存）
      this.saveAsset(asset);

      logger.info('Asset ingestion completed', {
        assetId: asset.id,
        type: asset.type,
        title: asset.metadata.title,
      });

      return {
        assetId: asset.id,
        status: asset.status,
        message: '素材の取得が完了しました',
        estimatedProcessingTime: adapter.getEstimatedTime(),
      };

    } catch (error) {
      logger.error('Asset ingestion failed', {
        sourceType: request.sourceType,
        url: request.url,
        error: error.message,
      });

      throw new Error(`素材の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * URLから適切なアダプターを選択
   */
  private selectAdapter(request: IngestRequest): IngestAdapter | null {
    if (!request.url) {
      return null;
    }

    // ソースタイプが明示的に指定されている場合
    if (request.sourceType !== 'url') {
      return this.adapters.get(request.sourceType) || null;
    }

    // URLから自動判定
    const detection = AssetModel.detectSourceFromUrl(request.url);
    return this.adapters.get(detection.source) || null;
  }

  /**
   * URLからタイトルを抽出（フォールバック）
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // ファイル名がある場合
      const pathname = urlObj.pathname;
      if (pathname && pathname !== '/') {
        const filename = pathname.split('/').pop();
        if (filename && filename.includes('.')) {
          return filename.split('.')[0];
        }
        return filename || urlObj.hostname;
      }
      
      // ドメイン名を使用
      return urlObj.hostname;
    } catch {
      return 'Unknown';
    }
  }

  /**
   * 一意IDの生成
   */
  private generateAssetId(): string {
    return 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * アセットの保存（メモリ内ストレージ - 実際はDBに保存）
   */
  private assetStorage = new Map<string, Asset>();

  private saveAsset(asset: Asset): void {
    this.assetStorage.set(asset.id, asset);
  }

  /**
   * アセットの取得
   */
  getAsset(id: string): Asset | null {
    return this.assetStorage.get(id) || null;
  }

  /**
   * ワークスペース内のアセット一覧を取得
   */
  getAssetsByWorkspace(workspaceId: string, limit = 20, offset = 0): Asset[] {
    const assets = Array.from(this.assetStorage.values())
      .filter(asset => asset.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
    
    return assets;
  }

  /**
   * アセットの検索
   */
  searchAssets(workspaceId: string, query?: string, types?: string[]): Asset[] {
    let assets = Array.from(this.assetStorage.values())
      .filter(asset => asset.workspaceId === workspaceId);

    // タイプフィルター
    if (types && types.length > 0) {
      assets = assets.filter(asset => types.includes(asset.type));
    }

    // テキスト検索
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      assets = assets.filter(asset => 
        asset.metadata.title?.toLowerCase().includes(searchTerm) ||
        asset.metadata.description?.toLowerCase().includes(searchTerm) ||
        asset.url.toLowerCase().includes(searchTerm)
      );
    }

    return assets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}