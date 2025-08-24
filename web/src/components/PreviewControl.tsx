import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack,
  Volume2,
  VolumeX,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Eye,
  Headphones,
  Video,
  FileText,
  BarChart3,
  Zap
} from 'lucide-react';
import type { Asset } from '@/types/asset';
import { TTSPanel } from './TTSPanel';
import type { TTSResult } from '@/lib/ttsService';
import { RecipePanel } from './RecipePanel';
import type { VideoRecipe } from '@/lib/recipeEngine';

interface PreviewControlProps {
  scriptContent?: string;
  selectedAssets?: Asset[];
  isGenerating?: boolean;
  onStartProcessing?: () => void;
}

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  result?: any;
  icon: React.ReactNode;
}

interface QCResult {
  category: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
  details?: string;
}

export function PreviewControl({ 
  scriptContent = '', 
  selectedAssets = [],
  isGenerating = false,
  onStartProcessing 
}: PreviewControlProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'progress' | 'control' | 'qc' | 'tts' | 'recipe'>('preview');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(120); // 2分のデモ
  const [ttsResult, setTTSResult] = useState<TTSResult | null>(null);
  const [ttsError, setTTSError] = useState<string>('');
  const [currentRecipe, setCurrentRecipe] = useState<VideoRecipe | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    {
      id: 'script',
      name: '台本生成',
      status: 'completed',
      duration: 2.3,
      icon: <FileText className="w-4 h-4" />
    },
    {
      id: 'tts',
      name: 'TTS生成',
      status: 'pending',
      icon: <Headphones className="w-4 h-4" />
    },
    {
      id: 'video',
      name: '動画生成',
      status: 'pending',
      icon: <Video className="w-4 h-4" />
    },
    {
      id: 'qc',
      name: '品質チェック',
      status: 'pending',
      icon: <CheckCircle className="w-4 h-4" />
    }
  ]);

  const [qcResults, setQCResults] = useState<QCResult[]>([
    {
      category: '台本品質',
      status: 'pass',
      message: '適切な長さと構成',
      details: '文字数: 856文字, 推定再生時間: 2分15秒'
    },
    {
      category: 'SRT形式',
      status: 'warning',
      message: '一部の行が長すぎます',
      details: '3行が20文字を超過しています'
    },
    {
      category: 'アセット品質',
      status: 'pass',
      message: '全アセットが利用可能',
      details: `${selectedAssets.length}件のアセットが正常に読み込まれました`
    }
  ]);

  // 台本内容が変更されたときにステップ状態を更新
  useEffect(() => {
    if (scriptContent.trim()) {
      setProcessingSteps(prev => prev.map(step => 
        step.id === 'script' 
          ? { ...step, status: 'completed', duration: 1.2 }
          : step
      ));
    }
  }, [scriptContent]);

  // タイマー処理（デモ用）
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalTime) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepStatusIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getQCStatusColor = (status: QCResult['status']) => {
    switch (status) {
      case 'pass':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  // TTS関連のハンドラ
  const handleTTSGenerated = (result: TTSResult) => {
    setTTSResult(result);
    setTTSError('');
    
    // TTS完了ステップを更新
    setProcessingSteps(prev => prev.map(step => 
      step.id === 'tts' 
        ? { ...step, status: 'completed', duration: result.totalDuration }
        : step
    ));
    
    console.log('TTS generated:', result);
  };

  const handleTTSError = (error: string) => {
    setTTSError(error);
    setProcessingSteps(prev => prev.map(step => 
      step.id === 'tts' 
        ? { ...step, status: 'error' }
        : step
    ));
  };

  const handleStartProcessing = () => {
    // TTS生成状況に応じて処理開始
    if (ttsResult) {
      // TTS完了済みの場合は動画生成から開始
      setProcessingSteps(prev => prev.map(step => 
        step.id === 'video' 
          ? { ...step, status: 'processing' }
          : step
      ));

      // 5秒後に動画完了
      setTimeout(() => {
        setProcessingSteps(prev => prev.map(step => 
          step.id === 'video' 
            ? { ...step, status: 'completed', duration: 45.2 }
            : step.id === 'qc'
            ? { ...step, status: 'processing' }
            : step
        ));
      }, 5000);

      // 7秒後にQC完了
      setTimeout(() => {
        setProcessingSteps(prev => prev.map(step => 
          step.id === 'qc' 
            ? { ...step, status: 'completed', duration: 2.1 }
            : step
        ));
      }, 7000);
    } else {
      // TTS未生成の場合はTTSタブに誘導
      setActiveTab('tts');
    }

    onStartProcessing?.();
  };

  const renderPreviewTab = () => (
    <div className="space-y-4">
      {/* プレビュー表示エリア */}
      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <div className="aspect-video bg-gray-800 rounded flex items-center justify-center mb-4">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-2 text-gray-500" />
            <p className="text-sm text-gray-400">プレビュー生成中...</p>
          </div>
        </div>

        {/* 再生コントロール */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          <button className="p-2 hover:bg-gray-700 rounded">
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button className="p-2 hover:bg-gray-700 rounded">
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="flex-1 mx-4">
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <div className="flex-1 bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all"
                  style={{ width: `${(currentTime / totalTime) * 100}%` }}
                />
              </div>
              <span>{formatTime(totalTime)}</span>
            </div>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-gray-700 rounded"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* スクリプトプレビュー */}
      {scriptContent && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">現在の台本</h4>
          <div className="text-sm text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
            {scriptContent.split('\n').slice(0, 6).map((line, index) => (
              <p key={index} className="mb-1">{line}</p>
            ))}
            {scriptContent.split('\n').length > 6 && (
              <p className="text-gray-500 italic">...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderProgressTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <BarChart3 className="w-4 h-4 mr-2" />
          処理進捗
        </h4>
        
        <div className="space-y-3">
          {processingSteps.map((step) => (
            <div key={step.id} className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {getStepStatusIcon(step.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {step.name}
                  </span>
                  {step.duration && (
                    <span className="text-xs text-gray-500">
                      {step.duration}s
                    </span>
                  )}
                </div>
                <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      step.status === 'completed' ? 'bg-green-500 w-full' :
                      step.status === 'processing' ? 'bg-blue-500 w-3/4' :
                      step.status === 'error' ? 'bg-red-500 w-1/2' :
                      'bg-gray-300 w-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="text-xs text-blue-600 dark:text-blue-400">アセット数</div>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {selectedAssets.length}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="text-xs text-green-600 dark:text-green-400">文字数</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-300">
            {scriptContent.length}
          </div>
        </div>
      </div>
    </div>
  );

  const renderControlTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <Zap className="w-4 h-4 mr-2" />
          バッチ制御
        </h4>
        
        <div className="space-y-3">
          {/* TTS状況表示 */}
          {ttsResult ? (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-300">
              ✅ TTS生成完了 ({ttsResult.segments.length}セグメント)
            </div>
          ) : ttsError ? (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
              ❌ TTS生成エラー
            </div>
          ) : scriptContent ? (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ TTSタブで音声を生成してください
            </div>
          ) : null}

          <button
            onClick={handleStartProcessing}
            disabled={!scriptContent.trim() || isGenerating}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            <span>{ttsResult ? '動画生成開始' : '全工程実行'}</span>
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              <Headphones className="w-4 h-4" />
              <span>TTS</span>
            </button>
            <button className="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              <Video className="w-4 h-4" />
              <span>動画</span>
            </button>
          </div>
        </div>
      </div>

      {/* 設定 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          設定
        </h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 dark:text-gray-300">音声品質</span>
            <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700">
              <option>標準</option>
              <option>高音質</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700 dark:text-gray-300">動画解像度</span>
            <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700">
              <option>1080p</option>
              <option>720p</option>
              <option>4K</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTTSTab = () => (
    <TTSPanel
      scriptContent={scriptContent}
      onAudioGenerated={handleTTSGenerated}
      onError={handleTTSError}
    />
  );

  const renderRecipeTab = () => (
    <RecipePanel
      assetIds={selectedAssets.map(asset => asset.id)}
      scriptContent={scriptContent}
      onRecipeComplete={(recipe) => {
        setCurrentRecipe(recipe);
        console.log('Recipe completed:', recipe);
      }}
      onError={(error) => {
        console.error('Recipe error:', error);
      }}
    />
  );

  const renderQCTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          品質チェック結果
        </h4>
        
        <div className="space-y-3">
          {qcResults.map((result, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getQCStatusColor(result.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.category}</div>
                  <div className="text-sm mt-1">{result.message}</div>
                  {result.details && (
                    <div className="text-xs mt-2 opacity-75">{result.details}</div>
                  )}
                </div>
                <div className="flex-shrink-0 ml-2">
                  {result.status === 'pass' && <CheckCircle className="w-4 h-4" />}
                  {result.status === 'warning' && <AlertCircle className="w-4 h-4" />}
                  {result.status === 'error' && <AlertCircle className="w-4 h-4" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ダウンロード */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Download className="w-4 h-4 mr-2" />
          出力ファイル
        </h4>
        
        <div className="space-y-2">
          <button className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <span>台本.txt</span>
            <Download className="w-4 h-4" />
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <span>字幕.srt</span>
            <Download className="w-4 h-4" />
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 opacity-50 cursor-not-allowed">
            <span>動画.mp4</span>
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* タブヘッダー */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          {[
            { id: 'preview', label: 'プレビュー', icon: <Eye className="w-4 h-4" /> },
            { id: 'tts', label: 'TTS', icon: <Headphones className="w-4 h-4" /> },
            { id: 'recipe', label: 'レシピ', icon: <Zap className="w-4 h-4" /> },
            { id: 'progress', label: '進捗', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'control', label: '制御', icon: <Settings className="w-4 h-4" /> },
            { id: 'qc', label: 'QC', icon: <CheckCircle className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'preview' && renderPreviewTab()}
        {activeTab === 'tts' && renderTTSTab()}
        {activeTab === 'recipe' && renderRecipeTab()}
        {activeTab === 'progress' && renderProgressTab()}
        {activeTab === 'control' && renderControlTab()}
        {activeTab === 'qc' && renderQCTab()}
      </div>
    </div>
  );
}