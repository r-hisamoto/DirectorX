/**
 * DirectorX Thumbnail Generation Service
 * サーバーサイドサムネイル生成（高品質・バッチ処理対応）
 */

import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../lib/logger.js';

export interface ThumbnailRequest {
  title: string;
  subtitle?: string;
  resolution: '1280x720' | '2160x2160' | '1920x1080';
  brandKit?: {
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
  };
  backgroundImage?: string;
  customText?: string[];
}

export interface ThumbnailVariant {
  id: string;
  name: string;
  description: string;
  layout: LayoutType;
  buffer: Buffer;
  metadata: {
    width: number;
    height: number;
    format: 'png';
    size: number;
  };
}

export type LayoutType = 'split' | 'overlay' | 'minimal';

export class ThumbnailGenerator {
  private fontRegistered = false;

  constructor() {
    this.registerFonts();
  }

  // フォント登録
  private async registerFonts(): Promise<void> {
    if (this.fontRegistered) return;

    try {
      // Docker環境での日本語フォントパス
      const notoFont = '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc';
      const notoBoldFont = '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc';

      // フォント存在確認
      try {
        await fs.access(notoFont);
        registerFont(notoFont, { family: 'Noto Sans CJK JP' });
      } catch {
        logger.warn('Noto font not found, using system default');
      }

      try {
        await fs.access(notoBoldFont);
        registerFont(notoBoldFont, { family: 'Noto Sans CJK JP Bold' });
      } catch {
        logger.warn('Noto Bold font not found, using system default');
      }

      this.fontRegistered = true;
      logger.info('Fonts registered successfully');

    } catch (error) {
      logger.error('Font registration failed:', error);
    }
  }

  // 3案サムネイル生成
  async generateVariants(request: ThumbnailRequest): Promise<ThumbnailVariant[]> {
    const [width, height] = request.resolution.split('x').map(Number);
    
    const layouts: Array<{ type: LayoutType; name: string; description: string }> = [
      {
        type: 'split',
        name: '分割レイアウト',
        description: '下部テキスト・グラデーション背景'
      },
      {
        type: 'overlay',
        name: 'オーバーレイ',
        description: '中央テキスト・背景画像重ね'
      },
      {
        type: 'minimal',
        name: 'ミニマル',
        description: '上部テキスト・シンプル'
      }
    ];

    const variants = await Promise.all(
      layouts.map(async (layout, index) => {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        await this.drawThumbnail(ctx, layout.type, request, width, height);

        const buffer = canvas.toBuffer('image/png');
        
        return {
          id: `variant_${index + 1}`,
          name: layout.name,
          description: layout.description,
          layout: layout.type,
          buffer,
          metadata: {
            width,
            height,
            format: 'png' as const,
            size: buffer.length
          }
        };
      })
    );

    logger.info(`Generated ${variants.length} thumbnail variants for "${request.title}"`);
    return variants;
  }

  // 個別サムネイル描画
  private async drawThumbnail(
    ctx: any,
    layout: LayoutType,
    request: ThumbnailRequest,
    width: number,
    height: number
  ): Promise<void> {
    const brandKit = request.brandKit;
    const colors = brandKit?.colors || {
      primary: '#FFD400',
      accent: '#111111',
      background: '#1a1a1a',
      text: '#ffffff'
    };

    // 背景描画
    await this.drawBackground(ctx, layout, colors, width, height, request.backgroundImage);
    
    // テキスト描画
    await this.drawText(ctx, layout, request, colors, width, height);
    
    // 装飾描画
    await this.drawDecorations(ctx, layout, colors, width, height);
  }

  // 背景描画
  private async drawBackground(
    ctx: any,
    layout: LayoutType,
    colors: any,
    width: number,
    height: number,
    backgroundImage?: string
  ): Promise<void> {
    switch (layout) {
      case 'split':
        // グラデーション背景
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, colors.primary);
        gradient.addColorStop(1, colors.background);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        break;

      case 'overlay':
        // 背景画像 + オーバーレイ
        if (backgroundImage) {
          try {
            const image = await loadImage(backgroundImage);
            ctx.drawImage(image, 0, 0, width, height);
            
            // ダークオーバーレイ
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, width, height);
          } catch {
            // 画像読み込み失敗時はソリッド背景
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, width, height);
          }
        } else {
          ctx.fillStyle = colors.background;
          ctx.fillRect(0, 0, width, height);
        }
        break;

      case 'minimal':
        // ソリッド背景
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
        break;
    }
  }

  // テキスト描画
  private async drawText(
    ctx: any,
    layout: LayoutType,
    request: ThumbnailRequest,
    colors: any,
    width: number,
    height: number
  ): Promise<void> {
    const titleFontSize = Math.round(width * 0.08);
    const subtitleFontSize = Math.round(width * 0.04);

    // フォント設定
    const fontFamily = request.brandKit?.fonts?.title || 'Noto Sans CJK JP Bold, Arial, sans-serif';
    
    // タイトル位置計算
    let textX: number, textY: number, textAlign: CanvasTextAlign;

    switch (layout) {
      case 'split':
        textX = width / 2;
        textY = height * 0.8;
        textAlign = 'center';
        break;
      case 'overlay':
        textX = width / 2;
        textY = height / 2;
        textAlign = 'center';
        break;
      case 'minimal':
        textX = width * 0.1;
        textY = height * 0.2;
        textAlign = 'left';
        break;
    }

    // タイトル描画
    ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    // アウトライン
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = Math.round(titleFontSize * 0.05);
    ctx.strokeText(request.title, textX, textY);

    // シャドウ
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // メインテキスト
    ctx.fillStyle = colors.text;
    ctx.fillText(request.title, textX, textY);

    // シャドウリセット
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // サブタイトル
    if (request.subtitle) {
      ctx.font = `${subtitleFontSize}px ${fontFamily}`;
      ctx.fillStyle = colors.text;
      ctx.globalAlpha = 0.8;
      ctx.fillText(request.subtitle, textX, textY + titleFontSize * 1.2);
      ctx.globalAlpha = 1;
    }
  }

  // 装飾描画
  private async drawDecorations(
    ctx: any,
    layout: LayoutType,
    colors: any,
    width: number,
    height: number
  ): Promise<void> {
    switch (layout) {
      case 'split':
        // 下部バー
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(0, height * 0.6, width, height * 0.4);
        ctx.globalAlpha = 1;
        break;

      case 'overlay':
        // 中央フレーム
        const frameX = width * 0.1;
        const frameY = height * 0.3;
        const frameW = width * 0.8;
        const frameH = height * 0.4;
        
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = 0.8;
        this.roundRect(ctx, frameX, frameY, frameW, frameH, 20);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'minimal':
        // 左端アクセントバー
        ctx.fillStyle = colors.primary;
        ctx.fillRect(0, 0, width * 0.05, height);
        break;
    }
  }

  // 角丸矩形描画
  private roundRect(ctx: any, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // バッチ生成
  async generateBatch(requests: ThumbnailRequest[]): Promise<ThumbnailVariant[][]> {
    const results = await Promise.all(
      requests.map(request => this.generateVariants(request))
    );

    logger.info(`Batch thumbnail generation completed: ${requests.length} sets, ${results.flat().length} total variants`);
    return results;
  }
}

export default ThumbnailGenerator;