import { z } from 'zod';
import { BrandKit } from '../types';

export const CreateBrandKitSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください'),
  fonts: z.object({
    subtitle: z.string().default('NotoSansCJKjp-Regular'),
    title: z.string().default('NotoSansCJKjp-Bold'),
    body: z.string().optional(),
  }),
  colors: z.object({
    primary: z.string().regex(/^#[0-9A-F]{6}$/i, '有効な色コードを入力してください'),
    accent: z.string().regex(/^#[0-9A-F]{6}$/i, '有効な色コードを入力してください'),
    background: z.string().regex(/^#[0-9A-F]{6}$/i, '有効な色コードを入力してください').optional(),
    text: z.string().regex(/^#[0-9A-F]{6}$/i, '有効な色コードを入力してください').optional(),
  }),
  ttsPreset: z.object({
    voice: z.string().default('ja-JP-A'),
    rate: z.number().min(0.5).max(2.0).default(1.02),
    pitch: z.number().min(-20).max(20).default(0.0),
    breakMs: z.number().min(0).max(1000).default(120),
  }),
  subtitleStyle: z.object({
    fontSize: z.number().min(12).max(128).default(48),
    stroke: z.number().min(0).max(10).default(3),
    position: z.enum(['top', 'center', 'bottom']).default('bottom'),
    alignment: z.enum(['left', 'center', 'right']).default('center'),
  }),
  watermark: z.object({
    file: z.string(),
    opacity: z.number().min(0).max(1).default(0.75),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('top-right'),
  }).optional(),
  bgm: z.array(z.string()).optional(),
});

export const UpdateBrandKitSchema = CreateBrandKitSchema.partial().omit({ name: true }).extend({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください').optional(),
});

export type CreateBrandKitRequest = z.infer<typeof CreateBrandKitSchema>;
export type UpdateBrandKitRequest = z.infer<typeof UpdateBrandKitSchema>;

export class BrandKitModel {
  static create(data: CreateBrandKitRequest): Omit<BrandKit, 'id'> {
    const now = new Date();
    
    // デフォルト値の設定
    const defaultFonts = {
      subtitle: 'NotoSansCJKjp-Regular',
      title: 'NotoSansCJKjp-Bold',
    };
    
    const defaultTtsPreset = {
      voice: 'ja-JP-A',
      rate: 1.02,
      pitch: 0.0,
      breakMs: 120,
    };
    
    const defaultSubtitleStyle = {
      fontSize: 48,
      stroke: 3,
      position: 'bottom' as const,
      alignment: 'center' as const,
    };

    return {
      name: data.name,
      fonts: { ...defaultFonts, ...data.fonts },
      colors: data.colors,
      ttsPreset: { ...defaultTtsPreset, ...data.ttsPreset },
      subtitleStyle: { ...defaultSubtitleStyle, ...data.subtitleStyle },
      watermark: data.watermark,
      bgm: data.bgm,
      createdAt: now,
      updatedAt: now,
    };
  }

  static update(existing: BrandKit, data: UpdateBrandKitRequest): BrandKit {
    return {
      ...existing,
      ...data,
      fonts: data.fonts ? { ...existing.fonts, ...data.fonts } : existing.fonts,
      colors: data.colors ? { ...existing.colors, ...data.colors } : existing.colors,
      ttsPreset: data.ttsPreset ? { ...existing.ttsPreset, ...data.ttsPreset } : existing.ttsPreset,
      subtitleStyle: data.subtitleStyle ? { ...existing.subtitleStyle, ...data.subtitleStyle } : existing.subtitleStyle,
      updatedAt: new Date(),
    };
  }
}