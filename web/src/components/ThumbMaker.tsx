/**
 * DirectorX Thumbnail Maker Component
 * タイトルから3案のサムネイル自動生成
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Download, RefreshCw, Palette, Type, Layout } from 'lucide-react';
import { BrandKit } from '../types';

export interface ThumbnailVariant {
  id: string;
  name: string;
  description: string;
  layout: ThumbnailLayout;
  style: ThumbnailStyle;
  preview?: string; // Base64 データURL
}

export interface ThumbnailLayout {
  type: 'split' | 'overlay' | 'minimal';
  textPosition: 'top' | 'center' | 'bottom';
  textAlignment: 'left' | 'center' | 'right';
  backgroundType: 'solid' | 'gradient' | 'image';
  elements: LayoutElement[];
}

export interface LayoutElement {
  type: 'text' | 'shape' | 'icon' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  style: any;
}

export interface ThumbnailStyle {
  fontSize: {
    title: number;
    subtitle: number;
  };
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    title: string;
    subtitle: string;
  };
  effects: {
    shadow: boolean;
    outline: boolean;
    gradient: boolean;
  };
}

export interface ThumbnailOptions {
  title: string;
  subtitle?: string;
  resolution: '1280x720' | '2160x2160' | '1920x1080';
  brandKit?: BrandKit;
  backgroundImage?: string;
  customText?: string[];
}

interface ThumbMakerProps {
  title: string;
  subtitle?: string;
  brandKit?: BrandKit;
  onGenerated?: (variants: ThumbnailVariant[]) => void;
  className?: string;
}

export const ThumbMaker: React.FC<ThumbMakerProps> = ({
  title,
  subtitle,
  brandKit,
  onGenerated,
  className = ''
}) => {
  const [variants, setVariants] = useState<ThumbnailVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'1280x720' | '2160x2160' | '1920x1080'>('1280x720');
  const [customOptions, setCustomOptions] = useState<Partial<ThumbnailOptions>>({});
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  // 3つの基本レイアウトテンプレート
  const layoutTemplates: ThumbnailLayout[] = [
    {
      type: 'split',
      textPosition: 'bottom',
      textAlignment: 'center',
      backgroundType: 'gradient',
      elements: [
        {
          type: 'shape',
          x: 0,
          y: 0.6,
          width: 1,
          height: 0.4,
          style: { type: 'rectangle', opacity: 0.9 }
        }
      ]
    },
    {
      type: 'overlay',
      textPosition: 'center',
      textAlignment: 'center',
      backgroundType: 'image',
      elements: [
        {
          type: 'shape',
          x: 0.1,
          y: 0.3,
          width: 0.8,
          height: 0.4,
          style: { type: 'rectangle', opacity: 0.8, radius: 20 }
        }
      ]
    },
    {
      type: 'minimal',
      textPosition: 'top',
      textAlignment: 'left',
      backgroundType: 'solid',
      elements: [
        {
          type: 'shape',
          x: 0,
          y: 0,
          width: 0.05,
          height: 1,
          style: { type: 'rectangle', opacity: 1 }
        }
      ]
    }
  ];

  // サムネイル生成
  const generateThumbnails = useCallback(async () => {
    if (!title) return;

    setIsGenerating(true);
    
    try {
      const options: ThumbnailOptions = {
        title,
        subtitle,
        resolution: selectedResolution,
        brandKit,
        ...customOptions
      };

      const newVariants = await Promise.all(
        layoutTemplates.map(async (layout, index) => {
          const variant = await generateVariant(layout, options, index);
          return variant;
        })
      );

      setVariants(newVariants);
      onGenerated?.(newVariants);

    } catch (error) {
      console.error('Thumbnail generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [title, subtitle, selectedResolution, brandKit, customOptions, onGenerated]);

  // 個別バリアント生成
  const generateVariant = async (
    layout: ThumbnailLayout, 
    options: ThumbnailOptions, 
    index: number
  ): Promise<ThumbnailVariant> => {
    const [width, height] = options.resolution.split('x').map(Number);
    
    // スタイル生成
    const style: ThumbnailStyle = {
      fontSize: {
        title: Math.round(width * 0.08), // 解像度に応じたフォントサイズ
        subtitle: Math.round(width * 0.04)
      },
      colors: brandKit ? {
        primary: brandKit.colors.primary,
        accent: brandKit.colors.accent,
        background: brandKit.colors.background,
        text: brandKit.colors.text
      } : {
        primary: '#FFD400',
        accent: '#111111',
        background: '#1a1a1a',
        text: '#ffffff'
      },
      fonts: brandKit ? {
        title: brandKit.fonts.title,
        subtitle: brandKit.fonts.subtitle
      } : {
        title: 'Noto Sans CJK JP',
        subtitle: 'Noto Sans CJK JP'
      },
      effects: {
        shadow: layout.type !== 'minimal',
        outline: true,
        gradient: layout.backgroundType === 'gradient'
      }
    };

    // Canvas描画
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    await drawThumbnail(ctx, layout, style, options, width, height);

    const preview = canvas.toDataURL('image/png');
    
    const variant: ThumbnailVariant = {
      id: `thumb_${index + 1}`,
      name: ['分割レイアウト', 'オーバーレイ', 'ミニマル'][index],
      description: ['下部テキスト・グラデーション背景', '中央テキスト・背景画像重ね', '上部テキスト・シンプル'][index],
      layout,
      style,
      preview
    };

    return variant;
  };

  // Canvas描画実行
  const drawThumbnail = async (
    ctx: CanvasRenderingContext2D,
    layout: ThumbnailLayout,
    style: ThumbnailStyle,
    options: ThumbnailOptions,
    width: number,
    height: number
  ): Promise<void> => {
    // 背景描画
    await drawBackground(ctx, layout, style, width, height);
    
    // レイアウト要素描画
    for (const element of layout.elements) {
      await drawElement(ctx, element, style, width, height);
    }
    
    // テキスト描画
    await drawText(ctx, layout, style, options, width, height);
  };

  // 背景描画
  const drawBackground = async (
    ctx: CanvasRenderingContext2D,
    layout: ThumbnailLayout,
    style: ThumbnailStyle,
    width: number,
    height: number
  ): Promise<void> => {
    ctx.save();
    
    switch (layout.backgroundType) {
      case 'solid':
        ctx.fillStyle = style.colors.background;
        ctx.fillRect(0, 0, width, height);
        break;
        
      case 'gradient':
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, style.colors.primary);
        gradient.addColorStop(1, style.colors.background);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        break;
        
      case 'image':
        // 背景画像（実装時は実際の画像を使用）
        ctx.fillStyle = style.colors.background;
        ctx.fillRect(0, 0, width, height);
        break;
    }
    
    ctx.restore();
  };

  // 要素描画
  const drawElement = async (
    ctx: CanvasRenderingContext2D,
    element: LayoutElement,
    style: ThumbnailStyle,
    width: number,
    height: number
  ): Promise<void> => {
    ctx.save();
    
    const x = element.x * width;
    const y = element.y * height;
    const w = element.width * width;
    const h = element.height * height;
    
    switch (element.type) {
      case 'shape':
        if (element.style.type === 'rectangle') {
          ctx.fillStyle = style.colors.accent;
          ctx.globalAlpha = element.style.opacity || 1;
          
          if (element.style.radius) {
            // 角丸矩形
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, element.style.radius);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, w, h);
          }
        }
        break;
    }
    
    ctx.restore();
  };

  // テキスト描画
  const drawText = async (
    ctx: CanvasRenderingContext2D,
    layout: ThumbnailLayout,
    style: ThumbnailStyle,
    options: ThumbnailOptions,
    width: number,
    height: number
  ): Promise<void> => {
    ctx.save();
    
    // タイトル描画位置計算
    let textX: number, textY: number;
    
    switch (layout.textPosition) {
      case 'top':
        textX = layout.textAlignment === 'left' ? width * 0.1 : 
               layout.textAlignment === 'right' ? width * 0.9 : width * 0.5;
        textY = height * 0.2;
        break;
      case 'center':
        textX = width * 0.5;
        textY = height * 0.5;
        break;
      case 'bottom':
        textX = width * 0.5;
        textY = height * 0.8;
        break;
    }

    // タイトル描画
    ctx.font = `bold ${style.fontSize.title}px ${style.fonts.title}`;
    ctx.textAlign = layout.textAlignment;
    ctx.textBaseline = 'middle';

    // アウトライン
    if (style.effects.outline) {
      ctx.strokeStyle = style.colors.accent;
      ctx.lineWidth = Math.round(style.fontSize.title * 0.05);
      ctx.strokeText(options.title, textX, textY);
    }

    // シャドウ
    if (style.effects.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    }

    // メインテキスト
    ctx.fillStyle = style.colors.text;
    ctx.fillText(options.title, textX, textY);

    // サブタイトル（あれば）
    if (options.subtitle) {
      ctx.font = `${style.fontSize.subtitle}px ${style.fonts.subtitle}`;
      ctx.fillText(options.subtitle, textX, textY + style.fontSize.title * 1.2);
    }
    
    ctx.restore();
  };

  // 生成実行
  useEffect(() => {
    if (title) {
      generateThumbnails();
    }
  }, [generateThumbnails, title]);

  // ダウンロード
  const downloadVariant = useCallback((variant: ThumbnailVariant) => {
    if (!variant.preview) return;

    const link = document.createElement('a');
    link.download = `${title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}_${variant.name}.png`;
    link.href = variant.preview;
    link.click();
  }, [title]);

  // 全ダウンロード
  const downloadAll = useCallback(() => {
    variants.forEach(variant => downloadVariant(variant));
  }, [variants, downloadVariant]);

  return (
    <div className={`thumb-maker ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">サムネイル生成</h3>
          <p className="text-sm text-gray-600">タイトルから3案のサムネイルを自動生成</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 解像度選択 */}
          <select
            value={selectedResolution}
            onChange={(e) => setSelectedResolution(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="1280x720">YouTube (1280×720)</option>
            <option value="1920x1080">HD (1920×1080)</option>
            <option value="2160x2160">Instagram (2160×2160)</option>
          </select>

          {/* 再生成ボタン */}
          <button
            onClick={generateThumbnails}
            disabled={isGenerating || !title}
            className="flex items-center px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? '生成中...' : '再生成'}
          </button>

          {/* 全ダウンロード */}
          <button
            onClick={downloadAll}
            disabled={variants.length === 0}
            className="flex items-center px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50 text-sm"
          >
            <Download className="w-4 h-4 mr-1" />
            全ダウンロード
          </button>
        </div>
      </div>

      {/* バリアント表示 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {variants.map((variant, index) => (
          <div key={variant.id} className="border rounded-lg p-4 bg-white">
            {/* プレビュー */}
            <div className="relative mb-4">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {variant.preview ? (
                  <img
                    src={variant.preview}
                    alt={variant.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
              
              {/* オーバーレイ情報 */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                {selectedResolution}
              </div>
            </div>

            {/* 詳細情報 */}
            <div className="mb-4">
              <h4 className="font-bold text-sm mb-1">{variant.name}</h4>
              <p className="text-xs text-gray-600 mb-2">{variant.description}</p>
              
              {/* スタイル情報 */}
              <div className="flex items-center space-x-2 text-xs">
                <div className="flex items-center">
                  <Layout className="w-3 h-3 mr-1" />
                  {variant.layout.type}
                </div>
                <div className="flex items-center">
                  <Type className="w-3 h-3 mr-1" />
                  {variant.style.fontSize.title}px
                </div>
                <div className="flex items-center">
                  <Palette className="w-3 h-3 mr-1" />
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: variant.style.colors.primary }}
                  />
                </div>
              </div>
            </div>

            {/* アクション */}
            <div className="flex space-x-2">
              <button
                onClick={() => downloadVariant(variant)}
                className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                <Download className="w-4 h-4 mr-1" />
                ダウンロード
              </button>
              
              <button
                onClick={() => regenerateVariant(index)}
                className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* カスタマイズオプション */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-bold mb-3">カスタマイズ</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* サブタイトル */}
          <div>
            <label className="block text-sm font-medium mb-1">サブタイトル</label>
            <input
              type="text"
              value={customOptions.subtitle || ''}
              onChange={(e) => setCustomOptions(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="オプション"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          {/* 背景画像URL */}
          <div>
            <label className="block text-sm font-medium mb-1">背景画像URL</label>
            <input
              type="url"
              value={customOptions.backgroundImage || ''}
              onChange={(e) => setCustomOptions(prev => ({ ...prev, backgroundImage: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* 生成状況 */}
      {isGenerating && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
            <span className="text-sm text-blue-700">
              {selectedResolution}で3案のサムネイルを生成中...
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // 個別バリアント再生成
  async function regenerateVariant(index: number): Promise<void> {
    if (!title) return;

    const layout = layoutTemplates[index];
    const options: ThumbnailOptions = {
      title,
      subtitle,
      resolution: selectedResolution,
      brandKit,
      ...customOptions
    };

    try {
      const newVariant = await generateVariant(layout, options, index);
      setVariants(prev => prev.map((v, i) => i === index ? newVariant : v));
    } catch (error) {
      console.error('Variant regeneration failed:', error);
    }
  }
};

// Canvas拡張（角丸矩形）
declare global {
  interface CanvasRenderingContext2D {
    roundRect(x: number, y: number, width: number, height: number, radius: number): void;
  }
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

export default ThumbMaker;