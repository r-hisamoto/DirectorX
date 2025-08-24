/**
 * GCP Configuration for DirectorX API
 * Google Cloud Platform設定
 */

// 環境変数から設定を取得
const GCP_CONFIG = {
  // プロジェクト情報
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'directorx-production',
  region: process.env.GCP_REGION || 'us-central1',
  
  // Firestore設定
  firestore: {
    databaseId: process.env.FIRESTORE_DATABASE || 'directorx-prod',
    settings: {
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    }
  },
  
  // Cloud Storage設定
  storage: {
    buckets: {
      assets: process.env.STORAGE_BUCKET_ASSETS || 'directorx-assets',
      outputs: process.env.STORAGE_BUCKET_OUTPUTS || 'directorx-outputs',
      temp: process.env.STORAGE_BUCKET_TEMP || 'directorx-temp'
    },
    options: {
      apiEndpoint: 'https://storage.googleapis.com',
      projectId: process.env.GOOGLE_CLOUD_PROJECT
    }
  },
  
  // Cloud Run設定
  cloudRun: {
    serviceName: process.env.K_SERVICE || 'directorx-api',
    revision: process.env.K_REVISION || 'unknown',
    configuration: process.env.K_CONFIGURATION || 'unknown'
  },
  
  // 認証設定
  auth: {
    // サービスアカウントキー (本番では自動取得)
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // Firebase Admin SDK
    adminSDK: {
      type: "service_account",
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      // 実際のプロジェクトでは適切な認証情報を設定
    }
  }
};

// CORS設定
const CORS_CONFIG = {
  origin: [
    process.env.CORS_ORIGIN || `https://${GCP_CONFIG.projectId}.web.app`,
    process.env.CORS_ORIGIN_DEV || 'http://localhost:5173',
    // Firebase Hosting URLs
    `https://${GCP_CONFIG.projectId}.firebaseapp.com`,
    // Cloud Run URLs (開発環境)
    /^https:\/\/.*\.a\.run\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24時間
};

// セキュリティ設定
const SECURITY_CONFIG = {
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // リクエスト数制限
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  },
  
  // ファイルアップロード制限
  fileUpload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'text/plain', 'application/json'
    ]
  },
  
  // JWT設定
  jwt: {
    expiresIn: '24h',
    issuer: `https://${GCP_CONFIG.projectId}.web.app`,
    audience: GCP_CONFIG.projectId
  }
};

// パフォーマンス設定
const PERFORMANCE_CONFIG = {
  // キャッシュ設定
  cache: {
    redis: {
      enabled: process.env.REDIS_URL ? true : false,
      url: process.env.REDIS_URL,
      ttl: 3600 // 1時間
    },
    memory: {
      max: 100,
      ttl: 300 // 5分
    }
  },
  
  // 並行処理設定
  concurrency: {
    maxRenderJobs: parseInt(process.env.MAX_RENDER_JOBS) || 5,
    maxFileProcessing: parseInt(process.env.MAX_FILE_PROCESSING) || 10
  },
  
  // タイムアウト設定
  timeout: {
    request: 30000,        // 30秒
    fileUpload: 300000,    // 5分
    renderJob: 1800000,    // 30分
    database: 10000        // 10秒
  }
};

// ログ設定
const LOGGING_CONFIG = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'combined',
  
  // Google Cloud Logging設定
  cloudLogging: {
    enabled: process.env.NODE_ENV === 'production',
    projectId: GCP_CONFIG.projectId,
    logName: 'directorx-api'
  },
  
  // エラー報告
  errorReporting: {
    enabled: process.env.NODE_ENV === 'production',
    projectId: GCP_CONFIG.projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  }
};

// 監視・アラート設定
const MONITORING_CONFIG = {
  // ヘルスチェック
  health: {
    endpoint: '/health',
    timeout: 5000,
    checks: [
      'database',
      'storage',
      'memory',
      'disk'
    ]
  },
  
  // メトリクス
  metrics: {
    enabled: true,
    endpoint: '/metrics',
    collectInterval: 10000 // 10秒
  },
  
  // アラート (Cloud Monitoring)
  alerts: {
    errorRate: {
      threshold: 0.05, // 5%
      duration: 300     // 5分
    },
    responseTime: {
      threshold: 2000,  // 2秒
      duration: 300     // 5分
    },
    memory: {
      threshold: 0.8,   // 80%
      duration: 300     // 5分
    }
  }
};

// 開発環境設定
const DEVELOPMENT_CONFIG = {
  // Hot reload
  hotReload: process.env.NODE_ENV !== 'production',
  
  // デバッグモード
  debug: process.env.DEBUG === 'true',
  
  // モック設定
  mocks: {
    enabled: process.env.USE_MOCKS === 'true',
    storage: process.env.MOCK_STORAGE === 'true',
    firestore: process.env.MOCK_FIRESTORE === 'true'
  }
};

module.exports = {
  GCP_CONFIG,
  CORS_CONFIG,
  SECURITY_CONFIG,
  PERFORMANCE_CONFIG,
  LOGGING_CONFIG,
  MONITORING_CONFIG,
  DEVELOPMENT_CONFIG,
  
  // 環境判定
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // ポート設定
  PORT: process.env.PORT || 8080,
  
  // バージョン情報
  VERSION: process.env.npm_package_version || '1.0.0',
  BUILD_TIME: new Date().toISOString(),
  
  // 統合設定関数
  getConfig() {
    return {
      gcp: GCP_CONFIG,
      cors: CORS_CONFIG,
      security: SECURITY_CONFIG,
      performance: PERFORMANCE_CONFIG,
      logging: LOGGING_CONFIG,
      monitoring: MONITORING_CONFIG,
      development: DEVELOPMENT_CONFIG
    };
  }
};