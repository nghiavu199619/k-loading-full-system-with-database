import { useState, useEffect } from "react";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResponsiveMain } from "@/components/layout/responsive-main";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ExpenseHandsontable } from "@/components/spreadsheets/expense-handsontable";
import { useHasPermission } from "@/hooks/usePermissions";
import {
  Calculator,
  Users,
  CreditCard,
  Activity,
  Clock,
  Pause,
  FileText,
  Grid3X3,
  Plus,
  Minus,
  Settings,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ConditionalLayout } from "@/components/layout/conditional-layout";

interface ExpenseData {
  accountId: number;
  clientId: number;
  amount: string;
  month: number;
  year: number;
}

export default function ExpenseManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { collapsed } = useSidebarContext();
  const canEdit = useHasPermission('expense-management', 'edit');

  // Current month/year state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // ✅ DEBUG MONTH/YEAR STATE - Watch for changes
  useEffect(() => {
    console.log("🔧 SELECTED MONTH CHANGED TO:", selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    console.log("🔧 SELECTED YEAR CHANGED TO:", selectedYear);
  }, [selectedYear]);

  console.log("🔧 Expense Management state:", {
    currentDateMonth: currentDate.getMonth(),
    currentDateMonthPlus1: currentDate.getMonth() + 1,
    selectedMonth,
    selectedYear,
    currentDate: currentDate.toISOString(),
  });

  // Account management dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(
    new Set(),
  );
  const [isSwitchingMonth, setIsSwitchingMonth] = useState(false);

  // Fetch ad accounts
  const { data: adAccounts = [], isLoading: loadingAccounts } = useQuery<any[]>(
    {
      queryKey: ["/api/ad-accounts"],
      staleTime: 0, // ✅ NO CACHE - Always fetch fresh data when tab switching
    },
  );

  // Fetch clients
  const { data: clients = [], isLoading: loadingClients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    staleTime: 0, // ✅ NO CACHE - Always fetch fresh data when tab switching
  });

  // Fetch expense data for current month/year
  const {
    data: expenseData = [],
    isLoading: loadingExpenses,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: [
      "/api/account-expenses",
      { month: selectedMonth, year: selectedYear },
    ],
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch visible accounts settings for current month/year
  const { data: visibleAccountsData = [], refetch: refetchVisibleAccounts } =
    useQuery<any[]>({
      queryKey: [
        "/api/expense-visible-accounts",
        { month: selectedMonth, year: selectedYear },
      ],
      staleTime: 0,
    });

  // ✅ TAB SWITCHING DATA REFRESH: Clear current month cache and refetch
  useEffect(() => {
    // Detect reload (PerformanceNavigationTiming)
    const nav = (performance.getEntriesByType?.("navigation") || [])[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload = nav?.type === "reload";

    if (isReload) {
      // F5: Let React Query fetch according to config; don't invalidate aggressively
      console.log(
        "🔄 PAGE RELOAD DETECTED - Skipping cache invalidation to prevent race conditions",
      );
      return;
    }

    // Navigation from other tab: clear current month cache first, then refetch
    console.log(
      "🔄 EXPENSE TAB ACTIVATED - Clearing current month cache and refetching",
    );

    // 1. Remove current month query from cache
    queryClient.removeQueries({
      queryKey: [
        "/api/account-expenses",
        { month: selectedMonth, year: selectedYear },
      ],
    });

    // 2. Remove visible accounts cache for current month
    queryClient.removeQueries({
      queryKey: [
        "/api/expense-visible-accounts",
        { month: selectedMonth, year: selectedYear },
      ],
    });

    // 3. Invalidate other general data
    queryClient.invalidateQueries({ queryKey: ["/api/ad-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

    // 4. Force refetch current active queries
    setTimeout(() => {
      refetchExpenses();
      refetchVisibleAccounts();
    }, 100);
  }, [
    queryClient,
    selectedMonth,
    selectedYear,
    refetchExpenses,
    refetchVisibleAccounts,
  ]);

  // Filter accounts based on visible settings, preserving insertion order
  const visibleAccounts = visibleAccountsData
    .map((visibleItem: any) => {
      const accountId = visibleItem.accountId || visibleItem;
      return adAccounts.find((acc: any) => acc.id === accountId);
    })
    .filter(Boolean) as any[]; // Remove any undefined items

  // Calculate statistics based on visible accounts
  const stats = {
    totalAccounts: visibleAccounts.length,
    activeAccounts: visibleAccounts.filter(
      (acc: any) => acc.status === "Active",
    ).length,
    pausedAccounts: visibleAccounts.filter(
      (acc: any) => acc.status === "Paused",
    ).length,
    pendingAccounts: visibleAccounts.filter(
      (acc: any) => acc.status === "Pending",
    ).length,
    totalClients: clients.length,
    totalColumns: clients.length,
    totalRows: visibleAccounts.length,
    totalCells: visibleAccounts.length * clients.length,
  };

  // Enhanced UX for period changes with smart loading duration
  const handlePeriodChange = (type: "month" | "year", value: string) => {
    console.log("🔧 HANDLE PERIOD CHANGE:", {
      type,
      value,
      currentSelectedMonth: selectedMonth,
      currentSelectedYear: selectedYear,
    });

    // Immediate visual feedback
    setIsSwitchingMonth(true);

    if (type === "month") {
      const newMonth = parseInt(value);
      console.log("🔧 SETTING MONTH FROM", selectedMonth, "TO", newMonth);
      setSelectedMonth(newMonth);
    } else {
      const newYear = parseInt(value);
      console.log("🔧 SETTING YEAR FROM", selectedYear, "TO", newYear);
      setSelectedYear(newYear);
    }

    // Smart loading timing based on data size and complexity
    const dataComplexity = visibleAccounts.length * clients.length;
    const baseDelay = 100;
    const loadingDuration = Math.min(1000, Math.max(400, dataComplexity * 0.5));

    setTimeout(() => {
      refetchExpenses();
      refetchVisibleAccounts();

      // Smooth loading completion with minimum visible time
      setTimeout(() => {
        setIsSwitchingMonth(false);
      }, loadingDuration);
    }, baseDelay);
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: (i + 1).toString(),
  }));

  // Generate year options (current year ± 2 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentDate.getFullYear() - 2 + i;
    return {
      value: year.toString(),
      label: year.toString(),
    };
  });

  // Filter accounts for dialog display
  const filteredAccounts = adAccounts.filter((acc: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      acc.name?.toLowerCase().includes(searchLower) ||
      acc.accountId?.toLowerCase().includes(searchLower) ||
      acc.localId?.toString().includes(searchLower)
    );
  });

  // Handle account selection
  const handleAccountToggle = (accountId: number, isSelected: boolean) => {
    const newSelected = new Set(selectedAccounts);
    if (isSelected) {
      newSelected.add(accountId);
    } else {
      newSelected.delete(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  // Save visible accounts mutation with month/year support
  const saveVisibleAccountsMutation = useMutation({
    mutationFn: async (accountIds: number[]) => {
      return apiRequest("POST", "/api/expense-visible-accounts", {
        accountIds,
        month: selectedMonth,
        year: selectedYear,
      });
    },
    onSuccess: () => {
      toast({
        title: "Cập nhật thành công",
        description: `Danh sách tài khoản hiển thị cho tháng ${selectedMonth}/${selectedYear} đã được cập nhật`,
      });
      refetchVisibleAccounts();
      setAccountDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi cập nhật",
        description: error?.message || "Không thể cập nhật danh sách tài khoản",
        variant: "destructive",
      });
    },
  });

  // Add all accounts with expenses mutation
  const addAccountsWithExpensesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(
        "POST",
        "/api/expense-visible-accounts/add-with-expenses",
        {
          month: selectedMonth,
          year: selectedYear,
        },
      );
    },
    onSuccess: (data: any) => {
      toast({
        title: "Thêm thành công",
        description: `Đã thêm ${data.added} tài khoản có chi phí cho tháng ${selectedMonth}/${selectedYear}`,
      });
      refetchVisibleAccounts();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi thêm tài khoản",
        description: error?.message || "Không thể thêm tài khoản có chi phí",
        variant: "destructive",
      });
    },
  });

  // Remove inactive accounts mutation
  const removeInactiveAccountsMutation = useMutation({
    mutationFn: async (monthsThreshold: number = 2) => {
      return apiRequest(
        "POST",
        "/api/expense-visible-accounts/remove-inactive",
        {
          monthsThreshold,
        },
      );
    },
    onSuccess: (data: any) => {
      toast({
        title: "Dọn dẹp thành công",
        description: `Đã xóa ${data.removed} tài khoản không hoạt động`,
      });
      refetchVisibleAccounts();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi dọn dẹp",
        description:
          error?.message || "Không thể xóa tài khoản không hoạt động",
        variant: "destructive",
      });
    },
  });

  // Load current visible accounts when dialog opens
  useEffect(() => {
    if (accountDialogOpen && visibleAccountsData) {
      const currentSelected = new Set(
        visibleAccountsData
          .map((item: any) => item.accountId || item)
          .filter((id): id is number => typeof id === "number"),
      );
      setSelectedAccounts(currentSelected);
    }
  }, [accountDialogOpen, visibleAccountsData]);

  // Handle save
  const handleSaveVisibleAccounts = () => {
    saveVisibleAccountsMutation.mutate(Array.from(selectedAccounts));
  };

  return (
    <ConditionalLayout>
      <div className="h-full w-full flex flex-col">
        {/* Header with month selector */}
        <div className="bg-white border-b border-gray-200 py-2 flex-shrink-0">
        
        <div className="flex items-center justify-between w-full px-4">
          {/* Left side - Controls aligned to left */}
          <div className="flex items-center gap-4">
            {/* Account Management Dialog */}
            <Dialog
              open={accountDialogOpen}
              onOpenChange={setAccountDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Thêm/Xoá TKQC
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quản lý Tài khoản Quảng cáo Hiển thị
                  </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                  {/* Bulk Operations */}

                  {/* Search */}
                  <div className="flex items-center gap-2">
                    <Input
                      id="search"
                      placeholder="Tìm theo tên, ID tài khoản, hoặc số thứ tự..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  {/* Account list */}
                  <div className="border rounded-lg flex-1 overflow-hidden flex flex-col">
                    <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-4 text-sm font-medium">
                      <div className="col-span-1">
                        <Checkbox
                          checked={
                            filteredAccounts.length > 0 &&
                            filteredAccounts.every((acc) =>
                              selectedAccounts.has(acc.id),
                            )
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAccounts(
                                new Set(filteredAccounts.map((acc) => acc.id)),
                              );
                            } else {
                              setSelectedAccounts(new Set());
                            }
                          }}
                        />
                      </div>
                      <div className="col-span-4">Tên tài khoản</div>
                      <div className="col-span-3">ID tài khoản</div>
                      <div className="col-span-2">Trạng thái</div>
                      <div className="col-span-2">Tag</div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {filteredAccounts.map((account: any) => (
                        <div
                          key={account.id}
                          className="px-4 py-2 border-b grid grid-cols-12 gap-4 items-center hover:bg-gray-50 text-sm"
                        >
                          <div className="col-span-1">
                            <Checkbox
                              checked={selectedAccounts.has(account.id)}
                              onCheckedChange={(checked) =>
                                handleAccountToggle(account.id, !!checked)
                              }
                            />
                          </div>
                          <div
                            className="col-span-4 truncate"
                            title={account.name}
                          >
                            {account.name || "Chưa có tên"}
                          </div>
                          <div className="col-span-3 font-mono text-xs">
                            {account.accountId}
                          </div>
                          <div className="col-span-2">
                            <Badge
                              variant={
                                account.status === "Active"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {account.status}
                            </Badge>
                          </div>
                          <div className="col-span-2">
                            <Badge variant="outline" className="text-xs">
                              {account.clientTag}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setAccountDialogOpen(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      onClick={handleSaveVisibleAccounts}
                      disabled={saveVisibleAccountsMutation.isPending}
                    >
                      {saveVisibleAccountsMutation.isPending
                        ? "Đang lưu..."
                        : "Lưu thay đổi"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Tháng</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => handlePeriodChange("month", value)}
                disabled={isSwitchingMonth}
              >
                <SelectTrigger
                  className={`w-16 h-8 text-xs transition-all duration-200 ${isSwitchingMonth ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400"}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Năm</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => handlePeriodChange("year", value)}
                disabled={isSwitchingMonth}
              >
                <SelectTrigger
                  className={`w-20 h-8 text-xs transition-all duration-200 ${isSwitchingMonth ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400"}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right side - Stats with loading states */}
          <div
            className={`flex items-center gap-2 text-xs transition-opacity duration-200 ${isSwitchingMonth ? "opacity-60" : ""}`}
          >
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-700 px-2 py-1 text-left transition-all duration-200 hover:bg-green-200"
            >
              <Activity className="h-3 w-3 mr-1" />
              {isSwitchingMonth ? "..." : stats.activeAccounts} Hoạt động
            </Badge>
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 px-2 py-1 text-left transition-all duration-200 hover:bg-blue-200"
            >
              <Users className="h-3 w-3 mr-1" />
              {isSwitchingMonth ? "..." : stats.totalClients} Khách hàng
            </Badge>
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 px-2 py-1 text-left transition-all duration-200 hover:bg-gray-200"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              {isSwitchingMonth ? "..." : stats.totalCells} Ô
            </Badge>
          </div>
        </div>
      </div>

        {/* Table Container */}
        <div className={`bg-white relative flex-1 overflow-hidden transition-all duration-300 ${isSwitchingMonth ? "pointer-events-none" : ""}`}>
        
        {/* Enhanced loading overlay with progress indication */}
        {isSwitchingMonth && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200">
            <div className="text-center bg-white rounded-lg shadow-lg border p-8 max-w-sm mx-4">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-600 mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-blue-600 font-bold text-lg">
                    {selectedMonth}
                  </div>
                </div>
              </div>
              <p className="text-xl font-semibold text-gray-800 mb-2">
                Đang tải tháng {selectedMonth}/{selectedYear}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {stats.totalAccounts} tài khoản • {stats.totalClients} khách
                hàng
              </p>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full animate-pulse"
                  style={{ width: "60%" }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Đang đồng bộ dữ liệu...
              </p>
            </div>
          </div>
        )}

        <ExpenseHandsontable
          key={`expense-${selectedMonth}-${selectedYear}`}
          accounts={visibleAccounts}
          clients={clients}
          expenseData={expenseData as any[]}
          month={selectedMonth}
          year={selectedYear}
          canEdit={canEdit}
        />
        </div>
      </div>
    </ConditionalLayout>
  );
}
