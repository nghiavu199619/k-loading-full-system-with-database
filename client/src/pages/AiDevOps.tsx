/**
 * AI DevOps Agent Management Interface
 * Real-time monitoring, control, and interaction with the AI Agent
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Bot, 
  Shield, 
  Zap, 
  RefreshCw, 
  Settings, 
  Database,
  FileCode,
  AlertTriangle,
  CheckCircle,
  Clock,
  Brain
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AiStatus {
  timestamp: string;
  agent: {
    name: string;
    version: string;
    uptime: number;
  };
  configuration: {
    autoSelfUpdate: boolean;
    safeMode: boolean;
    auditInterval: number;
    maxSelfUpdateLOC: number;
  };
  capabilities: {
    geminiAvailable: boolean;
    databaseAccess: boolean;
    selfHealing: boolean;
    autoMigration: boolean;
    codeModification: boolean;
    bugFixes: boolean;
    dependencyUpdates: boolean;
  };
  permissions: {
    readFiles: boolean;
    writeFiles: boolean;
    executeCommands: boolean;
    modifyConfig: boolean;
    databaseAccess: boolean;
    securityAudit: boolean;
  };
  lastActivities: Array<{
    timestamp: string;
    type: string;
    message: string;
    traceId: string;
  }>;
  stats: {
    totalOperations: number;
    successfulHealing: number;
    systemAudits: number;
    errorRate: number;
    lastActivity: string;
  };
}

interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    platform: string;
    nodeVersion: string;
    pid: number;
  };
  application: {
    name: string;
    version: string;
    environment: string;
  };
  aiAgent: {
    geminiAvailable: boolean;
    autoSelfUpdate: boolean;
    safeMode: boolean;
    auditInterval: number;
    maxSelfUpdateLOC: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  type?: string;
  traceId?: string;
  data?: any;
}

export default function AiDevOps() {
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  // Fetch AI Agent status
  const { data: aiStatus, isLoading: statusLoading } = useQuery<AiStatus>({
    queryKey: ['/api/ai/status'],
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ['/api/ai/metrics'],
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch health status
  const { data: health } = useQuery({
    queryKey: ['/api/ai/healthz'],
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch AI logs
  const { data: logsData } = useQuery<{logs: LogEntry[]}>({
    queryKey: ['/api/ai/logs'],
    refetchInterval: autoRefresh ? 3000 : false
  });

  // Control mutations
  const startDaemonMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/daemon/start', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/status'] });
    }
  });

  const stopDaemonMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/daemon/stop', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/status'] });
    }
  });

  const triggerAuditMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/audit', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/logs'] });
    }
  });

  const triggerSelfImproveMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/self-improve', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/logs'] });
    }
  });

  // Demo activity mutations  
  const demoActivityMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/simulate-activity', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/logs'] });
    }
  });

  const continuousDemoMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/start-continuous-demo', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/logs'] });
    }
  });


  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  if (statusLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Đang tải trạng thái AI DevOps Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="w-8 h-8 text-blue-600" />
            K-Loading AI DevOps Agent
          </h1>
          <p className="text-muted-foreground mt-2">
            AI Agent toàn quyền giám sát và tự động cải tiến hệ thống 24/7
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={(health as any)?.healthy ? "default" : "destructive"}>
            {(health as any)?.healthy ? 'Hoạt động' : 'Có vấn đề'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="toggle-auto-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Tắt tự động' : 'Bật tự động'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trạng thái Agent</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {aiStatus?.capabilities.geminiAvailable ? 'Hoạt động' : 'Offline'}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {aiStatus ? formatUptime(aiStatus.agent.uptime) : '0h 0m'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gemini AI</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${aiStatus?.capabilities.geminiAvailable ? 'text-green-600' : 'text-red-600'}`}>
              {aiStatus?.capabilities.geminiAvailable ? 'Sẵn sàng' : 'Chưa cấu hình'}
            </div>
            <p className="text-xs text-muted-foreground">
              Phân tích và cải tiến tự động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bộ nhớ</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? formatBytes(metrics.system.memory.heapUsed) : '0 MB'}
            </div>
            <p className="text-xs text-muted-foreground">
              / {metrics ? formatBytes(metrics.system.memory.heapTotal) : '0 MB'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoạt động</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {aiStatus?.stats.totalOperations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Tổng thao tác AI
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="monitoring">Giám sát</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="controls">Điều khiển</TabsTrigger>
          <TabsTrigger value="config">Cấu hình</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agent Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Thông tin Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Tên Agent</p>
                    <p className="text-sm text-muted-foreground">{aiStatus?.agent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phiên bản</p>
                    <p className="text-sm text-muted-foreground">{aiStatus?.agent.version}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Chế độ</p>
                    <Badge variant={aiStatus?.configuration.safeMode ? "secondary" : "default"}>
                      {aiStatus?.configuration.safeMode ? 'An toàn' : 'Toàn quyền'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tự cập nhật</p>
                    <Badge variant={aiStatus?.configuration.autoSelfUpdate ? "default" : "secondary"}>
                      {aiStatus?.configuration.autoSelfUpdate ? 'Bật' : 'Tắt'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Khả năng Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(aiStatus?.capabilities || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{formatCapabilityName(key)}</span>
                      <Badge variant={value ? "default" : "secondary"}>
                        {value ? 'Có' : 'Không'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Hoạt động gần đây
              </CardTitle>
              <CardDescription>
                {aiStatus?.lastActivities.length || 0} hoạt động AI trong thời gian gần đây
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {aiStatus?.lastActivities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                      <ActivityIcon type={activity.type} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString('vi-VN')} - {activity.traceId}
                        </p>
                      </div>
                      <Badge variant="outline">{formatActivityType(activity.type)}</Badge>
                    </div>
                  ))}
                  {(!aiStatus?.lastActivities || aiStatus.lastActivities.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      Chưa có hoạt động AI nào được ghi nhận
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Tình trạng hệ thống
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(health as any)?.healthy ? '✅' : '❌'}
                  </p>
                  <p className="text-sm">Tổng thể</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {metrics ? Math.round((metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100) : 0}%
                  </p>
                  <p className="text-sm">Bộ nhớ</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {aiStatus?.stats.systemAudits || 0}
                  </p>
                  <p className="text-sm">Audit hôm nay</p>
                </div>
              </div>

              {metrics && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Sử dụng bộ nhớ</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.heapUsed)} / {formatBytes(metrics.system.memory.heapTotal)}
                      </span>
                    </div>
                    <Progress 
                      value={(metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5" />
                AI Agent Logs
              </CardTitle>
              <CardDescription>
                Logs thời gian thực từ AI DevOps Agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1 font-mono text-sm">
                  {logsData?.logs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`p-2 rounded border-l-2 ${getLogLevelColor(log.level)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        {log.type && (
                          <Badge variant="secondary" className="text-xs">
                            {formatActivityType(log.type)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1">{log.message}</p>
                      {log.data && (
                        <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {(!logsData?.logs || logsData.logs.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      Chưa có logs nào từ AI Agent
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daemon Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Điều khiển Daemon
                </CardTitle>
                <CardDescription>
                  Khởi động/dừng tiến trình AI DevOps Agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => startDaemonMutation.mutate()}
                    disabled={startDaemonMutation.isPending}
                    className="flex-1"
                    data-testid="button-start-daemon"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {startDaemonMutation.isPending ? 'Đang khởi động...' : 'Khởi động'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => stopDaemonMutation.mutate()}
                    disabled={stopDaemonMutation.isPending}
                    className="flex-1"
                    data-testid="button-stop-daemon"
                  >
                    {stopDaemonMutation.isPending ? 'Đang dừng...' : 'Dừng'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Manual Operations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Thao tác thủ công
                </CardTitle>
                <CardDescription>
                  Kích hoạt các chức năng AI Agent ngay lập tức
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => triggerAuditMutation.mutate()}
                    disabled={triggerAuditMutation.isPending}
                    className="w-full"
                    data-testid="button-trigger-audit"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {triggerAuditMutation.isPending ? 'Đang audit...' : 'Chạy audit bảo mật'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => triggerSelfImproveMutation.mutate()}
                    disabled={triggerSelfImproveMutation.isPending}
                    className="w-full"
                    data-testid="button-trigger-self-improve"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {triggerSelfImproveMutation.isPending ? 'Đang cải tiến...' : 'Tự cải tiến hệ thống'}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => demoActivityMutation.mutate()}
                    disabled={demoActivityMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    data-testid="button-demo-activity"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {demoActivityMutation.isPending ? 'AI đang làm việc...' : 'Demo AI hoạt động'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => continuousDemoMutation.mutate()}
                    disabled={continuousDemoMutation.isPending}
                    className="w-full"
                    data-testid="button-continuous-demo"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {continuousDemoMutation.isPending ? 'Đang khởi động...' : 'Bắt đầu demo 25s'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Cấu hình AI Agent
              </CardTitle>
              <CardDescription>
                Cài đặt hoạt động của AI DevOps Agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Interval Audit</p>
                    <p className="text-sm text-muted-foreground">
                      {aiStatus?.configuration.auditInterval || 15} phút
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Max LOC/Update</p>
                    <p className="text-sm text-muted-foreground">
                      {aiStatus?.configuration.maxSelfUpdateLOC || 500} dòng
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Quyền hạn</h4>
                  {Object.entries(aiStatus?.permissions || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{formatPermissionName(key)}</span>
                      <Badge variant={value ? "default" : "secondary"}>
                        {value ? 'Có quyền' : 'Không có quyền'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'ai_action':
      return <Bot className="w-4 h-4 text-blue-500" />;
    case 'self_heal':
      return <Zap className="w-4 h-4 text-green-500" />;
    case 'system_audit':
      return <Shield className="w-4 h-4 text-orange-500" />;
    case 'agent_init':
      return <Settings className="w-4 h-4 text-purple-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-500" />;
  }
}

function formatActivityType(type: string): string {
  const typeMap: Record<string, string> = {
    'ai_action': 'Thao tác AI',
    'self_heal': 'Tự sửa',
    'system_audit': 'Audit',
    'agent_init': 'Khởi tạo',
    'improvement': 'Cải tiến'
  };
  return typeMap[type] || type;
}

function formatCapabilityName(key: string): string {
  const capabilityMap: Record<string, string> = {
    'geminiAvailable': 'Gemini AI',
    'databaseAccess': 'Truy cập DB',
    'selfHealing': 'Tự sửa lỗi',
    'autoMigration': 'Migration tự động',
    'codeModification': 'Sửa đổi code',
    'bugFixes': 'Sửa lỗi',
    'dependencyUpdates': 'Cập nhật dependencies'
  };
  return capabilityMap[key] || key;
}

function formatPermissionName(key: string): string {
  const permissionMap: Record<string, string> = {
    'readFiles': 'Đọc file',
    'writeFiles': 'Ghi file',
    'executeCommands': 'Thực thi lệnh',
    'modifyConfig': 'Sửa cấu hình',
    'databaseAccess': 'Truy cập DB',
    'securityAudit': 'Audit bảo mật'
  };
  return permissionMap[key] || key;
}

function getLogLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'error':
      return 'border-l-red-500 bg-red-50';
    case 'warn':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'info':
      return 'border-l-blue-500 bg-blue-50';
    case 'debug':
      return 'border-l-gray-500 bg-gray-50';
    default:
      return 'border-l-gray-300 bg-gray-50';
  }
}