/**
 * DirectorX Task Monitor Component
 * タスクモニタリング・キュー管理画面
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  Square,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  RefreshCw,
  Zap,
  Server,
  Timer
} from 'lucide-react';

// 型定義
interface RunningTask {
  taskId: string;
  jobId: string;
  type: TaskType;
  status: 'running' | 'completed' | 'failed' | 'retrying';
  startTime: Date;
  duration: number;
  retryCount: number;
}

interface QueueStats {
  queueName: string;
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  maxConcurrency: number;
}

interface TaskType {
  type: string;
  description: string;
  permissions: string[];
  estimatedDuration: string;
  resourceUsage: string;
}

enum TaskStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// メインコンポーネント
const TaskMonitor: React.FC = () => {
  const [runningTasks, setRunningTasks] = useState<RunningTask[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // 選択された表示モード
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'queues' | 'system'>('overview');

  // データ読み込み
  useEffect(() => {
    loadData();
    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadData = async () => {
    try {
      const [tasksResponse, statsResponse, typesResponse, healthResponse] = await Promise.all([
        fetch('/v1/tasks/running'),
        fetch('/v1/tasks/queues/stats'),
        fetch('/v1/tasks/types'),
        fetch('/v1/tasks/health')
      ]);

      const tasksData = await tasksResponse.json();
      const statsData = await statsResponse.json();
      const typesData = await typesResponse.json();
      const healthData = await healthResponse.json();

      if (tasksData.success) setRunningTasks(tasksData.tasks);
      if (statsData.success) setQueueStats(statsData.queues);
      if (typesData.success) setTaskTypes(typesData.taskTypes);
      setSystemHealth(healthData);

    } catch (error) {
      setError('データの取得に失敗しました');
      console.error('Data loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  // タスクキャンセル
  const handleCancelTask = async (taskId: string) => {
    if (!confirm('タスクをキャンセルしますか？')) return;

    try {
      const response = await fetch(`/v1/tasks/${taskId}/cancel`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await loadData();
        alert('タスクがキャンセルされました');
      } else {
        alert(data.message || 'キャンセルに失敗しました');
      }
    } catch (error) {
      alert('ネットワークエラーが発生しました');
      console.error('Cancel task error:', error);
    }
  };

  // キュー制御
  const handleQueueControl = async (taskType: string, action: 'pause' | 'resume') => {
    try {
      const response = await fetch(`/v1/tasks/queues/${taskType}/${action}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        await loadData();
        alert(data.message);
      } else {
        alert(data.message || `キューの${action}に失敗しました`);
      }
    } catch (error) {
      alert('ネットワークエラーが発生しました');
      console.error('Queue control error:', error);
    }
  };

  if (loading) {
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
            <Activity className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">タスクモニター</h2>
            <SystemHealthIndicator health={systemHealth} />
          </div>
          <div className="flex items-center space-x-3">
            <AutoRefreshToggle 
              enabled={autoRefresh}
              interval={refreshInterval}
              onToggle={setAutoRefresh}
              onIntervalChange={setRefreshInterval}
            />
            <button
              onClick={loadData}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              更新
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { key: 'overview', label: '概要', icon: BarChart3 },
            { key: 'tasks', label: '実行中タスク', icon: Zap },
            { key: 'queues', label: 'キュー状態', icon: Server },
            { key: 'system', label: 'システム情報', icon: Settings }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* コンテンツエリア */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewPanel 
            runningTasks={runningTasks}
            queueStats={queueStats}
            systemHealth={systemHealth}
          />
        )}
        
        {activeTab === 'tasks' && (
          <TasksPanel 
            runningTasks={runningTasks}
            onCancelTask={handleCancelTask}
          />
        )}
        
        {activeTab === 'queues' && (
          <QueuesPanel 
            queueStats={queueStats}
            onQueueControl={handleQueueControl}
          />
        )}
        
        {activeTab === 'system' && (
          <SystemPanel 
            taskTypes={taskTypes}
            systemHealth={systemHealth}
          />
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="px-6 py-4 bg-red-50 border-t border-red-200">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// システムヘルス表示
const SystemHealthIndicator: React.FC<{ health: any }> = ({ health }) => {
  if (!health) return null;

  const isHealthy = health.status === 'healthy';
  
  return (
    <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      isHealthy 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {isHealthy ? (
        <>
          <CheckCircle className="h-3 w-3 mr-1" />
          正常
        </>
      ) : (
        <>
          <XCircle className="h-3 w-3 mr-1" />
          異常
        </>
      )}
    </div>
  );
};

// 自動更新トグル
const AutoRefreshToggle: React.FC<{
  enabled: boolean;
  interval: number;
  onToggle: (enabled: boolean) => void;
  onIntervalChange: (interval: number) => void;
}> = ({ enabled, interval, onToggle, onIntervalChange }) => (
  <div className="flex items-center space-x-2">
    <label className="flex items-center">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <span className="ml-2 text-sm text-gray-700">自動更新</span>
    </label>
    <select
      value={interval}
      onChange={(e) => onIntervalChange(Number(e.target.value))}
      disabled={!enabled}
      className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
    >
      <option value={2000}>2秒</option>
      <option value={5000}>5秒</option>
      <option value={10000}>10秒</option>
      <option value={30000}>30秒</option>
    </select>
  </div>
);

// 概要パネル
const OverviewPanel: React.FC<{
  runningTasks: RunningTask[];
  queueStats: QueueStats[];
  systemHealth: any;
}> = ({ runningTasks, queueStats, systemHealth }) => {
  const totalTasks = queueStats.reduce((sum, queue) => sum + queue.totalTasks, 0);
  const totalRunning = queueStats.reduce((sum, queue) => sum + queue.runningTasks, 0);
  const totalPending = queueStats.reduce((sum, queue) => sum + queue.pendingTasks, 0);

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="総タスク数"
          value={totalTasks}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="実行中"
          value={totalRunning}
          icon={Play}
          color="green"
        />
        <StatCard
          title="待機中"
          value={totalPending}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="システム状態"
          value={systemHealth?.status === 'healthy' ? '正常' : '異常'}
          icon={systemHealth?.status === 'healthy' ? CheckCircle : XCircle}
          color={systemHealth?.status === 'healthy' ? 'green' : 'red'}
        />
      </div>

      {/* 最近のタスク */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">最近のタスク</h3>
        <div className="space-y-2">
          {runningTasks.slice(0, 5).map(task => (
            <TaskRow key={task.taskId} task={task} compact={true} />
          ))}
          {runningTasks.length === 0 && (
            <p className="text-gray-500 text-center py-4">実行中のタスクはありません</p>
          )}
        </div>
      </div>
    </div>
  );
};

// タスクパネル
const TasksPanel: React.FC<{
  runningTasks: RunningTask[];
  onCancelTask: (taskId: string) => void;
}> = ({ runningTasks, onCancelTask }) => (
  <div>
    <h3 className="text-lg font-medium text-gray-900 mb-4">
      実行中タスク ({runningTasks.length})
    </h3>
    <div className="space-y-2">
      {runningTasks.map(task => (
        <TaskRow 
          key={task.taskId} 
          task={task} 
          onCancel={() => onCancelTask(task.taskId)}
        />
      ))}
      {runningTasks.length === 0 && (
        <p className="text-gray-500 text-center py-8">実行中のタスクはありません</p>
      )}
    </div>
  </div>
);

// キューパネル
const QueuesPanel: React.FC<{
  queueStats: QueueStats[];
  onQueueControl: (taskType: string, action: 'pause' | 'resume') => void;
}> = ({ queueStats, onQueueControl }) => (
  <div>
    <h3 className="text-lg font-medium text-gray-900 mb-4">キュー状態</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {queueStats.map(queue => (
        <QueueCard 
          key={queue.queueName}
          queue={queue}
          onControl={onQueueControl}
        />
      ))}
    </div>
  </div>
);

// システムパネル
const SystemPanel: React.FC<{
  taskTypes: TaskType[];
  systemHealth: any;
}> = ({ taskTypes, systemHealth }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">システム情報</h3>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Cloud Tasks</span>
            <p className="text-base font-medium">
              {systemHealth?.cloudTasks ? '接続済み' : '未接続'}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-500">実行中タスク</span>
            <p className="text-base font-medium">{systemHealth?.runningTasks || 0}</p>
          </div>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">利用可能なタスクタイプ</h3>
      <div className="space-y-3">
        {taskTypes.map(type => (
          <TaskTypeCard key={type.type} taskType={type} />
        ))}
      </div>
    </div>
  </div>
);

// 統計カードコンポーネント
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center">
        <div className={`p-2 rounded-md ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

// タスク行コンポーネント
const TaskRow: React.FC<{
  task: RunningTask;
  compact?: boolean;
  onCancel?: () => void;
}> = ({ task, compact = false, onCancel }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'retrying': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Play;
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      case 'retrying': return RefreshCw;
      default: return Clock;
    }
  };

  const StatusIcon = getStatusIcon(task.status);
  const duration = Math.floor(task.duration / 1000);

  return (
    <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${
      compact ? 'text-sm' : ''
    }`}>
      <div className="flex items-center space-x-3">
        <StatusIcon className={`h-4 w-4 ${getStatusColor(task.status)}`} />
        <div>
          <p className="font-medium text-gray-900">{task.type}</p>
          <p className="text-xs text-gray-500">Job: {task.jobId}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm text-gray-600">
            <Timer className="h-3 w-3 inline mr-1" />
            {duration}秒
          </p>
          {task.retryCount > 0 && (
            <p className="text-xs text-yellow-600">
              リトライ: {task.retryCount}回
            </p>
          )}
        </div>
        
        {!compact && onCancel && task.status === 'running' && (
          <button
            onClick={onCancel}
            className="text-red-600 hover:text-red-800 p-1"
            title="キャンセル"
          >
            <Square className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// キューカードコンポーネント
const QueueCard: React.FC<{
  queue: QueueStats;
  onControl: (taskType: string, action: 'pause' | 'resume') => void;
}> = ({ queue, onControl }) => {
  const utilizationPercent = queue.maxConcurrency > 0 
    ? Math.round((queue.runningTasks / queue.maxConcurrency) * 100)
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">{queue.queueName}</h4>
        <div className="flex space-x-1">
          <button
            onClick={() => onControl(queue.queueName, 'pause')}
            className="text-yellow-600 hover:text-yellow-800 p-1"
            title="一時停止"
          >
            <Pause className="h-4 w-4" />
          </button>
          <button
            onClick={() => onControl(queue.queueName, 'resume')}
            className="text-green-600 hover:text-green-800 p-1"
            title="再開"
          >
            <Play className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">実行中</span>
          <span className="font-medium">{queue.runningTasks}/{queue.maxConcurrency}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${utilizationPercent}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>待機: {queue.pendingTasks}</span>
          <span>利用率: {utilizationPercent}%</span>
        </div>
      </div>
    </div>
  );
};

// タスクタイプカードコンポーネント
const TaskTypeCard: React.FC<{
  taskType: TaskType;
}> = ({ taskType }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-medium text-gray-900">{taskType.type}</h4>
        <p className="text-sm text-gray-600 mt-1">{taskType.description}</p>
      </div>
    </div>
    
    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-gray-500">推定時間</span>
        <p className="font-medium">{taskType.estimatedDuration}</p>
      </div>
      <div>
        <span className="text-gray-500">リソース使用量</span>
        <p className="font-medium">{taskType.resourceUsage}</p>
      </div>
    </div>
  </div>
);

export default TaskMonitor;