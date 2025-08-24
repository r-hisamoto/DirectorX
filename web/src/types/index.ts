// Common types for DirectorX Web

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  brandKitId?: string;
  defaultRecipeId?: string;
  settings: {
    outputFormats: string[];
    defaultResolution: string;
    defaultBitrate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandKit {
  id: string;
  name: string;
  fonts: {
    subtitle: string;
    title: string;
    body?: string;
  };
  colors: {
    primary: string;
    accent: string;
    background?: string;
    text?: string;
  };
  ttsPreset: {
    voice: string;
    rate: number;
    pitch: number;
    breakMs: number;
  };
  subtitleStyle: {
    fontSize: number;
    stroke: number;
    position: 'top' | 'center' | 'bottom';
    alignment: 'left' | 'center' | 'right';
  };
  watermark?: {
    file: string;
    opacity: number;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
  bgm?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Recipe {
  id: string;
  name: string;
  version: string;
  description?: string;
  json: RecipeDefinition;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeDefinition {
  version: string;
  slots: RecipeSlot[];
  particles?: {
    type: 'none' | 'sparkles' | 'snow' | 'rain';
    intensity?: number;
  };
  transitions?: {
    default: 'fade' | 'slide' | 'zoom' | 'cut';
    duration: number;
  };
}

export interface RecipeSlot {
  when: 'heading' | 'paragraph' | 'intro' | 'outro';
  zoom?: {
    from: number;
    to: number;
    durMs: number;
  };
  slide?: {
    dir: 'up' | 'down' | 'left' | 'right';
    px: number;
    durMs: number;
  };
  transition?: 'fade' | 'slide' | 'zoom' | 'cut';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  timestamp: string;
}