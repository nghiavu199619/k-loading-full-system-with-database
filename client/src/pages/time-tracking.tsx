import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  Users, 
  Calculator, 
  FileText, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  UserCheck,
  PlayCircle,
  StopCircle,
  CheckCircle,
  XCircle,
  Edit
} from "lucide-react";
import { AttendanceHandsontable } from "@/components/spreadsheets/attendance-handsontable";
import { PayrollHandsontable } from "@/components/spreadsheets/payroll-handsontable";

// Mock data mẫu
const mockEmployees = [
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

const mockAttendance = {
  1: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  2: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  3: { 1: "ONL", 2: "ONL", 3: "ONL", 4: "ONL", 5: "ONL", 6: "ONL", 7: "ONL", 8: "ONL", 9: "ONL", 10: "ONL", 11: "ONL", 12: "ONL", 13: "ONL", 14: "ONL", 15: "ONL", 16: "ONL", 17: "ONL", 18: "ONL", 19: "ONL", 20: "ONL" },
  4: { 1: "CN", 2: "CN", 3: "CN", 4: "CN", 5: "CN", 6: "CN", 7: "CN", 8: "CN", 9: "CN", 10: "CN", 11: "CN", 12: "CN", 13: "CN", 14: "CN", 15: "CN", 16: "CN", 17: "CN", 18: "CN", 19: "CN", 20: "CN" },
  5: { 1: "P", 2: "P", 3: "P", 4: "P", 5: "P", 6: "P", 7: "P", 8: "P", 9: "P", 10: "P", 11: "P", 12: "P", 13: "P", 14: "P", 15: "P", 16: "P", 17: "P", 18: "P", 19: "P", 20: "P" },
  6: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  7: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  8: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  9: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 },
  10: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1 }
};

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

const mockBonusData = {
  totalRevenue: 10850360118,
  estimatedCost: 1627554018,
  actualRevenue: 9222806100,
  bonusPool: 46114031,
  employees: [
    { name: "LÝ NGỌC ANH", percentage: 7, bonus: 3227982 },
    { name: "NGUYỄN THỊ VÂN ANH", percentage: 7, bonus: 3227982 },
    { name: "LƯƠNG THÀNH ĐẠT", percentage: 50, bonus: 23057015 },
    { name: "LƯƠNG THU TRANG", percentage: 36, bonus: 16601051 }
  ]
};

const mockLeaveRequests = [
  {
    id: 1,
    employeeName: "Nguyễn Văn A",
    department: "Marketing",
    leaveType: "Nghỉ phép năm",
    startDate: "2025-08-10",
    endDate: "2025-08-12",
    days: 3,
    reason: "Nghỉ phép cá nhân",
    status: "pending",
    submittedAt: "2025-08-08"
  },
  {
    id: 2,
    employeeName: "Trần Thị B",
    department: "Kế toán",
    leaveType: "Nghỉ ốm",
    startDate: "2025-08-09",
    endDate: "2025-08-09",
    days: 1,
    reason: "Ốm",
    status: "approved",
    submittedAt: "2025-08-08",
    approvedBy: "Quản lý",
    approvedAt: "2025-08-08"
  },
  {
    id: 3,
    employeeName: "Phạm Văn C",
    department: "IT",
    leaveType: "Nghỉ việc riêng",
    startDate: "2025-08-15",
    endDate: "2025-08-16",
    days: 2,
    reason: "Có việc gia đình",
    status: "rejected",
    submittedAt: "2025-08-07",
    rejectedBy: "Quản lý",
    rejectedAt: "2025-08-07",
    rejectionReason: "Trùng lịch họp quan trọng"
  }
];

// Main Time Tracking Component
export default function TimeTracking() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(8);
  const [selectedYear, setSelectedYear] = useState(2025);

  // Mock current time for demonstration
  const currentTime = new Date().toLocaleTimeString('vi-VN');
  const currentDate = new Date().toLocaleDateString('vi-VN');

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 via-white to-sky-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />
              Hệ thống Chấm công & Tính lương
            </h1>
            <p className="text-gray-600 mt-1">Quản lý thời gian làm việc và tính toán lương tự động</p>
          </div>
          
          {/* Month/Year Filter & Quick Clock In/Out */}
          <div className="flex items-center gap-6">
            {/* Month/Year Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Tháng/Năm:</span>
              </div>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tháng 1</SelectItem>
                  <SelectItem value="2">Tháng 2</SelectItem>
                  <SelectItem value="3">Tháng 3</SelectItem>
                  <SelectItem value="4">Tháng 4</SelectItem>
                  <SelectItem value="5">Tháng 5</SelectItem>
                  <SelectItem value="6">Tháng 6</SelectItem>
                  <SelectItem value="7">Tháng 7</SelectItem>
                  <SelectItem value="8">Tháng 8</SelectItem>
                  <SelectItem value="9">Tháng 9</SelectItem>
                  <SelectItem value="10">Tháng 10</SelectItem>
                  <SelectItem value="11">Tháng 11</SelectItem>
                  <SelectItem value="12">Tháng 12</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-gray-900">{currentTime}</div>
              <div className="text-sm text-gray-600">{currentDate}</div>
            </div>
            <Button 
              onClick={() => setIsClockingIn(!isClockingIn)}
              className={`flex items-center gap-2 px-6 py-3 ${
                isClockingIn 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isClockingIn ? (
                <>
                  <StopCircle className="h-5 w-5" />
                  Chấm công ra
                </>
              ) : (
                <>
                  <PlayCircle className="h-5 w-5" />
                  Chấm công vào
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 lg:w-full">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="attendance">Chấm công</TabsTrigger>
            <TabsTrigger value="payroll">Tính lương</TabsTrigger>
            <TabsTrigger value="leave">Xin nghỉ</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng nhân viên</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockEmployees.length}</div>
                    <p className="text-xs text-muted-foreground">Nhân viên</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Đang làm việc</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{mockEmployees.filter(e => e.status === 'active').length}</div>
                    <p className="text-xs text-muted-foreground">Nhân viên</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng lương tháng</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(mockSalaryData.reduce((sum, emp) => sum + emp.finalTotal, 0) / 1000000).toFixed(1)}M</div>
                    <p className="text-xs text-muted-foreground">VNĐ</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Đơn xin nghỉ</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockLeaveRequests.filter(r => r.status === 'pending').length}</div>
                    <p className="text-xs text-muted-foreground">Chờ duyệt</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Attendance */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Chấm công gần đây</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nhân viên</TableHead>
                          <TableHead>Bộ phận</TableHead>
                          <TableHead>Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockEmployees.slice(0, 5).map(emp => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.department}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={emp.status === 'active' ? 'default' : 'secondary'}
                                className={emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                              >
                                {emp.status === 'active' ? 'Đang làm' : 'Nghỉ'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Salary Summary */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Tóm tắt lương tháng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nhân viên</TableHead>
                          <TableHead>Chức vụ</TableHead>
                          <TableHead className="text-right">Tổng lương</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockSalaryData.slice(0, 5).map(emp => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell className="text-right font-bold">
                              {(emp.finalTotal / 1000000).toFixed(1)}M
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <AttendanceHandsontable 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear} 
            />
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll">
            <PayrollHandsontable 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear} 
            />
          </TabsContent>


          {/* Leave Tab */}
          <TabsContent value="leave">
            <div className="space-y-6">
              {/* Create Leave Request */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Tạo đơn xin nghỉ</CardTitle>
                  <CardDescription>Gửi yêu cầu nghỉ phép</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Loại nghỉ</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn loại nghỉ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Nghỉ phép năm</SelectItem>
                          <SelectItem value="sick">Nghỉ ốm</SelectItem>
                          <SelectItem value="personal">Nghỉ việc riêng</SelectItem>
                          <SelectItem value="maternity">Nghỉ thai sản</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Số ngày nghỉ</label>
                      <Input type="number" placeholder="Nhập số ngày" min="1" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Từ ngày</label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Đến ngày</label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Lý do nghỉ</label>
                      <textarea 
                        className="w-full p-2 border border-gray-300 rounded-md resize-none h-20"
                        placeholder="Nhập lý do xin nghỉ..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Gửi đơn xin nghỉ
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Leave Requests List */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Danh sách đơn xin nghỉ</CardTitle>
                  <CardDescription>Quản lý và duyệt đơn xin nghỉ</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Bộ phận</TableHead>
                        <TableHead>Loại nghỉ</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Số ngày</TableHead>
                        <TableHead>Lý do</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockLeaveRequests.map(request => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.employeeName}</TableCell>
                          <TableCell>{request.department}</TableCell>
                          <TableCell>{request.leaveType}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{request.startDate}</div>
                              <div className="text-gray-500">đến {request.endDate}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{request.days} ngày</TableCell>
                          <TableCell className="max-w-32 truncate">{request.reason}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={{
                                'pending': 'border-yellow-400 text-yellow-700 bg-yellow-50',
                                'approved': 'border-green-400 text-green-700 bg-green-50',
                                'rejected': 'border-red-400 text-red-700 bg-red-50'
                              }[request.status]}
                            >
                              {{
                                'pending': 'Chờ duyệt',
                                'approved': 'Đã duyệt', 
                                'rejected': 'Từ chối'
                              }[request.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {request.status === 'approved' && (
                              <div className="text-xs text-green-600">
                                Duyệt bởi: {request.approvedBy}
                              </div>
                            )}
                            {request.status === 'rejected' && (
                              <div className="text-xs text-red-600">
                                Từ chối: {request.rejectionReason}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}