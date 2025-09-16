import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, Shield, Calendar, Clock, Mail, User, MoreHorizontal, Edit2, Trash2, Power, PowerOff, Settings } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import type { Employee, AuthUser } from "@shared/schema";

interface CreateEmployeeData {
  username: string;
  email: string;
  fullName: string;
  role?: string;
  status?: string;
}

// Define available roles for employees
const EMPLOYEE_ROLES = [
  { value: 'director', label: 'Tổng quản lý' },
  { value: 'accounting_manager', label: 'Quản lý Kế toán' },
  { value: 'operations_manager', label: 'Quản lý vận hành' },
  { value: 'operations_staff', label: 'Nhân viên vận hành' },
  { value: 'accounting_staff', label: 'Nhân viên kế toán' },
];

// Define tabs that can have permissions set
const PERMISSION_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'account-management', label: 'Quản lý tài khoản' },
  { key: 'expense-management', label: 'Chi phí tài khoản' },
  { key: 'card-management', label: 'Quản lý thẻ' },
  { key: 'via-management', label: 'Quản lý Via' },
  { key: 'client-management', label: 'Quản lý khách hàng' },
  { key: 'employee-management', label: 'Quản lý nhân viên' },
  { key: 'activity-history', label: 'Lịch sử hoạt động' },
  { key: 'system-settings', label: 'Cài đặt hệ thống' },
];

// Permission levels
const PERMISSION_LEVELS = [
  { value: 'none', label: 'Không truy cập', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'view', label: 'Chỉ xem', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'edit', label: 'Toàn quyền', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
];

export default function EmployeeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [permissionEmployee, setPermissionEmployee] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateEmployeeData>({
    username: '',
    email: '',
    fullName: '',
    role: 'accounting_staff',
    status: 'active'
  });

  // Cleanup dialog overlay on unmount or when dialogs close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingEmployee(null);
        setDeletingEmployee(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      try {
        const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
        overlays.forEach(overlay => {
          try {
            if (overlay && overlay.parentNode && overlay.parentNode.contains(overlay)) {
              overlay.remove();
            }
          } catch (error) {
            console.warn('Failed to cleanup overlay on unmount:', error);
          }
        });
      } catch (error) {
        console.warn('Failed to query overlays:', error);
      }
    };
  }, []);

  // Additional cleanup when dialogs close
  useEffect(() => {
    if (!editingEmployee && !deletingEmployee) {
      setTimeout(() => {
        try {
          const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
          overlays.forEach(overlay => overlay.remove());
          document.body.style.overflow = '';
          document.body.style.pointerEvents = '';
        } catch (error) {
          console.warn('Failed to cleanup overlays:', error);
        }
      }, 100);
    }
  }, [editingEmployee, deletingEmployee]);

  // Query for employee permissions
  const { data: employeePermissions } = useQuery({
    queryKey: [`/api/employees/${permissionEmployee?.id}/permissions`],
    enabled: !!permissionEmployee?.id,
  });

  // Load permissions when dialog opens
  useEffect(() => {
    if (permissionEmployee && employeePermissions) {
      const permissionMap: Record<string, string> = {};
      PERMISSION_TABS.forEach(tab => {
        const existingPermission = employeePermissions.find((p: any) => p.tabName === tab.key);
        permissionMap[tab.key] = existingPermission?.permission || 'none';
      });
      setPermissions(permissionMap);
    }
  }, [permissionEmployee, employeePermissions]);

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch employees');
      }
      
      return response.json();
    },
  });

  // Create employee mutation
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create employee');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsCreateDialogOpen(false);
      setFormData({
        username: '',
        email: '',
        fullName: '',
        role: 'accounting_staff',
        status: 'active'
      });
      toast({
        title: "Thành công",
        description: "Tạo nhân viên mới thành công",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo nhân viên",
        variant: "destructive",
      });
    },
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update employee');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEditingEmployee(null);
      toast({
        title: "Thành công",
        description: "Cập nhật thông tin nhân viên thành công",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật nhân viên",
        variant: "destructive",
      });
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete employee');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setDeletingEmployee(null);
      toast({
        title: "Thành công",
        description: "Xóa nhân viên thành công",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa nhân viên",
        variant: "destructive",
      });
    },
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async (data: { employeeId: number; permissions: Record<string, string> }) => {
      const permissionArray = Object.entries(data.permissions).map(([tabName, permission]) => ({
        tabName,
        permission
      }));
      
      const response = await fetch(`/api/employees/${data.employeeId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
        },
        body: JSON.stringify({ permissions: permissionArray }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save permissions');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${permissionEmployee?.id}/permissions`] });
      setPermissionEmployee(null);
      toast({
        title: "Thành công",
        description: "Đã cập nhật quyền cho nhân viên",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error("Error saving permissions:", error);
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể cập nhật quyền",
        variant: "destructive",
      });
    },
  });

  // Initialize sample data mutation
  const initializeSampleDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/initialize-sample-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize sample data');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: "Thành công",
        description: `Đã tạo ${data.employees?.length || 0} tài khoản mẫu`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo dữ liệu mẫu",
        variant: "destructive",
      });
    },
  });

  // Toggle employee status
  const toggleEmployeeStatus = async (employee: Employee) => {
    const isCurrentlyActive = employee.isActive !== false && employee.status !== 'inactive';
    const newData = {
      isActive: !isCurrentlyActive,
      status: !isCurrentlyActive ? 'active' : 'inactive'
    };
    
    updateEmployeeMutation.mutate({ id: employee.id, data: newData });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const passwordField = document.getElementById('password') as HTMLInputElement;
    const password = passwordField?.value || '';
    
    if (!formData.username || !formData.fullName || !password) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc",
        variant: "destructive",
      });
      return;
    }

    const userData = { 
      username: formData.username,
      email: formData.email || `${formData.username}@company.com`,
      fullName: formData.fullName,
      password: password,
      role: formData.role || 'accounting_staff'
    };
    createEmployeeMutation.mutate(userData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const formElement = e.target as HTMLFormElement;
    const formData = new FormData(formElement);
    
    const updateData: any = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      role: formData.get('role'),
    };

    const password = formData.get('password') as string;
    if (password && password.trim()) {
      updateData.password = password;
    }

    updateEmployeeMutation.mutate({ id: editingEmployee.id, data: updateData });
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'director': return 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      case 'accounting_manager': return 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'operations_manager': return 'bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800';
      case 'operations_staff': return 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
      case 'accounting_staff': return 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
      default: return 'bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleObj = EMPLOYEE_ROLES.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  };

  if (employeesLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Đang tải dữ liệu nhân viên...</p>
          </div>
        </div>
      </div>
    );
  }

  if (employeesError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">Lỗi khi tải dữ liệu: {(employeesError as any)?.message}</p>
            <Button onClick={() => queryClient.refetchQueries({ queryKey: ['/api/employees'] })}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Quản lý nhân viên</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý thông tin và quyền hạn của nhân viên trong hệ thống
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => initializeSampleDataMutation.mutate()}
            disabled={initializeSampleDataMutation.isPending}
            variant="outline"
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {initializeSampleDataMutation.isPending ? 'Đang tạo...' : 'Tạo dữ liệu mẫu'}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Thêm nhân viên
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tạo nhân viên mới</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  Nhập thông tin để tạo tài khoản nhân viên mới
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tên đăng nhập *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Nhập tên đăng nhập"
                    required
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Họ và tên *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Nhập họ và tên"
                    required
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Nhập địa chỉ email"
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-gray-300">Vai trò</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Mật khẩu *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Nhập mật khẩu"
                    required
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={createEmployeeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {createEmployeeMutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Tổng nhân viên</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Power className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Đang hoạt động</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {employees.filter(emp => emp.isActive !== false && emp.status !== 'inactive').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <PowerOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Tạm ngưng</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {employees.filter(emp => emp.isActive === false || emp.status === 'inactive').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Quản lý</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {employees.filter(emp => ['director', 'accounting_manager', 'operations_manager'].includes(emp.role || '')).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Danh sách nhân viên</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Chưa có nhân viên nào được tạo</p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tạo nhân viên đầu tiên
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-700">
                  <TableHead className="text-gray-900 dark:text-gray-100">Thông tin</TableHead>
                  <TableHead className="text-gray-900 dark:text-gray-100">Vai trò</TableHead>
                  <TableHead className="text-gray-900 dark:text-gray-100">Trạng thái</TableHead>
                  <TableHead className="text-gray-900 dark:text-gray-100">Ngày tạo</TableHead>
                  <TableHead className="text-gray-900 dark:text-gray-100 text-center">Cài đặt quyền</TableHead>
                  <TableHead className="text-gray-900 dark:text-gray-100 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{employee.fullName}</div>
                        <div className="text-sm text-muted-foreground">@{employee.username}</div>
                        {employee.email && (
                          <div className="text-sm text-muted-foreground flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {employee.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(employee.role || '')}>
                        {getRoleDisplayName(employee.role || '')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={employee.isActive !== false && employee.status !== 'inactive' ? "default" : "secondary"}
                        className={employee.isActive !== false && employee.status !== 'inactive' 
                          ? "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" 
                          : "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700"
                        }
                      >
                        {employee.isActive !== false && employee.status !== 'inactive' ? 'Hoạt động' : 'Tạm ngưng'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPermissionEmployee(employee)}
                        className="h-8 px-3 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Quyền
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          <DropdownMenuItem
                            onClick={() => setEditingEmployee(employee)}
                            className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleEmployeeStatus(employee)}
                            className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {employee.isActive !== false && employee.status !== 'inactive' ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Tạm ngưng
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Kích hoạt
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingEmployee(employee)}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Roles Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Vai trò và quyền hạn</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EMPLOYEE_ROLES.map((role) => (
              <div key={role.value} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="space-y-2">
                  <Badge className={getRoleBadgeColor(role.value)}>
                    {role.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {role.value === 'director' && 'Toàn quyền truy cập và quản lý hệ thống'}
                    {role.value === 'accounting_manager' && 'Quản lý bộ phận kế toán và tài chính'}
                    {role.value === 'operations_manager' && 'Quản lý bộ phận vận hành'}
                    {role.value === 'operations_staff' && 'Thực hiện các công việc vận hành'}
                    {role.value === 'accounting_staff' && 'Thực hiện các công việc kế toán'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog 
        open={!!editingEmployee} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingEmployee(null);
            setTimeout(() => {
              const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
              overlays.forEach(overlay => overlay.remove());
              document.body.style.overflow = '';
              document.body.style.pointerEvents = '';
            }, 50);
          }
        }}
      >
        {editingEmployee && (
          <DialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl max-w-md z-50">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chỉnh sửa nhân viên</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Cập nhật thông tin cho nhân viên {editingEmployee.fullName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Họ và tên</Label>
                <Input
                  id="editFullName"
                  name="fullName"
                  type="text"
                  defaultValue={editingEmployee.fullName}
                  placeholder="Nhập họ và tên"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                <Input
                  id="editEmail"
                  name="email"
                  type="email"
                  defaultValue={editingEmployee.email || ''}
                  placeholder="Nhập địa chỉ email"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRole" className="text-sm font-medium text-gray-700 dark:text-gray-300">Vai trò</Label>
                <Select name="role" defaultValue={editingEmployee.role}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Mật khẩu mới (để trống nếu không thay đổi)</Label>
                <Input
                  id="editPassword"
                  name="password"
                  type="password"
                  placeholder="Nhập mật khẩu mới"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingEmployee(null);
                    setTimeout(() => {
                      const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
                      overlays.forEach(overlay => overlay.remove());
                      document.body.style.overflow = '';
                      document.body.style.pointerEvents = '';
                    }, 50);
                  }}
                  className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateEmployeeMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật'}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!deletingEmployee} 
        onOpenChange={(open) => {
          if (!open) {
            setDeletingEmployee(null);
          }
        }}
      >
        <AlertDialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl z-50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Xác nhận xóa nhân viên</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Bạn có chắc chắn muốn xóa nhân viên <strong className="text-gray-900 dark:text-gray-100">{deletingEmployee?.fullName}</strong>?
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <AlertDialogCancel onClick={() => setDeletingEmployee(null)}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingEmployee) {
                  deleteEmployeeMutation.mutate(deletingEmployee.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permission Settings Dialog */}
      <Dialog 
        open={!!permissionEmployee} 
        onOpenChange={(open) => {
          if (!open) {
            setPermissionEmployee(null);
            setPermissions({});
          }
        }}
      >
        <DialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Cài đặt quyền truy cập - {permissionEmployee?.fullName}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Thiết lập quyền truy cập cho từng tab trong hệ thống. Bạn có thể chọn mức độ quyền cho từng tính năng.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {PERMISSION_TABS.map((tab) => (
              <div key={tab.key} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{tab.label}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {tab.key === 'dashboard' && 'Trang tổng quan với thống kê và biểu đồ'}
                    {tab.key === 'account-management' && 'Quản lý tài khoản quảng cáo Facebook'}
                    {tab.key === 'expense-management' && 'Theo dõi chi phí theo tài khoản và thời gian'}
                    {tab.key === 'card-management' && 'Quản lý thẻ thanh toán và ngân hàng'}
                    {tab.key === 'client-management' && 'Quản lý khách hàng và đối tác'}
                    {tab.key === 'employee-management' && 'Quản lý nhân viên và phân quyền'}
                    {tab.key === 'activity-history' && 'Xem lịch sử hoạt động của hệ thống'}
                    {tab.key === 'system-settings' && 'Cài đặt hệ thống và cấu hình'}
                  </p>
                </div>
                <div className="ml-4">
                  <Select
                    value={permissions[tab.key] || 'none'}
                    onValueChange={(value) => setPermissions(prev => ({ ...prev, [tab.key]: value }))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${level.color.includes('red') ? 'bg-red-500' : level.color.includes('yellow') ? 'bg-yellow-500' : 'bg-green-500'}`} />
                            <span>{level.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPermissionEmployee(null);
                setPermissions({});
              }}
              className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (permissionEmployee) {
                  savePermissionsMutation.mutate({
                    employeeId: permissionEmployee.id,
                    permissions
                  });
                }
              }}
              disabled={savePermissionsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savePermissionsMutation.isPending ? 'Đang lưu...' : 'Lưu quyền'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}