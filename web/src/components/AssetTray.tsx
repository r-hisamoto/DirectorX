import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Link, 
  Upload, 
  Hash, 
  Video, 
  Search, 
  Filter,
  Image,
  FileText,
  Globe,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Volume2
} from 'lucide-react';
import { Asset, AssetSource, IngestRequest, SourceDetectionResult } from '@/types/asset';
import { useEntitiesStore } from '@/store/entities';
import { assetApi } from '@/lib/api';

interface AssetTrayProps {
  onAssetSelect?: (asset: Asset) => void;
  selectedAssets?: string[];
  multiSelect?: boolean;
}

// URL検証関数
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export function AssetTray({ onAssetSelect, selectedAssets = [], multiSelect = false }: AssetTrayProps) {
  const { currentWorkspace } = useEntitiesStore();
  const [urlInput, setUrlInput] = useState('');
  const [sourceType, setSourceType] = useState<AssetSource>('url');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // 素材一覧の取得
  const { data: assetsResponse, isLoading, refetch } = useQuery({
    queryKey: ['assets', searchQuery, filterType],
    queryFn: async () => {
      const response = await assetApi.getAssets({
        search: searchQuery || undefined,
        type: filterType !== 'all' ? filterType : undefined,
      });
      return response.data;
    },
    enabled: true,
  });

  const assets = assetsResponse?.assets || [];

  // ソース自動判定（簡易版）
  const detectSource = (url: string): AssetSource => {
    if (url.includes('5ch.net') || url.includes('5channel.net')) return '5ch';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'x-twitter';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return 'url';
  };

  // インジェスト実行
  const ingestMutation = useMutation({
    mutationFn: (request: { url?: string; title?: string; description?: string; tags?: string[] }) => 
      assetApi.ingest(request),
    onSuccess: (data) => {
      console.log('Ingest successful:', data);
      setUrlInput('');
      setShowUrlInput(false);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      refetch();
    },
    onError: (error) => {
      console.error('Ingest failed:', error);
    },
  });

  // ドラッグ&ドロップ設定
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      // ファイルアップロードは後で実装
      console.log('File drop detected:', file.name);
      // TODO: ファイルアップロード処理を実装
    });
  }, [ingestMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'text/*': ['.txt'],
      'application/pdf': ['.pdf'],
    },
  });

  // URL送信処理
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;

    const url = urlInput.trim();
    const detectedSource = detectSource(url);
    
    ingestMutation.mutate({
      url,
      title: `${detectedSource}からのインジェスト`,
      tags: [detectedSource, 'imported'],
    });
  };

  // URL変更時の自動判定
  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    
    if (value.trim() && isValidUrl(value)) {
      const source = detectSource(value.trim());
      setSourceType(source);
    }
  };

  // ファイル選択ダイアログ
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        console.log('File selected:', file.name);
        // TODO: ファイルアップロード処理を実装
      });
    }
  };

  // アセット選択処理
  const handleAssetClick = (asset: Asset) => {
    onAssetSelect?.(asset);
  };

  // アセットタイプのアイコン
  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Volume2 className="w-4 h-4" />;
      case 'text': return <FileText className="w-4 h-4" />;
      case 'social-post': return <Hash className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  // ステータスアイコン
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div 
      {...getRootProps()} 
      className={`h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${
        isDragActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''
      }`}
    >
      <input {...getInputProps()} />
      
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            素材トレイ
          </h2>
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* 検索とフィルター */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="素材を検索..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
          >
            <option value="all">すべて</option>
            <option value="image">画像</option>
            <option value="video">動画</option>
            <option value="audio">音声</option>
            <option value="text">テキスト</option>
            <option value="social-post">SNS</option>
            <option value="webpage">ウェブページ</option>
          </select>
        </div>
      </div>

      {/* URL入力エリア */}
      {showUrlInput && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                素材を追加
              </span>
              <button
                onClick={() => setShowUrlInput(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setSourceType('url')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  sourceType === 'url' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Link className="w-3 h-3" />
                <span>URL</span>
              </button>
              <button
                onClick={() => setSourceType('x-twitter')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  sourceType === 'x-twitter' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Hash className="w-3 h-3" />
                <span>X</span>
              </button>
              <button
                onClick={() => setSourceType('5ch')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  sourceType === '5ch' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Hash className="w-3 h-3" />
                <span>5ch</span>
              </button>
              <button
                onClick={() => setSourceType('youtube')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  sourceType === 'youtube' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Video className="w-3 h-3" />
                <span>YouTube</span>
              </button>
            </div>
            
            <div className="flex space-x-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="URLを入力..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim() || ingestMutation.isPending}
                className="px-3 py-2 bg-brand-primary text-black font-medium rounded-md hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleFileSelect}
                className="flex items-center space-x-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
              >
                <Upload className="w-4 h-4" />
                <span>ファイル選択</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ドラッグ&ドロップメッセージ */}
      {isDragActive && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
              ファイルをドロップして追加
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              画像、動画、音声、PDFファイル対応
            </p>
          </div>
        </div>
      )}

      {/* 素材一覧 */}
      {!isDragActive && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
                ))}
              </div>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">素材がありません</p>
              <p className="text-xs">URLやファイルを追加してください</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className={`p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                    selectedAssets.includes(asset.id) 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' 
                      : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 text-gray-500">
                      {getAssetIcon(asset.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {asset.metadata.title || 'Untitled'}
                        </p>
                        {getStatusIcon(asset.status)}
                      </div>
                      {asset.metadata.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {asset.metadata.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                        <span className="capitalize">{asset.source}</span>
                        {asset.metadata.fileSize && (
                          <span>{formatFileSize(asset.metadata.fileSize)}</span>
                        )}
                        {asset.metadata.duration && (
                          <span>{formatDuration(asset.metadata.duration)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.txt"
      />
    </div>
  );
}

// ユーティリティ関数
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}