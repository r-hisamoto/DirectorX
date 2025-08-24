/**
 * DirectorX Users API Routes
 * ユーザー管理・RBAC設定API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  User, 
  UserRole, 
  Permission, 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserHelper,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS
} from '../models/user.js';
import { 
  AuthenticatedRequest,
  requirePermissions,
  requireRoles,
  requireAdmin,
  requireWorkspaceAccess
} from '../middleware/rbac.js';
import { logger } from '../lib/logger.js';

const router = Router();

// リクエストスキーマ
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole),
  workspaceId: z.string().min(1),
  sendInviteEmail: z.boolean().default(true)
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional()
});

const BulkUpdateRolesSchema = z.object({
  userIds: z.array(z.string()).min(1).max(50),
  role: z.nativeEnum(UserRole)
});

// GET /v1/users - ユーザー一覧取得
router.get('/', 
  requirePermissions(Permission.USER_READ),
  requireWorkspaceAccess(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        page = '1', 
        limit = '20', 
        role, 
        search,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // フィルターとページング処理（実装では実際のデータベースクエリを使用）
      // 現在はモックデータ
      const mockUsers: User[] = [
        {
          id: 'user_1',
          email: 'admin@example.com',
          name: '管理者',
          role: UserRole.ADMIN,
          permissions: ROLE_PERMISSIONS[UserRole.ADMIN],
          workspaceId: req.workspace!.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system'
        },
        {
          id: 'user_2', 
          email: 'editor@example.com',
          name: 'エディター',
          role: UserRole.EDITOR,
          permissions: ROLE_PERMISSIONS[UserRole.EDITOR],
          workspaceId: req.workspace!.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user_1'
        }
      ];

      // フィルタリング
      let filteredUsers = mockUsers;
      
      if (role && Object.values(UserRole).includes(role as UserRole)) {
        filteredUsers = filteredUsers.filter(user => user.role === role);
      }
      
      if (search) {
        const searchTerm = search.toString().toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm)
        );
      }
      
      if (isActive !== undefined) {
        filteredUsers = filteredUsers.filter(user => 
          user.isActive === (isActive === 'true')
        );
      }

      // ページング
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const offset = (pageNum - 1) * limitNum;
      const paginatedUsers = filteredUsers.slice(offset, offset + limitNum);

      res.json({
        success: true,
        users: paginatedUsers.map(user => ({
          ...user,
          roleLabel: ROLE_LABELS[user.role],
          canManage: UserHelper.canManageUser(req.user!, user)
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / limitNum)
        }
      });

    } catch (error) {
      logger.error('Failed to get users:', error);
      res.status(500).json({
        error: 'Failed to get users',
        message: 'ユーザー一覧の取得に失敗しました'
      });
    }
  }
);

// GET /v1/users/me - 現在のユーザー情報取得
router.get('/me', 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Not authenticated',
          message: '認証されていません'
        });
        return;
      }

      res.json({
        success: true,
        user: {
          ...req.user,
          roleLabel: ROLE_LABELS[req.user.role],
          roleDescription: ROLE_DESCRIPTIONS[req.user.role]
        }
      });

    } catch (error) {
      logger.error('Failed to get current user:', error);
      res.status(500).json({
        error: 'Failed to get user info',
        message: 'ユーザー情報の取得に失敗しました'
      });
    }
  }
);

// POST /v1/users - 新規ユーザー作成
router.post('/',
  requirePermissions(Permission.USER_CREATE),
  requireWorkspaceAccess(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = CreateUserSchema.parse(req.body);

      // ロール変更権限チェック
      if (!UserHelper.canChangeRole(req.user!, body.role)) {
        res.status(403).json({
          error: 'Cannot assign this role',
          message: 'このロールを割り当てる権限がありません'
        });
        return;
      }

      // メール重複チェック（実装では実際のデータベースクエリを使用）
      // 現在はモック処理

      const newUser: User = {
        id: `user_${Date.now()}`,
        email: body.email,
        name: body.name,
        role: body.role,
        permissions: ROLE_PERMISSIONS[body.role],
        workspaceId: body.workspaceId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user!.id
      };

      // 実装では実際にデータベースに保存
      // if (body.sendInviteEmail) {
      //   await sendInviteEmail(newUser);
      // }

      logger.info('User created', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        createdBy: req.user!.id
      });

      res.status(201).json({
        success: true,
        user: {
          ...newUser,
          roleLabel: ROLE_LABELS[newUser.role]
        },
        message: 'ユーザーが作成されました'
      });

    } catch (error) {
      logger.error('Failed to create user:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to create user',
          message: 'ユーザーの作成に失敗しました'
        });
      }
    }
  }
);

// PUT /v1/users/:id - ユーザー情報更新
router.put('/:id',
  requirePermissions(Permission.USER_UPDATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const body = UpdateUserSchema.parse(req.body);

      // 実装では実際のユーザー取得
      const targetUser: User = {
        id,
        email: 'user@example.com',
        name: 'Test User',
        role: UserRole.EDITOR,
        permissions: ROLE_PERMISSIONS[UserRole.EDITOR],
        workspaceId: req.user!.workspaceId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user_1'
      };

      // 管理権限チェック
      if (!UserHelper.canManageUser(req.user!, targetUser)) {
        res.status(403).json({
          error: 'Cannot manage this user',
          message: 'このユーザーを管理する権限がありません'
        });
        return;
      }

      // ロール変更権限チェック
      if (body.role && !UserHelper.canChangeRole(req.user!, body.role)) {
        res.status(403).json({
          error: 'Cannot assign this role',
          message: 'このロールを割り当てる権限がありません'
        });
        return;
      }

      // 更新処理（実装では実際のデータベース更新）
      const updatedUser: User = {
        ...targetUser,
        name: body.name || targetUser.name,
        role: body.role || targetUser.role,
        permissions: body.role ? ROLE_PERMISSIONS[body.role] : targetUser.permissions,
        isActive: body.isActive !== undefined ? body.isActive : targetUser.isActive,
        updatedAt: new Date()
      };

      logger.info('User updated', {
        userId: id,
        changes: body,
        updatedBy: req.user!.id
      });

      res.json({
        success: true,
        user: {
          ...updatedUser,
          roleLabel: ROLE_LABELS[updatedUser.role]
        },
        message: 'ユーザーが更新されました'
      });

    } catch (error) {
      logger.error('Failed to update user:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to update user',
          message: 'ユーザーの更新に失敗しました'
        });
      }
    }
  }
);

// DELETE /v1/users/:id - ユーザー削除
router.delete('/:id',
  requirePermissions(Permission.USER_DELETE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // 自分自身の削除防止
      if (id === req.user!.id) {
        res.status(400).json({
          error: 'Cannot delete yourself',
          message: '自分自身を削除することはできません'
        });
        return;
      }

      // 実装では実際のユーザー取得
      const targetUser: User = {
        id,
        email: 'user@example.com',
        name: 'Test User',
        role: UserRole.EDITOR,
        permissions: ROLE_PERMISSIONS[UserRole.EDITOR],
        workspaceId: req.user!.workspaceId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user_1'
      };

      // 管理権限チェック
      if (!UserHelper.canManageUser(req.user!, targetUser)) {
        res.status(403).json({
          error: 'Cannot delete this user',
          message: 'このユーザーを削除する権限がありません'
        });
        return;
      }

      // 削除処理（実装では実際のデータベース削除）
      
      logger.info('User deleted', {
        userId: id,
        deletedBy: req.user!.id
      });

      res.json({
        success: true,
        message: 'ユーザーが削除されました'
      });

    } catch (error) {
      logger.error('Failed to delete user:', error);
      res.status(500).json({
        error: 'Failed to delete user',
        message: 'ユーザーの削除に失敗しました'
      });
    }
  }
);

// POST /v1/users/bulk/roles - 一括ロール変更
router.post('/bulk/roles',
  requireAdmin(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = BulkUpdateRolesSchema.parse(req.body);

      // 実装では実際の一括更新処理
      const updatedCount = body.userIds.length;

      logger.info('Bulk role update', {
        userIds: body.userIds,
        newRole: body.role,
        updatedBy: req.user!.id
      });

      res.json({
        success: true,
        updatedCount,
        message: `${updatedCount}名のユーザーのロールが更新されました`
      });

    } catch (error) {
      logger.error('Failed to bulk update roles:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to update roles',
          message: 'ロールの一括更新に失敗しました'
        });
      }
    }
  }
);

// GET /v1/users/roles - ロール一覧取得
router.get('/roles', 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roles = Object.values(UserRole).map(role => ({
        value: role,
        label: ROLE_LABELS[role],
        description: ROLE_DESCRIPTIONS[role],
        permissions: ROLE_PERMISSIONS[role],
        canAssign: req.user ? UserHelper.canChangeRole(req.user, role) : false
      }));

      res.json({
        success: true,
        roles
      });

    } catch (error) {
      logger.error('Failed to get roles:', error);
      res.status(500).json({
        error: 'Failed to get roles',
        message: 'ロール一覧の取得に失敗しました'
      });
    }
  }
);

// GET /v1/users/permissions - 権限一覧取得
router.get('/permissions',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const permissions = Object.values(Permission).map(permission => ({
        value: permission,
        category: permission.split(':')[0],
        action: permission.split(':')[1],
        description: getPermissionDescription(permission)
      }));

      // カテゴリ別にグループ化
      const grouped = permissions.reduce((acc, perm) => {
        const category = perm.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(perm);
        return acc;
      }, {} as Record<string, typeof permissions>);

      res.json({
        success: true,
        permissions: grouped
      });

    } catch (error) {
      logger.error('Failed to get permissions:', error);
      res.status(500).json({
        error: 'Failed to get permissions',
        message: '権限一覧の取得に失敗しました'
      });
    }
  }
);

// 権限説明取得ヘルパー
function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<string, string> = {
    [Permission.WORKSPACE_READ]: 'ワークスペースの閲覧',
    [Permission.WORKSPACE_WRITE]: 'ワークスペースの編集',
    [Permission.WORKSPACE_DELETE]: 'ワークスペースの削除',
    [Permission.USER_READ]: 'ユーザー一覧の閲覧',
    [Permission.USER_CREATE]: 'ユーザーの新規作成',
    [Permission.USER_UPDATE]: 'ユーザー情報の更新',
    [Permission.USER_DELETE]: 'ユーザーの削除',
    [Permission.CHANNEL_READ]: 'チャンネルの閲覧',
    [Permission.CHANNEL_CREATE]: 'チャンネルの作成',
    [Permission.CHANNEL_UPDATE]: 'チャンネルの更新',
    [Permission.CHANNEL_DELETE]: 'チャンネルの削除',
    [Permission.JOB_READ]: 'ジョブの閲覧',
    [Permission.JOB_CREATE]: 'ジョブの作成',
    [Permission.JOB_UPDATE]: 'ジョブの更新',
    [Permission.JOB_DELETE]: 'ジョブの削除',
    [Permission.JOB_EXECUTE]: 'ジョブの実行',
    [Permission.REVIEW_APPROVE]: 'レビューの承認',
    [Permission.REVIEW_REJECT]: 'レビューの却下'
  };
  
  return descriptions[permission] || permission;
}

export default router;