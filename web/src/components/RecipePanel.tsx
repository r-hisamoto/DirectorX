/**
 * RecipePanel - Video Recipe Engine UI
 * 動画制作のワークフロー管理とプログレス表示
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  RecipeEngine, 
  VideoRecipe, 
  VideoConfig, 
  RenderOptions, 
  RecipeStep,
  DEFAULT_TEMPLATES,
  VideoTemplate 
} from '../lib/recipeEngine';

interface RecipePanelProps {
  assetIds: string[];
  scriptContent: string;
  onRecipeComplete?: (recipe: VideoRecipe) => void;
  onError?: (error: string) => void;
}

interface RecipeFormData {
  title: string;
  description: string;
  template: VideoTemplate;
  resolution: '1920x1080' | '1280x720' | '3840x2160';
  frameRate: 30 | 60;
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  outputFormat: 'mp4' | 'webm' | 'mov';
}

export function RecipePanel({ 
  assetIds, 
  scriptContent, 
  onRecipeComplete, 
  onError 
}: RecipePanelProps) {
  const [engine] = useState(() => new RecipeEngine());
  const [currentRecipe, setCurrentRecipe] = useState<VideoRecipe | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<RecipeStep | null>(null);
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '新しい動画',
    description: '',
    template: DEFAULT_TEMPLATES[0],
    resolution: '1920x1080',
    frameRate: 30,
    quality: 'standard',
    outputFormat: 'mp4'
  });

  // レシピエンジンのイベントハンドラー設定
  useEffect(() => {
    engine.on('stepStart', (step) => {
      setCurrentStep(step);
    });

    engine.on('stepProgress', (stepId, progress) => {
      setCurrentStep(prev => 
        prev && prev.id === stepId 
          ? { ...prev, progress } 
          : prev
      );
    });

    engine.on('stepComplete', (step) => {
      setCurrentStep(step);
    });

    engine.on('stepError', (stepId, error) => {
      onError?.(error);
      setIsProcessing(false);
    });

    engine.on('recipeComplete', (recipe) => {
      setIsProcessing(false);
      onRecipeComplete?.(recipe);
    });

    engine.on('recipeError', (error) => {
      onError?.(error);
      setIsProcessing(false);
    });
  }, [engine, onRecipeComplete, onError]);

  // レシピ作成
  const createRecipe = useCallback(() => {
    if (!scriptContent.trim()) {
      onError?.('台本が入力されていません');
      return;
    }

    const videoConfig: VideoConfig = {
      resolution: formData.resolution,
      frameRate: formData.frameRate,
      duration: 0, // 動的に計算
      template: formData.template,
      background: {
        type: 'solid',
        color: '#1a1a1a'
      },
      textStyle: {
        fontFamily: 'Noto Sans JP',
        fontSize: 24,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 16,
        position: 'bottom',
        animation: 'fade-in'
      }
    };

    const recipe = engine.createRecipe(
      formData.title,
      formData.description,
      assetIds,
      scriptContent,
      videoConfig
    );

    setCurrentRecipe(recipe);
  }, [engine, assetIds, scriptContent, formData, onError]);

  // レシピ実行
  const executeRecipe = useCallback(async () => {
    if (!currentRecipe) {
      onError?.('レシピが作成されていません');
      return;
    }

    const renderOptions: RenderOptions = {
      outputFormat: formData.outputFormat,
      quality: formData.quality,
      compression: 'balanced'
    };

    setIsProcessing(true);
    
    try {
      await engine.executeRecipe(currentRecipe, renderOptions);
    } catch (error) {
      console.error('Recipe execution error:', error);
    }
  }, [engine, currentRecipe, formData, onError]);

  // フォーム更新
  const updateFormData = (updates: Partial<RecipeFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex-none p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          レシピエンジン
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          動画制作パイプラインの設定と実行
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 基本設定 */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">基本設定</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              動画タイトル
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="動画のタイトルを入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder="動画の説明（オプション）"
            />
          </div>
        </div>

        {/* テンプレート選択 */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">テンプレート</h4>
          
          <div className="grid gap-3">
            {DEFAULT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.template.id === template.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => updateFormData({ template })}
              >
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-gray-600 mt-1">{template.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 動画設定 */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">動画設定</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                解像度
              </label>
              <select
                value={formData.resolution}
                onChange={(e) => updateFormData({ 
                  resolution: e.target.value as RecipeFormData['resolution'] 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="1280x720">HD (720p)</option>
                <option value="1920x1080">Full HD (1080p)</option>
                <option value="3840x2160">4K (2160p)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                フレームレート
              </label>
              <select
                value={formData.frameRate}
                onChange={(e) => updateFormData({ 
                  frameRate: parseInt(e.target.value) as RecipeFormData['frameRate'] 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                品質
              </label>
              <select
                value={formData.quality}
                onChange={(e) => updateFormData({ 
                  quality: e.target.value as RecipeFormData['quality'] 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="draft">ドラフト</option>
                <option value="standard">標準</option>
                <option value="high">高品質</option>
                <option value="ultra">最高品質</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出力形式
              </label>
              <select
                value={formData.outputFormat}
                onChange={(e) => updateFormData({ 
                  outputFormat: e.target.value as RecipeFormData['outputFormat'] 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="mov">MOV</option>
              </select>
            </div>
          </div>
        </div>

        {/* レシピ状態 */}
        {currentRecipe && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">レシピ状態</h4>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {currentRecipe.title}
              </div>
              <div className="text-xs text-gray-600">
                アセット: {currentRecipe.assetIds.length}個 | 
                作成日時: {currentRecipe.createdAt.toLocaleString()}
              </div>
            </div>

            {/* ステップ進行状況 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">進行状況</div>
              {currentRecipe.steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{step.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        step.status === 'completed' ? 'bg-green-100 text-green-800' :
                        step.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        step.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {step.status === 'completed' ? '完了' :
                         step.status === 'running' ? '実行中' :
                         step.status === 'error' ? 'エラー' : '待機中'}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          step.status === 'completed' ? 'bg-green-500' :
                          step.status === 'running' ? 'bg-blue-500' :
                          step.status === 'error' ? 'bg-red-500' :
                          'bg-gray-300'
                        }`}
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                    
                    {step.error && (
                      <div className="text-xs text-red-600 mt-1">{step.error}</div>
                    )}
                    
                    {step.duration && (
                      <div className="text-xs text-gray-500 mt-1">
                        継続時間: {step.duration.toFixed(1)}秒
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 統計情報 */}
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>アセット数:</span>
            <span>{assetIds.length}個</span>
          </div>
          <div className="flex justify-between">
            <span>台本文字数:</span>
            <span>{scriptContent.length}文字</span>
          </div>
          <div className="flex justify-between">
            <span>推定動画長:</span>
            <span>{Math.ceil(scriptContent.length * 0.2)}秒</span>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex-none p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={createRecipe}
          disabled={!scriptContent.trim() || isProcessing}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          レシピ作成
        </button>
        
        <button
          onClick={executeRecipe}
          disabled={!currentRecipe || isProcessing}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              実行中...
            </>
          ) : (
            '動画生成実行'
          )}
        </button>

        {currentStep && (
          <div className="text-center text-sm text-gray-600">
            {currentStep.name}: {Math.round(currentStep.progress)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default RecipePanel;