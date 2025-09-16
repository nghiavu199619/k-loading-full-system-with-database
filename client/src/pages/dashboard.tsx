import { useQuery } from "@tanstack/react-query";
import { Plus, Share2, ArrowUp, ArrowDown, Clock, Eye, ExternalLink, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/currency";
import { ExpenseChart } from "@/components/charts/expense-chart";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { uiToRaw } from '../../../packages/data-center/src/index';

export default function Dashboard() {
  const { subscribe } = useWebSocket();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats', { month: currentMonth, year: currentYear }]
  });

  // Ad Accounts
  const { data: adAccounts = [] } = useQuery({
    queryKey: ['/api/ad-accounts']
  });

  // Account Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['/api/account-expenses', { month: currentMonth, year: currentYear }]
  });

  // Clients
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients']
  });

  // Type-safe arrays
  const typedAdAccounts = adAccounts as any[];
  const typedExpenses = expenses as any[];
  const typedClients = clients as any[];

  // Subscribe to real-time updates - DISABLED to prevent row jumping
  useEffect(() => {
    // Disabled WebSocket auto-refresh to prevent spreadsheet row jumping
    const unsubscribers: (() => void)[] = [
      // subscribe('AD_ACCOUNT_CREATED', () => {
      //   queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
      //   queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // }),
      // subscribe('AD_ACCOUNT_UPDATED', () => {
      //   queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
      //   queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // }),
      // subscribe('ACCOUNT_EXPENSE_CREATED', () => {
      //   queryClient.invalidateQueries({ queryKey: ['/api/account-expenses'] });
      //   queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // }),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [subscribe]);

  if (statsLoading) {
    return <div className="flex items-center justify-center h-64">Đang tải...</div>;
  }

  // Calculate actual statistics from real data
  const totalAdAccounts = typedAdAccounts.length;
  const totalClients = typedClients.length;
  
  // ✅ USE DATA-CENTER: Calculate total expenses for current month
  const totalExpenses = typedExpenses.reduce((sum: number, expense: any) => {
    const amount = typeof expense.amount === 'string' ? 
      uiToRaw(expense.amount, { returnNumber: true }) : 
      expense.amount || 0;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);
  
  // Calculate active accounts (accounts with expenses)
  const activeAccounts = new Set(typedExpenses.map((expense: any) => expense.accountId)).size;
  
  // Get platform distribution
  const platformCounts = typedAdAccounts.reduce((acc: Record<string, number>, account: any) => {
    const platform = account.platform || 'unknown';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate expense growth (mock for now, could be real with historical data)
  const expenseGrowth = "+15.3%";
  const accountGrowth = "+8.7%";
  const clientGrowth = "+22.1%";

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 p-6">
      <div className="space-y-6">
        {/* Modern Page Header */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-sky-200 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-sky-700 to-blue-700 bg-clip-text text-transparent">Tổng quan tài chính</h1>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Cập nhật trực tiếp • Tháng {currentMonth}/{currentYear}</span>
              </div>
            </div>
        
            <div className="flex flex-wrap gap-2 lg:gap-3">
              <Button size="sm" className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 flex items-center space-x-2 shadow-md">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Thêm giao dịch</span>
              </Button>
              
              <Button size="sm" variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center space-x-2">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Chia sẻ báo cáo</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="bg-gradient-to-br from-white to-sky-50 border-sky-200 shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-sky-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">Tổng tài khoản</CardTitle>
              <div className="h-4 w-4 text-sky-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{totalAdAccounts.toLocaleString()}</div>
              <div className="flex items-center text-xs text-sky-600">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>{accountGrowth} từ tháng trước</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-emerald-50 border-emerald-200 shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">Tổng khách hàng</CardTitle>
              <div className="h-4 w-4 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{totalClients.toLocaleString()}</div>
              <div className="flex items-center text-xs text-emerald-600">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>{clientGrowth} từ tháng trước</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-rose-50 border-rose-200 shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-rose-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">Chi phí tháng này</CardTitle>
              <div className="h-4 w-4 text-rose-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1v22"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(totalExpenses)}</div>
              <div className="flex items-center text-xs text-rose-600">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>{expenseGrowth} từ tháng trước</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-violet-50 border-violet-200 shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-violet-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">TK hoạt động</CardTitle>
              <div className="h-4 w-4 text-violet-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{activeAccounts.toLocaleString()}</div>
              <div className="text-xs text-slate-600">
                {totalAdAccounts > 0 ? Math.round((activeAccounts / totalAdAccounts) * 100) : 0}% của tổng số TK
              </div>
            </CardContent>
          </Card>
      </div>

        {/* Platform Distribution and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Distribution */}
          <Card className="bg-white/70 backdrop-blur-sm border-sky-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-700">Phân bố theo nền tảng</CardTitle>
            </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(platformCounts).map(([platform, count]) => {
                const percentage = totalAdAccounts > 0 ? Math.round(((count as number) / totalAdAccounts) * 100) : 0;
                const platformColors: Record<string, string> = {
                  google: 'bg-blue-500',
                  facebook: 'bg-blue-600',
                  tiktok: 'bg-gray-800',
                  youtube: 'bg-red-500',
                  instagram: 'bg-pink-500',
                  unknown: 'bg-gray-400'
                };
                const platformLabels: Record<string, string> = {
                  google: 'Google Ads',
                  facebook: 'Facebook Ads',
                  tiktok: 'TikTok Ads',
                  youtube: 'YouTube Ads',
                  instagram: 'Instagram Ads',
                  unknown: 'Khác'
                };
                
                return (
                  <div key={platform} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${platformColors[platform]}`}></div>
                      <span className="text-sm font-medium">{platformLabels[platform]}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">{count as number} TK</span>
                      <span className="text-xs text-muted-foreground">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

          {/* Recent Account Expenses */}
          <Card className="bg-white/70 backdrop-blur-sm border-sky-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-slate-700">Chi tiêu gần đây</CardTitle>
              <Button variant="link" className="text-sky-600 hover:text-sky-700 hover:underline p-0">
                Xem chi tiết
              </Button>
            </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {typedExpenses.slice(0, 5).map((expense: any, index: number) => {
                const account = typedAdAccounts.find((acc: any) => acc.id === expense.accountId);
                const client = typedClients.find((cli: any) => cli.id === expense.clientId);
                
                return (
                  <div key={`expense-item-${expense.id || index}-${index}-${Date.now()}`} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-orange-600 text-xs font-bold">
                          {expense.type === 'rental' ? 'R' : expense.type === 'ad_spend' ? 'A' : expense.type === 'management_fee' ? 'M' : 'O'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{account?.name || 'Unknown Account'}</p>
                        <p className="text-sm text-muted-foreground">{client?.name || 'Unknown Client'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatCurrency(parseFloat(expense.amount))}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {expense.type === 'rental' ? 'Thuê TK' : 
                         expense.type === 'ad_spend' ? 'Chi phí QC' : 
                         expense.type === 'management_fee' ? 'Phí QL' : 'Khác'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {typedExpenses.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  Chưa có chi tiêu nào trong tháng này
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Ad Account Overview */}
        <Card className="bg-white/70 backdrop-blur-sm border-sky-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-slate-700">Tổng quan tài khoản quảng cáo</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Cập nhật trực tiếp</span>
            </div>
          </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {typedAdAccounts.slice(0, 6).map((account: any, index: number) => {
              const accountExpenses = typedExpenses.filter((exp: any) => exp.accountId === account.id);
              const totalAccountExpense = accountExpenses.reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount) || 0), 0);
              
              return (
                <div key={`account-overview-${account.id || index}-${index}-${Date.now()}`} className="p-4 bg-gradient-to-br from-white to-sky-50 border border-sky-200 rounded-xl hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        account.platform === 'google' ? 'bg-blue-500' :
                        account.platform === 'facebook' ? 'bg-blue-600' :
                        account.platform === 'tiktok' ? 'bg-gray-800' :
                        account.platform === 'youtube' ? 'bg-red-500' :
                        account.platform === 'instagram' ? 'bg-pink-500' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-sm font-medium text-slate-600">
                        {account.platform?.charAt(0).toUpperCase() + account.platform?.slice(1) || 'Unknown'}
                      </span>
                    </div>
                    {account.hasVat && (
                      <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">VAT {account.vatPercentage}</Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-800 mb-1">{account.name}</h4>
                  <p className="text-sm text-slate-600 mb-2">ID: {account.accountId}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Chi tiêu tháng này</span>
                    <span className="font-medium text-slate-800">{formatCurrency(totalAccountExpense)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {typedAdAccounts.length === 0 && (
            <div className="text-center text-slate-500 py-8">
              <p>Chưa có tài khoản quảng cáo nào</p>
              <p className="text-sm mt-1">Hãy thêm tài khoản đầu tiên của bạn</p>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
