/**
 * DirectorX User Model with RBAC Support
 * ユーザー情報とロールベースアクセス制御
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  workspaceId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
  workspaceId: string;
  sendInviteEmail?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ロール定義
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor', 
  REVIEWER = 'reviewer',
  VIEWER = 'viewer'
}

// 権限定義
export enum Permission {
  // ワークスペース管理
  WORKSPACE_READ = 'workspace:read',
  WORKSPACE_WRITE = 'workspace:write',
  WORKSPACE_DELETE = 'workspace:delete',
  
  // ユーザー管理
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // チャンネル管理
  CHANNEL_READ = 'channel:read',
  CHANNEL_CREATE = 'channel:create',
  CHANNEL_UPDATE = 'channel:update',
  CHANNEL_DELETE = 'channel:delete',
  
  // ブランドキット管理
  BRANDKIT_READ = 'brandkit:read',
  BRANDKIT_CREATE = 'brandkit:create',
  BRANDKIT_UPDATE = 'brandkit:update',
  BRANDKIT_DELETE = 'brandkit:delete',
  
  // アセット管理
  ASSET_READ = 'asset:read',
  ASSET_UPLOAD = 'asset:upload',
  ASSET_UPDATE = 'asset:update',
  ASSET_DELETE = 'asset:delete',
  
  // ジョブ管理
  JOB_READ = 'job:read',
  JOB_CREATE = 'job:create',
  JOB_UPDATE = 'job:update',
  JOB_DELETE = 'job:delete',
  JOB_EXECUTE = 'job:execute',
  
  // レビュー機能
  REVIEW_READ = 'review:read',
  REVIEW_CREATE = 'review:create',
  REVIEW_UPDATE = 'review:update',
  REVIEW_APPROVE = 'review:approve',
  REVIEW_REJECT = 'review:reject',
  
  // レンダリング機能
  RENDER_EXECUTE = 'render:execute',
  RENDER_READ = 'render:read',
  
  // QC機能
  QC_EXECUTE = 'qc:execute',
  QC_READ = 'qc:read',
  
  // NLP機能
  NLP_EXECUTE = 'nlp:execute',
  NLP_READ = 'nlp:read',
  
  // サムネイル機能
  THUMBNAIL_GENERATE = 'thumbnail:generate',
  THUMBNAIL_READ = 'thumbnail:read'
}

// ロール別権限マップ
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // 全権限
    Permission.WORKSPACE_READ,
    Permission.WORKSPACE_WRITE,
    Permission.WORKSPACE_DELETE,
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.CHANNEL_READ,
    Permission.CHANNEL_CREATE,
    Permission.CHANNEL_UPDATE,
    Permission.CHANNEL_DELETE,
    Permission.BRANDKIT_READ,
    Permission.BRANDKIT_CREATE,
    Permission.BRANDKIT_UPDATE,
    Permission.BRANDKIT_DELETE,
    Permission.ASSET_READ,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_UPDATE,
    Permission.ASSET_DELETE,
    Permission.JOB_READ,
    Permission.JOB_CREATE,
    Permission.JOB_UPDATE,
    Permission.JOB_DELETE,
    Permission.JOB_EXECUTE,
    Permission.REVIEW_READ,
    Permission.REVIEW_CREATE,
    Permission.REVIEW_UPDATE,
    Permission.REVIEW_APPROVE,
    Permission.REVIEW_REJECT,
    Permission.RENDER_EXECUTE,
    Permission.RENDER_READ,
    Permission.QC_EXECUTE,
    Permission.QC_READ,
    Permission.NLP_EXECUTE,
    Permission.NLP_READ,
    Permission.THUMBNAIL_GENERATE,
    Permission.THUMBNAIL_READ
  ],
  
  [UserRole.EDITOR]: [
    // コンテンツ作成・編集権限
    Permission.WORKSPACE_READ,
    Permission.CHANNEL_READ,
    Permission.CHANNEL_CREATE,
    Permission.CHANNEL_UPDATE,
    Permission.BRANDKIT_READ,
    Permission.BRANDKIT_CREATE,
    Permission.BRANDKIT_UPDATE,
    Permission.ASSET_READ,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_UPDATE,
    Permission.JOB_READ,
    Permission.JOB_CREATE,
    Permission.JOB_UPDATE,
    Permission.JOB_EXECUTE,
    Permission.REVIEW_READ,
    Permission.REVIEW_CREATE,
    Permission.RENDER_EXECUTE,
    Permission.RENDER_READ,
    Permission.QC_EXECUTE,
    Permission.QC_READ,
    Permission.NLP_EXECUTE,
    Permission.NLP_READ,
    Permission.THUMBNAIL_GENERATE,
    Permission.THUMBNAIL_READ
  ],
  
  [UserRole.REVIEWER]: [
    // レビュー・承認権限
    Permission.WORKSPACE_READ,
    Permission.CHANNEL_READ,
    Permission.BRANDKIT_READ,
    Permission.ASSET_READ,
    Permission.JOB_READ,
    Permission.REVIEW_READ,
    Permission.REVIEW_CREATE,
    Permission.REVIEW_UPDATE,
    Permission.REVIEW_APPROVE,
    Permission.REVIEW_REJECT,
    Permission.RENDER_READ,
    Permission.QC_READ,
    Permission.THUMBNAIL_READ
  ],
  
  [UserRole.VIEWER]: [
    // 読み取り専用権限
    Permission.WORKSPACE_READ,
    Permission.CHANNEL_READ,
    Permission.BRANDKIT_READ,
    Permission.ASSET_READ,
    Permission.JOB_READ,
    Permission.REVIEW_READ,
    Permission.RENDER_READ,
    Permission.QC_READ,
    Permission.THUMBNAIL_READ
  ]
};

// ロール階層定義（上位ロールは下位ロールの権限を含む）
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.EDITOR, UserRole.REVIEWER, UserRole.VIEWER],
  [UserRole.EDITOR]: [UserRole.EDITOR, UserRole.REVIEWER, UserRole.VIEWER],
  [UserRole.REVIEWER]: [UserRole.REVIEWER, UserRole.VIEWER],
  [UserRole.VIEWER]: [UserRole.VIEWER]
};

// ロール表示名
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'システム管理者',
  [UserRole.EDITOR]: '編集者',
  [UserRole.REVIEWER]: 'レビュアー',
  [UserRole.VIEWER]: '閲覧者'
};

// ロール説明
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'システム全体の管理とすべての機能にアクセス可能',
  [UserRole.EDITOR]: 'コンテンツの作成・編集・レンダリングが可能',
  [UserRole.REVIEWER]: 'コンテンツのレビュー・承認・却下が可能',
  [UserRole.VIEWER]: 'コンテンツの閲覧のみ可能'
};

// ユーザーヘルパー関数
export class UserHelper {
  // ユーザーが特定の権限を持つかチェック
  static hasPermission(user: User, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }
  
  // ユーザーが複数の権限を持つかチェック
  static hasPermissions(user: User, permissions: Permission[]): boolean {
    return permissions.every(permission => user.permissions.includes(permission));
  }
  
  // ユーザーがいずれかの権限を持つかチェック
  static hasAnyPermission(user: User, permissions: Permission[]): boolean {
    return permissions.some(permission => user.permissions.includes(permission));
  }
  
  // ロールから権限を取得
  static getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }
  
  // ユーザーが特定のロール以上かチェック
  static hasRoleLevel(user: User, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY[user.role]?.includes(requiredRole) || false;
  }
  
  // ユーザーが他のユーザーを管理できるかチェック
  static canManageUser(manager: User, target: User): boolean {
    // 管理者は全員管理可能
    if (manager.role === UserRole.ADMIN) return true;
    
    // 自分より下位ロールのみ管理可能
    const managerHierarchy = ROLE_HIERARCHY[manager.role] || [];
    const targetHierarchy = ROLE_HIERARCHY[target.role] || [];
    
    return managerHierarchy.length > targetHierarchy.length;
  }
  
  // ロールの昇格・降格可能性チェック
  static canChangeRole(manager: User, targetRole: UserRole): boolean {
    if (manager.role === UserRole.ADMIN) return true;
    
    const managerHierarchy = ROLE_HIERARCHY[manager.role] || [];
    return managerHierarchy.includes(targetRole);
  }
}

export default User;