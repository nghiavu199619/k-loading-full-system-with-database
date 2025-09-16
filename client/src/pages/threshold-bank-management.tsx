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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, Download, Upload, Filter, Edit, Search, Calendar, Target, Banknote } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ThresholdManagement, BankOrder } from "@shared/schema";
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

// Status options - Get from system settings
const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Suspended'];

// Chốt tháng options for dropdown
const COMPLETION_STATUS_OPTIONS = ["Đã chốt", "Chưa chốt"];

// Month and Year options for monthly report dropdown
const MONTH_OPTIONS = [
  { value: 1, label: "Tháng 1" },
  { value: 2, label: "Tháng 2" },
  { value: 3, label: "Tháng 3" },
  { value: 4, label: "Tháng 4" },
  { value: 5, label: "Tháng 5" },
  { value: 6, label: "Tháng 6" },
  { value: 7, label: "Tháng 7" },
  { value: 8, label: "Tháng 8" },
  { value: 9, label: "Tháng 9" },
  { value: 10, label: "Tháng 10" },
  { value: 11, label: "Tháng 11" },
  { value: 12, label: "Tháng 12" }
];

const YEAR_OPTIONS = [
  { value: 2023, label: "2023" },
  { value: 2024, label: "2024" },
  { value: 2025, label: "2025" },
  { value: 2026, label: "2026" }
];

// Column configurations for Threshold Management Handsontable
const getThresholdColumnConfig = () => [
  {
    data: 'accountId',
    title: 'ID TKQC',
    width: 120,
    readOnly: false
  },
  {
    data: 'accountName', 
    title: 'Name',
    width: 200,
    readOnly: false
  },
  {
    data: 'tag',
    title: 'Tag KH',
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
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
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'reportMonth',
    title: 'Báo cáo tháng',
    type: 'dropdown',
    source: MONTH_OPTIONS.map(m => m.label),
    width: 120,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      const monthOption = MONTH_OPTIONS.find(m => m.value === value);
      td.innerHTML = monthOption ? monthOption.label : `Tháng ${value}`;
    }
  },
  {
    data: 'reportYear',
    title: 'Năm BC',
    type: 'dropdown', 
    source: YEAR_OPTIONS.map(y => y.label),
    width: 100,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? value.toString() : '';
    }
  },
  {
    data: 'isCompleted',
    title: 'Chốt tháng',
    type: 'dropdown',
    source: COMPLETION_STATUS_OPTIONS,
    width: 120,
    readOnly: false
  },
  {
    data: 'hasBankOrder',
    title: 'Đã tạo lệnh',
    width: 120,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? '✅ Đã tạo' : '⏳ Chưa tạo';
      td.style.textAlign = 'center';
      td.style.color = value ? '#10b981' : '#f59e0b';
    }
  }
];

// Bank Orders Column Configuration
const getBankOrderColumnConfig = () => [
  {
    data: 'orderCode',
    title: 'Mã Lệnh',
    width: 120,
    readOnly: true
  },
  {
    data: 'title',
    title: 'Tiêu đề',
    width: 200,
    readOnly: true
  },
  {
    data: 'totalAmount',
    title: 'Tổng tiền',
    width: 130,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
  },
  {
    data: 'status',
    title: 'Trạng thái',
    width: 120,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      const statusBadge = {
        'pending': '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Chờ duyệt</span>',
        'accounting_approved': '<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">KT Duyệt</span>',
        'operations_approved': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">VH Duyệt</span>',
        'completed': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Hoàn thành</span>',
        'rejected': '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Từ chối</span>'
      };
      td.innerHTML = statusBadge[value as keyof typeof statusBadge] || value;
    }
  },
  {
    data: 'accountingApproval',
    title: 'Duyệt KT',
    width: 100,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      const approved = value?.approved;
      td.innerHTML = approved ? '✅' : '⏳';
      td.style.textAlign = 'center';
    }
  },
  {
    data: 'operationsApproval',
    title: 'Duyệt VH',
    width: 100,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      const approved = value?.approved;
      td.innerHTML = approved ? '✅' : '⏳';
      td.style.textAlign = 'center';
    }
  },
  {
    data: 'createdAt',
    title: 'Ngày tạo',
    width: 150,
    readOnly: true,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? new Date(value).toLocaleDateString('vi-VN') : '';
    }
  },
  {
    data: 'isBanked',
    title: 'Đã Bank',
    type: 'checkbox',
    width: 100,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? '✅ Đã Bank' : '⏳ Chưa Bank';
      td.style.textAlign = 'center';
      td.style.color = value ? '#10b981' : '#f59e0b';
    }
  }
];






export default function ThresholdBankManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States
  const [activeTab, setActiveTab] = useState("threshold");
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isBankOrderModalOpen, setIsBankOrderModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>({});
  const [selectedAccountId, setSelectedAccountId] = useState("");
  
  // Filter criteria for bank order creation
  const [bankOrderFilter, setBankOrderFilter] = useState({
    tags: [] as string[],
    completion: [] as string[],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Bank information for order creation
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    accountName: '',
    accountNumber: ''
  });

  // Fetch threshold management data
  const { data: thresholds, isLoading: isLoadingThresholds } = useQuery({
    queryKey: ['/api/threshold-management'],
    staleTime: 0,
    gcTime: 0
  });

  // Fetch bank orders data
  const { data: bankOrders, isLoading: isLoadingBankOrders } = useQuery({
    queryKey: ['/api/bank-orders'],
    staleTime: 0,
    gcTime: 0
  });

  // Fetch ad accounts for mapping
  const { data: accounts } = useQuery({
    queryKey: ['/api/ad-accounts'],
    staleTime: 300000
  });

  // Fetch system settings for status mapping
  const { data: systemSettings } = useQuery({
    queryKey: ['/api/system-settings'],
    staleTime: 300000
  });

  // Auto-detect threshold accounts
  const thresholdAccounts = useMemo(() => {
    if (!Array.isArray(accounts)) return [];
    return accounts.filter((account: any) => 
      ['Ngưỡng', 'DH', 'Lỗi PTT'].includes(account.status)
    );
  }, [accounts]);

  // Create threshold mutation
  const createThresholdMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/threshold-management', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
      toast({ title: "Tạo TKQC thành công" });
    },
    onError: () => {
      toast({ 
        title: "Lỗi tạo TKQC", 
        variant: "destructive" 
      });
    },
  });

  // Update threshold mutation
  const updateThresholdMutation = useMutation({
    mutationFn: async ({ id, updateData }: { id: number, updateData: any }) => {
      return apiRequest('PATCH', `/api/threshold-management/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threshold-management'] });
    },
    onError: () => {
      toast({ 
        title: "Lỗi cập nhật", 
        variant: "destructive" 
      });
    },
  });

  // Add account to threshold management
  const addAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const accountsArray = Array.isArray(accounts) ? accounts : [];
      const account = accountsArray.find((acc: any) => acc.localId.toString() === accountId);
      if (!account) throw new Error('Account not found');
      
      const newThreshold = {
        accountId: account.localId.toString(), // Use localId for ID TKQC
        accountName: account.name || account.accountId || 'N/A', // Use name field for Name column
        tag: account.clientTag || '', // Use clientTag for Tag KH
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
        hasBankOrder: false,
        bankRecipient: '',
        month: monthFilter,
        year: yearFilter
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

  // Create bank order mutation
  const createBankOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/bank-orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-orders'] });
      toast({ title: "Tạo lệnh bank thành công" });
      setIsBankOrderModalOpen(false);
    },
    onError: () => {
      toast({ 
        title: "Lỗi tạo lệnh bank", 
        variant: "destructive" 
      });
    },
  });

  // Update bank order mutation
  const updateBankOrderMutation = useMutation({
    mutationFn: async ({ id, updateData }: { id: number, updateData: any }) => {
      return apiRequest('PATCH', `/api/bank-orders/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-orders'] });
      toast({ title: "Cập nhật lệnh bank thành công" });
    },
    onError: () => {
      toast({ 
        title: "Lỗi cập nhật lệnh bank", 
        variant: "destructive" 
      });
    },
  });

  // Auto-save functionality for threshold management
  const { saveStatus, isSaving, pendingCount } = useAutoSave(async (changes: any[]) => {
    for (const change of changes) {
      if (change.id) {
        await updateThresholdMutation.mutateAsync({
          id: change.id,
          updateData: change.data
        });
      }
    }
  });

  // Filtered threshold data for table
  const filteredThresholdData = useMemo(() => {
    if (!thresholds || !Array.isArray(thresholds)) return [];

    return thresholds
      .filter((threshold: ThresholdManagement) => {
        const matchesSearch = !searchTerm || 
          threshold.accountId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          threshold.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          threshold.tag?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || threshold.status === statusFilter;
        const matchesCompletion = completionFilter === "all" || threshold.isCompleted === completionFilter;
        
        return matchesSearch && matchesStatus && matchesCompletion;
      });
  }, [thresholds, searchTerm, statusFilter, completionFilter]);

  // Filtered data for bank order creation
  const filteredForBankOrder = useMemo(() => {
    if (!thresholds || !Array.isArray(thresholds)) return [];

    return thresholds.filter((threshold: ThresholdManagement) => {
      const matchesTags = bankOrderFilter.tags.length === 0 || 
        (threshold.tag && bankOrderFilter.tags.includes(threshold.tag));
      
      const matchesCompletion = bankOrderFilter.completion.length === 0 || 
        (threshold.isCompleted && bankOrderFilter.completion.includes(threshold.isCompleted));
      
      const matchesMonth = threshold.month === bankOrderFilter.month;
      const matchesYear = threshold.year === bankOrderFilter.year;
      
      return matchesTags && matchesCompletion && matchesMonth && matchesYear;
    });
  }, [thresholds, bankOrderFilter]);

  // Handle cell changes in threshold table
  const handleThresholdAfterChange = (changes: any[], source: string) => {
    if (source === 'loadData' || !changes) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const rowData = filteredThresholdData[row];
      if (!rowData || !rowData.id) return;

      let updateData: any = {};
      
      if (['totalThreshold', 'shareAmount', 'monthlySpend', 'cutAmount'].includes(prop)) {
        updateData[prop] = parseVND(newValue?.toString() || '0');
      } else {
        updateData[prop] = newValue;
      }

      updateThresholdMutation.mutate({
        id: rowData.id!,
        updateData
      });
    });
  };

  // Handle cell changes in bank orders table
  const handleBankOrderAfterChange = (changes: any[], source: string) => {
    if (source === 'loadData' || !changes) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const rowData = Array.isArray(bankOrders) ? bankOrders[row] : null;
      if (!rowData || !rowData.id) return;

      let updateData: any = {};
      updateData[prop] = newValue;

      updateBankOrderMutation.mutate({
        id: rowData.id!,
        updateData
      });
    });
  };

  // Create bank order
  const handleCreateBankOrder = () => {
    // Validate bank information
    if (!bankInfo.bankName.trim() || !bankInfo.accountName.trim() || !bankInfo.accountNumber.trim()) {
      toast({
        title: "Thiếu thông tin ngân hàng",
        description: "Vui lòng điền đầy đủ tên ngân hàng, tên tài khoản và số tài khoản",
        variant: "destructive"
      });
      return;
    }

    const selectedAccounts = filteredForBankOrder
      .filter(t => t.statusEx === 'Đã Chốt' && t.shareAmount && parseFloat(t.shareAmount.toString()) > 0)
      .map(t => ({
        accountId: t.accountId,
        accountName: t.accountName,
        tag: t.tag,
        status: t.statusEx,
        shareAmount: t.shareAmount?.toString() || '0',
        bankRecipient: t.bankRecipient || ''
      }));

    if (selectedAccounts.length === 0) {
      toast({
        title: "Không có TKQC nào được chọn",
        description: "Vui lòng đảm bảo có TKQC với trạng thái 'Đã Chốt' và có số tiền chia",
        variant: "destructive"
      });
      return;
    }

    const totalAmount = selectedAccounts.reduce((sum, acc) => sum + parseFloat(acc.shareAmount), 0);
    
    const bankOrderData = {
      title: `Lệnh Bank tháng ${bankOrderFilter.month}/${bankOrderFilter.year}`,
      selectedAccounts,
      totalAmount,
      filterCriteria: bankOrderFilter,
      bankInfo, // Thêm thông tin ngân hàng
      month: bankOrderFilter.month,
      year: bankOrderFilter.year
    };

    createBankOrderMutation.mutate(bankOrderData);
    
    // Clear bank info after successful creation
    setBankInfo({
      bankName: '',
      accountName: '',
      accountNumber: ''
    });
    
    // Update hasBankOrder for selected accounts
    selectedAccounts.forEach(account => {
      const threshold = (Array.isArray(thresholds) ? thresholds : []).find(
        (t: any) => t.accountId === account.accountId && t.month === bankOrderFilter.month && t.year === bankOrderFilter.year
      );
      if (threshold?.id) {
        updateThresholdMutation.mutate({
          id: threshold.id,
          updateData: { hasBankOrder: true }
        });
      }
    });
  };

  if (isLoadingThresholds) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quản Lý Ngưỡng & Lệnh Bank</h1>
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="threshold" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>QL Ngưỡng</span>
          </TabsTrigger>
          <TabsTrigger value="bankorder" className="flex items-center space-x-2">
            <Banknote className="h-4 w-4" />
            <span>Lệnh Bank</span>
          </TabsTrigger>
        </TabsList>

        {/* Threshold Management Tab */}
        <TabsContent value="threshold" className="space-y-6">
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIsAddAccountModalOpen(true)}
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Thêm TKQC
              </Button>
              <Button
                onClick={() => setIsBankOrderModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Tạo Lệnh Bank
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

                <div className="space-y-2">
                  <Label>Chốt tháng</Label>
                  <Select value={completionFilter} onValueChange={setCompletionFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {COMPLETION_STATUS_OPTIONS.map((status: string) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

          {/* Threshold Handsontable */}
          <Card>
            <CardContent className="p-0">
              <div className="w-full overflow-auto">
                <HotTable
                  data={filteredThresholdData || []}
                  columns={getThresholdColumnConfig()}
                  height="600"
                  width="100%"
                  licenseKey="non-commercial-and-evaluation"
                  afterChange={(changes: any[] | null, source: string) => handleThresholdAfterChange(changes || [], source)}
                  manualColumnResize={true}
                  manualRowResize={true}
                  contextMenu={true}
                  filters={true}
                  dropdownMenu={true}
                  colHeaders={true}
                  rowHeaders={true}
                  stretchH="all"
                  className="htCore"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Orders Tab */}
        <TabsContent value="bankorder" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Banknote className="h-5 w-5" />
                <span>Danh sách Lệnh Bank</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-auto">
                <HotTable
                  data={Array.isArray(bankOrders) ? bankOrders : []}
                  columns={getBankOrderColumnConfig()}
                  height="600"
                  width="100%"
                  licenseKey="non-commercial-and-evaluation"
                  afterChange={(changes: any[] | null, source: string) => handleBankOrderAfterChange(changes || [], source)}
                  manualColumnResize={true}
                  manualRowResize={true}
                  contextMenu={true}
                  filters={true}
                  dropdownMenu={true}
                  colHeaders={true}
                  rowHeaders={true}
                  stretchH="all"
                  className="htCore"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Add Account Modal */}
      <Dialog open={isAddAccountModalOpen} onOpenChange={setIsAddAccountModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm TKQC vào Quản Lý Ngưỡng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chọn tài khoản:</Label>
              <Select 
                value={selectedAccountId} 
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tài khoản để thêm vào bảng ngưỡng..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.isArray(accounts) ? accounts
                      .filter((account: any) => {
                        const existingAccountIds = new Set((Array.isArray(thresholds) ? thresholds : []).map((t: any) => t.accountId) || []);
                        return !existingAccountIds.has(account.localId.toString());
                      })
                      .map((account: any) => (
                        <SelectItem key={account.localId} value={account.localId.toString()}>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-blue-600">{account.localId}</span>
                            <span>-</span>
                            <span>{account.name || account.accountName || account.accountId || 'Chưa có tên'}</span>
                            <Badge variant="outline" className="ml-2">{account.status}</Badge>
                          </div>
                        </SelectItem>
                      )) : null}
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
                {addAccountMutation.isPending ? "Đang thêm..." : "Thêm TKQC"}
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

      {/* Create Bank Order Modal */}
      <Dialog open={isBankOrderModalOpen} onOpenChange={setIsBankOrderModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tạo Lệnh Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filter Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bộ lọc TKQC</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tag KH</Label>
                    <Select
                      onValueChange={(value) => {
                        setBankOrderFilter(prev => ({ 
                          ...prev, 
                          tags: value === 'all' ? [] : [value]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn Tag KH..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        {/* Get unique tags from thresholds */}
                        {Array.from(new Set((Array.isArray(thresholds) ? thresholds : []).map((t: any) => t.tag).filter(Boolean))).map((tag: any) => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chốt tháng</Label>
                    <Select
                      onValueChange={(value) => {
                        setBankOrderFilter(prev => ({ 
                          ...prev, 
                          completion: value === 'all' ? [] : [value]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn trạng thái chốt..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        {COMPLETION_STATUS_OPTIONS.map((status: string) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tháng</Label>
                    <Select 
                      value={bankOrderFilter.month.toString()} 
                      onValueChange={(value) => setBankOrderFilter(prev => ({ 
                        ...prev, 
                        month: parseInt(value) 
                      }))}
                    >
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

                  <div className="space-y-2">
                    <Label>Năm</Label>
                    <Select 
                      value={bankOrderFilter.year.toString()} 
                      onValueChange={(value) => setBankOrderFilter(prev => ({ 
                        ...prev, 
                        year: parseInt(value) 
                      }))}
                    >
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

            {/* Bank Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thông tin ngân hàng</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Tên ngân hàng (NH)</Label>
                    <Input
                      id="bankName"
                      placeholder="Ví dụ: Vietcombank, BIDV..."
                      value={bankInfo.bankName}
                      onChange={(e) => setBankInfo(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountName">Tên tài khoản (TÊN TK)</Label>
                    <Input
                      id="accountName"
                      placeholder="Tên chủ tài khoản"
                      value={bankInfo.accountName}
                      onChange={(e) => setBankInfo(prev => ({ ...prev, accountName: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Số tài khoản (STK)</Label>
                    <Input
                      id="accountNumber"
                      placeholder="Số tài khoản ngân hàng"
                      value={bankInfo.accountNumber}
                      onChange={(e) => setBankInfo(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview filtered accounts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TKQC được chọn ({filteredForBankOrder.filter(t => t.statusEx === 'Đã Chốt').length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {(Array.isArray(filteredForBankOrder) ? filteredForBankOrder : [])
                    .filter(t => t.statusEx === 'Đã Chốt' && t.shareAmount && parseFloat(t.shareAmount.toString()) > 0)
                    .map(threshold => (
                      <div key={threshold.id} className="flex justify-between items-center p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm">{threshold.accountId}</span>
                          <span>-</span>
                          <span>{threshold.accountName}</span>
                          {threshold.tag && <Badge variant="outline">{threshold.tag}</Badge>}
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-green-600">
                            {formatVND(threshold.shareAmount)}đ
                          </div>
                          <div className="text-xs text-gray-500">{threshold.bankRecipient}</div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Tổng tiền:</span>
                    <span className="font-mono font-bold text-lg text-blue-600">
                      {formatVND(
                        filteredForBankOrder
                          .filter(t => t.statusEx === 'Đã Chốt')
                          .reduce((sum, t) => sum + (parseFloat(t.shareAmount?.toString() || '0') || 0), 0)
                      )}đ
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleCreateBankOrder}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={createBankOrderMutation.isPending || filteredForBankOrder.filter(t => t.statusEx === 'Đã Chốt').length === 0}
              >
                {createBankOrderMutation.isPending ? "Đang tạo..." : "Tạo Lệnh Bank"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsBankOrderModalOpen(false)}
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