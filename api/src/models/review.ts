/**
 * DirectorX Review Model
 * レビュー・承認・差し戻し機能
 */

import { z } from 'zod';

// レビュー状態
export type ReviewStatus = 
  | 'pending'    // レビュー待ち
  | 'in_review'  // レビュー中
  | 'approved'   // 承認
  | 'rejected'   // 差し戻し
  | 'cancelled'; // キャンセル

// コメントタイプ
export type CommentType = 
  | 'general'     // 一般コメント
  | 'suggestion'  // 改善提案
  | 'issue'       // 問題指摘
  | 'approval'    // 承認理由
  | 'rejection';  // 差し戻し理由

// 差分タイプ
export type DiffType = 
  | 'script'     // 台本変更
  | 'srt'        // 字幕変更
  | 'recipe'     // レシピ変更
  | 'config'     // 設定変更
  | 'assets';    // 素材変更

// レビューコメント
export interface ReviewComment {
  id: string;
  type: CommentType;
  content: string;
  timestamp?: number; // 動画・音声の特定位置
  section?: string;   // 台本の特定セクション
  severity: 'info' | 'warning' | 'error';
  resolved: boolean;
  author: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 差分情報
export interface ReviewDiff {
  type: DiffType;
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
}

// レビューテンプレート
export interface ReviewTemplate {
  id: string;
  name: string;
  category: string;
  checklist: ReviewChecklistItem[];
  defaultComments: string[];
}

export interface ReviewChecklistItem {
  id: string;
  text: string;
  category: string;
  required: boolean;
  checked: boolean;
}

// Review型定義
export interface Review {
  id: string;
  jobId: string;
  status: ReviewStatus;
  
  // レビュー担当
  reviewerId: string;
  reviewerName: string;
  assignedAt: Date;
  
  // コメント・フィードバック
  comments: ReviewComment[];
  checklist: ReviewChecklistItem[];
  
  // 差分情報
  diffs: ReviewDiff[];
  
  // 判定
  decision?: {
    type: 'approve' | 'reject';
    reason: string;
    conditions?: string[]; // 承認条件
    deadline?: Date;      // 修正期限
  };
  
  // メタデータ
  templateId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedTime: number; // 分
  
  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Review作成用スキーマ
export const CreateReviewSchema = z.object({
  jobId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  templateId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimatedTime: z.number().min(1).max(480).default(30), // 分
  initialComments: z.array(z.object({
    type: z.enum(['general', 'suggestion', 'issue', 'approval', 'rejection']),
    content: z.string().min(1),
    timestamp: z.number().optional(),
    section: z.string().optional(),
    severity: z.enum(['info', 'warning', 'error']).default('info')
  })).optional()
});

// Review更新用スキーマ
export const UpdateReviewSchema = z.object({
  status: z.enum(['pending', 'in_review', 'approved', 'rejected', 'cancelled']).optional(),
  decision: z.object({
    type: z.enum(['approve', 'reject']),
    reason: z.string().min(1),
    conditions: z.array(z.string()).optional(),
    deadline: z.string().datetime().optional()
  }).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
});

// コメント追加用スキーマ
export const AddCommentSchema = z.object({
  type: z.enum(['general', 'suggestion', 'issue', 'approval', 'rejection']),
  content: z.string().min(1).max(2000),
  timestamp: z.number().optional(),
  section: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']).default('info')
});

export class ReviewModel {
  private static reviews: Map<string, Review> = new Map();
  private static templates: Map<string, ReviewTemplate> = new Map();

  static {
    // デフォルトテンプレート登録
    this.loadDefaultTemplates();
  }

  // デフォルトテンプレート読み込み
  private static loadDefaultTemplates(): void {
    const standardTemplate: ReviewTemplate = {
      id: 'standard',
      name: '標準レビュー',
      category: 'general',
      checklist: [
        { id: '1', text: '台本の内容が適切か', category: 'content', required: true, checked: false },
        { id: '2', text: '字幕の表示時間が適切か', category: 'subtitle', required: true, checked: false },
        { id: '3', text: '音声品質に問題がないか', category: 'audio', required: true, checked: false },
        { id: '4', text: '映像品質に問題がないか', category: 'video', required: true, checked: false },
        { id: '5', text: 'NGワードが含まれていないか', category: 'content', required: true, checked: false },
        { id: '6', text: 'ブランドガイドラインに準拠しているか', category: 'brand', required: false, checked: false }
      ],
      defaultComments: [
        '全体的に良い内容ですが、以下の点を修正してください。',
        '品質基準を満たしており、承認します。',
        '以下の理由により差し戻しします。'
      ]
    };

    this.templates.set('standard', standardTemplate);
  }

  // 新規レビュー作成
  static async create(data: z.infer<typeof CreateReviewSchema>, reviewerName: string): Promise<Review> {
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // テンプレート適用
    const template = data.templateId ? this.templates.get(data.templateId) : this.templates.get('standard');
    const checklist = template ? [...template.checklist] : [];

    const review: Review = {
      id: reviewId,
      jobId: data.jobId,
      status: 'pending',
      reviewerId: data.reviewerId,
      reviewerName,
      assignedAt: now,
      comments: data.initialComments?.map(comment => ({
        ...comment,
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resolved: false,
        author: {
          id: data.reviewerId,
          name: reviewerName,
          role: 'reviewer'
        },
        createdAt: now,
        updatedAt: now
      })) || [],
      checklist,
      diffs: [],
      templateId: data.templateId,
      priority: data.priority,
      estimatedTime: data.estimatedTime,
      createdAt: now,
      updatedAt: now
    };

    this.reviews.set(reviewId, review);
    return review;
  }

  // レビュー更新
  static async update(reviewId: string, data: z.infer<typeof UpdateReviewSchema>): Promise<Review | null> {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    const updatedReview: Review = {
      ...review,
      ...data,
      updatedAt: new Date()
    };

    // ステータス変更時の処理
    if (data.status && data.status !== review.status) {
      if (data.status === 'approved' || data.status === 'rejected') {
        updatedReview.completedAt = new Date();
      }
      if (data.status === 'in_review' && review.status === 'pending') {
        // レビュー開始時刻を記録
      }
    }

    this.reviews.set(reviewId, updatedReview);
    return updatedReview;
  }

  // コメント追加
  static async addComment(
    reviewId: string, 
    commentData: z.infer<typeof AddCommentSchema>,
    authorId: string,
    authorName: string
  ): Promise<Review | null> {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    const comment: ReviewComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...commentData,
      resolved: false,
      author: {
        id: authorId,
        name: authorName,
        role: 'reviewer'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    review.comments.push(comment);
    review.updatedAt = new Date();

    this.reviews.set(reviewId, review);
    return review;
  }

  // チェックリスト更新
  static async updateChecklist(
    reviewId: string, 
    checklistUpdates: Array<{ id: string; checked: boolean }>
  ): Promise<Review | null> {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    for (const update of checklistUpdates) {
      const item = review.checklist.find(item => item.id === update.id);
      if (item) {
        item.checked = update.checked;
      }
    }

    review.updatedAt = new Date();
    this.reviews.set(reviewId, review);
    return review;
  }

  // レビュー取得
  static async findById(reviewId: string): Promise<Review | null> {
    return this.reviews.get(reviewId) || null;
  }

  // ジョブのレビュー取得
  static async findByJobId(jobId: string): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(review => review.jobId === jobId);
  }

  // レビュアーのレビュー取得
  static async findByReviewerId(reviewerId: string): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(review => review.reviewerId === reviewerId);
  }

  // 差分生成
  static generateDiffs(oldData: any, newData: any): ReviewDiff[] {
    const diffs: ReviewDiff[] = [];
    
    // 簡易的な差分検出（実際の実装ではより詳細な比較）
    const compareFields = ['title', 'script', 'srt', 'recipe'];
    
    for (const field of compareFields) {
      if (oldData[field] !== newData[field]) {
        diffs.push({
          type: field as DiffType,
          field,
          oldValue: oldData[field],
          newValue: newData[field],
          description: `${field}が変更されました`
        });
      }
    }

    return diffs;
  }

  // テンプレート取得
  static getTemplate(templateId: string): ReviewTemplate | undefined {
    return this.templates.get(templateId);
  }

  // テンプレート一覧
  static listTemplates(): ReviewTemplate[] {
    return Array.from(this.templates.values());
  }
}

export default ReviewModel;