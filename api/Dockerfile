# DirectorX API - Production Dockerfile for Google Cloud Run

# Node.js 18 LTS (slim for smaller image size)
FROM node:18-slim

# システムパッケージとFFmpeg、日本語フォントのインストール
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-noto-cjk \
    fonts-ipaexfont \
    fontconfig \
    curl \
    && fc-cache -fv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# セキュリティ: 非rootユーザー作成
RUN groupadd -r directorx && useradd -r -g directorx directorx

# 作業ディレクトリ設定
WORKDIR /app

# package.json と package-lock.json をコピー (Docker layer caching 最適化)
COPY package*.json ./

# 本番依存関係のみインストール
RUN npm ci --only=production && npm cache clean --force

# アプリケーションファイルをコピー
COPY . .

# 非rootユーザーに所有権変更
RUN chown -R directorx:directorx /app
USER directorx

# Cloud Run 標準ポート
EXPOSE 8080

# セキュリティ: プロセス実行ユーザー確認
RUN whoami

# ヘルスチェックエンドポイント
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# アプリケーション起動
CMD ["node", "src/index.js"]