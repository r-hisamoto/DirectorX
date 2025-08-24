# DirectorX v1.0 🎬

**Self-Contained Video Production OS**

[![GitHub](https://img.shields.io/github/license/r-hisamoto/DirectorX?style=for-the-badge)](https://github.com/r-hisamoto/DirectorX)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

> **Status**: ✅ Successfully deployed to GitHub - Ready for production use

**Repository**: https://github.com/r-hisamoto/DirectorX.git

## 🌟 Overview

DirectorX v1.0 is a comprehensive video production operating system that handles the complete workflow from assets to final video distribution within a single application. Built with Japanese language support and advanced video processing capabilities.

### 🎯 Core Workflow
```
Assets → Scripts → SRT → TTS → Video → Thumbnails → Distribution Checks
```

## ⚡️ Key Features

### 🎬 Complete Video Production Pipeline
- **8-Step Recipe Engine**: Dependency-managed production workflow
- **Asset Ingestion**: Multi-source import (URL, files, X/Twitter, 5ch, YouTube)
- **Script Generation**: AI-assisted scriptwriting with templates
- **SRT Processing**: Japanese formatting with kinsoku rules (禁則処理)
- **TTS Integration**: Web Speech API with Japanese voice support
- **Video Rendering**: Canvas API + MediaRecorder browser-native generation
- **Thumbnail Creation**: Automated thumbnail generation
- **Distribution**: Multi-platform export preparation

### 🌏 Japanese Language Excellence
- **Kinsoku Rules (禁則処理)**: Proper Japanese text line breaking
- **SRT Formatting**: 20-character full-width text wrapping
- **Native TTS**: Japanese speech synthesis integration
- **UI Localization**: Complete Japanese interface support

### 🎨 Modern Architecture
- **Frontend**: React 18 + TypeScript + Vite + Zustand
- **Backend**: Node.js + Express + TypeScript
- **Monorepo**: pnpm workspaces for organized development
- **State Management**: Zustand with TypeScript integration
- **Command Palette**: Quick access to all functions
- **Three-Column Layout**: Optimized workflow interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Modern browser with Canvas and MediaRecorder support

### Installation
```bash
# Clone the repository
git clone https://github.com/r-hisamoto/DirectorX.git
cd DirectorX

# Install dependencies
pnpm install

# Start development servers
pnpm dev        # Both frontend and backend
pnpm dev:web    # Frontend only (port 5173)
pnpm dev:api    # Backend only (port 3001)
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs

## 🏗️ Architecture

### Project Structure
```
DirectorX/
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # Core services
│   │   │   ├── recipeEngine.ts    # 8-step pipeline
│   │   │   ├── renderService.ts   # Video rendering
│   │   │   ├── ttsService.ts      # TTS integration
│   │   │   └── srtProcessor.ts    # Japanese SRT handling
│   │   └── store/         # Zustand state management
├── api/                   # Node.js backend
│   ├── src/
│   │   ├── controllers/   # API endpoints
│   │   ├── services/      # Business logic
│   │   └── models/        # Data models
├── shared/                # Common TypeScript types
└── docs/                  # Documentation
```

### Core Services

#### Recipe Engine
```typescript
export class RecipeEngine {
  async executeRecipe(recipe: VideoRecipe, options: RenderOptions): Promise<void>
  private sortStepsByDependencies(steps: RecipeStep[]): RecipeStep[]
}
```

#### TTS Service
```typescript
export class TTSService {
  async generateFromScript(scriptContent: string, options: TTSOptions = {}): Promise<TTSResult>
  async generateFromSRT(srtContent: string, options: TTSOptions = {}): Promise<TTSResult>
}
```

#### Render Service
```typescript
export class RenderService {
  async renderJob(jobId: string): Promise<void>
  private async generateFrame(job: RenderJob, timestamp: number): Promise<VideoFrame>
}
```

## 🧪 Testing

### Run Tests
```bash
pnpm test              # All tests
pnpm test:web         # Frontend tests
pnpm test:api         # Backend tests
pnpm test:e2e         # End-to-end tests
```

### Coverage
```bash
pnpm test:coverage    # Generate coverage report
```

## 🌐 Production Deployment

### Build for Production
```bash
pnpm build            # Build all packages
pnpm build:web        # Build frontend
pnpm build:api        # Build backend
```

### GCP Deployment
DirectorX v1.0 includes complete Google Cloud Platform deployment configuration:

```bash
# Deploy to Firebase Hosting + Cloud Run
pnpm deploy

# Individual deployments
pnpm deploy:web       # Frontend to Firebase Hosting
pnpm deploy:api       # Backend to Cloud Run
```

**Infrastructure Components**:
- **Frontend**: Firebase Hosting with global CDN
- **API**: Cloud Run with auto-scaling
- **Database**: Firestore with security rules
- **Storage**: Cloud Storage with IAM policies
- **Monitoring**: Cloud Logging and Error Reporting

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

## 📋 Available Scripts

### Development
```bash
pnpm dev              # Start both servers in development mode
pnpm dev:web          # Start frontend development server
pnpm dev:api          # Start backend development server
```

### Building
```bash
pnpm build            # Build all packages for production
pnpm build:web        # Build frontend bundle
pnpm build:api        # Build backend for deployment
```

### Testing
```bash
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Run ESLint on all packages
pnpm type-check       # Run TypeScript type checking
```

### Deployment
```bash
pnpm deploy           # Deploy to production (GCP)
pnpm deploy:web       # Deploy frontend to Firebase Hosting
pnpm deploy:api       # Deploy backend to Cloud Run
```

## 🎛️ Configuration

### Environment Variables

#### Frontend (.env.local)
```bash
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=DirectorX
VITE_ENABLE_DEBUG=true
```

#### Backend (.env)
```bash
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Production Configuration
Production environment variables are managed through:
- Firebase configuration for hosting
- Cloud Run environment variables for the API
- Firestore security rules for database access
- Cloud Storage IAM policies for file storage

## 🔧 Advanced Features

### Japanese Text Processing
- **Kinsoku Rules**: Automatic line breaking for proper Japanese typography
- **Character Width**: Full-width character support for SRT formatting
- **Voice Selection**: Native Japanese TTS voice detection and selection

### Video Processing
- **Canvas Rendering**: High-performance browser-based video generation
- **MediaRecorder**: Efficient video encoding and export
- **Frame Composition**: Layer-based video composition system

### Command Palette
- Quick access to all application functions
- Keyboard shortcuts for power users
- Context-aware command suggestions

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions
- [API Documentation](./docs/api.md) - REST API reference
- [Component Guide](./docs/components.md) - Frontend component documentation
- [Architecture](./docs/architecture.md) - System architecture overview

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Use conventional commit messages
- Ensure Japanese language support for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies and best practices
- Japanese language processing with kinsoku rule implementation
- Browser-native video processing for maximum compatibility
- Production-ready GCP deployment configuration

---

**DirectorX v1.0** - Complete video production OS ready for production use.

**Repository**: https://github.com/r-hisamoto/DirectorX.git