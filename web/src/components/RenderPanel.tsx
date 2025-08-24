/**
 * RenderPanel - Final Rendering UI
 * 動画・音声ファイルの最終出力とダウンロード管理
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  Video, 
  Volume2, 
  Image as ImageIcon,
  Trash2,
  Settings,
  Eye,
  Pause,
  Square,
  Loader2
} from 'lucide-react';
import { VideoRecipe, RenderOptions } from '../lib/recipeEngine';
import RenderService, { RenderJob, RenderOutput, RenderProgress } from '../lib/renderService';

interface RenderPanelProps {
  recipe: VideoRecipe | null;
  onRenderComplete?: (job: RenderJob) => void;
  onError?: (error: string) => void;
}

interface RenderSettings {
  outputFormat: 'mp4' | 'webm' | 'mov';
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  includeAudio: boolean;
  includeSubtitles: boolean;
  includeThumbnail: boolean;
  includeScript: boolean;
}

export function RenderPanel({ recipe, onRenderComplete, onError }: RenderPanelProps) {
  const [renderService] = useState(() => new RenderService());
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [allJobs, setAllJobs] = useState<RenderJob[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [previewMode, setPreviewMode] = useState<'video' | 'audio' | 'thumbnail'>('video');
  const [settings, setSettings] = useState<RenderSettings>({
    outputFormat: 'mp4',
    quality: 'standard',
    includeAudio: true,
    includeSubtitles: true,
    includeThumbnail: true,
    includeScript: true
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // レンダーサービスのイベントハンドラー設定
  useEffect(() => {
    renderService.on('jobStart', (job) => {
      setCurrentJob(job);
      setIsRendering(true);
    });

    renderService.on('progress', (progress) => {
      setRenderProgress(progress);
    });

    renderService.on('jobComplete', (job) => {
      setCurrentJob(job);
      setIsRendering(false);
      setRenderProgress(null);
      setAllJobs(prev => [...prev.filter(j => j.id !== job.id), job]);
      onRenderComplete?.(job);
    });

    renderService.on('jobError', (jobId, error) => {
      setIsRendering(false);
      setRenderProgress(null);
      onError?.(error);
    });

    // 既存ジョブの読み込み
    setAllJobs(renderService.getAllJobs());
  }, [renderService, onRenderComplete, onError]);

  // レンダリング開始
  const startRender = useCallback(async () => {
    if (!recipe) {
      onError?.('レシピが選択されていません');
      return;
    }

    try {
      const renderOptions: RenderOptions = {
        outputFormat: settings.outputFormat,
        quality: settings.quality,
        compression: 'balanced'
      };

      const job = await renderService.createRenderJob(recipe, renderOptions);
      setCurrentJob(job);
      
      await renderService.renderJob(job.id);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'レンダリングエラー');
    }
  }, [recipe, settings, renderService, onError]);

  // ファイルダウンロード
  const downloadFile = useCallback((output: RenderOutput) => {
    if (!output.url) return;
    
    const link = document.createElement('a');
    link.href = output.url;
    link.download = output.filename;
    link.click();
  }, []);

  // ジョブ削除
  const deleteJob = useCallback((jobId: string) => {
    renderService.deleteJob(jobId);
    setAllJobs(prev => prev.filter(job => job.id !== jobId));
    if (currentJob?.id === jobId) {
      setCurrentJob(null);
    }
  }, [renderService, currentJob]);

  // 設定更新
  const updateSettings = (updates: Partial<RenderSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 時間フォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // プレビュー表示
  const renderPreview = () => {
    if (!currentJob || currentJob.status !== 'completed') {
      return (
        <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Eye className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">プレビューなし</p>
          </div>
        </div>
      );
    }

    const videoOutput = currentJob.outputs.find(o => o.type === 'video');
    const audioOutput = currentJob.outputs.find(o => o.type === 'audio');
    const thumbnailOutput = currentJob.outputs.find(o => o.type === 'thumbnail');

    switch (previewMode) {
      case 'video':
        return videoOutput?.url ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video 
              src={videoOutput.url} 
              controls 
              className="w-full h-full"
              poster={thumbnailOutput?.url}
            />
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">動画なし</p>
          </div>
        );

      case 'audio':
        return audioOutput?.url ? (
          <div className="aspect-video bg-gradient-to-br from-purple-900 to-blue-900 rounded-lg flex items-center justify-center">
            <div className="text-center text-white">
              <Volume2 className="w-16 h-16 mx-auto mb-4" />
              <audio ref={audioRef} src={audioOutput.url} controls className="mb-2" />
              <p className="text-sm opacity-75">音声プレビュー</p>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">音声なし</p>
          </div>
        );

      case 'thumbnail':
        return thumbnailOutput?.url ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <img 
              src={thumbnailOutput.url} 
              alt="サムネイル" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">サムネイルなし</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex-none p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          最終レンダリング
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          動画・音声ファイルの生成と出力
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* プレビューエリア */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">プレビュー</h4>
            <div className="flex space-x-1">
              {[
                { id: 'video', label: '動画', icon: <Video className="w-4 h-4" /> },
                { id: 'audio', label: '音声', icon: <Volume2 className="w-4 h-4" /> },
                { id: 'thumbnail', label: 'サムネ', icon: <ImageIcon className="w-4 h-4" /> }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setPreviewMode(mode.id as any)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                    previewMode === mode.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          
          {renderPreview()}
        </div>

        {/* レンダリング設定 */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            レンダリング設定
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出力形式
              </label>
              <select
                value={settings.outputFormat}
                onChange={(e) => updateSettings({ outputFormat: e.target.value as RenderSettings['outputFormat'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="mov">MOV</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                品質
              </label>
              <select
                value={settings.quality}
                onChange={(e) => updateSettings({ quality: e.target.value as RenderSettings['quality'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="draft">ドラフト</option>
                <option value="standard">標準</option>
                <option value="high">高品質</option>
                <option value="ultra">最高品質</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">含める要素</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'includeAudio' as keyof RenderSettings, label: '音声' },
                { key: 'includeSubtitles' as keyof RenderSettings, label: '字幕' },
                { key: 'includeThumbnail' as keyof RenderSettings, label: 'サムネイル' },
                { key: 'includeScript' as keyof RenderSettings, label: '台本' }
              ].map((option) => (
                <label key={option.key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings[option.key] as boolean}
                    onChange={(e) => updateSettings({ [option.key]: e.target.checked })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* レンダリング進捗 */}
        {(isRendering || renderProgress) && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              レンダリング進捗
            </h4>
            
            <div className="bg-gray-50 rounded-lg p-4">
              {renderProgress && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{renderProgress.step}</span>
                    <span className="text-sm text-gray-600">{Math.round(renderProgress.progress)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${renderProgress.progress}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{renderProgress.message}</span>
                    <span>
                      経過: {Math.round(renderProgress.timeElapsed / 1000)}秒
                      {renderProgress.timeRemaining && (
                        <> | 残り: {Math.round(renderProgress.timeRemaining / 1000)}秒</>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 出力ファイル */}
        {currentJob && currentJob.outputs.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Download className="w-4 h-4" />
              出力ファイル
            </h4>
            
            <div className="space-y-2">
              {currentJob.outputs.map((output, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {output.type === 'video' && <Video className="w-4 h-4 text-blue-500" />}
                      {output.type === 'audio' && <Volume2 className="w-4 h-4 text-green-500" />}
                      {output.type === 'subtitle' && <FileText className="w-4 h-4 text-purple-500" />}
                      {output.type === 'thumbnail' && <ImageIcon className="w-4 h-4 text-orange-500" />}
                      {output.type === 'project' && <FileText className="w-4 h-4 text-gray-500" />}
                    </div>
                    
                    <div>
                      <div className="font-medium text-sm">{output.filename}</div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(output.size)}
                        {output.duration && <> • {formatTime(output.duration)}</>}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => downloadFile(output)}
                    disabled={!output.url}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3 h-3" />
                    DL
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* レンダリング履歴 */}
        {allJobs.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              レンダリング履歴
            </h4>
            
            <div className="space-y-2">
              {allJobs.slice(-5).reverse().map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {job.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {job.status === 'processing' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                      {job.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {job.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                    </div>
                    
                    <div>
                      <div className="font-medium text-sm">{job.recipe.title}</div>
                      <div className="text-xs text-gray-500">
                        {job.startTime.toLocaleString()}
                        {job.endTime && <> - {job.endTime.toLocaleString()}</>}
                        • {job.outputs.length}ファイル
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentJob(job)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      表示
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 統計情報 */}
        {recipe && (
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>レシピ:</span>
              <span>{recipe.title}</span>
            </div>
            <div className="flex justify-between">
              <span>推定時間:</span>
              <span>{recipe.ttsResult ? formatTime(recipe.ttsResult.totalDuration) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>解像度:</span>
              <span>{recipe.videoConfig.resolution}</span>
            </div>
            <div className="flex justify-between">
              <span>フレームレート:</span>
              <span>{recipe.videoConfig.frameRate} FPS</span>
            </div>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex-none p-4 border-t border-gray-200">
        <button
          onClick={startRender}
          disabled={!recipe || isRendering}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isRendering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              レンダリング中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              レンダリング開始
            </>
          )}
        </button>
        
        {!recipe && (
          <p className="text-xs text-gray-500 text-center mt-2">
            レシピタブでレシピを作成してください
          </p>
        )}
      </div>
    </div>
  );
}

export default RenderPanel;