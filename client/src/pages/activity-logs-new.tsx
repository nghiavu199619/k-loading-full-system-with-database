import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Activity, Search, User, Calendar, Globe, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Enhanced Activity Log interface with old/new values
interface ActivityLogDisplay {
  id: number;
  action: string;
  description: string;
  userId?: number;
  userName?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: string;
  newValue?: string;
  tableName?: string;
  fieldName?: string;
  recordId?: string;
  metadata?: any;
}

export default function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch activity logs from new ActivityLogger system
  const { data: logs, isLoading } = useQuery<ActivityLogDisplay[]>({
    queryKey: ['/api/activity-logs', { limit: 100 }],
  });

  // Fetch accounts data for ID lookup
  const { data: accountsData } = useQuery({
    queryKey: ['/api/ad-accounts'],
  });

  // Store data globally for cross-reference in getSmartDescription
  React.useEffect(() => {
    if (logs) {
      (window as any).activityLogsData = logs;
    }
  }, [logs]);

  React.useEffect(() => {
    if (accountsData) {
      (window as any).accountsData = accountsData;
      console.log('🌐 ACTIVITY LOGS: Stored accounts data globally:', accountsData.length, 'accounts');
    }
  }, [accountsData]);

  // Handle reload button click
  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/activity-logs'] 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (!action) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('create') || actionLower.includes('insert')) 
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) 
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    if (actionLower.includes('delete') || actionLower.includes('remove')) 
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    if (actionLower.includes('login') || actionLower.includes('logout') || actionLower.includes('signin') || actionLower.includes('signout')) 
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    if (actionLower.includes('view') || actionLower.includes('read')) 
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
    if (actionLower.includes('permission') || actionLower.includes('assign')) 
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  };

  const getActionText = (action: string, tableName?: string, fieldName?: string) => {
    if (!action) return 'Khác';
    
    const actionLower = action.toLowerCase();
    const tableNames: { [key: string]: string } = {
      'clients': 'khách hàng',
      'ad_accounts': 'tài khoản quảng cáo', 
      'client_accounts': 'gán tài khoản',
      'auth_users': 'nhân viên',
      'fee_changes': 'phí dịch vụ',
      'account_expenses': 'chi phí tài khoản',
      'companies': 'thông tin công ty',
      'budgets': 'ngân sách',
      'transactions': 'giao dịch',
      'reconciliations': 'đối soát',
    };
    
    const tableDisplay = tableName ? (tableNames[tableName] || tableName) : 'dữ liệu';
    
    // Mô tả ngắn gọn theo loại hoạt động
    if (actionLower.includes('create')) {
      if (tableName === 'auth_users') return 'THÊM NHÂN VIÊN';
      if (tableName === 'clients') return 'TẠO KHÁCH HÀNG';
      if (tableName === 'ad_accounts') return 'TẠO TÀI KHOẢN';
      return 'TẠO MỚI';
    }
    if (actionLower.includes('update')) {
      if (tableName === 'auth_users') return 'SỬA NHÂN VIÊN';
      if (tableName === 'clients') return 'SỬA KHÁCH HÀNG';
      if (tableName === 'ad_accounts') {
        if (fieldName === 'status') return 'ĐỔI TRẠNG THÁI';
        return 'SỬA TÀI KHOẢN';
      }
      return 'THAY ĐỔI';
    }
    if (actionLower.includes('delete')) {
      if (tableName === 'auth_users') return 'XÓA NHÂN VIÊN';
      if (tableName === 'clients') return 'XÓA KHÁCH HÀNG';
      if (tableName === 'ad_accounts') return 'XÓA TÀI KHOẢN';
      return 'XÓA';
    }
    if (actionLower.includes('login') || actionLower.includes('signin')) {
      return 'ĐĂNG NHẬP';
    }
    if (actionLower.includes('logout') || actionLower.includes('signout')) {
      return 'ĐĂNG XUẤT';
    }
    if (actionLower.includes('view') || actionLower.includes('read')) {
      return 'XEM';
    }
    if (actionLower.includes('assign')) {
      return 'PHÂN QUYỀN';
    }
    if (actionLower.includes('permission')) {
      return 'ĐỔI QUYỀN';
    }
    
    return action;
  };

  // Enhanced description and value processing with ID for ad_accounts
  const getSmartDescription = (log: ActivityLogDisplay) => {
    if (!log.tableName || !log.fieldName) return log.description || 'Hoạt động không xác định';
    
    const tableMap: Record<string, string> = {
      'auth_users': 'Người dùng',
      'clients': 'Khách hàng', 
      'ad_accounts': 'Tài khoản quảng cáo',
      'account_expenses': 'Chi phí tài khoản',
      'employees': 'Nhân viên',
      'settings': 'Cài đặt',
      'auth_login_attempts': 'Đăng nhập'
    };
    
    const fieldMap: Record<string, string> = {
      'assignedEmployee': 'NHÂN VIÊN',
      'status': 'TRẠNG THÁI',
      'accountPermission': 'QUYỀN', 
      'name': 'TÊN',
      'email': 'EMAIL',
      'phone': 'SĐT',
      'amount': 'SỐ TIỀN',
      'accountId': 'ID',
      'source': 'NGUỒN',
      'cardType': 'LOẠI THẺ',
      'clientTag': 'TAG',
      'rentalPercentage': 'PHÍ THUÊ',
      'vatPercentage': 'VAT',
      'login': 'ĐĂNG NHẬP',
      'logout': 'ĐĂNG XUẤT',
      'fullName': 'HỌ TÊN',
      'username': 'TÊN TK',
      'role': 'VAI TRÒ',
      'employee_create': 'THÊM NV',
      'employee_delete': 'XÓA NV',
      'createdAt': 'TẠO',
      'updatedAt': 'CẬP NHẬT'
    };
    
    // For ad_accounts, get account ID from recordId using accounts data
    if (log.tableName === 'ad_accounts') {
      const fieldName = fieldMap[log.fieldName] || log.fieldName.toUpperCase();
      
      // Debug logging
      console.log('🔍 DEBUG LOG PROCESSING:', {
        recordId: log.recordId,
        fieldName: log.fieldName,
        oldValue: log.oldValue,
        newValue: log.newValue,
        windowAccountsData: !!(window as any).accountsData,
        windowActivityLogs: !!(window as any).activityLogsData
      });
      
      // Method 1: Try to find account ID from global accounts data
      const accounts = (window as any).accountsData || [];
      let foundAccount = accounts.find((acc: any) => acc.id == log.recordId || acc.id === parseInt(log.recordId));
      
      console.log('🔍 ACCOUNT LOOKUP:', {
        foundAccount: !!foundAccount,
        accountId: foundAccount?.accountId,
        searchRecordId: log.recordId,
        totalAccounts: accounts.length,
        firstAccountSample: accounts[0]
      });
      
      if (foundAccount && foundAccount.accountId) {
        return `${foundAccount.accountId} - ${fieldName}`;
      }
      
      // Method 1.5: Try direct search by ID (maybe recordId is string)
      if (!foundAccount && accounts.length > 0) {
        foundAccount = accounts.find((acc: any) => String(acc.id) === String(log.recordId));
        if (foundAccount && foundAccount.accountId) {
          console.log('✅ STRING MATCH SUCCESS:', foundAccount.accountId);
          return `${foundAccount.accountId} - ${fieldName}`;
        }
      }
      
      // Method 2: Try to extract from log values (oldValue/newValue)
      let accountId = '';
      
      // Priority 1: Check if field is 'accountId' - use the value directly  
      if (log.fieldName === 'accountId') {
        if (log.newValue && typeof log.newValue === 'string') {
          accountId = log.newValue.replace(/['"]/g, '');
        } else if (log.oldValue && typeof log.oldValue === 'string') {
          accountId = log.oldValue.replace(/['"]/g, '');
        }
      }
      
      // Priority 2: Look for account ID patterns in values
      if (!accountId) {
        const valuesToCheck = [log.newValue, log.oldValue].filter(Boolean);
        
        for (const value of valuesToCheck) {
          if (typeof value === 'string') {
            const cleanValue = value.replace(/['"]/g, '');
            // Match patterns like "72-2", "ADM-005", "XXX-YYY" etc.
            if (cleanValue.match(/^[A-Za-z0-9]+-[A-Za-z0-9]+$/)) {
              accountId = cleanValue;
              break;
            }
          }
        }
      }
      
      // Priority 3: Use a more specific search through logs context
      // If we have access to other logs for same recordId, extract accountId
      if (!accountId && (window as any).activityLogsData) {
        const relatedLogs = (window as any).activityLogsData.filter((l: any) => 
          l.tableName === 'ad_accounts' && 
          l.recordId === log.recordId && 
          l.fieldName === 'accountId'
        );
        
        if (relatedLogs.length > 0) {
          const relatedLog = relatedLogs[0];
          accountId = relatedLog.newValue || relatedLog.oldValue;
          if (accountId) {
            accountId = accountId.replace(/['"]/g, '');
          }
        }
      }
      
      // Return with found accountId or fallback to recordId
      if (accountId && accountId.length > 0 && !accountId.includes('undefined')) {
        return `${accountId} - ${fieldName}`;
      } else {
        return `#${log.recordId} - ${fieldName}`;
      }
    }
    
    // For auth_users operations (login/logout/employee management)
    if (log.tableName === 'auth_users') {
      if (log.fieldName === 'login' || log.fieldName === 'logout') {
        const actionName = fieldMap[log.fieldName] || log.fieldName.toUpperCase();
        const userName = log.userName || 'Người dùng';
        return `${userName} - ${actionName}`; // Format: "Quản trị viên K-Loading - ĐĂNG NHẬP"
      }
      
      // For employee management operations
      if (log.fieldName === 'employee_create' || log.fieldName === 'employee_delete') {
        const actionName = fieldMap[log.fieldName] || log.fieldName.toUpperCase();
        const targetName = log.newValue || log.oldValue || 'Nhân viên';
        return `${targetName} - ${actionName}`; // Format: "Nam Nguyen - THÊM NV"
      }
      
      // For other auth_users field updates (status, role, fullName, etc.)
      const fieldName = fieldMap[log.fieldName] || log.fieldName.toUpperCase();
      
      // Try to extract user name from values if it's JSON
      let displayName = 'NV';
      
      // Try new value first
      if (log.newValue) {
        try {
          const parsed = JSON.parse(log.newValue);
          if (parsed && typeof parsed === 'object') {
            displayName = parsed.fullName || parsed.username || parsed.email || displayName;
          } else {
            displayName = log.newValue;
          }
        } catch {
          displayName = log.newValue;
        }
      }
      
      // Try old value if no new value
      if (displayName === 'NV' && log.oldValue) {
        try {
          const parsed = JSON.parse(log.oldValue);
          if (parsed && typeof parsed === 'object') {
            displayName = parsed.fullName || parsed.username || parsed.email || displayName;
          } else {
            displayName = log.oldValue;
          }
        } catch {
          displayName = log.oldValue;
        }
      }
      
      return `${displayName} - ${fieldName}`;
    }
    
    // For other tables
    const tableName = tableMap[log.tableName] || log.tableName;
    const fieldName = fieldMap[log.fieldName] || log.fieldName;
    
    return `${tableName} - ${fieldName}`;
  };

  const getSmartValue = (value: string, fieldName?: string, tableName?: string) => {
    if (!value) return '-';
    
    // Special handling for employee management JSON values
    if (tableName === 'auth_users') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          // For single field updates, extract the relevant value
          if (Object.keys(parsed).length === 1) {
            const singleKey = Object.keys(parsed)[0];
            const singleValue = parsed[singleKey];
            
            if (singleKey === 'status') {
              return singleValue === 'active' ? 'Hoạt động' : 'Không hoạt động';
            }
            if (singleKey === 'role') {
              return singleValue === 'employee' ? 'Nhân viên' : singleValue === 'director' ? 'Giám đốc' : singleValue;
            }
            if (singleKey === 'fullName' || singleKey === 'username' || singleKey === 'email') {
              return singleValue;
            }
          }
          
          // For complex objects, show key fields only
          const keyFields = [];
          if (parsed.fullName) keyFields.push(`Tên: ${parsed.fullName}`);
          if (parsed.username) keyFields.push(`TK: ${parsed.username}`);
          if (parsed.email) keyFields.push(`Email: ${parsed.email}`);
          if (parsed.status) keyFields.push(`TT: ${parsed.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}`);
          if (parsed.role) keyFields.push(`Vai trò: ${parsed.role === 'employee' ? 'Nhân viên' : parsed.role === 'director' ? 'Giám đốc' : parsed.role}`);
          
          if (keyFields.length > 0) {
            return keyFields.join(', ');
          }
          
          // For employee data objects, try to extract meaningful display
          if (parsed.fullName) return parsed.fullName;
          if (parsed.username) return parsed.username;
          if (parsed.email) return parsed.email;
        }
      } catch {}
    }
    
    // Handle other JSON values
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') {
        // Try to extract meaningful info instead of raw JSON
        if (parsed.accountId) return parsed.accountId;
        if (parsed.name) return parsed.name;
        if (parsed.amount) return parsed.amount;
        
        return JSON.stringify(parsed, null, 2);
      }
    } catch {}
    
    // Format specific field types
    if (fieldName?.toLowerCase().includes('date') || fieldName?.toLowerCase().includes('time')) {
      try {
        return new Date(value).toLocaleString('vi-VN');
      } catch {}
    }
    
    if (fieldName?.toLowerCase().includes('amount') || fieldName?.toLowerCase().includes('money')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('vi-VN', { 
          style: 'currency', 
          currency: 'VND' 
        }).format(num);
      }
    }
    
    // Format status values
    if (fieldName?.toLowerCase().includes('status')) {
      if (value === 'active') return 'Hoạt động';
      if (value === 'inactive') return 'Không hoạt động';
    }
    
    // Format role values
    if (fieldName?.toLowerCase().includes('role')) {
      if (value === 'employee') return 'Nhân viên';
      if (value === 'director') return 'Giám đốc';
      if (value === 'manager') return 'Quản lý';
    }
    
    // Clean up any remaining JSON-like strings or quotes
    if (typeof value === 'string') {
      // Remove quotes and clean up
      let cleanValue = value.replace(/^["']|["']$/g, '');
      
      // If it still looks like JSON, try to extract meaningful content
      if (cleanValue.startsWith('{') && cleanValue.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanValue);
          if (parsed && typeof parsed === 'object') {
            // Extract the most meaningful field
            return parsed.fullName || parsed.username || parsed.email || parsed.name || 'Không xác định';
          }
        } catch {
          // If parsing fails, return cleaned value
          return 'Không xác định';
        }
      }
      
      return cleanValue;
    }
    
    return value;
  };

  // Filter logs based on search and filters
  const filteredLogs = logs?.filter(log => {
    if (!log) return false;
    
    const smartDescription = getSmartDescription(log);
    const matchesSearch = searchTerm === "" || 
      (log.action && getActionText(log.action, log.tableName, log.fieldName).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (smartDescription && smartDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const actionText = getActionText(log.action, log.tableName, log.fieldName);
    const matchesAction = actionFilter === "all" || actionText.toLowerCase().includes(actionFilter.toLowerCase());
    
    return matchesSearch && matchesAction;
  }) || [];

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lịch sử hoạt động</h1>
          <p className="text-muted-foreground">Theo dõi tất cả hoạt động trong hệ thống</p>
        </div>
        <Button 
          onClick={handleReload}
          disabled={isRefreshing || isLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Đang tải...' : 'Tải lại'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Tìm kiếm hoạt động..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc theo loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả hoạt động</SelectItem>
                  <SelectItem value="create">Tạo mới</SelectItem>
                  <SelectItem value="update">Cập nhật</SelectItem>
                  <SelectItem value="delete">Xóa</SelectItem>
                  <SelectItem value="login">Đăng nhập</SelectItem>
                  <SelectItem value="logout">Đăng xuất</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Nhật ký hoạt động ({filteredLogs?.length || 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Đang tải...</p>
            </div>
          ) : !filteredLogs || filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Không có hoạt động nào</p>
              <p className="text-sm">Các hoạt động sẽ được ghi lại tự động</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Loại</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead className="w-[180px]">Giá trị cũ</TableHead>
                    <TableHead className="w-[180px]">Giá trị mới</TableHead>
                    <TableHead className="w-[150px]">Người dùng</TableHead>
                    <TableHead className="w-[180px]">Thời gian</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={`${log.id}-${index}`}>
                      <TableCell>
                        <Badge className={`${getActionBadgeColor(log.action)} text-xs px-2 py-1 whitespace-nowrap`}>
                          {getActionText(log.action, log.tableName, log.fieldName)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getSmartDescription(log)}
                      </TableCell>
                      <TableCell>
                        {log.oldValue ? (
                          <div className="text-red-600 dark:text-red-400 text-xs break-words max-w-[180px]">
                            {getSmartValue(log.oldValue, log.fieldName, log.tableName)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.newValue ? (
                          <div className="text-green-600 dark:text-green-400 text-xs break-words max-w-[180px]">
                            {getSmartValue(log.newValue, log.fieldName, log.tableName)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.userName || 'Không xác định'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.timestamp ? formatTimestamp(log.timestamp) : 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-mono">{log.ipAddress || 'N/A'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}