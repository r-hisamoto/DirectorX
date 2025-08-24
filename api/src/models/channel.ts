import { z } from 'zod';
import { Channel } from '../types';

export const CreateChannelSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください'),
  workspaceId: z.string().min(1, 'ワークスペースIDは必須です'),
  description: z.string().optional(),
  brandKitId: z.string().optional(),
  defaultRecipeId: z.string().optional(),
  settings: z.object({
    outputFormats: z.array(z.string()).default(['mp4']),
    defaultResolution: z.string().default('1920x1080'),
    defaultBitrate: z.number().default(5000),
  }).default({}),
});

export const UpdateChannelSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください').optional(),
  description: z.string().optional(),
  brandKitId: z.string().optional(),
  defaultRecipeId: z.string().optional(),
  settings: z.object({
    outputFormats: z.array(z.string()).optional(),
    defaultResolution: z.string().optional(),
    defaultBitrate: z.number().optional(),
  }).optional(),
});

export type CreateChannelRequest = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelRequest = z.infer<typeof UpdateChannelSchema>;

export class ChannelModel {
  static create(data: CreateChannelRequest): Omit<Channel, 'id'> {
    const now = new Date();
    const defaultSettings = {
      outputFormats: ['mp4'],
      defaultResolution: '1920x1080',
      defaultBitrate: 5000,
    };

    return {
      name: data.name,
      description: data.description,
      workspaceId: data.workspaceId,
      brandKitId: data.brandKitId,
      defaultRecipeId: data.defaultRecipeId,
      settings: { ...defaultSettings, ...data.settings },
      createdAt: now,
      updatedAt: now,
    };
  }

  static update(existing: Channel, data: UpdateChannelRequest): Channel {
    return {
      ...existing,
      ...data,
      settings: data.settings ? { ...existing.settings, ...data.settings } : existing.settings,
      updatedAt: new Date(),
    };
  }
}