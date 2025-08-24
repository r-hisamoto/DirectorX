/**
 * DirectorX Frontend RBAC Utilities
 * フロントエンド用ロールベースアクセス制御ヘルパー
 */

// ユーザー・ロール・権限の型定義
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  workspaceId: string;
  isActive: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  REVIEWER = 'reviewer',
  VIEWER = 'viewer'
}

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

// ロール階層（上位ロールは下位ロールの機能を含む）
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 4,
  [UserRole.EDITOR]: 3,
  [UserRole.REVIEWER]: 2,
  [UserRole.VIEWER]: 1
};

// ロール表示名
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'システム管理者',
  [UserRole.EDITOR]: '編集者',
  [UserRole.REVIEWER]: 'レビュアー',
  [UserRole.VIEWER]: '閲覧者'
};

// ロール色分け
export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'purple',
  [UserRole.EDITOR]: 'blue',
  [UserRole.REVIEWER]: 'green',
  [UserRole.VIEWER]: 'gray'
};

// RBAC ヘルパークラス
export class RBACHelper {
  /**
   * ユーザーが特定の権限を持つかチェック
   */
  static hasPermission(user: User | null, permission: Permission): boolean {
    if (!user || !user.isActive) return false;
    return user.permissions.includes(permission);
  }

  /**
   * ユーザーが複数の権限をすべて持つかチェック
   */
  static hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
    if (!user || !user.isActive) return false;
    return permissions.every(permission => user.permissions.includes(permission));
  }

  /**
   * ユーザーが複数の権限のいずれかを持つかチェック
   */
  static hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
    if (!user || !user.isActive) return false;
    return permissions.some(permission => user.permissions.includes(permission));
  }

  /**
   * ユーザーが特定のロールかチェック
   */
  static hasRole(user: User | null, role: UserRole): boolean {
    if (!user || !user.isActive) return false;
    return user.role === role;
  }

  /**
   * ユーザーが特定のロール以上かチェック
   */
  static hasRoleLevel(user: User | null, minimumRole: UserRole): boolean {
    if (!user || !user.isActive) return false;
    return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
  }

  /**
   * ユーザーが複数のロールのいずれかを持つかチェック
   */
  static hasAnyRole(user: User | null, roles: UserRole[]): boolean {
    if (!user || !user.isActive) return false;
    return roles.includes(user.role);
  }

  /**
   * ユーザーが管理者かチェック
   */
  static isAdmin(user: User | null): boolean {
    return this.hasRole(user, UserRole.ADMIN);
  }

  /**
   * ユーザーがエディター以上かチェック
   */
  static canEdit(user: User | null): boolean {
    return this.hasRoleLevel(user, UserRole.EDITOR);
  }

  /**
   * ユーザーがレビュアー以上かチェック
   */
  static canReview(user: User | null): boolean {
    return this.hasRoleLevel(user, UserRole.REVIEWER);
  }

  /**
   * ユーザーが他のユーザーを管理できるかチェック
   */
  static canManageUser(manager: User | null, target: User): boolean {
    if (!manager || !manager.isActive) return false;
    if (manager.role === UserRole.ADMIN) return true;
    return ROLE_HIERARCHY[manager.role] > ROLE_HIERARCHY[target.role];
  }

  /**
   * リソースの所有者かチェック
   */
  static isOwner(user: User | null, resourceOwnerId: string): boolean {
    return user?.id === resourceOwnerId;
  }

  /**
   * リソースにアクセス可能かチェック（所有者またはより高い権限）
   */
  static canAccessResource(
    user: User | null, 
    resourceOwnerId: string, 
    requiredPermissions: Permission[] = []
  ): boolean {
    if (!user || !user.isActive) return false;
    
    // 管理者は常にアクセス可能
    if (this.isAdmin(user)) return true;
    
    // リソースの所有者は基本的にアクセス可能
    if (this.isOwner(user, resourceOwnerId)) return true;
    
    // 必要な権限を持っているかチェック
    if (requiredPermissions.length > 0) {
      return this.hasAllPermissions(user, requiredPermissions);
    }
    
    return false;
  }

  /**
   * ロールに基づいたCSSクラス名を生成
   */
  static getRoleBadgeClass(role: UserRole): string {
    const color = ROLE_COLORS[role];
    return `inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${color}-100 text-${color}-800`;
  }

  /**
   * ユーザーが表示可能なロール一覧を取得
   */
  static getAssignableRoles(currentUser: User | null): UserRole[] {
    if (!currentUser || !currentUser.isActive) return [];
    
    const currentLevel = ROLE_HIERARCHY[currentUser.role];
    return Object.entries(ROLE_HIERARCHY)
      .filter(([, level]) => level <= currentLevel)
      .map(([role]) => role as UserRole);
  }

  /**
   * 権限に基づいたルーティングガード
   */
  static checkRouteAccess(user: User | null, requiredPermissions: Permission[]): boolean {
    if (requiredPermissions.length === 0) return true;
    return this.hasAllPermissions(user, requiredPermissions);
  }

  /**
   * 機能の可用性チェック
   */
  static getFeatureAvailability(user: User | null) {
    return {
      // ユーザー管理
      canViewUsers: this.hasPermission(user, Permission.USER_READ),
      canCreateUsers: this.hasPermission(user, Permission.USER_CREATE),
      canUpdateUsers: this.hasPermission(user, Permission.USER_UPDATE),
      canDeleteUsers: this.hasPermission(user, Permission.USER_DELETE),
      
      // ワークスペース管理
      canViewWorkspace: this.hasPermission(user, Permission.WORKSPACE_READ),
      canUpdateWorkspace: this.hasPermission(user, Permission.WORKSPACE_WRITE),
      canDeleteWorkspace: this.hasPermission(user, Permission.WORKSPACE_DELETE),
      
      // コンテンツ作成
      canCreateJobs: this.hasPermission(user, Permission.JOB_CREATE),
      canExecuteJobs: this.hasPermission(user, Permission.JOB_EXECUTE),
      canUploadAssets: this.hasPermission(user, Permission.ASSET_UPLOAD),
      
      // レビュー機能
      canCreateReviews: this.hasPermission(user, Permission.REVIEW_CREATE),
      canApproveReviews: this.hasPermission(user, Permission.REVIEW_APPROVE),
      
      // システム機能
      canExecuteRender: this.hasPermission(user, Permission.RENDER_EXECUTE),
      canExecuteQC: this.hasPermission(user, Permission.QC_EXECUTE),
      canGenerateThumbnails: this.hasPermission(user, Permission.THUMBNAIL_GENERATE),
      
      // ロールベース
      isAdmin: this.isAdmin(user),
      canEdit: this.canEdit(user),
      canReview: this.canReview(user)
    };
  }
}

/**
 * Reactコンポーネント用フック
 */
import { useState, useEffect } from 'react';

export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 現在のユーザー情報を取得
    fetch('/v1/users/me')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
        }
      })
      .catch(error => {
        console.error('Failed to get current user:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return user;
}

export function usePermissions() {
  const user = useCurrentUser();
  return RBACHelper.getFeatureAvailability(user);
}

export function useRoleCheck(requiredRole: UserRole) {
  const user = useCurrentUser();
  return RBACHelper.hasRoleLevel(user, requiredRole);
}

export function usePermissionCheck(permission: Permission) {
  const user = useCurrentUser();
  return RBACHelper.hasPermission(user, permission);
}

/**
 * 認可コンポーネント - 権限に基づいて子要素を表示/非表示
 */
import React from 'react';

interface CanProps {
  permission?: Permission;
  permissions?: Permission[];
  role?: UserRole;
  roles?: UserRole[];
  requireAll?: boolean;
  user?: User | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  user,
  children,
  fallback = null
}) => {
  const currentUser = useCurrentUser();
  const targetUser = user || currentUser;

  let hasAccess = false;

  if (permission) {
    hasAccess = RBACHelper.hasPermission(targetUser, permission);
  } else if (permissions) {
    hasAccess = requireAll 
      ? RBACHelper.hasAllPermissions(targetUser, permissions)
      : RBACHelper.hasAnyPermission(targetUser, permissions);
  } else if (role) {
    hasAccess = RBACHelper.hasRoleLevel(targetUser, role);
  } else if (roles) {
    hasAccess = RBACHelper.hasAnyRole(targetUser, roles);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default RBACHelper;