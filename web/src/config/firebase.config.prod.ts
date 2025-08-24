/**
 * Firebase Configuration for Production (GCP)
 * 本番環境用のFirebase設定
 */

// 実際のプロジェクトでは環境変数から取得
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "directorx-production.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "directorx-production",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "directorx-production.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX"
};

// API Base URL (Cloud Run)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  "https://directorx-api-xxxxx-uc.a.run.app";

// GCP Project ID
export const GCP_PROJECT_ID = import.meta.env.VITE_GCP_PROJECT_ID || 
  "directorx-production";

// Cloud Storage Buckets
export const STORAGE_BUCKETS = {
  assets: `${GCP_PROJECT_ID}-assets`,
  outputs: `${GCP_PROJECT_ID}-outputs`,
  temp: `${GCP_PROJECT_ID}-temp`
};

// Firestore Collection Names
export const COLLECTIONS = {
  assets: 'assets',
  recipes: 'recipes',
  renderJobs: 'render_jobs',
  exportJobs: 'export_jobs',
  users: 'users'
};

// アプリケーション設定
export const APP_CONFIG = {
  name: 'DirectorX',
  version: '1.0.0',
  environment: 'production',
  region: 'us-central1',
  maxFileSize: {
    asset: 100 * 1024 * 1024, // 100MB
    output: 500 * 1024 * 1024, // 500MB
    temp: 50 * 1024 * 1024     // 50MB
  },
  supportedFormats: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    subtitle: ['text/plain', 'text/srt', 'text/vtt']
  },
  features: {
    authentication: true,
    fileUpload: true,
    videoRendering: true,
    realTimeSync: true,
    analytics: true
  }
};

// パフォーマンス設定
export const PERFORMANCE_CONFIG = {
  // キャッシュ設定
  cache: {
    assets: 7 * 24 * 60 * 60 * 1000,        // 7日
    staticFiles: 30 * 24 * 60 * 60 * 1000,  // 30日
    apiResponses: 5 * 60 * 1000              // 5分
  },
  // 並行処理制限
  concurrency: {
    maxRenderJobs: 3,
    maxUploadFiles: 5,
    maxApiRequests: 10
  },
  // タイムアウト設定
  timeout: {
    apiRequest: 30000,     // 30秒
    fileUpload: 300000,    // 5分
    renderJob: 1800000     // 30分
  }
};

// エラー処理設定
export const ERROR_CONFIG = {
  // リトライ設定
  retry: {
    maxAttempts: 3,
    backoff: 1000,
    apiRequests: true,
    fileUploads: true
  },
  // エラー報告
  reporting: {
    enabled: true,
    endpoint: `${API_BASE_URL}/v1/errors`,
    includeUserAgent: true,
    includeUrl: true
  }
};

// 分析・監視設定
export const ANALYTICS_CONFIG = {
  // Google Analytics
  googleAnalytics: {
    enabled: true,
    measurementId: FIREBASE_CONFIG.measurementId
  },
  // カスタム分析
  customAnalytics: {
    enabled: true,
    endpoint: `${API_BASE_URL}/v1/analytics`,
    events: {
      assetCreated: true,
      recipeGenerated: true,
      videoRendered: true,
      fileExported: true
    }
  }
};

export { FIREBASE_CONFIG };
export default FIREBASE_CONFIG;