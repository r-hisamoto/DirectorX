#!/bin/bash

# DirectorX GCP Deployment Script
# Usage: ./scripts/deploy-gcp.sh [environment]
# Environment: dev, staging, production (default: dev)

set -e  # Exit on error

# 設定
ENVIRONMENT=${1:-dev}
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="directorx-api"

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 環境別設定
case $ENVIRONMENT in
    "dev")
        PROJECT_ID="directorx-dev"
        ;;
    "staging")
        PROJECT_ID="directorx-staging"
        ;;
    "production")
        PROJECT_ID="directorx-production"
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        log_info "Available environments: dev, staging, production"
        exit 1
        ;;
esac

log_info "🚀 Starting DirectorX deployment to $ENVIRONMENT environment"
log_info "Project ID: $PROJECT_ID"
log_info "Region: $REGION"

# 前提条件チェック
check_prerequisites() {
    log_info "🔍 Checking prerequisites..."
    
    # gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        log_info "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Firebase CLI
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI is not installed"
        log_info "Install with: npm install -g firebase-tools"
        exit 1
    fi
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Install from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        log_info "Install from: https://nodejs.org/"
        exit 1
    fi
    
    log_success "All prerequisites are available"
}

# GCPプロジェクト設定
setup_gcp_project() {
    log_info "⚙️  Setting up GCP project..."
    
    # プロジェクト選択
    gcloud config set project $PROJECT_ID
    
    # 必要なAPI有効化
    log_info "Enabling required APIs..."
    gcloud services enable run.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable storage-api.googleapis.com
    gcloud services enable firestore.googleapis.com
    gcloud services enable secretmanager.googleapis.com
    
    log_success "GCP project setup completed"
}

# Cloud Storage設定
setup_cloud_storage() {
    log_info "💾 Setting up Cloud Storage..."
    
    # バケット作成 (存在しない場合のみ)
    for bucket in "assets" "outputs" "temp"; do
        BUCKET_NAME="${PROJECT_ID}-${bucket}"
        
        if ! gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
            log_info "Creating bucket: $BUCKET_NAME"
            gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
        else
            log_info "Bucket already exists: $BUCKET_NAME"
        fi
        
        # CORS設定適用
        log_info "Applying CORS configuration to $BUCKET_NAME"
        gsutil cors set deployment/cors.json gs://$BUCKET_NAME
    done
    
    log_success "Cloud Storage setup completed"
}

# バックエンドAPI ビルド & デプロイ
deploy_api() {
    log_info "🔧 Deploying API to Cloud Run..."
    
    # Docker イメージビルド & プッシュ
    cd api
    
    log_info "Building Docker image..."
    gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .
    
    # Cloud Run デプロイ
    log_info "Deploying to Cloud Run..."
    gcloud run deploy $SERVICE_NAME \
        --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --max-instances 10 \
        --set-env-vars NODE_ENV=$ENVIRONMENT,CORS_ORIGIN=https://$PROJECT_ID.web.app \
        --quiet
    
    # API URL取得
    API_URL=$(gcloud run services describe $SERVICE_NAME \
        --platform managed \
        --region $REGION \
        --format 'value(status.url)')
    
    log_success "API deployed successfully: $API_URL"
    
    # ヘルスチェック
    log_info "Running health check..."
    sleep 30
    if curl -f "$API_URL/health" &> /dev/null; then
        log_success "API health check passed"
    else
        log_warning "API health check failed - check logs"
    fi
    
    cd ..
    echo "$API_URL" > .api-url  # フロントエンドで使用
}

# フロントエンド ビルド & デプロイ
deploy_frontend() {
    log_info "📱 Deploying Frontend to Firebase Hosting..."
    
    cd web
    
    # 依存関係インストール
    log_info "Installing dependencies..."
    npm ci
    
    # 環境変数設定
    API_URL=$(cat ../.api-url)
    cat > .env.production << EOF
VITE_API_BASE_URL=$API_URL
VITE_GCP_PROJECT_ID=$PROJECT_ID
VITE_ENVIRONMENT=$ENVIRONMENT
EOF
    
    # ビルド
    log_info "Building frontend..."
    npm run build
    
    cd ..
    
    # Firebase設定更新
    log_info "Updating Firebase configuration..."
    sed -i "s|https://directorx-api-YOUR_REGION.a.run.app|$API_URL|g" firebase.json
    
    # Firebase デプロイ
    log_info "Deploying to Firebase Hosting..."
    firebase use $PROJECT_ID
    firebase deploy --only hosting --project $PROJECT_ID
    
    FRONTEND_URL="https://$PROJECT_ID.web.app"
    log_success "Frontend deployed successfully: $FRONTEND_URL"
    
    # フロントエンドテスト
    log_info "Testing frontend..."
    if curl -f "$FRONTEND_URL" &> /dev/null; then
        log_success "Frontend is accessible"
    else
        log_warning "Frontend accessibility test failed"
    fi
}

# Firestore & Firebase設定
setup_firestore() {
    log_info "🗄️  Setting up Firestore..."
    
    # Firestore ルール & インデックス デプロイ
    firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID
    
    # Storage ルール デプロイ
    firebase deploy --only storage --project $PROJECT_ID
    
    log_success "Firestore setup completed"
}

# デプロイ後検証
post_deploy_verification() {
    log_info "🔍 Running post-deployment verification..."
    
    API_URL=$(cat .api-url)
    FRONTEND_URL="https://$PROJECT_ID.web.app"
    
    # API エンドポイント テスト
    log_info "Testing API endpoints..."
    if curl -f "$API_URL/health" &> /dev/null; then
        log_success "✓ API health check"
    else
        log_error "✗ API health check failed"
    fi
    
    if curl -f "$API_URL/v1/assets" -H "Authorization: Bearer test" &> /dev/null; then
        log_success "✓ API assets endpoint"
    else
        log_warning "○ API assets endpoint (requires auth)"
    fi
    
    # フロントエンド テスト
    log_info "Testing frontend..."
    if curl -f "$FRONTEND_URL" &> /dev/null; then
        log_success "✓ Frontend accessible"
    else
        log_error "✗ Frontend accessibility failed"
    fi
    
    # Firebase サービス テスト
    log_info "Testing Firebase services..."
    # 実際のテストはフロントエンドで実行
    
    log_success "Post-deployment verification completed"
}

# デプロイ情報表示
show_deployment_info() {
    log_info "📋 Deployment Information"
    echo "=========================================="
    echo "Environment: $ENVIRONMENT"
    echo "Project ID: $PROJECT_ID"
    echo "Region: $REGION"
    echo "=========================================="
    echo "🌐 Frontend URL: https://$PROJECT_ID.web.app"
    echo "🔧 API URL: $(cat .api-url 2>/dev/null || echo 'N/A')"
    echo "🗄️  Firestore: https://console.firebase.google.com/project/$PROJECT_ID/firestore"
    echo "💾 Storage: https://console.cloud.google.com/storage/browser?project=$PROJECT_ID"
    echo "📊 Monitoring: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
    echo "=========================================="
}

# クリーンアップ
cleanup() {
    log_info "🧹 Cleaning up temporary files..."
    rm -f .api-url
    log_success "Cleanup completed"
}

# メイン実行
main() {
    log_info "🎬 DirectorX GCP Deployment Started"
    echo "Environment: $ENVIRONMENT"
    echo "Project: $PROJECT_ID"
    echo ""
    
    check_prerequisites
    setup_gcp_project
    setup_cloud_storage
    
    deploy_api
    setup_firestore
    deploy_frontend
    
    post_deploy_verification
    show_deployment_info
    
    cleanup
    
    log_success "🎉 DirectorX deployment completed successfully!"
    log_info "Access your application at: https://$PROJECT_ID.web.app"
}

# エラーハンドリング
trap 'log_error "Deployment failed at line $LINENO"; cleanup; exit 1' ERR

# 実行
main "$@"