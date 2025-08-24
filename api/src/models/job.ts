/**
 * DirectorX Job Model
 * 制作ジョブの状態管理・進行追跡
 */

import { z } from 'zod';

// ジョブステータス
export type JobStatus = 
  | 'draft'           // 下書き状態
  | 'processing'      // 処理中
  | 'review'          // レビュー待ち
  | 'approved'        // 承認済み
  | 'rejected'        // 差し戻し
  | 'completed'       // 完了（配信可能）
  | 'error'           // エラー
  | 'cancelled';      // キャンセル

// ジョブ段階
export type JobStep = 
  | 'ingest'          // 素材取得
  | 'script'          // 台本生成
  | 'srt'             // 字幕生成
  | 'tts'             // 音声合成
  | 'render'          // 動画レンダリング
  | 'qc'              // 品質チェック
  | 'thumbnail'       // サムネ生成
  | 'export';         // 最終出力

// 成果物（アーティファクト）
export interface JobArtifacts {
  video?: {
    url: string;
    filename: string;
    format: string;
    resolution: string;
    duration: number;
    size: number;
  };
  audio?: {
    url: string;
    filename: string;
    format: string;
    duration: number;
    size: number;
  };
  srt?: {
    url: string;
    filename: string;
    content: string;
    segmentCount: number;
  };
  thumbnails?: Array<{
    url: string;
    filename: string;
    format: string;
    resolution: string;
    variant: string; // レイアウトバリエーション
  }>;
  script?: {
    title: string;
    content: string;
    wordCount: number;
    style: string;
  };
}

// ジョブメトリクス
export interface JobMetrics {
  processingTime: {
    total: number;
    byStep: Record<JobStep, number>;
  };
  cost: {
    total: number;
    breakdown: {
      llm: number;
      tts: number;
      storage: number;
      compute: number;
    };
  };
  quality: {
    qcScore: number;
    issues: number;
    warnings: number;
  };
  performance: {
    throughput: number; // 分/秒
    efficiency: number; // 0-100%
  };
}

// QCレポート
export interface QCReport {
  overall: {
    passed: boolean;
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  audio?: {
    lufs: number;
    issues: string[];
  };
  video?: {
    blackFrames: number;
    quality: number;
    issues: string[];
  };
  content?: {
    ngwords: number;
    violations: string[];
  };
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  timestamp: string;
}

// Job型定義
export interface Job {
  id: string;
  channelId: string;
  workspaceId: string;
  status: JobStatus;
  currentStep: JobStep;
  
  // 制作設定
  recipeId: string;
  brandKitId: string;
  
  // 入力素材
  inputs: {
    assetIds: string[];
    sourceContent?: string;
    userInstructions?: string;
  };
  
  // 成果物
  artifacts: JobArtifacts;
  
  // 品質・メトリクス
  qcReport?: QCReport;
  metrics?: JobMetrics;
  
  // メタデータ
  title: string;
  description?: string;
  tags: string[];
  
  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // 担当者
  createdBy: string;
  assignedTo?: string;
  
  // 進捗
  progress: number; // 0-100
  progressMessage: string;
  
  // エラー情報
  error?: {
    message: string;
    step: JobStep;
    timestamp: Date;
    retryCount: number;
  };
}

// Job作成用スキーマ
export const CreateJobSchema = z.object({
  channelId: z.string().uuid(),
  recipeId: z.string().uuid(),
  inputs: z.object({
    assetIds: z.array(z.string().uuid()),
    sourceContent: z.string().optional(),
    userInstructions: z.string().optional()
  }),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([])
});

// Job更新用スキーマ
export const UpdateJobSchema = z.object({
  status: z.enum([
    'draft', 'processing', 'review', 'approved', 
    'rejected', 'completed', 'error', 'cancelled'
  ]).optional(),
  currentStep: z.enum([
    'ingest', 'script', 'srt', 'tts', 
    'render', 'qc', 'thumbnail', 'export'
  ]).optional(),
  assignedTo: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  progressMessage: z.string().optional()
});

// Job検索/フィルタ用スキーマ
export const JobFilterSchema = z.object({
  channelId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  status: z.array(z.enum([
    'draft', 'processing', 'review', 'approved', 
    'rejected', 'completed', 'error', 'cancelled'
  ])).optional(),
  assignedTo: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'status']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export class JobModel {
  private static jobs: Map<string, Job> = new Map();

  // 新規ジョブ作成
  static async create(data: z.infer<typeof CreateJobSchema>, userId: string): Promise<Job> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const job: Job = {
      id: jobId,
      channelId: data.channelId,
      workspaceId: '', // チャンネルから取得
      status: 'draft',
      currentStep: 'ingest',
      recipeId: data.recipeId,
      brandKitId: '', // チャンネルから取得
      inputs: data.inputs,
      artifacts: {},
      title: data.title,
      description: data.description,
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      progress: 0,
      progressMessage: '初期化中...'
    };

    this.jobs.set(jobId, job);
    return job;
  }

  // ジョブ更新
  static async update(jobId: string, data: z.infer<typeof UpdateJobSchema>): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const updatedJob: Job = {
      ...job,
      ...data,
      updatedAt: new Date()
    };

    // ステータス変更時の特別処理
    if (data.status && data.status !== job.status) {
      switch (data.status) {
        case 'processing':
          updatedJob.startedAt = new Date();
          break;
        case 'completed':
        case 'approved':
          updatedJob.completedAt = new Date();
          updatedJob.progress = 100;
          break;
        case 'error':
        case 'cancelled':
          updatedJob.completedAt = new Date();
          break;
      }
    }

    this.jobs.set(jobId, updatedJob);
    return updatedJob;
  }

  // ジョブ取得
  static async findById(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  // ジョブ一覧取得（フィルタ付き）
  static async findMany(filter: z.infer<typeof JobFilterSchema>): Promise<{
    jobs: Job[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    let filteredJobs = Array.from(this.jobs.values());

    // フィルタ適用
    if (filter.channelId) {
      filteredJobs = filteredJobs.filter(job => job.channelId === filter.channelId);
    }
    if (filter.workspaceId) {
      filteredJobs = filteredJobs.filter(job => job.workspaceId === filter.workspaceId);
    }
    if (filter.status?.length) {
      filteredJobs = filteredJobs.filter(job => filter.status!.includes(job.status));
    }
    if (filter.assignedTo) {
      filteredJobs = filteredJobs.filter(job => job.assignedTo === filter.assignedTo);
    }
    if (filter.createdBy) {
      filteredJobs = filteredJobs.filter(job => job.createdBy === filter.createdBy);
    }
    if (filter.tags?.length) {
      filteredJobs = filteredJobs.filter(job => 
        filter.tags!.some(tag => job.tags.includes(tag))
      );
    }

    // 日付フィルタ
    if (filter.dateFrom) {
      const fromDate = new Date(filter.dateFrom);
      filteredJobs = filteredJobs.filter(job => job.createdAt >= fromDate);
    }
    if (filter.dateTo) {
      const toDate = new Date(filter.dateTo);
      filteredJobs = filteredJobs.filter(job => job.createdAt <= toDate);
    }

    // ソート
    filteredJobs.sort((a, b) => {
      const aValue = a[filter.sortBy as keyof Job] as any;
      const bValue = b[filter.sortBy as keyof Job] as any;
      
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return filter.sortOrder === 'desc' ? -comparison : comparison;
    });

    // ページネーション
    const total = filteredJobs.length;
    const totalPages = Math.ceil(total / filter.limit);
    const startIndex = (filter.page - 1) * filter.limit;
    const endIndex = startIndex + filter.limit;
    const jobs = filteredJobs.slice(startIndex, endIndex);

    return {
      jobs,
      total,
      page: filter.page,
      totalPages
    };
  }

  // ジョブ削除
  static async delete(jobId: string): Promise<boolean> {
    return this.jobs.delete(jobId);
  }

  // 進捗更新
  static async updateProgress(
    jobId: string, 
    progress: number, 
    message: string, 
    step?: JobStep
  ): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.progress = Math.max(0, Math.min(100, progress));
    job.progressMessage = message;
    job.updatedAt = new Date();

    if (step) {
      job.currentStep = step;
    }

    this.jobs.set(jobId, job);
    return job;
  }

  // アーティファクト更新
  static async updateArtifacts(jobId: string, artifacts: Partial<JobArtifacts>): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.artifacts = { ...job.artifacts, ...artifacts };
    job.updatedAt = new Date();

    this.jobs.set(jobId, job);
    return job;
  }

  // QCレポート更新
  static async updateQCReport(jobId: string, qcReport: QCReport): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.qcReport = qcReport;
    job.updatedAt = new Date();

    // QC結果に基づくステータス更新
    if (!qcReport.overall.passed) {
      job.status = 'error';
      job.error = {
        message: `品質チェック失敗: ${qcReport.blockers.join(', ')}`,
        step: 'qc',
        timestamp: new Date(),
        retryCount: (job.error?.retryCount || 0) + 1
      };
    }

    this.jobs.set(jobId, job);
    return job;
  }

  // ワークフロー進行
  static async advanceWorkflow(jobId: string, targetStatus: JobStatus): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // ワークフロー検証
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      draft: ['processing', 'cancelled'],
      processing: ['review', 'error', 'cancelled'],
      review: ['approved', 'rejected'],
      approved: ['completed'],
      rejected: ['draft', 'processing'],
      completed: [],
      error: ['processing', 'cancelled'],
      cancelled: ['draft']
    };

    const allowedStates = validTransitions[job.status];
    if (!allowedStates.includes(targetStatus)) {
      throw new Error(`Invalid status transition: ${job.status} -> ${targetStatus}`);
    }

    return this.update(jobId, { status: targetStatus });
  }
}

export default JobModel;