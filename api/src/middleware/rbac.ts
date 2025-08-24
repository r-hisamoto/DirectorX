/**
 * DirectorX RBAC Middleware
 * ロールベースアクセス制御ミドルウェア
 */

import { Request, Response, NextFunction } from 'express';
import { User, Permission, UserRole, UserHelper } from '../models/user.js';
import { logger } from '../lib/logger.js';

// 拡張Request型（認証後のユーザー情報を含む）
export interface AuthenticatedRequest extends Request {
  user?: User;
  workspace?: {
    id: string;
    name: string;
  };
}

export interface RBACOptions {
  permissions?: Permission[];
  roles?: UserRole[];
  requireAll?: boolean; // 全権限が必要か（デフォルト: false = いずれかの権限があればOK）
  allowOwner?: boolean; // リソースオーナーは権限チェックをスキップ
  ownerField?: string; // オーナー判定に使用するフィールド名（デフォルト: 'createdBy'）
}

// 権限チェックミドルウェア
export function requirePermissions(
  permissions: Permission | Permission[],
  options: Omit<RBACOptions, 'permissions'> = {}
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const permissionsArray = Array.isArray(permissions) ? permissions : [permissions];
    const opts: RBACOptions = {
      permissions: permissionsArray,
      requireAll: false,
      allowOwner: false,
      ownerField: 'createdBy',
      ...options
    };

    checkPermissions(req, res, next, opts);
  };
}

// ロールチェックミドルウェア
export function requireRoles(
  roles: UserRole | UserRole[],
  options: Omit<RBACOptions, 'roles'> = {}
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const opts: RBACOptions = {
      roles: rolesArray,
      allowOwner: false,
      ownerField: 'createdBy',
      ...options
    };

    checkPermissions(req, res, next, opts);
  };
}

// 管理者権限チェック
export function requireAdmin() {
  return requireRoles(UserRole.ADMIN);
}

// エディター以上の権限チェック
export function requireEditor() {
  return requireRoles([UserRole.ADMIN, UserRole.EDITOR]);
}

// レビュアー以上の権限チェック
export function requireReviewer() {
  return requireRoles([UserRole.ADMIN, UserRole.EDITOR, UserRole.REVIEWER]);
}

// メイン権限チェック関数
function checkPermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  options: RBACOptions
): void {
  try {
    // ユーザー認証チェック
    if (!req.user) {
      logger.warn('RBAC: Unauthorized access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: '認証が必要です',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const user = req.user;

    // アクティブユーザーチェック
    if (!user.isActive) {
      logger.warn('RBAC: Inactive user access attempt', {
        userId: user.id,
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({
        error: 'Account inactive',
        message: 'アカウントが無効です',
        code: 'ACCOUNT_INACTIVE'
      });
      return;
    }

    // 管理者は全てのアクセスを許可
    if (user.role === UserRole.ADMIN) {
      logger.debug('RBAC: Admin access granted', {
        userId: user.id,
        path: req.path,
        method: req.method
      });
      next();
      return;
    }

    // オーナー権限チェック（設定されている場合）
    if (options.allowOwner && options.ownerField) {
      const resourceOwnerId = req.body?.[options.ownerField] || req.params?.[options.ownerField];
      if (resourceOwnerId && resourceOwnerId === user.id) {
        logger.debug('RBAC: Owner access granted', {
          userId: user.id,
          resourceOwnerId,
          path: req.path,
          method: req.method
        });
        next();
        return;
      }
    }

    // 権限ベースのチェック
    if (options.permissions && options.permissions.length > 0) {
      const hasPermission = options.requireAll
        ? UserHelper.hasPermissions(user, options.permissions)
        : UserHelper.hasAnyPermission(user, options.permissions);

      if (!hasPermission) {
        logger.warn('RBAC: Permission denied', {
          userId: user.id,
          userRole: user.role,
          requiredPermissions: options.permissions,
          userPermissions: user.permissions,
          path: req.path,
          method: req.method
        });
        
        res.status(403).json({
          error: 'Insufficient permissions',
          message: '権限が不足しています',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: options.permissions,
          current: user.permissions
        });
        return;
      }
    }

    // ロールベースのチェック
    if (options.roles && options.roles.length > 0) {
      const hasRole = options.roles.includes(user.role);
      
      if (!hasRole) {
        logger.warn('RBAC: Role access denied', {
          userId: user.id,
          userRole: user.role,
          requiredRoles: options.roles,
          path: req.path,
          method: req.method
        });
        
        res.status(403).json({
          error: 'Insufficient role level',
          message: '権限レベルが不足しています',
          code: 'INSUFFICIENT_ROLE',
          required: options.roles,
          current: user.role
        });
        return;
      }
    }

    // 全てのチェックを通過
    logger.debug('RBAC: Access granted', {
      userId: user.id,
      userRole: user.role,
      path: req.path,
      method: req.method
    });

    next();

  } catch (error) {
    logger.error('RBAC: Permission check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'Permission check failed',
      message: '権限チェック中にエラーが発生しました',
      code: 'PERMISSION_CHECK_ERROR'
    });
  }
}

// リソース所有者チェックミドルウェア
export function requireOwnership(resourceIdParam: string = 'id', ownerField: string = 'createdBy') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: '認証が必要です'
        });
        return;
      }

      // 管理者は全てのリソースにアクセス可能
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        res.status(400).json({
          error: 'Resource ID required',
          message: 'リソースIDが必要です'
        });
        return;
      }

      // ここで実際のリソース取得とオーナーシップチェックを行う
      // 実装では各リソースごとに適切なデータベースクエリを使用
      // 現在はプレースホルダー実装
      
      next();

    } catch (error) {
      logger.error('RBAC: Ownership check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resourceIdParam,
        ownerField,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Ownership check failed',
        message: '所有者チェック中にエラーが発生しました'
      });
    }
  };
}

// ワークスペースアクセスチェック
export function requireWorkspaceAccess() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        error: 'Workspace access required',
        message: 'ワークスペースアクセスが必要です'
      });
      return;
    }

    // ユーザーが指定されたワークスペースにアクセス権があるかチェック
    if (req.user.workspaceId !== req.workspace.id) {
      logger.warn('RBAC: Workspace access denied', {
        userId: req.user.id,
        userWorkspaceId: req.user.workspaceId,
        requestedWorkspaceId: req.workspace.id
      });

      res.status(403).json({
        error: 'Workspace access denied',
        message: 'ワークスペースへのアクセスが拒否されました'
      });
      return;
    }

    next();
  };
}

// デバッグ用：ユーザー権限情報表示
export function debugPermissions() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      logger.debug('RBAC Debug', {
        userId: req.user.id,
        role: req.user.role,
        permissions: req.user.permissions,
        path: req.path,
        method: req.method
      });
    }
    next();
  };
}