import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, Download, Upload, Filter, Edit, Search, Calendar, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ThresholdManagement } from "@shared/schema";
import { useAutoSave } from "@/hooks/useAutoSave";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable";
import "handsontable/dist/handsontable.full.min.css";

// Handsontable configuration for Vietnamese formatting
const formatVND = (value: number | string): string => {
  if (!value || value === '' || value === null || value === undefined) return '';
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat('vi-VN', { 
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(numValue);
};

const parseVND = (value: string): number => {
  if (!value || value === '') return 0;
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
};

// Status options
const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Suspended'];
const STATUS_EX_OPTIONS = ['Đang dùng', 'Đã Chốt', 'Tạm ngưng'];

// Column configurations for Handsontable
const getColumnConfig = () => [
  {
    data: 'selected',
    type: 'checkbox',
    width: 50,
    readOnly: false,
    title: '✓'
  },
  {
    data: 'accountId',
    title: 'ID TKQC',
    width: 120,
    readOnly: false
  },
  {
    data: 'accountName', 
    title: 'Tên TKQC',
    width: 200,
    readOnly: false
  },
  {
    data: 'tag',
    title: 'Tag',
    width: 100,
    readOnly: false
  },
  {
    data: 'status',
    title: 'Trạng thái',
    type: 'dropdown',
    source: STATUS_OPTIONS,
    width: 120,
    readOnly: false
  },
  {
    data: 'totalThreshold',
    title: 'Tổng ngưỡng',
    type: 'numeric',
    width: 130,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string | number, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'sharePercentage',
    title: '% Chia',
    type: 'numeric',
    width: 80,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any) => {
      td.innerHTML = value ? `${value}%` : '0%';
      td.style.textAlign = 'right';
    }
  },
  {
    data: 'shareAmount',
    title: 'Chia (VNĐ)',
    type: 'numeric', 
    width: 130,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'monthlySpend',
    title: 'Chi tiêu tháng',
    type: 'numeric',
    width: 140,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'cutPercentage',
    title: '% Cắt',
    type: 'numeric',
    width: 80,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any) => {
      td.innerHTML = value ? `${value}%` : '0%';
      td.style.textAlign = 'right';
    }
  },
  {
    data: 'cutAmount',
    title: 'Cắt (VNĐ)',
    type: 'numeric',
    width: 130,
    readOnly: false,
    renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'monthlyReport',
    title: 'Báo cáo tháng',
    width: 150,
    readOnly: false
  },
  {
    data: 'statusEx',
    title: 'Trạng thái EX',
    type: 'dropdown',
    source: STATUS_EX_OPTIONS,
    width: 120,
    readOnly: false
  },
  {
    data: 'isBanked',
    title: 'Đã Bank',
    type: 'checkbox',
    width: 80,
    readOnly: false
  },
  {
    data: 'bankRecipient',
    title: 'TT Người nhận Bank',
    width: 200,
    readOnly: false
  }
];

export default function ThresholdManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hotTableRef = useRef<HotTable>(null);
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<Partial<ThresholdManagement>>({});
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Query for thresholds
  const { data: thresholds = [], isLoading } = useQuery({
    queryKey: ['/api/threshold-management', { month: monthFilter, year: yearFilter }],
  });

  // Query for accounts to auto-filter threshold status
  const { data: accounts = [] } = useQuery({
    queryKey: ['/api/ad-accounts'],
  });

  // Filter accounts with threshold status
  const thresholdAccounts = useMemo(() => {
    return accounts.filter((account: any) => 
      ['Ngưỡng', 'DH', 'Lỗi PTT'].includes(account.status)
    );
  }, [accounts]);

  // Mutation for updating thresholds
  const updateThresholdMutation = useMutation({
    mutationFn: (data: { id: number; updateData: Partial<ThresholdManagement> }) =>
      apiRequest('PATCH', `/api/threshold-management/${data.id}`, data.updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
      toast({ title: "Cập nhật thành công", description: "Dữ liệu đã được lưu" });
    },
    onError: () => {
      toast({ 
        title: "Lỗi cập nhật", 
        description: "Không thể lưu dữ liệu",
        variant: "destructive" 
      });
    },
  });

  // Mutation for bulk edit
  const bulkEditMutation = useMutation({
    mutationFn: (data: { ids: number[]; updateData: Partial<ThresholdManagement> }) =>
      apiRequest('PATCH', '/api/threshold-management/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
      toast({ title: "Cập nhật hàng loạt thành công" });
      setSelectedRows([]);
    },
    onError: () => {
      toast({ 
        title: "Lỗi cập nhật hàng loạt", 
        variant: "destructive" 
      });
    },
  });

  // Create new threshold mutation
  const createThresholdMutation = useMutation({
    mutationFn: (data: Partial<ThresholdManagement>) =>
      apiRequest('POST', '/api/threshold-management', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
      toast({ title: "Thêm mới thành công" });
    },
    onError: () => {
      toast({ 
        title: "Lỗi thêm mới", 
        variant: "destructive" 
      });
    },
  });

  // Mutation for adding account to threshold management
  const addAccountMutation = useMutation({
    mutationFn: (accountId: string) => {
      const account = accounts.find((acc: any) => acc.localId.toString() === accountId);
      if (!account) throw new Error('Account not found');
      
      const newThreshold = {
        accountId: account.localId.toString(),
        accountName: account.accountName || account.accountId || '',
        tag: account.tag || '',
        status: 'Active',
        totalThreshold: 0,
        sharePercentage: 0,
        shareAmount: 0,
        monthlySpend: 0,
        cutPercentage: 0,
        cutAmount: 0,
        monthlyReport: '',
        statusEx: 'Đang dùng',
        isBanked: false,
        bankRecipient: ''
      };
      
      return apiRequest('POST', '/api/threshold-management', newThreshold);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
      toast({ title: "Thêm TKQC thành công" });
      setIsAddAccountModalOpen(false);
      setSelectedAccountId("");
    },
    onError: () => {
      toast({ 
        title: "Lỗi thêm TKQC", 
        variant: "destructive" 
      });
    },
  });

  // Auto-save functionality
  const { saveStatus, isSaving, pendingCount } = useAutoSave(async (changes: any[]) => {
    // Process each changed item
    for (const change of changes) {
      if (change.id) {
        await updateThresholdMutation.mutateAsync({
          id: change.id,
          updateData: change.data
        });
      }
    }
  });

  // Auto-add disabled temporarily to prevent infinite loop
  // Will re-enable after fixing the duplicate issue

  // Filtered and processed data for table
  const tableData = useMemo(() => {
    if (!thresholds || !Array.isArray(thresholds)) return [];

    return thresholds
      .filter((threshold: ThresholdManagement) => {
        const matchesSearch = !searchTerm || 
          threshold.accountId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          threshold.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          threshold.tag?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || threshold.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .map((threshold: ThresholdManagement) => ({
        ...threshold,
        selected: selectedRows.includes(threshold.id!)
      }));
  }, [thresholds, searchTerm, statusFilter, selectedRows]);

  // Handle cell changes in Handsontable
  const handleAfterChange = (changes: any[], source: string) => {
    if (source === 'loadData' || !changes) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const rowData = tableData[row];
      if (!rowData || !rowData.id) return;

      let updateData: Partial<ThresholdManagement> = {};
      
      // Handle checkbox selection
      if (prop === 'selected') {
        if (newValue) {
          setSelectedRows(prev => [...prev, rowData.id!]);
        } else {
          setSelectedRows(prev => prev.filter(id => id !== rowData.id));
        }
        return;
      }

      // Handle isBanked checkbox - lock/unlock bankRecipient field
      if (prop === 'isBanked') {
        (updateData as any)[prop] = newValue;
        // If unchecked, clear bank recipient
        if (!newValue) {
          (updateData as any).bankRecipient = '';
        }
      } else if (prop === 'bankRecipient') {
        // Only allow editing if isBanked is true
        if (!rowData.isBanked) {
          toast({
            title: "Không thể chỉnh sửa",
            description: "Vui lòng tick 'Đã Bank' trước khi nhập thông tin người nhận",
            variant: "destructive"
          });
          return;
        }
        (updateData as any)[prop] = newValue;
      } else {
        (updateData as any)[prop] = newValue;
      }

      // Trigger update
      updateThresholdMutation.mutate({
        id: rowData.id!,
        updateData
      });
    });
  };

  // Handle bulk edit
  const handleBulkEdit = () => {
    if (selectedRows.length === 0) {
      toast({
        title: "Chưa chọn dòng nào",
        description: "Vui lòng chọn ít nhất một dòng để chỉnh sửa",
        variant: "destructive"
      });
      return;
    }
    setIsEditModalOpen(true);
  };

  // Apply bulk edit
  const applyBulkEdit = () => {
    if (Object.keys(editingData).length === 0) {
      toast({
        title: "Chưa có thay đổi",
        description: "Vui lòng nhập dữ liệu cần cập nhật",
        variant: "destructive"
      });
      return;
    }

    bulkEditMutation.mutate({
      ids: selectedRows,
      updateData: editingData
    });
    setIsEditModalOpen(false);
    setEditingData({});
  };

  // Add new threshold
  const handleAddNew = () => {
    const newThreshold = {
      accountId: `TK${Date.now()}`,
      accountName: 'Tài khoản mới',
      tag: '',
      status: 'Active',
      totalThreshold: '0',
      sharePercentage: '0',
      shareAmount: '0',
      monthlySpend: '0',
      cutPercentage: '0',
      cutAmount: '0',
      monthlyReport: '',
      statusEx: 'Đang dùng',
      isBanked: false,
      bankRecipient: '',
      month: monthFilter,
      year: yearFilter
    };

    createThresholdMutation.mutate(newThreshold);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quản Lý Ngưỡng</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {isSaving && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              Đang lưu...
            </Badge>
          )}
          {saveStatus === 'saved' && (
            <Badge variant="outline" className="text-green-600">
              Đã lưu
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {pendingCount} thay đổi
            </Badge>
          )}
          <Button
            onClick={() => setIsAddAccountModalOpen(true)}
            variant="outline"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            🎯 Thêm TKQC
          </Button>
          <Button
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm mới
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Bộ lọc</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ID TKQC, Tên TKQC, Tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Filter */}
            <div className="space-y-2">
              <Label>Tháng</Label>
              <Select value={monthFilter.toString()} onValueChange={(value) => setMonthFilter(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Tháng {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Filter */}
            <div className="space-y-2">
              <Label>Năm</Label>
              <Select value={yearFilter.toString()} onValueChange={(value) => setYearFilter(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      {selectedRows.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-700 dark:text-blue-300">
                Đã chọn {selectedRows.length} dòng
              </span>
              <Button
                onClick={handleBulkEdit}
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-100"
              >
                <Settings className="h-4 w-4 mr-2" />
                🛠 Chỉnh sửa hàng loạt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handsontable */}
      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <HotTable
              data={tableData}
              columns={getColumnConfig()}
              height="600"
              width="100%"
              licenseKey="non-commercial-and-evaluation"
              afterChange={(changes: any[] | null, source: string) => handleAfterChange(changes, source)}
              manualColumnResize={true}
              manualRowResize={true}
              contextMenu={true}
              filters={true}
              dropdownMenu={true}
              hiddenColumns={{
                indicators: true
              }}
              colHeaders={true}
              rowHeaders={true}
              stretchH="all"
              className="htCore"
              beforeChange={(changes: any, source: any) => {
                // Validate bank recipient editing
                if (changes) {
                  for (let [row, prop, oldValue, newValue] of changes) {
                    if (prop === 'bankRecipient') {
                      const rowData = tableData[row];
                      if (!rowData?.isBanked) {
                        return false; // Prevent change
                      }
                    }
                  }
                }
                return true;
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hàng loạt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select 
                value={editingData.status || ""} 
                onValueChange={(value) => setEditingData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trạng thái EX</Label>
              <Select 
                value={editingData.statusEx || ""} 
                onValueChange={(value) => setEditingData(prev => ({ ...prev, statusEx: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái EX..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_EX_OPTIONS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>% Chia</Label>
              <Input
                type="number"
                placeholder="Nhập % chia..."
                value={editingData.sharePercentage || ""}
                onChange={(e) => setEditingData(prev => ({ 
                  ...prev, 
                  sharePercentage: e.target.value 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>% Cắt</Label>
              <Input
                type="number"
                placeholder="Nhập % cắt..."
                value={editingData.cutPercentage || ""}
                onChange={(e) => setEditingData(prev => ({ 
                  ...prev, 
                  cutPercentage: e.target.value 
                }))}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                onClick={applyBulkEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={bulkEditMutation.isPending}
              >
                {bulkEditMutation.isPending ? "Đang cập nhật..." : "Áp dụng"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={isAddAccountModalOpen} onOpenChange={setIsAddAccountModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>🎯 Thêm TKQC vào Quản Lý Ngưỡng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show auto-detected threshold accounts */}
            {thresholdAccounts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-orange-600">📊 Tài khoản có trạng thái ngưỡng (tự động phát hiện):</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-orange-50">
                  {thresholdAccounts.map((account: any) => (
                    <div key={account.localId} className="flex justify-between items-center py-1 text-sm">
                      <span className="font-mono">{account.localId} - {account.accountName || account.accountId}</span>
                      <Badge variant="outline" className={
                        account.status === 'Ngưỡng' ? 'border-orange-400 text-orange-600' :
                        account.status === 'DH' ? 'border-red-400 text-red-600' :
                        account.status === 'Lỗi PTT' ? 'border-purple-400 text-purple-600' : ''
                      }>
                        {account.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  ✨ Các tài khoản này sẽ được tự động thêm vào bảng ngưỡng
                </p>
              </div>
            )}

            {/* Manual account selection */}
            <div className="space-y-2">
              <Label>🔍 Hoặc chọn tài khoản thủ công:</Label>
              <Select 
                value={selectedAccountId} 
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tài khoản để thêm vào bảng ngưỡng..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {accounts
                    .filter((account: any) => {
                      const existingAccountIds = new Set(thresholds.map((t: any) => t.accountId));
                      return !existingAccountIds.has(account.localId.toString());
                    })
                    .map((account: any) => (
                      <SelectItem key={account.localId} value={account.localId.toString()}>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-blue-600">{account.localId}</span>
                          <span>-</span>
                          <span>{account.accountName || account.accountId || 'Chưa có tên'}</span>
                          <Badge variant="outline" className="ml-2">{account.status}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                onClick={() => {
                  if (selectedAccountId) {
                    addAccountMutation.mutate(selectedAccountId);
                  } else {
                    toast({
                      title: "Chưa chọn tài khoản",
                      description: "Vui lòng chọn tài khoản để thêm",
                      variant: "destructive"
                    });
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={addAccountMutation.isPending || !selectedAccountId}
              >
                {addAccountMutation.isPending ? "Đang thêm..." : "🎯 Thêm TKQC"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddAccountModalOpen(false);
                  setSelectedAccountId("");
                }}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}