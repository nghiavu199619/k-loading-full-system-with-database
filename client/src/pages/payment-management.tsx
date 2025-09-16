import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Plus } from "lucide-react";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";

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

// Payment Management Column Configuration
const getPaymentColumnConfig = () => [
  {
    data: 'paymentDate',
    title: 'NGÀY',
    type: 'date',
    width: 120,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? new Date(value).toLocaleDateString('vi-VN') : '';
    }
  },
  {
    data: 'amount',
    title: 'SỐ TIỀN',
    type: 'numeric',
    width: 150,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = formatVND(value || 0);
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
      td.style.fontWeight = 'bold';
    }
  },
  {
    data: 'currency',
    title: 'ĐƠN VỊ TIỀN TỆ',
    type: 'dropdown',
    source: ['VND', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF'],
    width: 140,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      const colorMap: { [key: string]: string } = {
        'VND': '#10b981', // Green for VND
        'USD': '#3b82f6', // Blue for USD
        'EUR': '#8b5cf6', // Purple for EUR
        'JPY': '#f59e0b', // Orange for JPY
        'GBP': '#ef4444', // Red for GBP
        'AUD': '#06b6d4', // Cyan for AUD
        'CAD': '#84cc16', // Lime for CAD
        'CHF': '#6366f1'  // Indigo for CHF
      };
      const color = colorMap[value] || '#6b7280';
      td.innerHTML = `<span style="color: ${color}; font-weight: bold;">${value || 'VND'}</span>`;
      td.style.textAlign = 'center';
    }
  },
  {
    data: 'customerCode',
    title: 'MÃ KHÁCH',
    width: 100,
    readOnly: false
  },
  {
    data: 'note',
    title: 'NOTE',
    width: 250,
    readOnly: false
  },
  {
    data: 'accountId',
    title: 'NẠP TK',
    width: 100,
    readOnly: false
  },
  {
    data: 'accountName',
    title: 'TÊN TK',
    width: 200,
    readOnly: false
  },
  {
    data: 'isChecked',
    title: 'ĐÃ CHECK',
    width: 120,
    readOnly: false,
    renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
      td.innerHTML = value ? '✅ Đã check' : '⏳ Chưa check';
      td.style.textAlign = 'center';
      td.style.color = value ? '#10b981' : '#f59e0b';
      td.style.fontWeight = 'bold';
    }
  }
];

// Sample Payment Data
const samplePaymentData = [
  {
    id: 1,
    paymentDate: '2025-08-07',
    amount: 5000000,
    currency: 'VND',
    customerCode: 'KH001',
    note: 'Thanh toán đơn hàng #001',
    accountId: '62',
    accountName: 'HDG TỔng 2869 47',
    isChecked: false
  },
  {
    id: 2,
    paymentDate: '2025-08-07',
    amount: 3500,
    currency: 'USD',
    customerCode: 'KH002',
    note: 'Thanh toán dịch vụ tháng 8',
    accountId: '201',
    accountName: 'TKV Beta Account',
    isChecked: true
  },
  {
    id: 3,
    paymentDate: '2025-08-06',
    amount: 2300,
    currency: 'EUR',
    customerCode: 'KH003',
    note: 'Nạp tiền vào tài khoản',
    accountId: '535',
    accountName: 'FUT Account Alpha',
    isChecked: false
  },
  {
    id: 4,
    paymentDate: '2025-08-06',
    amount: 42000,
    currency: 'JPY',
    customerCode: 'KH004',
    note: 'Thanh toán hợp đồng',
    accountId: '62',
    accountName: 'HDG TỔng 2869 47',
    isChecked: true
  },
  {
    id: 5,
    paymentDate: '2025-08-05',
    amount: 1900,
    currency: 'GBP',
    customerCode: 'KH005',
    note: 'Gia hạn dịch vụ',
    accountId: '201',
    accountName: 'TKV Beta Account',
    isChecked: false
  },
  {
    id: 6,
    paymentDate: '2025-08-04',
    amount: 6500000,
    currency: 'VND',
    customerCode: 'KH006',
    note: 'Thanh toán quảng cáo Facebook',
    accountId: '535',
    accountName: 'FUT Account Alpha',
    isChecked: true
  },
  {
    id: 7,
    paymentDate: '2025-08-03',
    amount: 2500,
    currency: 'AUD',
    customerCode: 'KH007',
    note: 'Nạp tiền cho chiến dịch Google',
    accountId: '62',
    accountName: 'HDG TỔng 2869 47',
    isChecked: false
  }
];

export default function PaymentManagement() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const hotTableRef = useRef<HotTable>(null);

  // Sample data for different months
  const getMonthlyData = (month: string) => {
    const baseData = {
      "all": [
        { customer: "KH001", currency: "VND", opening: "520,850,000", bank: "85,000,000", used: "102,300,450", remaining: "418,549,550" },
        { customer: "KH001", currency: "USD", opening: "28,950.00", bank: "18,500.00", used: "4,280.00", remaining: "24,670.00" },
        { customer: "KH001", currency: "EUR", opening: "22,180.00", bank: "14,200.00", used: "3,150.00", remaining: "19,030.00" },
        { customer: "KH002", currency: "VND", opening: "745,600,000", bank: "220,000,000", used: "158,750,200", remaining: "586,849,800" },
        { customer: "KH002", currency: "USD", opening: "35,240.00", bank: "22,000.00", used: "6,850.00", remaining: "28,390.00" },
        { customer: "KH003", currency: "EUR", opening: "19,750.00", bank: "9,800.00", used: "2,650.00", remaining: "17,100.00" },
        { customer: "KH004", currency: "VND", opening: "380,950,000", bank: "95,000,000", used: "78,420,500", remaining: "302,529,500" },
        { customer: "KH005", currency: "USD", opening: "42,680.00", bank: "25,500.00", used: "8,920.00", remaining: "33,760.00" },
        { customer: "KH006", currency: "EUR", opening: "16,420.00", bank: "7,800.00", used: "1,950.00", remaining: "14,470.00" }
      ],
      "2025-01": [
        { customer: "KH001", currency: "VND", opening: "520,850,000", bank: "85,000,000", used: "102,300,450", remaining: "418,549,550" },
        { customer: "KH001", currency: "USD", opening: "28,950.00", bank: "18,500.00", used: "4,280.00", remaining: "24,670.00" },
        { customer: "KH002", currency: "VND", opening: "745,600,000", bank: "220,000,000", used: "158,750,200", remaining: "586,849,800" },
        { customer: "KH003", currency: "EUR", opening: "19,750.00", bank: "9,800.00", used: "2,650.00", remaining: "17,100.00" }
      ],
      "2024-12": [
        { customer: "KH001", currency: "VND", opening: "480,250,000", bank: "75,000,000", used: "95,680,200", remaining: "384,569,800" },
        { customer: "KH001", currency: "USD", opening: "26,430.00", bank: "16,000.00", used: "3,950.00", remaining: "22,480.00" },
        { customer: "KH002", currency: "VND", opening: "680,100,000", bank: "180,000,000", used: "142,350,500", remaining: "537,749,500" },
        { customer: "KH004", currency: "VND", opening: "350,800,000", bank: "80,000,000", used: "72,150,300", remaining: "278,649,700" }
      ],
      "2024-11": [
        { customer: "KH001", currency: "VND", opening: "445,680,000", bank: "65,000,000", used: "88,920,150", remaining: "356,759,850" },
        { customer: "KH002", currency: "USD", opening: "31,850.00", bank: "19,500.00", used: "5,420.00", remaining: "26,430.00" },
        { customer: "KH003", currency: "EUR", opening: "18,200.00", bank: "8,500.00", used: "2,100.00", remaining: "16,100.00" },
        { customer: "KH005", currency: "USD", opening: "38,920.00", bank: "22,000.00", used: "7,650.00", remaining: "31,270.00" }
      ],
      "2024-10": [
        { customer: "KH001", currency: "VND", opening: "410,320,000", bank: "60,000,000", used: "82,150,600", remaining: "328,169,400" },
        { customer: "KH002", currency: "EUR", opening: "25,680.00", bank: "15,000.00", used: "4,850.00", remaining: "20,830.00" },
        { customer: "KH004", currency: "VND", opening: "320,500,000", bank: "70,000,000", used: "65,280,400", remaining: "255,219,600" }
      ]
    };
    return baseData[month as keyof typeof baseData] || baseData.all;
  };

  const monthlyData = getMonthlyData(selectedMonth);

  // Calculate statistics
  const totalAmount = samplePaymentData.reduce((sum, payment) => sum + payment.amount, 0);
  const checkedCount = samplePaymentData.filter(payment => payment.isChecked).length;
  const uncheckedCount = samplePaymentData.length - checkedCount;

  // Handle transaction addition
  const handleAddTransaction = (transactionData: any, type: 'deposit' | 'refund') => {
    console.log('Adding transaction:', { type, data: transactionData });
    // Here you would typically make an API call to save the transaction
    // For now, we'll just log it to console
    alert(`Đã thêm giao dịch ${type === 'deposit' ? 'nạp tiền' : 'hoàn tiền'} thành công!`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Quản lý thanh toán
          </h1>
          <p className="text-muted-foreground mt-2">
            Theo dõi các giao dịch thanh toán từ khách hàng
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm giao dịch
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileCheck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng giao dịch</p>
                <p className="text-2xl font-bold">{samplePaymentData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-xs text-green-600">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Đã check</p>
                <p className="text-2xl font-bold text-green-600">{checkedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-xs text-yellow-600">⏳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chưa check</p>
                <p className="text-2xl font-bold text-yellow-600">{uncheckedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs text-blue-600">₫</span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng tiền</p>
                <p className="text-xl font-bold text-blue-600">{formatVND(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xs text-purple-600">💰</span>
            </div>
            <span>Báo cáo tài chính theo tháng</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Quản lý số dư và lịch sử giao dịch</p>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Báo cáo tài chính</h3>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Lọc theo:</label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="2025-01">Tháng 1/2025</option>
                  <option value="2024-12">Tháng 12/2024</option>
                  <option value="2024-11">Tháng 11/2024</option>
                  <option value="2024-10">Tháng 10/2024</option>
                  <option value="2024-09">Tháng 9/2024</option>
                  <option value="2024-08">Tháng 8/2024</option>
                  <option value="2024-07">Tháng 7/2024</option>
                  <option value="2024-06">Tháng 6/2024</option>
                  <option value="2024-05">Tháng 5/2024</option>
                  <option value="2024-04">Tháng 4/2024</option>
                  <option value="2024-03">Tháng 3/2024</option>
                  <option value="2024-02">Tháng 2/2024</option>
                  <option value="2024-01">Tháng 1/2024</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">MÃ KH</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">MÃ VÍ</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b">SỐ DƯ ĐẦU KỲ</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b">ĐÃ BANK</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b">ĐÃ SỬ DỤNG</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b">CÒN LẠI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyData.map((row, index) => {
                    const getCurrencyStyle = (currency: string) => {
                      const styles = {
                        'VND': 'bg-green-100 text-green-800',
                        'USD': 'bg-blue-100 text-blue-800',
                        'EUR': 'bg-purple-100 text-purple-800'
                      };
                      return styles[currency as keyof typeof styles] || 'bg-gray-100 text-gray-800';
                    };

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border-b">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {row.customer}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCurrencyStyle(row.currency)}`}>
                            {row.currency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm border-b">{row.opening}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-blue-600 border-b">{row.bank}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-red-600 border-b">{row.used}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-green-600 border-b font-semibold">{row.remaining}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileCheck className="h-5 w-5" />
              <span>Danh sách giao dịch thanh toán</span>
            </CardTitle>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="text-sm">
                Tổng: {samplePaymentData.length} giao dịch
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <HotTable
              data={samplePaymentData}
              columns={getPaymentColumnConfig()}
              height="700"
              width="100%"
              licenseKey="non-commercial-and-evaluation"
              manualColumnResize={true}
              manualRowResize={true}
              contextMenu={true}
              filters={true}
              dropdownMenu={true}
              colHeaders={true}
              rowHeaders={true}
              stretchH="all"
              className="htCore"
              afterChange={(changes: any[] | null, source: string) => {
                if (changes && source !== 'loadData') {
                  console.log('Payment data changed:', changes);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddTransaction={handleAddTransaction}
      />
    </div>
  );
}