import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, FileTextIcon, TrendingUpIcon } from 'lucide-react';
import { rawToUI } from '../../../packages/data-center/src/formatters';

// Server-side import for Handsontable
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

interface FinancialReportData {
  id: number;
  reconciliationLink: string;
  customerCode: string;
  customerCodes: string[]; // Support multiple customer codes
  openingBalance: number;
  totalSpend: number;
  fee: number;
  vat: number;
  totalSpendWithFee: number;
  bankPayments: number;
  remainingBalance: number;
  month: number;
  year: number;
}

// Sample data for demonstration - supports multiple customers per entry
const generateSampleData = (month: number, year: number): FinancialReportData[] => {
  const baseCustomerCodes = ['KH001', 'KH002', 'KH003', 'KH004', 'KH005'];
  const additionalCodes = ['KH006', 'KH007', 'KH008', 'KH009', 'KH010', 'KH011', 'KH012'];
  
  return baseCustomerCodes.map((code, index) => {
    // Some entries will have multiple customer codes
    const hasMultipleCustomers = Math.random() > 0.6; // 40% chance of multiple customers
    let customerCodes = [code];
    let displayCode = code;
    
    if (hasMultipleCustomers) {
      const additionalCount = Math.floor(Math.random() * 3) + 1; // 1-3 additional customers
      const additional = additionalCodes.slice(0, additionalCount);
      customerCodes = [code, ...additional];
      displayCode = customerCodes.join(', ');
    }
    
    const totalSpend = Math.random() * 80000000 + 15000000; // 15M - 95M VND (higher for multiple customers)
    
    // Mixed calculation based on various card types in accounts
    // Simulating aggregated data from multiple accounts with different card types
    const vatRate = 0.08 + Math.random() * 0.04; // 8-12% VAT (average across accounts)
    const feeRate = 0.025 + Math.random() * 0.025; // 2.5-5% fee rate (average across accounts)
    
    const fee = totalSpend * feeRate;
    const vat = totalSpend * vatRate;
    const totalCalculated = totalSpend + fee + vat;
    
    const bankPayments = totalCalculated * (0.6 + Math.random() * 0.4); // 60-100% paid
    const openingBalance = Math.random() * 8000000; // 0-8M VND opening balance
    
    return {
      id: index + 1,
      reconciliationLink: `/reconciliation/${code}`,
      customerCode: displayCode,
      customerCodes,
      openingBalance,
      totalSpend,
      fee,
      vat,
      totalSpendWithFee: totalCalculated,
      bankPayments,
      remainingBalance: openingBalance + bankPayments - totalCalculated,
      month,
      year
    };
  });
};

const FinancialReport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<Handsontable | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<FinancialReportData[]>([]);
  const { toast } = useToast();

  // Generate sample data when month/year changes
  useEffect(() => {
    const sampleData = generateSampleData(selectedMonth, selectedYear);
    setData(sampleData);
  }, [selectedMonth, selectedYear]);

  // Initialize Handsontable
  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    // Destroy existing instance
    if (hotRef.current) {
      hotRef.current.destroy();
    }

    // Create column configurations
    const columns = [
      {
        data: 'reconciliationLink',
        title: 'Link đối soát',
        width: 120,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = `<a href="${value}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">Xem đối soát</a>`;
          td.style.textAlign = 'center';
          return td;
        },
        readOnly: true
      },
      {
        data: 'customerCode',
        title: 'Mã KH',
        width: 150,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          const isMultiple = value.includes(',');
          if (isMultiple) {
            td.innerHTML = `<span class="font-semibold text-gray-800" title="${value}">${value}</span>`;
            td.style.fontSize = '12px';
          } else {
            td.innerHTML = `<span class="font-semibold text-gray-800">${value}</span>`;
          }
          td.style.textAlign = 'center';
          return td;
        },
        readOnly: true
      },
      {
        data: 'openingBalance',
        title: 'Số dư đầu kỳ',
        width: 120,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          return td;
        },
        readOnly: true
      },
      {
        data: 'totalSpend',
        title: 'Tổng Chạy',
        width: 120,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.fontWeight = 'bold';
          td.style.color = '#1e40af';
          return td;
        },
        readOnly: true
      },
      {
        data: 'fee',
        title: 'Phí',
        width: 100,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.color = '#dc2626';
          return td;
        },
        readOnly: true
      },
      {
        data: 'vat',
        title: 'VAT',
        width: 100,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.color = '#dc2626';
          return td;
        },
        readOnly: true
      },
      {
        data: 'totalSpendWithFee',
        title: 'Tổng CHẠY + PHÍ',
        width: 140,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.fontWeight = 'bold';
          td.style.backgroundColor = '#fef3c7';
          td.style.color = '#92400e';
          return td;
        },
        readOnly: true
      },
      {
        data: 'bankPayments',
        title: 'ĐÃ BANK',
        width: 120,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.color = '#059669';
          td.style.fontWeight = 'bold';
          return td;
        },
        readOnly: true
      },
      {
        data: 'remainingBalance',
        title: 'CÒN LẠI',
        width: 120,
        renderer: (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
          const isNegative = value < 0;
          td.innerHTML = rawToUI(value) + ' ₫';
          td.style.textAlign = 'right';
          td.style.fontFamily = 'monospace';
          td.style.fontWeight = 'bold';
          td.style.color = isNegative ? '#dc2626' : '#059669';
          if (isNegative) {
            td.style.backgroundColor = '#fee2e2';
          }
          return td;
        },
        readOnly: true
      }
    ];

    // Initialize Handsontable
    hotRef.current = new Handsontable(containerRef.current, {
      data: data,
      columns: columns,
      rowHeaders: true,
      colHeaders: true,
      contextMenu: false,
      manualRowResize: true,
      manualColumnResize: true,
      manualRowMove: false,
      manualColumnMove: false,
      stretchH: 'all',
      height: 'auto',
      maxRows: data.length,
      licenseKey: 'non-commercial-and-evaluation',
      className: 'financial-report-table',
      readOnly: true,
      filters: true,
      dropdownMenu: true,
      hiddenColumns: {
        indicators: true
      },
      afterLoadData: () => {
        if (hotRef.current) {
          hotRef.current.render();
        }
      }
    });

    // Cleanup function
    return () => {
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
      }
    };
  }, [data]);

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!data.length) return null;

    return {
      totalCustomers: data.length,
      totalSpend: data.reduce((sum, item) => sum + item.totalSpend, 0),
      totalFees: data.reduce((sum, item) => sum + item.fee, 0),
      totalVAT: data.reduce((sum, item) => sum + item.vat, 0),
      totalBankPayments: data.reduce((sum, item) => sum + item.bankPayments, 0),
      totalRemaining: data.reduce((sum, item) => sum + item.remainingBalance, 0),
    };
  }, [data]);

  const currentMonthYear = `${selectedMonth.toString().padStart(2, '0')}/${selectedYear}`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileTextIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Báo cáo Tài chính</h1>
            <p className="text-gray-600">Tổng hợp báo cáo tài chính chi tiết theo khách hàng</p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <CalendarIcon className="h-4 w-4 mr-2" />
          {currentMonthYear}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5" />
            <span>Bộ lọc thời gian</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tháng</label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tháng" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      Tháng {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Năm</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      Năm {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Tổng KH</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.totalCustomers}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Tổng Chạy</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{rawToUI(summaryStats.totalSpend)} ₫</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-gray-600">Tổng Phí</span>
              </div>
              <p className="text-xl font-bold text-red-600">{rawToUI(summaryStats.totalFees)} ₫</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-gray-600">Tổng VAT</span>
              </div>
              <p className="text-xl font-bold text-red-600">{rawToUI(summaryStats.totalVAT)} ₫</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-gray-600">Đã Bank</span>
              </div>
              <p className="text-xl font-bold text-green-600">{rawToUI(summaryStats.totalBankPayments)} ₫</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">Còn Lại</span>
              </div>
              <p className={`text-xl font-bold ${summaryStats.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {rawToUI(summaryStats.totalRemaining)} ₫
              </p>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Financial Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo chi tiết khách hàng - {currentMonthYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={containerRef} 
            className="w-full"
            style={{ 
              height: 'auto',
              minHeight: '400px'
            }}
          />
          
          {/* Calculation Rules Guide - Simple text below table */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-800">
              <div className="font-semibold mb-2">Quy tắc tính toán theo loại thẻ:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                <div><strong>THẺ KAG:</strong> Tổng chi tiêu + VAT + Phí</div>
                <div><strong>THẺ KHÁCH:</strong> Chỉ tính phí</div>
                <div><strong>THẺ MỐI:</strong> Tổng chi tiêu + VAT + Phí</div>
                <div><strong>THẺ NHIỀU BÊN:</strong> Tổng chi tiêu + VAT + Phí</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



      <style>{`
        .financial-report-table .htCore {
          font-size: 13px;
        }
        .financial-report-table .ht_clone_top .htCore thead th {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-bottom: 2px solid #cbd5e0;
          font-weight: 600;
          color: #2d3748;
        }
        .financial-report-table .htCore tbody td {
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #f1f5f9;
        }
        .financial-report-table .htCore tbody tr:hover td {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
};

export default FinancialReport;