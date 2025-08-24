/**
 * DirectorX User Manager Component
 * ユーザー管理・RBAC設定画面
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Settings, 
  Shield, 
  Edit3, 
  Trash2, 
  Search,
  Filter,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  AlertCircle
} from 'lucide-react';

// 型定義
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  canManage: boolean;
}

enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  REVIEWER = 'reviewer',
  VIEWER = 'viewer'
}

interface RoleInfo {
  value: UserRole;
  label: string;
  description: string;
  permissions: string[];
  canAssign: boolean;
}

// メインコンポーネント
const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // フィルターとページング
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  
  // ユーザー作成フォーム
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    role: UserRole.VIEWER,
    sendInviteEmail: true
  });

  // データ読み込み
  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [currentPage, searchQuery, roleFilter, activeFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
        ...(activeFilter !== 'all' && { isActive: activeFilter === 'active' ? 'true' : 'false' })
      });

      const response = await fetch(`/v1/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.message || 'ユーザー一覧の取得に失敗しました');
      }
    } catch (error) {
      setError('ネットワークエラーが発生しました');
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch('/v1/users/roles');
      const data = await response.json();
      if (data.success) {
        setRoles(data.roles);
      }
    } catch (error) {
      console.error('Load roles error:', error);
    }
  };

  // ユーザー作成
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({ email: '', name: '', role: UserRole.VIEWER, sendInviteEmail: true });
        loadUsers();
        alert('ユーザーが作成されました');
      } else {
        alert(data.message || 'ユーザーの作成に失敗しました');
      }
    } catch (error) {
      alert('ネットワークエラーが発生しました');
      console.error('Create user error:', error);
    }
  };

  // ユーザー更新
  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const response = await fetch(`/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (data.success) {
        loadUsers();
        alert('ユーザーが更新されました');
      } else {
        alert(data.message || 'ユーザーの更新に失敗しました');
      }
    } catch (error) {
      alert('ネットワークエラーが発生しました');
      console.error('Update user error:', error);
    }
  };

  // ユーザー削除
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`${userName}さんを削除してもよろしいですか？`)) return;

    try {
      const response = await fetch(`/v1/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        loadUsers();
        alert('ユーザーが削除されました');
      } else {
        alert(data.message || 'ユーザーの削除に失敗しました');
      }
    } catch (error) {
      alert('ネットワークエラーが発生しました');
      console.error('Delete user error:', error);
    }
  };

  // 検索とフィルター処理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role);
    setCurrentPage(1);
  };

  const handleActiveFilter = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">ユーザー管理</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Shield className="h-4 w-4 mr-2" />
              ロール設定
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              ユーザー追加
            </button>
          </div>
        </div>
      </div>

      {/* フィルターバー */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="ユーザー名またはメールで検索..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全てのロール</option>
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            
            <select
              value={activeFilter}
              onChange={(e) => handleActiveFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全ユーザー</option>
              <option value="active">アクティブ</option>
              <option value="inactive">無効</option>
            </select>
          </div>
        </div>
      </div>

      {/* ユーザーテーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ロール
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最終ログイン
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作成日
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">アクション</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <UserRow 
                key={user.id}
                user={user}
                roles={roles}
                onUpdate={handleUpdateUser}
                onDelete={handleDeleteUser}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ページング */}
      {totalPages > 1 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* エラー表示 */}
      {error && (
        <div className="px-6 py-4 bg-red-50 border-t border-red-200">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* ユーザー作成モーダル */}
      {showCreateModal && (
        <CreateUserModal
          form={createForm}
          roles={roles}
          onChange={setCreateForm}
          onSubmit={handleCreateUser}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* ロール設定モーダル */}
      {showRoleModal && (
        <RoleConfigModal
          roles={roles}
          onClose={() => setShowRoleModal(false)}
        />
      )}
    </div>
  );
};

// ユーザー行コンポーネント
const UserRow: React.FC<{
  user: User;
  roles: RoleInfo[];
  onUpdate: (userId: string, updates: Partial<User>) => void;
  onDelete: (userId: string, userName: string) => void;
}> = ({ user, roles, onUpdate, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-purple-100 text-purple-800';
      case UserRole.EDITOR: return 'bg-blue-100 text-blue-800';
      case UserRole.REVIEWER: return 'bg-green-100 text-green-800';
      case UserRole.VIEWER: return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-10 w-10 rounded-full" />
            ) : (
              <span className="text-sm font-medium text-gray-700">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
          {user.roleLabel}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {user.isActive ? (
          <span className="flex items-center text-sm text-green-600">
            <UserCheck className="h-4 w-4 mr-1" />
            アクティブ
          </span>
        ) : (
          <span className="flex items-center text-sm text-red-600">
            <UserX className="h-4 w-4 mr-1" />
            無効
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.lastLoginAt ? (
          <span className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {new Date(user.lastLoginAt).toLocaleDateString()}
          </span>
        ) : (
          '未ログイン'
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {user.canManage && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={() => {
                      // ロール編集モーダルを開く実装
                      setShowActions(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    編集
                  </button>
                  <button
                    onClick={() => {
                      onUpdate(user.id, { isActive: !user.isActive });
                      setShowActions(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {user.isActive ? (
                      <>
                        <UserX className="h-4 w-4 mr-2" />
                        無効にする
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        有効にする
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onDelete(user.id, user.name);
                      setShowActions(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

// ユーザー作成モーダル
const CreateUserModal: React.FC<{
  form: any;
  roles: RoleInfo[];
  onChange: (form: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}> = ({ form, roles, onChange, onSubmit, onClose }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 className="text-lg font-medium text-gray-900 mb-4">新規ユーザー作成</h3>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            名前
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ロール
          </label>
          <select
            value={form.role}
            onChange={(e) => onChange({ ...form, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {roles.filter(role => role.canAssign).map(role => (
              <option key={role.value} value={role.value}>
                {role.label} - {role.description}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="sendInvite"
            checked={form.sendInviteEmail}
            onChange={(e) => onChange({ ...form, sendInviteEmail: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="sendInvite" className="ml-2 block text-sm text-gray-900">
            招待メールを送信
          </label>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            作成
          </button>
        </div>
      </form>
    </div>
  </div>
);

// ロール設定モーダル
const RoleConfigModal: React.FC<{
  roles: RoleInfo[];
  onClose: () => void;
}> = ({ roles, onClose }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-medium text-gray-900 mb-4">ロールと権限の設定</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map(role => (
          <div key={role.value} className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium text-gray-900 mb-2">
              {role.label}
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              {role.description}
            </p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                権限一覧
              </p>
              <div className="max-h-32 overflow-y-auto">
                {role.permissions.map(permission => (
                  <div key={permission} className="text-xs text-gray-600">
                    • {permission}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end pt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
);

// ページング
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => (
  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-700">
        {totalPages} ページ中 {currentPage} ページ目
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          前へ
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          次へ
        </button>
      </div>
    </div>
  </div>
);

export default UserManager;