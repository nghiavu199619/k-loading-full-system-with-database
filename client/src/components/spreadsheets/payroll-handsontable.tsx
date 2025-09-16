import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

interface PayrollHandsontableProps {
  selectedMonth: number;
  selectedYear: number;
}

const mockSalaryData = [
  {
    id: 1,
    name: "Phạm Quân Lý",
    position: "Quản Lý",
    workDays: 25,
    basicSalary: 15000000,
    productionSalary: 15000000,
    bonusRevenue: 0,
    bonusService: 0,
    allowance: 0,
    penalty: 0,
    advance: 2000000,
    actualReceived: 0,
    totalSalary: 28000000,
    managementBonus: 6435000,
    finalTotal: 9300000
  },
  {
    id: 2,
    name: "Vũ Thị Ngân",
    position: "Quản Lý CSS Team",
    workDays: 25,
    basicSalary: 5000000,
    productionSalary: 5000000,
    bonusRevenue: 0,
    bonusService: 0,
    allowance: 0,
    penalty: 0,
    advance: 0,
    actualReceived: 0,
    totalSalary: 10000000,
    managementBonus: 5000000,
    finalTotal: 5000000
  },
  {
    id: 3,
    name: "Lương Thu Trang",
    position: "MKT",
    workDays: 25,
    basicSalary: 4500000,
    productionSalary: 4500000,
    bonusRevenue: 0,
    bonusService: 0,
    allowance: 0,
    penalty: 0,
    advance: 0,
    actualReceived: 0,
    totalSalary: 9000000,
    managementBonus: 4500000,
    finalTotal: 4500000
  },
  {
    id: 4,
    name: "Phạm Việt Luân",
    position: "Ads Team",
    workDays: 25,
    basicSalary: 4500000,
    productionSalary: 4500000,
    bonusRevenue: 0,
    bonusService: 0,
    allowance: 0,
    penalty: 0,
    advance: 0,
    actualReceived: 0,
    totalSalary: 9000000,
    managementBonus: 4500000,
    finalTotal: 4500000
  },
  {
    id: 5,
    name: "Lương Thành Đạt",
    position: "MKT",
    workDays: 25,
    basicSalary: 4500000,
    productionSalary: 4500000,
    bonusRevenue: 600000,
    bonusService: 1200000,
    allowance: 0,
    penalty: 0,
    advance: 2000000,
    actualReceived: 0,
    totalSalary: 8800000,
    managementBonus: 6400000,
    finalTotal: 6400000
  }
];

const mockBonusData = [
  { name: "LÝ NGỌC ANH", percentage: 7, bonus: 3227982 },
  { name: "NGUYỄN THỊ VÂN ANH", percentage: 7, bonus: 3227982 },
  { name: "LƯƠNG THÀNH ĐẠT", percentage: 50, bonus: 23057015 },
  { name: "LƯƠNG THU TRANG", percentage: 36, bonus: 16601051 }
];

const mockAgcSalaryData = [
  {
    id: 1,
    employeeName: "Nguyễn Văn A",
    employeeCode: "NV001",
    clientName: "Khách hàng ABC",
    clientRevenue: 5000000,
    bonusPercentage: 3,
    agcSalary: 150000
  },
  {
    id: 2,
    employeeName: "Trần Thị B",
    employeeCode: "NV002",
    clientName: "Khách hàng XYZ",
    clientRevenue: 8000000,
    bonusPercentage: 2.5,
    agcSalary: 200000
  },
  {
    id: 3,
    employeeName: "Phạm Văn C",
    employeeCode: "NV003",
    clientName: "Khách hàng DEF",
    clientRevenue: 12000000,
    bonusPercentage: 2,
    agcSalary: 240000
  },
  {
    id: 4,
    employeeName: "Lê Thị D",
    employeeCode: "NV004",
    clientName: "Khách hàng GHI",
    clientRevenue: 6500000,
    bonusPercentage: 2.8,
    agcSalary: 182000
  },
  {
    id: 5,
    employeeName: "Hoàng Văn E",
    employeeCode: "NV005",
    clientName: "Khách hàng JKL",
    clientRevenue: 4200000,
    bonusPercentage: 3.5,
    agcSalary: 147000
  }
];

export function PayrollHandsontable({ selectedMonth, selectedYear }: PayrollHandsontableProps) {
  const salaryHotRef = useRef<Handsontable | null>(null);
  const salaryContainerRef = useRef<HTMLDivElement>(null);
  const bonusHotRef = useRef<Handsontable | null>(null);
  const bonusContainerRef = useRef<HTMLDivElement>(null);
  const agcHotRef = useRef<Handsontable | null>(null);
  const agcContainerRef = useRef<HTMLDivElement>(null);
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState("salary-summary");
  
  // Use useRef to track which tables have been initialized (persists across re-renders)
  const initializedTables = useRef<Set<string>>(new Set());
  
  // Debug logging
  console.log('🔍 PayrollHandsontable render - activeTab:', activeTab);
  console.log('📊 Mock salary data length:', mockSalaryData?.length);
  console.log('📊 Mock bonus data length:', mockBonusData?.length);
  console.log('📊 Mock AGC data length:', mockAgcSalaryData?.length);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  // Initialize specific table when its tab becomes active
  const initializeSalaryTable = () => {
    if (!salaryContainerRef.current || salaryHotRef.current) return;

    console.log('💰 Initializing Salary table...');
    const salaryColumns = [
      { data: 'stt', title: 'STT', width: 40, readOnly: true },
      { data: 'name', title: 'Họ và tên', width: 120, readOnly: true },
      { data: 'position', title: 'Chức vụ', width: 100, readOnly: true },
      { data: 'workDays', title: 'Ngày công', width: 80, type: 'numeric' },
      { data: 'basicSalary', title: 'Lương cơ bản', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'productionSalary', title: 'Lương sản xuất', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'bonusRevenue', title: 'Thưởng DT', width: 100, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'bonusService', title: 'Thưởng DV', width: 100, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'allowance', title: 'Phụ cấp', width: 100, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'penalty', title: 'Phạt', width: 80, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'advance', title: 'Tạm ứng', width: 100, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'totalSalary', title: 'Tổng lương', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true },
      { data: 'managementBonus', title: 'Thưởng QL', width: 100, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'finalTotal', title: 'Thực nhận', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true }
    ];

    const salaryData = mockSalaryData.map((emp, index) => ({
      ...emp,
      stt: index + 1
    }));

    try {
      salaryHotRef.current = new Handsontable(salaryContainerRef.current, {
        data: salaryData,
        columns: salaryColumns,
        colHeaders: ['STT', 'Họ và tên', 'Chức vụ', 'Ngày công', 'Lương cơ bản', 'Lương sản xuất', 'Thưởng DT', 'Thưởng DV', 'Phụ cấp', 'Phạt', 'Tạm ứng', 'Tổng lương', 'Thưởng QL', 'Thực nhận'],
        rowHeaders: false,
        height: 300,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all',
        columnSorting: true,
        contextMenu: ['copy', 'cut'],
        manualColumnResize: true,
        manualRowResize: false,
        fixedColumnsStart: 3,
        className: 'handsontable-payroll'
      });
      initializedTables.current.add('salary');
      console.log('✅ Salary Handsontable initialized!');
    } catch (error) {
      console.error('❌ Salary Handsontable failed:', error);
    }
  };

  const initializeBonusTable = () => {
    if (!bonusContainerRef.current) {
      console.error('❌ BONUS: Container ref not available');
      return;
    }
    
    if (bonusHotRef.current) {
      console.log('⚠️ BONUS: Table already exists, skipping');
      return;
    }

    console.log('🎁 BONUS: Starting initialization...');
    const bonusColumns = [
      { data: 'stt', title: 'STT', width: 40, readOnly: true },
      { data: 'name', title: 'Tên nhân viên', width: 150, readOnly: true },
      { data: 'percentage', title: '% Thưởng', width: 80, type: 'numeric' },
      { data: 'bonus', title: 'Tiền thưởng', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' } }
    ];

    const bonusData = mockBonusData.map((emp, index) => ({
      ...emp,
      stt: index + 1
    }));
    
    console.log('🎁 BONUS: Data prepared, columns:', bonusColumns.length, 'rows:', bonusData.length);

    try {
      bonusHotRef.current = new Handsontable(bonusContainerRef.current, {
        data: bonusData,
        columns: bonusColumns,
        colHeaders: ['STT', 'Tên nhân viên', '% Thưởng', 'Tiền thưởng'],
        rowHeaders: false,
        height: 200,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all',
        columnSorting: true,
        contextMenu: ['copy', 'cut'],
        manualColumnResize: true,
        manualRowResize: false,
        className: 'handsontable-bonus'
      });
      initializedTables.current.add('bonus');
      console.log('✅ BONUS: Handsontable initialized successfully!');
      
      // Force render after a small delay
      setTimeout(() => {
        if (bonusHotRef.current) {
          bonusHotRef.current.render();
          console.log('🔄 BONUS: Force rendered');
        }
      }, 100);
    } catch (error) {
      console.error('❌ BONUS: Handsontable initialization failed:', error);
    }
  };

  const initializeAgcTable = () => {
    if (!agcContainerRef.current) {
      console.error('❌ AGC: Container ref not available');
      return;
    }
    
    if (agcHotRef.current) {
      console.log('⚠️ AGC: Table already exists, skipping');
      return;
    }

    console.log('🏢 AGC: Starting initialization...');
    const agcColumns = [
      { data: 'stt', title: 'STT', width: 50, readOnly: true },
      { data: 'employeeName', title: 'Nhân viên', width: 120, readOnly: false },
      { data: 'employeeCode', title: 'Mã NV', width: 80, readOnly: false },
      { data: 'clientName', title: 'Khách hàng', width: 150, readOnly: false },
      { data: 'clientRevenue', title: 'Doanh thu KH', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' } },
      { data: 'bonusPercentage', title: 'Tỷ lệ %', width: 80, type: 'numeric', numericFormat: { pattern: '0.0' } },
      { data: 'agcSalary', title: 'Lương DV AGC', width: 120, type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true }
    ];

    const agcData = mockAgcSalaryData.map((emp, index) => ({
      ...emp,
      stt: index + 1
    }));
    
    console.log('🏢 AGC: Data prepared, columns:', agcColumns.length, 'rows:', agcData.length);

    try {
      agcHotRef.current = new Handsontable(agcContainerRef.current, {
        data: agcData,
        columns: agcColumns,
        colHeaders: ['STT', 'Nhân viên', 'Mã NV', 'Khách hàng', 'Doanh thu KH', 'Tỷ lệ %', 'Lương DV AGC'],
        rowHeaders: false,
        height: 250,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all',
        columnSorting: true,
        contextMenu: ['copy', 'cut'],
        manualColumnResize: true,
        manualRowResize: false,
        className: 'handsontable-agc',
        afterChange: function(changes: any, source: string) {
          if (changes && source !== 'loadData' && source !== 'calculation') {
            const hotInstance = agcHotRef.current;
            if (hotInstance) {
              changes.forEach(([row, prop, oldVal, newVal]: [number, string, any, any]) => {
                if (prop === 'clientRevenue' || prop === 'bonusPercentage') {
                  const revenue = hotInstance.getDataAtCell(row, 4) || 0;
                  const percentage = hotInstance.getDataAtCell(row, 5) || 0;
                  const calculatedSalary = Math.round((revenue * percentage) / 100);
                  hotInstance.setDataAtCell(row, 6, calculatedSalary, 'calculation');
                }
              });
            }
          }
        }
      });
      initializedTables.current.add('agc');
      console.log('✅ AGC: Handsontable initialized successfully!');
      
      // Force render after a small delay
      setTimeout(() => {
        if (agcHotRef.current) {
          agcHotRef.current.render();
          console.log('🔄 AGC: Force rendered');
        }
      }, 100);
    } catch (error) {
      console.error('❌ AGC: Handsontable initialization failed:', error);
    }
  };

  // Lazy initialization when tab becomes active + persistent tables
  useEffect(() => {
    console.log(`🎯 LAZY INIT: Tab ${activeTab} became active`);
    
    const timer = setTimeout(() => {
      switch (activeTab) {
        case 'salary-summary':
          if (!initializedTables.current.has('salary') && salaryContainerRef.current) {
            console.log('💰 LAZY: Initializing Salary table when needed...');
            initializeSalaryTable();
          } else if (salaryHotRef.current) {
            console.log('🔄 LAZY: Re-rendering existing Salary table');
            salaryHotRef.current.render();
          }
          break;
          
        case 'revenue-bonus':
          if (!initializedTables.current.has('bonus') && bonusContainerRef.current) {
            console.log('🎁 LAZY: Initializing Bonus table when needed...');
            initializeBonusTable();
          } else if (bonusHotRef.current) {
            console.log('🔄 LAZY: Re-rendering existing Bonus table');
            bonusHotRef.current.render();
          }
          break;
          
        case 'agc-salary':
          if (!initializedTables.current.has('agc') && agcContainerRef.current) {
            console.log('🏢 LAZY: Initializing AGC table when needed...');
            initializeAgcTable();
          } else if (agcHotRef.current) {
            console.log('🔄 LAZY: Re-rendering existing AGC table');
            agcHotRef.current.render();
          }
          break;
      }
    }, 100); // Small delay to ensure DOM is fully rendered

    return () => clearTimeout(timer);
  }, [activeTab]); // Re-run when tab changes

  // Re-initialize all tables when month/year changes
  useEffect(() => {
    console.log('📅 Month/Year changed, clearing all tables for re-initialization');
    
    // Clean up existing tables
    if (salaryHotRef.current) {
      console.log('🗑️ Destroying existing Salary table');
      salaryHotRef.current.destroy();
      salaryHotRef.current = null;
    }
    if (bonusHotRef.current) {
      console.log('🗑️ Destroying existing Bonus table');
      bonusHotRef.current.destroy();
      bonusHotRef.current = null;
    }
    if (agcHotRef.current) {
      console.log('🗑️ Destroying existing AGC table');
      agcHotRef.current.destroy();
      agcHotRef.current = null;
    }
    
    // Reset initialization tracking
    initializedTables.current.clear();
    console.log('✅ All tables cleared, ready for lazy re-initialization');
  }, [selectedMonth, selectedYear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (salaryHotRef.current) {
        salaryHotRef.current.destroy();
        salaryHotRef.current = null;
      }
      if (bonusHotRef.current) {
        bonusHotRef.current.destroy();
        bonusHotRef.current = null;
      }
      if (agcHotRef.current) {
        agcHotRef.current.destroy();
        agcHotRef.current = null;
      }
    };
  }, []);


  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => {
        console.log('🔄 Tab changed from', activeTab, 'to', value);
        setActiveTab(value);
      }} className="w-full">
        <TabsList className="grid grid-cols-3 lg:w-full">
          <TabsTrigger value="salary-summary">Tổng hợp lương</TabsTrigger>
          <TabsTrigger value="revenue-bonus">Thưởng DT</TabsTrigger>
          <TabsTrigger value="agc-salary">Lương DV AGC</TabsTrigger>
        </TabsList>

        {/* Salary Summary Tab */}
        <TabsContent value="salary-summary">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>LƯƠNG NHÂN VIÊN</CardTitle>
              <CardDescription>Bảng tính lương chi tiết</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={salaryContainerRef} style={{ minHeight: '300px', width: '100%' }} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Bonus Tab */}
        <TabsContent value="revenue-bonus">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>THƯỞNG DOANH THU FB</CardTitle>
              <CardDescription>Tính thưởng theo doanh thu Facebook Ads</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Tổng doanh thu</p>
                  <p className="text-xl font-bold text-blue-900">10,850M VNĐ</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Chi phí ước tính</p>
                  <p className="text-xl font-bold text-red-900">1,628M VNĐ</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Doanh thu thực</p>
                  <p className="text-xl font-bold text-green-900">9,223M VNĐ</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Tổng thưởng</p>
                  <p className="text-xl font-bold text-purple-900">46M VNĐ</p>
                </div>
              </div>
              
              <div ref={bonusContainerRef} style={{ minHeight: '200px', width: '100%' }} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AGC Salary Tab */}
        <TabsContent value="agc-salary">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>LƯƠNG DỊCH VỤ AGC</CardTitle>
              <CardDescription>Bảng tính lương dịch vụ AGC chi tiết</CardDescription>
            </CardHeader>
            <CardContent>
              {/* AGC Stats Card */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Tổng lương DV AGC tháng {selectedMonth}</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(mockAgcSalaryData.reduce((sum, emp) => sum + emp.agcSalary, 0))} VNĐ
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Số nhân viên: {mockAgcSalaryData.length}</p>
                    <p className="text-sm text-gray-600">Tỷ lệ trung bình: {(mockAgcSalaryData.reduce((sum, emp) => sum + emp.bonusPercentage, 0) / mockAgcSalaryData.length).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              
              <div ref={agcContainerRef} style={{ minHeight: '250px', width: '100%' }} />
              
              {/* AGC Notes */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Ghi chú:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Lương DV AGC được tính theo tỷ lệ % trên doanh thu khách hàng</li>
                  <li>• Doanh thu và tỷ lệ có thể chỉnh sửa trực tiếp trên bảng</li>
                  <li>• Lương sẽ tự động tính toán lại khi thay đổi doanh thu hoặc tỷ lệ</li>
                  <li>• Số liệu được cập nhật theo tháng/năm đã chọn</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}