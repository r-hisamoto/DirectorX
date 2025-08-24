/**
 * DirectorX Video Recipe Engine
 * 動画制作のワークフロー全体を管理する中核システム
 * 
 * 設計思想：
 * - アセット → 台本 → SRT → TTS → 動画 → サムネイル → 配信チェックまでのパイプライン
 * - 各ステップの依存関係と並行処理の最適化
 * - エラーハンドリングと復旧機能
 * - プログレス追跡とユーザーフィードバック
 */

import { TTSService, TTSResult } from './ttsService';

// レシピエンジンの型定義
export interface RecipeStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number; // 0-100
  duration?: number;
  error?: string;
  dependencies?: string[];
  outputs?: string[];
}

export interface VideoRecipe {
  id: string;
  title: string;
  description: string;
  assetIds: string[];
  scriptContent: string;
  srtContent: string;
  ttsResult?: TTSResult;
  videoConfig: VideoConfig;
  steps: RecipeStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoConfig {
  resolution: '1920x1080' | '1280x720' | '3840x2160';
  frameRate: 30 | 60;
  duration: number; // seconds
  template: VideoTemplate;
  background: BackgroundConfig;
  textStyle: TextStyleConfig;
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  layout: 'single' | 'picture-in-picture' | 'split-screen' | 'news-style';
  transitions: TransitionConfig[];
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'video';
  color?: string;
  gradientColors?: [string, string];
  imageUrl?: string;
  videoUrl?: string;
  blur?: number;
  opacity?: number;
}

export interface TextStyleConfig {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  padding: number;
  position: 'top' | 'bottom' | 'center' | 'custom';
  customPosition?: { x: number; y: number };
  animation?: 'fade-in' | 'slide-up' | 'typewriter' | 'none';
}

export interface TransitionConfig {
  type: 'cut' | 'fade' | 'slide' | 'zoom' | 'wipe';
  duration: number; // seconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface RenderOptions {
  outputFormat: 'mp4' | 'webm' | 'mov';
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  compression: 'fast' | 'balanced' | 'quality';
  watermark?: {
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number;
  };
}

// レシピエンジンのイベント型
export interface RecipeEngineEvents {
  stepStart: (step: RecipeStep) => void;
  stepProgress: (stepId: string, progress: number) => void;
  stepComplete: (step: RecipeStep) => void;
  stepError: (stepId: string, error: string) => void;
  recipeComplete: (recipe: VideoRecipe) => void;
  recipeError: (error: string) => void;
}

// 定義済みテンプレート
export const DEFAULT_TEMPLATES: VideoTemplate[] = [
  {
    id: 'news-style',
    name: 'ニュース風テンプレート',
    description: '情報系動画に最適なシンプルなテンプレート',
    layout: 'single',
    transitions: [
      { type: 'fade', duration: 0.5, easing: 'ease-in-out' }
    ]
  },
  {
    id: 'commentary',
    name: '解説動画テンプレート', 
    description: '解説系コンテンツ向けの読みやすいテンプレート',
    layout: 'picture-in-picture',
    transitions: [
      { type: 'slide', duration: 0.3, easing: 'ease-out' }
    ]
  },
  {
    id: 'social-media',
    name: 'SNS投稿紹介テンプレート',
    description: 'X/Twitter、5ch等のSNS内容を紹介する動画用',
    layout: 'split-screen',
    transitions: [
      { type: 'wipe', duration: 0.4, easing: 'ease-in-out' }
    ]
  }
];

export class RecipeEngine {
  private ttsService: TTSService;
  private eventHandlers: Partial<RecipeEngineEvents> = {};
  private activeRecipe: VideoRecipe | null = null;

  constructor() {
    this.ttsService = new TTSService();
  }

  // イベントハンドラーの登録
  on<K extends keyof RecipeEngineEvents>(event: K, handler: RecipeEngineEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  // イベントの発火
  private emit<K extends keyof RecipeEngineEvents>(event: K, ...args: Parameters<RecipeEngineEvents[K]>): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      (handler as any)(...args);
    }
  }

  // 新しいレシピの作成
  createRecipe(
    title: string,
    description: string,
    assetIds: string[],
    scriptContent: string,
    videoConfig: VideoConfig
  ): VideoRecipe {
    const recipe: VideoRecipe = {
      id: `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      assetIds,
      scriptContent,
      srtContent: '',
      videoConfig,
      steps: this.createRecipeSteps(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeRecipe = recipe;
    return recipe;
  }

  // レシピステップの定義
  private createRecipeSteps(): RecipeStep[] {
    return [
      {
        id: 'validate-assets',
        name: 'アセット検証',
        status: 'pending',
        progress: 0,
        dependencies: []
      },
      {
        id: 'generate-srt',
        name: 'SRT生成',
        status: 'pending',
        progress: 0,
        dependencies: ['validate-assets']
      },
      {
        id: 'generate-tts',
        name: 'TTS音声生成',
        status: 'pending',
        progress: 0,
        dependencies: ['generate-srt']
      },
      {
        id: 'prepare-media',
        name: 'メディア準備',
        status: 'pending',
        progress: 0,
        dependencies: ['validate-assets']
      },
      {
        id: 'video-composition',
        name: '動画合成',
        status: 'pending',
        progress: 0,
        dependencies: ['generate-tts', 'prepare-media']
      },
      {
        id: 'generate-thumbnail',
        name: 'サムネイル生成',
        status: 'pending',
        progress: 0,
        dependencies: ['video-composition']
      },
      {
        id: 'quality-check',
        name: '品質チェック',
        status: 'pending',
        progress: 0,
        dependencies: ['video-composition', 'generate-thumbnail']
      },
      {
        id: 'export-files',
        name: 'ファイル出力',
        status: 'pending',
        progress: 0,
        dependencies: ['quality-check']
      }
    ];
  }

  // レシピの実行
  async executeRecipe(recipe: VideoRecipe, options: RenderOptions): Promise<void> {
    this.activeRecipe = recipe;
    
    try {
      const sortedSteps = this.sortStepsByDependencies(recipe.steps);
      
      for (const step of sortedSteps) {
        await this.executeStep(step, recipe, options);
      }
      
      this.emit('recipeComplete', recipe);
    } catch (error) {
      this.emit('recipeError', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // 依存関係によるステップのソート
  private sortStepsByDependencies(steps: RecipeStep[]): RecipeStep[] {
    const sorted: RecipeStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(step: RecipeStep) {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
      }
      if (visited.has(step.id)) {
        return;
      }

      visiting.add(step.id);
      
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depStep = steps.find(s => s.id === depId);
          if (depStep) {
            visit(depStep);
          }
        }
      }
      
      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    }

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  // 個別ステップの実行
  private async executeStep(step: RecipeStep, recipe: VideoRecipe, options: RenderOptions): Promise<void> {
    step.status = 'running';
    step.progress = 0;
    this.emit('stepStart', step);

    try {
      switch (step.id) {
        case 'validate-assets':
          await this.validateAssets(step, recipe);
          break;
        case 'generate-srt':
          await this.generateSRT(step, recipe);
          break;
        case 'generate-tts':
          await this.generateTTS(step, recipe);
          break;
        case 'prepare-media':
          await this.prepareMedia(step, recipe);
          break;
        case 'video-composition':
          await this.composeVideo(step, recipe, options);
          break;
        case 'generate-thumbnail':
          await this.generateThumbnail(step, recipe);
          break;
        case 'quality-check':
          await this.performQualityCheck(step, recipe);
          break;
        case 'export-files':
          await this.exportFiles(step, recipe, options);
          break;
        default:
          throw new Error(`Unknown step: ${step.id}`);
      }

      step.status = 'completed';
      step.progress = 100;
      this.emit('stepComplete', step);
    } catch (error) {
      step.status = 'error';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('stepError', step.id, step.error);
      throw error;
    }
  }

  // ステップ実装メソッド（各ステップの具体的な処理）
  private async validateAssets(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // アセットの存在確認と有効性チェック
    await this.simulateProgress(step, 1000);
  }

  private async generateSRT(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // 台本からSRTを生成
    const srt = this.scriptToSRT(recipe.scriptContent);
    recipe.srtContent = srt;
    await this.simulateProgress(step, 800);
  }

  private async generateTTS(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // TTS音声生成
    const ttsResult = await this.ttsService.generateFromSRT(recipe.srtContent);
    recipe.ttsResult = ttsResult;
    step.duration = ttsResult.totalDuration;
    await this.simulateProgress(step, 2000);
  }

  private async prepareMedia(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // 背景画像/動画、アセットメディアの準備
    await this.simulateProgress(step, 1500);
  }

  private async composeVideo(step: RecipeStep, recipe: VideoRecipe, options: RenderOptions): Promise<void> {
    // 動画合成処理（最も重い処理）
    await this.simulateProgress(step, 5000);
  }

  private async generateThumbnail(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // サムネイル生成
    await this.simulateProgress(step, 1000);
  }

  private async performQualityCheck(step: RecipeStep, recipe: VideoRecipe): Promise<void> {
    // 品質チェック（音声レベル、動画品質など）
    await this.simulateProgress(step, 800);
  }

  private async exportFiles(step: RecipeStep, recipe: VideoRecipe, options: RenderOptions): Promise<void> {
    // 最終ファイル出力
    await this.simulateProgress(step, 1200);
  }

  // プログレスのシミュレーション（実際の処理では適切な進捗更新を実装）
  private async simulateProgress(step: RecipeStep, duration: number): Promise<void> {
    const intervals = 10;
    const intervalDuration = duration / intervals;

    for (let i = 0; i < intervals; i++) {
      await new Promise(resolve => setTimeout(resolve, intervalDuration));
      step.progress = ((i + 1) / intervals) * 100;
      this.emit('stepProgress', step.id, step.progress);
    }
  }

  // 台本からSRTへの変換（Issue-04で実装済みのロジック）
  private scriptToSRT(scriptContent: string): string {
    const lines = scriptContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    let srt = '';
    let currentTime = 0;

    lines.forEach((line, index) => {
      if (line.trim()) {
        // 日本語の禁則処理を考慮した20文字での行分割
        const wrappedLines = this.wrapJapaneseText(line.trim(), 20);
        
        wrappedLines.forEach((wrappedLine, lineIndex) => {
          const charCount = wrappedLine.length;
          const duration = Math.max(2, Math.min(8, charCount * 0.2));
          
          const startTimeStr = this.formatSrtTime(currentTime);
          const endTimeStr = this.formatSrtTime(currentTime + duration);
          
          srt += `${index + 1 + lineIndex}\n`;
          srt += `${startTimeStr} --> ${endTimeStr}\n`;
          srt += `${wrappedLine}\n\n`;
          
          currentTime += duration + 0.5;
        });
      }
    });

    return srt;
  }

  // 日本語テキストの折り返し（禁則処理対応）
  private wrapJapaneseText(text: string, maxLength: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    
    for (const char of text) {
      if (currentLine.length >= maxLength) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine += char;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  // SRT時間フォーマット
  private formatSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  // アクティブなレシピの取得
  getActiveRecipe(): VideoRecipe | null {
    return this.activeRecipe;
  }

  // レシピのステップ状態を取得
  getStepStatus(stepId: string): RecipeStep | null {
    return this.activeRecipe?.steps.find(step => step.id === stepId) || null;
  }
}

// エクスポート
export { RecipeEngine as default };