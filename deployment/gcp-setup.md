# DirectorX GCP Deployment Guide

## アーキテクチャ概要

### フロントエンド: Firebase Hosting
- React/Vite SPA配信
- 自動SSL/CDN
- カスタムドメイン対応
- 高速グローバル配信

### バックエンド: Cloud Run
- Node.js/Express API
- 自動スケーリング (0→1000)
- Pay-per-use課金
- コンテナベースデプロイ

### データベース: Firestore
- NoSQL ドキュメントDB
- リアルタイム同期
- 自動バックアップ
- 強力なクエリ機能

### ストレージ: Cloud Storage
- 生成動画ファイル保存
- アセットファイル管理
- CDN統合配信
- ライフサイクル管理

## デプロイメント手順

### 1. GCPプロジェクト作成
```bash
# GCP CLI インストール & 認証
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# プロジェクト作成
gcloud projects create directorx-production --name="DirectorX Production"
gcloud config set project directorx-production

# 必要なAPI有効化
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable storage-api.googleapis.com
gcloud services enable firestore.googleapis.com
```

### 2. Firebase初期化
```bash
# Firebase CLI インストール
npm install -g firebase-tools

# Firebase ログイン & プロジェクト関連付け
firebase login
firebase use --add directorx-production

# Firebase設定初期化
firebase init hosting
firebase init firestore
```

### 3. Cloud Run デプロイ
```bash
# Docker ビルド & プッシュ
gcloud builds submit --tag gcr.io/directorx-production/api

# Cloud Run デプロイ
gcloud run deploy directorx-api \
  --image gcr.io/directorx-production/api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### 4. Cloud Storage 設定
```bash
# バケット作成
gsutil mb -p directorx-production -c STANDARD -l us-central1 gs://directorx-assets
gsutil mb -p directorx-production -c STANDARD -l us-central1 gs://directorx-outputs

# CORS設定
gsutil cors set cors.json gs://directorx-assets
gsutil cors set cors.json gs://directorx-outputs
```

## 環境変数設定

### Cloud Run環境変数
```bash
gcloud run services update directorx-api \
  --set-env-vars \
  GOOGLE_CLOUD_PROJECT=directorx-production,\
  FIRESTORE_DATABASE=directorx-prod,\
  STORAGE_BUCKET_ASSETS=directorx-assets,\
  STORAGE_BUCKET_OUTPUTS=directorx-outputs,\
  CORS_ORIGIN=https://directorx-production.web.app
```

### Firebase環境設定
```javascript
// web/src/config/firebase.config.prod.ts
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "directorx-production.firebaseapp.com",
  projectId: "directorx-production",
  storageBucket: "directorx-production.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

export const apiBaseUrl = "https://directorx-api-xxxxx-uc.a.run.app";
```

## CI/CD パイプライン

### GitHub Actions設定
```yaml
# .github/workflows/deploy-gcp.yml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v0
        with:
          project_id: directorx-production
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Build and Deploy API
        run: |
          gcloud builds submit --tag gcr.io/directorx-production/api ./api
          gcloud run deploy directorx-api \
            --image gcr.io/directorx-production/api \
            --platform managed \
            --region us-central1

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build and Deploy Frontend
        run: |
          cd web
          npm ci
          npm run build
          firebase deploy --only hosting
```

## モニタリング & ログ

### Cloud Monitoring設定
```bash
# アラートポリシー作成
gcloud alpha monitoring policies create --policy-from-file=monitoring-policy.yaml
```

### ログ管理
```bash
# Cloud Run ログ確認
gcloud logs read "resource.type=cloud_run_revision" --limit=100

# Firebase Hosting ログ
firebase hosting:channel:list
```

## セキュリティ設定

### IAM & サービスアカウント
```bash
# サービスアカウント作成
gcloud iam service-accounts create directorx-api \
  --description="DirectorX API Service Account" \
  --display-name="DirectorX API"

# 権限付与
gcloud projects add-iam-policy-binding directorx-production \
  --member="serviceAccount:directorx-api@directorx-production.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding directorx-production \
  --member="serviceAccount:directorx-api@directorx-production.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Firebase Security Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /assets/{assetId} {
      allow read, write: if request.auth != null;
    }
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null 
        && resource.data.userId == request.auth.uid;
    }
  }
}
```

## パフォーマンス最適化

### CDN & キャッシュ設定
```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{
      "source": "/api/**",
      "function": "api"
    }],
    "headers": [{
      "source": "/static/**",
      "headers": [{
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }]
    }]
  }
}
```

### Cloud Run最適化
```dockerfile
# api/Dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
```

## コスト管理

### 予算アラート設定
```bash
# 予算作成 (月$50上限)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="DirectorX Budget" \
  --budget-amount=50USD \
  --threshold-rules-percent=80,100
```

### リソース削減策
- Cloud Run: 最小インスタンス数 = 0
- Cloud Storage: ライフサイクルルール設定
- Firebase: 使用量監視ダッシュボード
- CDN: 適切なキャッシュポリシー

## 本番運用チェックリスト

### セキュリティ
- [ ] Firebase Auth 設定完了
- [ ] Firestore Security Rules 適用
- [ ] Cloud Storage IAM 設定
- [ ] SSL証明書 自動更新有効
- [ ] CORS設定 適切に制限

### パフォーマンス
- [ ] CDN キャッシュ設定済み
- [ ] 画像最適化 実装済み
- [ ] JavaScript バンドルサイズ最適化
- [ ] Cloud Run コールドスタート対策
- [ ] データベース インデックス最適化

### 監視
- [ ] Cloud Monitoring アラート設定
- [ ] エラー追跡 (Cloud Error Reporting)
- [ ] パフォーマンス監視設定
- [ ] アップタイム監視有効
- [ ] ログ保存期間設定

### バックアップ & DR
- [ ] Firestore 自動バックアップ
- [ ] Cloud Storage バージョニング
- [ ] 設定ファイル バックアップ
- [ ] 障害復旧手順書作成
- [ ] データ復旧テスト実施

## 推定コスト (月間)

| サービス | 使用量 | 概算コスト |
|---------|--------|----------|
| Firebase Hosting | ~1GB転送 | 無料 |
| Cloud Run | ~10万リクエスト | $2-5 |
| Firestore | ~10万操作 | 無料-$3 |
| Cloud Storage | ~50GB | $1-3 |
| Cloud CDN | ~1GB転送 | $0.50 |
| **合計** | | **$3.50-11.50** |

DirectorXは無料枠でほぼカバー可能で、スケールしても非常に低コストです。