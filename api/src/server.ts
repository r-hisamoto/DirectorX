import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      connectSrc: [
        "'self'",
        process.env.API_URL || 'http://localhost:8000',
        process.env.STORAGE_URL || '',
        // Allow WebSocket connections for Socket.IO (ws/wss)
        'ws:',
        'wss:',
      ].filter(Boolean),
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import { workspaceRoutes } from './routes/workspaces';
import { channelRoutes } from './routes/channels';
import { brandkitRoutes } from './routes/brandkits';
import { assetRoutes } from './routes/assets';
import renderRoutes from './routes/render';
import qcRoutes from './routes/qc';
import nlpRoutes from './routes/nlp';
import jobsRoutes from './routes/jobs';
import reviewsRoutes from './routes/reviews';
import thumbnailsRoutes from './routes/thumbnails';
import usersRoutes from './routes/users';
import tasksRoutes from './routes/tasks';

// API routes
app.use('/v1/workspaces', workspaceRoutes);
app.use('/v1/channels', channelRoutes);
app.use('/v1/brandkits', brandkitRoutes);
app.use('/v1', assetRoutes);  // Assets routes are at root level: /v1/ingest, /v1/assets
app.use('/v1/render', renderRoutes);
app.use('/v1/qc', qcRoutes);
app.use('/v1', nlpRoutes);  // NLP routes: /v1/script, /v1/comments5ch
app.use('/v1/jobs', jobsRoutes);
app.use('/v1/reviews', reviewsRoutes);
app.use('/v1/thumbnails', thumbnailsRoutes);
app.use('/v1/users', usersRoutes);
app.use('/v1/tasks', tasksRoutes);

// API root endpoint
app.get('/v1', (req, res) => {
  res.json({ 
    message: 'DirectorX API v1.0', 
    timestamp: new Date().toISOString(),
    endpoints: {
      workspaces: '/v1/workspaces',
      channels: '/v1/channels',
      brandkits: '/v1/brandkits',
      ingest: '/v1/ingest',
      assets: '/v1/assets',
      render: '/v1/render',
      qc: '/v1/qc',
      script: '/v1/script',
      comments5ch: '/v1/comments5ch',
      jobs: '/v1/jobs',
      reviews: '/v1/reviews',
      thumbnails: '/v1/thumbnails',
      users: '/v1/users',
      tasks: '/v1/tasks'
    }
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`🚀 DirectorX API server running on port ${PORT}`);
  logger.info(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
});
