import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

interface AttendanceHandsontableProps {
  selectedMonth: number;
  selectedYear: number;
}

interface Employee {
  id: number;
  name: string;
  department: string;
  status: string;
}

const mockEmployees: Employee[] = [
  { id: 1, name: "Lý Ngọc Anh", department: "Kế Toán", status: "active" },
  { id: 2, name: "BÙI LÊ HOÀI", department: "Kế Toán", status: "active" },
  { id: 3, name: "Mẫu Vàng", department: "LAM ONL", status: "leave" },
  { id: 4, name: "Màu Đỏ", department: "Nghỉ Cá Nhân", status: "leave" },
  { id: 5, name: "Màu Xanh", department: "Nghỉ Phép", status: "leave" },
  { id: 6, name: "Phạm Quân Lý", department: "Quản Lý", status: "active" },
  { id: 7, name: "Vũ Thị Ngân", department: "Quản Lý CSS Team", status: "active" },
  { id: 8, name: "Lương Thu Trang", department: "MKT", status: "active" },
  { id: 9, name: "Phạm Việt Luân", department: "Ads Team", status: "active" },
  { id: 10, name: "Lương Thành Đạt", department: "MKT", status: "active" }
];

// Generate dynamic attendance data based on month/year
const generateAttendanceData = (month: number, year: number, daysInMonth: number): Record<number, Record<number, string | number>> => {
  const attendance: Record<number, Record<number, string | number>> = {};
  
  // Create different patterns for each employee based on month
  mockEmployees.forEach((employee, empIndex) => {
    const employeeId = employee.id;
    attendance[employeeId] = {};
    
    // Use employee ID and month as seed for consistent but different patterns
    const seed = employeeId * 100 + month;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      // Special patterns for different employee statuses
      if (employee.status === 'leave') {
        // Employees on leave have special patterns
        if (employee.name.includes('Mẫu Vàng')) {
          attendance[employeeId][day] = 'ONL'; // Online work
        } else if (employee.name.includes('Màu Đỏ')) {
          attendance[employeeId][day] = 'CN'; // Personal leave
        } else if (employee.name.includes('Màu Xanh')) {
          attendance[employeeId][day] = 'P'; // Vacation
        } else {
          attendance[employeeId][day] = 'CN';
        }
      } else {
        // Active employees with varied attendance patterns
        if (isWeekend) {
          attendance[employeeId][day] = ''; // Weekends are usually empty
        } else {
          // Create realistic attendance patterns with some variation
          const randomFactor = (seed + day * 7) % 100;
          
          if (randomFactor < 85) {
            attendance[employeeId][day] = 1; // Present (85% chance)
          } else if (randomFactor < 90) {
            attendance[employeeId][day] = 0; // Absent (5% chance)
          } else if (randomFactor < 95) {
            attendance[employeeId][day] = 'ONL'; // Online (5% chance)
          } else {
            attendance[employeeId][day] = 'P'; // Vacation (5% chance)
          }
          
          // Some employees have different patterns in different months
          if (month === 1 || month === 12) { // Holiday months
            if (randomFactor > 80 && randomFactor < 90) {
              attendance[employeeId][day] = 'P'; // More vacation in holiday months
            }
          }
          
          if (month === 7 || month === 8) { // Summer months
            if (empIndex % 3 === 0 && randomFactor > 75 && randomFactor < 85) {
              attendance[employeeId][day] = 'ONL'; // More online work in summer
            }
          }
        }
      }
    }
  });
  
  return attendance;
};

export function AttendanceHandsontable({ selectedMonth, selectedYear }: AttendanceHandsontableProps) {
  const hotRef = useRef<Handsontable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create cell renderer function
  const createCellRenderer = (day: string) => {
    return (instance: any, td: any, row: any, col: any, prop: any, value: any) => {
      const date = new Date(selectedYear, selectedMonth - 1, parseInt(day));
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      td.innerHTML = value || '-';
      td.className = 'htMiddle htCenter text-xs';
      
      if (isWeekend) {
        td.style.backgroundColor = '#f3f4f6';
        td.style.color = '#9ca3af';
        td.innerHTML = 'CN';
      } else if (value === 1) {
        td.style.backgroundColor = '#dcfce7';
        td.style.color = '#166534';
        td.style.fontWeight = 'bold';
      } else if (value === 0) {
        td.style.backgroundColor = '#fee2e2';
        td.style.color = '#dc2626';
        td.style.fontWeight = 'bold';
      } else if (value === 'ONL') {
        td.style.backgroundColor = '#fef3c7';
        td.style.color = '#d97706';
        td.style.fontWeight = 'bold';
      } else if (value === 'CN') {
        td.style.backgroundColor = '#fed7aa';
        td.style.color = '#ea580c';
        td.style.fontWeight = 'bold';
      } else if (value === 'P') {
        td.style.backgroundColor = '#bfdbfe';
        td.style.color = '#2563eb';
        td.style.fontWeight = 'bold';
      }
      
      return td;
    };
  };

  // Initialize or update table
  const initializeTable = () => {
    console.log(`📅 Initializing attendance table for ${selectedMonth}/${selectedYear}`);
    
    // Clean up existing table
    if (hotRef.current) {
      hotRef.current.destroy();
      hotRef.current = null;
    }

    if (!containerRef.current) return;

    // Get days in month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    console.log(`📊 Days in month ${selectedMonth}: ${daysInMonth}`);
    
    // Generate dynamic attendance data for the selected month/year
    const dynamicAttendanceData = generateAttendanceData(selectedMonth, selectedYear, daysInMonth);
    console.log(`📅 Generated attendance data for ${selectedMonth}/${selectedYear}:`, Object.keys(dynamicAttendanceData).length, 'employees');
    
    // Create headers
    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const dayNameHeaders = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(selectedYear, selectedMonth - 1, i + 1);
      return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
    });

    const columns = [
      { data: 'stt', title: 'STT', width: 50, readOnly: true },
      { data: 'name', title: 'Họ và tên', width: 120, readOnly: true },
      { data: 'department', title: 'Bộ phận', width: 100, readOnly: true },
      ...dayHeaders.map((day) => ({
        data: `day_${day}`,
        title: day,
        width: 40,
        renderer: createCellRenderer(day)
      }))
    ];

    // Prepare data using dynamic attendance data
    const data = mockEmployees.map((employee, index) => {
      const attendance = dynamicAttendanceData[employee.id] || {};
      const row: any = {
        stt: index + 1,
        name: employee.name,
        department: employee.department
      };
      
      for (let day = 1; day <= daysInMonth; day++) {
        row[`day_${day}`] = attendance[day] || '';
      }
      
      return row;
    });

    console.log('📊 Attendance data prepared:', data.length, 'employees');
    console.log('🏗️ Columns configured:', columns.length, 'columns');
    console.log('🔍 DEBUG - First data row:', JSON.stringify(data[0], null, 2));
    console.log('🔍 DEBUG - dayHeaders:', dayHeaders.slice(0, 5), '...', dayHeaders.slice(-5));
    console.log('🔍 DEBUG - dayNameHeaders:', dayNameHeaders.slice(0, 5), '...', dayNameHeaders.slice(-5));
    console.log('🔍 DEBUG - Sample columns:', columns.slice(0, 5));

    try {
      hotRef.current = new Handsontable(containerRef.current, {
        data,
        columns,
        colHeaders: ['STT', 'Họ và tên', 'Bộ phận', ...dayHeaders],
        nestedHeaders: [
          ['STT', 'Họ và tên', 'Bộ phận', ...dayNameHeaders]
        ],
        rowHeaders: false,
        height: 400,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'none',
        width: '100%',
        viewportColumnRenderingOffset: 50,
        viewportRowRenderingOffset: 100,
        columnSorting: false,
        contextMenu: false,
        manualColumnResize: true,
        manualRowResize: false,
        fixedColumnsStart: 3,
        className: 'handsontable-attendance'
      });
      
      console.log('✅ Attendance Handsontable initialized successfully!');
      console.log('🔍 DEBUG - Table columns after init:', hotRef.current.countCols());
      console.log('🔍 DEBUG - Table rows after init:', hotRef.current.countRows());
      
      // Force render after initialization
      setTimeout(() => {
        if (hotRef.current) {
          hotRef.current.render();
          console.log('🔄 Force rendered attendance table');
        }
      }, 200);
    } catch (error) {
      console.error('❌ Failed to initialize attendance table:', error);
    }
  };

  // Single useEffect to handle initialization and updates
  useEffect(() => {
    console.log(`🔄 Attendance table useEffect triggered: ${selectedMonth}/${selectedYear}`);
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeTable, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, [selectedMonth, selectedYear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
      }
    };
  }, []);

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Bảng chấm công tháng {selectedMonth}/{selectedYear}</CardTitle>
        <CardDescription>
          Dữ liệu chấm công chi tiết cho tháng {selectedMonth}/{selectedYear} 
          ({new Date(selectedYear, selectedMonth, 0).getDate()} ngày)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} />
        
        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded flex items-center justify-center">
              <span className="text-green-800 text-xs font-bold">1</span>
            </div>
            <span>Có mặt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded flex items-center justify-center">
              <span className="text-red-800 text-xs font-bold">0</span>
            </div>
            <span>Vắng mặt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded flex items-center justify-center">
              <span className="text-yellow-800 text-xs font-bold">ONL</span>
            </div>
            <span>Làm online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-200 border border-orange-400 rounded flex items-center justify-center">
              <span className="text-orange-800 text-xs font-bold">CN</span>
            </div>
            <span>Nghỉ cá nhân</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded flex items-center justify-center">
              <span className="text-blue-800 text-xs font-bold">P</span>
            </div>
            <span>Nghỉ phép</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
              <span className="text-gray-400 text-xs">CN</span>
            </div>
            <span>Chủ nhật</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}