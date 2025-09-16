import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Eye, Users, Percent, TrendingUp, Settings, Calendar, History, Trash2, Clock, Link, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";

export default function ClientManagement() {
  const { subscribe } = useWebSocket();
  const { toast } = useToast();
  const canEdit = useHasPermission('client-management', 'edit');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [employeeAssignDialogOpen, setEmployeeAssignDialogOpen] = useState(false);
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [assigningEmployeeClient, setAssigningEmployeeClient] = useState<any>(null);
  
  const [clientFormData, setClientFormData] = useState({
    name: "",
    code: "",
    systemCode: "",
    email: "",
    phone: "",
    address: "",
    contactPerson: "",
    assignedEmployee: "",
  });

  const [assignFormData, setAssignFormData] = useState({
    accountId: "",
    rentalPercentage: "100",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
  });

  const [feeFormData, setFeeFormData] = useState({
    newPercentage: "",
    changeType: "immediate", // immediate, scheduled, from_month
    fromMonth: new Date().getMonth() + 1,
    fromYear: new Date().getFullYear(),
    toMonth: "",
    toYear: "",
  });

  const [employeeAssignFormData, setEmployeeAssignFormData] = useState({
    employeeId: "",
  });

  const [reconciliationFormData, setReconciliationFormData] = useState({
    type: "single", // single, multiple, system_report
    clientId: "",
    clientIds: [] as string[],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    includeDetails: true,
    includeExpenses: true,
    includeFees: true,
    includeBalance: true
  });

  // Fetch fee change history for selected client
  const { data: feeHistory = [], refetch: refetchFeeHistory } = useQuery({
    queryKey: ['/api/fee-changes/client', selectedClient?.id],
    enabled: !!selectedClient?.id
  });

  // Fetch clients with their account assignments
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients-with-accounts']
  });

  // Fetch advertising accounts
  const { data: adAccounts = [] } = useQuery({
    queryKey: ['/api/ad-accounts']
  });

  // Fetch client account assignments
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ['/api/client-accounts']
  });

  // Fetch employees for assignment
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees']
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const processedData = {
        ...clientData,
        assignedEmployee: clientData.assignedEmployee === 'none' ? null : clientData.assignedEmployee
      };
      return apiRequest('POST', '/api/clients', processedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients-with-accounts'] });
      setCreateDialogOpen(false);
      resetClientForm();
      toast({
        title: "Thành công",
        description: "Khách hàng đã được thêm",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thêm khách hàng",
        variant: "destructive",
      });
    }
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const processedData = {
        ...clientData,
        assignedEmployee: clientData.assignedEmployee === 'none' ? null : clientData.assignedEmployee
      };
      return apiRequest('PATCH', `/api/clients/${editingClient.id}`, processedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients-with-accounts'] });
      setEditDialogOpen(false);
      resetClientForm();
      setEditingClient(null);
      toast({
        title: "Thành công",
        description: "Thông tin khách hàng đã được cập nhật",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật thông tin khách hàng",
        variant: "destructive",
      });
    }
  });

  // Assign account to client mutation
  const assignAccountMutation = useMutation({
    mutationFn: async (assignData: any) => {
      return apiRequest('POST', '/api/client-accounts', assignData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients-with-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-accounts'] });
      setAssignDialogOpen(false);
      resetAssignForm();
      toast({
        title: "Thành công",
        description: "Tài khoản đã được gán cho khách hàng",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể gán tài khoản",
        variant: "destructive",
      });
    }
  });

  // Create fee change mutation
  const createFeeChangeMutation = useMutation({
    mutationFn: async (feeData: any) => {
      return apiRequest('POST', '/api/fee-changes', feeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients-with-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fee-changes/client', selectedClient?.id] });
      setFeeDialogOpen(false);
      toast({
        title: "Thành công",
        description: "Lịch sửa phí đã được cập nhật",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật phí",
        variant: "destructive",
      });
    }
  });

  // Delete fee change mutation
  const deleteFeeChangeMutation = useMutation({
    mutationFn: async (feeChangeId: number) => {
      return apiRequest('DELETE', `/api/fee-changes/${feeChangeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fee-changes/client', selectedClient?.id] });
      toast({
        title: "Thành công",
        description: "Đã hủy lịch sửa phí",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể hủy lịch sửa phí",
        variant: "destructive",
      });
    }
  });

  // Assign employee to client mutation
  const assignEmployeeMutation = useMutation({
    mutationFn: async (assignData: any) => {
      return apiRequest('PATCH', `/api/clients/${assignData.clientId}`, {
        assignedEmployee: assignData.employeeName === 'none' ? null : assignData.employeeName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients-with-accounts'] });
      setEmployeeAssignDialogOpen(false);
      setEmployeeAssignFormData({ employeeId: "" });
      toast({
        title: "Thành công",
        description: "Đã gắn nhân viên cho khách hàng",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể gắn nhân viên",
        variant: "destructive",
      });
    }
  });

  const resetClientForm = () => {
    setClientFormData({
      name: "",
      code: "",
      systemCode: "",
      email: "",
      phone: "",
      address: "",
      contactPerson: "",
      assignedEmployee: "",
    });
  };

  const resetAssignForm = () => {
    setAssignFormData({
      accountId: "",
      rentalPercentage: "100",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
    });
  };

  const handleCreateClient = () => {
    if (!clientFormData.name || !clientFormData.code) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền tên và mã khách hàng",
        variant: "destructive",
      });
      return;
    }

    createClientMutation.mutate(clientFormData);
  };

  const handleUpdateClient = () => {
    if (!clientFormData.name || !clientFormData.code) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền tên và mã khách hàng",
        variant: "destructive",
      });
      return;
    }

    updateClientMutation.mutate(clientFormData);
  };

  const handleCreateFeeChange = () => {
    if (!feeFormData.newPercentage) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập phí mới",
        variant: "destructive",
      });
      return;
    }

    const feeData = {
      clientId: selectedClient.id,
      ...feeFormData,
    };

    createFeeChangeMutation.mutate(feeData);
  };

  const handleDeleteFeeChange = (feeChangeId: number) => {
    deleteFeeChangeMutation.mutate(feeChangeId);
  };

  const handleAssignAccount = () => {
    if (!selectedClient || !assignFormData.accountId) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn khách hàng và tài khoản",
        variant: "destructive",
      });
      return;
    }

    assignAccountMutation.mutate({
      clientId: selectedClient.id,
      ...assignFormData,
    });
  };

  const handleClientInputChange = (field: string, value: string) => {
    setClientFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAssignInputChange = (field: string, value: string) => {
    setAssignFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFeeInputChange = (field: string, value: string) => {
    setFeeFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmployeeAssignInputChange = (field: string, value: string) => {
    setEmployeeAssignFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const openEmployeeAssignDialog = (client: any) => {
    setAssigningEmployeeClient(client);
    setEmployeeAssignFormData({
      employeeId: client.assignedEmployeeId || ""
    });
    setEmployeeAssignDialogOpen(true);
  };

  const handleAssignEmployee = () => {
    if (!employeeAssignFormData.employeeId) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn nhân viên",
        variant: "destructive",
      });
      return;
    }

    // Handle "none" selection for unassigning employee
    if (employeeAssignFormData.employeeId === 'none') {
      assignEmployeeMutation.mutate({
        clientId: assigningEmployeeClient.id,
        employeeName: 'none'
      });
      return;
    }

    const selectedEmployee = employees.find((emp: any) => emp.id.toString() === employeeAssignFormData.employeeId);
    if (!selectedEmployee) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy nhân viên",
        variant: "destructive",
      });
      return;
    }

    assignEmployeeMutation.mutate({
      clientId: assigningEmployeeClient.id,
      employeeName: selectedEmployee.fullName
    });
  };

  const openAssignDialog = (client: any) => {
    setSelectedClient(client);
    setAssignDialogOpen(true);
  };

  const openEditDialog = (client: any) => {
    setEditingClient(client);
    setClientFormData({
      name: client.name || "",
      code: client.code || "",
      systemCode: client.systemCode || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      contactPerson: client.contactPerson || "",
      assignedEmployee: client.assignedEmployee || "none",
    });
    setEditDialogOpen(true);
  };

  const openFeeDialog = (client: any) => {
    setSelectedClient(client);
    const assignments = clientAccounts.filter((ca: any) => ca.clientId === client.id);
    const currentPercentage = assignments.length > 0 ? assignments[0].rentalPercentage : "0";
    
    setFeeFormData({
      newPercentage: currentPercentage,
      changeType: "immediate",
      fromMonth: new Date().getMonth() + 1,
      fromYear: new Date().getFullYear(),
      toMonth: "",
      toYear: "",
    });
    setFeeDialogOpen(true);
  };

  // Calculate client statistics
  const totalClients = clients.length;
  const activeClients = clients.filter((c: any) => c.accountAssignments?.some((a: any) => a.status === 'active')).length;
  const totalRentalValue = clientAccounts.reduce((sum: number, ca: any) => {
    const account = adAccounts.find((acc: any) => acc.id === ca.accountId);
    const rentalPrice = parseFloat(account?.rentalPrice || '0');
    const percentage = parseFloat(ca.rentalPercentage || '0') / 100;
    return sum + (rentalPrice * percentage);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Quản lý khách hàng</h2>
      </div>


      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-foreground">{totalClients}</p>
                <p className="text-sm text-muted-foreground">Tổng khách hàng</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-secondary">{activeClients}</p>
                <p className="text-sm text-muted-foreground">Đang hoạt động</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Percent className="h-6 w-6 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-accent currency">
                  {formatCurrency(totalRentalValue)}
                </p>
                <p className="text-sm text-muted-foreground">Tổng giá trị thuê</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-muted/10 rounded-lg">
                <Eye className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-foreground">{clientAccounts.length}</p>
                <p className="text-sm text-muted-foreground">Tài khoản được gán</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Danh sách khách hàng ({clients?.length || 0})</span>
            </div>
            
            {canEdit && (
              <div className="flex items-center space-x-2">
                <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex items-center space-x-2 h-9 px-4 text-sm scale-90 border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <FileCheck className="h-4 w-4" />
                      <span>Tạo đối soát KH</span>
                    </Button>
                  </DialogTrigger>
                </Dialog>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      className="flex items-center space-x-2 h-9 px-4 text-sm scale-90"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Thêm khách hàng</span>
                    </Button>
                  </DialogTrigger>
              <DialogContent aria-describedby="dialog-description">
                <DialogHeader>
                  <DialogTitle>Thêm khách hàng mới</DialogTitle>
                  <DialogDescription id="dialog-description">
                    Tạo khách hàng mới để quản lý tài khoản và hợp đồng thuê.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client-name">Tên khách hàng *</Label>
                      <Input
                        id="client-name"
                        value={clientFormData.name}
                        onChange={(e) => handleClientInputChange('name', e.target.value)}
                        placeholder="Công ty ABC"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-code">Mã khách hàng *</Label>
                      <Input
                        id="client-code"
                        value={clientFormData.code}
                        onChange={(e) => handleClientInputChange('code', e.target.value)}
                        placeholder="KH001"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-system-code">Mã hệ thống</Label>
                      <Input
                        id="client-system-code"
                        value={clientFormData.systemCode}
                        onChange={(e) => handleClientInputChange('systemCode', e.target.value)}
                        placeholder="SYS001"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-email">Email</Label>
                      <Input
                        id="client-email"
                        type="email"
                        value={clientFormData.email}
                        onChange={(e) => handleClientInputChange('email', e.target.value)}
                        placeholder="contact@company.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-phone">Số điện thoại</Label>
                      <Input
                        id="client-phone"
                        value={clientFormData.phone}
                        onChange={(e) => handleClientInputChange('phone', e.target.value)}
                        placeholder="0123-456-789"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-contact">Người liên hệ</Label>
                      <Input
                        id="client-contact"
                        value={clientFormData.contactPerson}
                        onChange={(e) => handleClientInputChange('contactPerson', e.target.value)}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>

                    <div>
                      <Label htmlFor="client-employee">Nhân viên phụ trách</Label>
                      <Select 
                        value={clientFormData.assignedEmployee} 
                        onValueChange={(value) => handleClientInputChange('assignedEmployee', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn nhân viên..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Không gắn nhân viên</SelectItem>
                          {employees.map((employee: any) => (
                            <SelectItem key={employee.id} value={employee.fullName}>
                              {employee.fullName} - {employee.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="client-address">Địa chỉ</Label>
                    <Textarea
                      id="client-address"
                      value={clientFormData.address}
                      onChange={(e) => handleClientInputChange('address', e.target.value)}
                      placeholder="Địa chỉ công ty..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button 
                      onClick={handleCreateClient}
                      disabled={createClientMutation.isPending}
                    >
                      {createClientMutation.isPending ? 'Đang thêm...' : 'Thêm khách hàng'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có khách hàng nào</p>
              <p className="text-sm">Thêm khách hàng đầu tiên để bắt đầu</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                  <TableRow className="h-10 border-b border-gray-200 dark:border-gray-700">
                    <TableHead className="w-[140px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Tên NV</TableHead>
                    <TableHead className="w-[180px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Khách hàng</TableHead>
                    <TableHead className="w-[120px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Mã hệ thống</TableHead>
                    <TableHead className="w-[160px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Liên hệ</TableHead>
                    <TableHead className="w-[130px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Phí thuê tài khoản</TableHead>
                    <TableHead className="w-[130px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Tổng chi tiêu</TableHead>
                    <TableHead className="w-[130px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Chi tiêu T.này</TableHead>
                    <TableHead className="w-[130px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Chi tiêu T.trước</TableHead>
                    <TableHead className="w-[120px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Link đối soát</TableHead>
                    <TableHead className="w-[110px] h-10 text-xs font-semibold py-3 px-4 text-gray-700 dark:text-gray-300">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-4">Đang tải...</TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client: any, index: number) => {
                      const assignments = clientAccounts.filter((ca: any) => ca.clientId === client.id);
                      const activeAssignments = assignments.filter((a: any) => a.status === 'active');
                      
                      const totalRentalValue = assignments.reduce((sum: number, ca: any) => {
                        const account = adAccounts.find((acc: any) => acc.id === ca.accountId);
                        const rentalPrice = parseFloat(account?.rentalPrice || '0');
                        const percentage = parseFloat(ca.rentalPercentage || '0') / 100;
                        return sum + (rentalPrice * percentage);
                      }, 0);

                      // Mock data for expenses - in real implementation, these would come from API
                      const totalExpenses = Math.floor(Math.random() * 50000000); // Random total expenses
                      const thisMonthExpenses = Math.floor(Math.random() * 5000000); // Random this month
                      const lastMonthExpenses = Math.floor(Math.random() * 4000000); // Random last month

                      return (
                        <TableRow 
                          key={client.id} 
                          className={`h-12 transition-colors duration-150 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/50'
                          }`}
                        >
                          <TableCell className="h-12 py-3 px-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {client.assignedEmployee || '-'}
                              </span>
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 px-2 py-0 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                                  onClick={() => openEmployeeAssignDialog(client)}
                                  title="Chỉnh sửa/Gắn nhân viên"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Gắn NV
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="h-12 py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{client.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">Mã: {client.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="h-12 py-3 px-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {client.systemCode || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="h-12 py-3 px-4">
                            <div className="flex flex-col">
                              {client.contactPerson && (
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{client.contactPerson}</span>
                              )}
                              {client.email && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.email}</span>
                              )}
                              {client.phone && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.phone}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="h-12 py-3 px-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {client.currentFeePercentage ? `${client.currentFeePercentage}%` : '0%'}
                              </span>
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 px-2 py-0 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                                  onClick={() => openFeeDialog(client)}
                                  title="Quản lý phí thuê"
                                >
                                  <Settings className="h-3 w-3 mr-1" />
                                  Quản lý phí
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="h-12 py-3 px-4">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 currency">
                              {formatCurrency(totalExpenses)}
                            </span>
                          </TableCell>
                          <TableCell className="h-10 py-2 px-3">
                            <span className="text-xs font-medium text-green-600 dark:text-green-400 currency">
                              {formatCurrency(thisMonthExpenses)}
                            </span>
                          </TableCell>
                          <TableCell className="h-10 py-2 px-3">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 currency">
                              {formatCurrency(lastMonthExpenses)}
                            </span>
                          </TableCell>
                          <TableCell className="h-10 py-2 px-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 py-0 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => window.open(`/reconciliation/${client.code}`, '_blank')}
                              title="Xem báo cáo đối soát"
                            >
                              <Link className="h-3 w-3 mr-1" />
                              Xem báo cáo
                            </Button>
                          </TableCell>
                          <TableCell className="h-10 py-2 px-3">
                            <div className="flex items-center space-x-1">
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => openEditDialog(client)}
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Account Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Gán tài khoản cho {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tài khoản *
              </label>
              <Select value={assignFormData.accountId} onValueChange={(value) => handleAssignInputChange('accountId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tài khoản" />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((account: any) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.source || 'N/A'})
                      {account.rentalPrice && (
                        <span className="ml-2 text-muted-foreground">
                          - {formatCurrency(account.rentalPrice)}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                % Thuê tài khoản
              </label>
              <Input
                type="number"
                value={assignFormData.rentalPercentage}
                onChange={(e) => handleAssignInputChange('rentalPercentage', e.target.value)}
                placeholder="100"
                min="0"
                max="100"
                step="0.1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ngày bắt đầu *
                </label>
                <Input
                  type="date"
                  value={assignFormData.startDate}
                  onChange={(e) => handleAssignInputChange('startDate', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ngày kết thúc
                </label>
                <Input
                  type="date"
                  value={assignFormData.endDate}
                  onChange={(e) => handleAssignInputChange('endDate', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Hủy
              </Button>
              <Button 
                onClick={handleAssignAccount}
                disabled={assignAccountMutation.isPending}
              >
                {assignAccountMutation.isPending ? 'Đang gán...' : 'Gán tài khoản'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent aria-describedby="edit-dialog-description">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin khách hàng</DialogTitle>
            <DialogDescription id="edit-dialog-description">
              Cập nhật thông tin khách hàng {editingClient?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-client-name">Tên khách hàng *</Label>
                <Input
                  id="edit-client-name"
                  value={clientFormData.name}
                  onChange={(e) => handleClientInputChange('name', e.target.value)}
                  placeholder="Công ty ABC"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-code">Mã khách hàng *</Label>
                <Input
                  id="edit-client-code"
                  value={clientFormData.code}
                  onChange={(e) => handleClientInputChange('code', e.target.value)}
                  placeholder="KH001"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-system-code">Mã hệ thống</Label>
                <Input
                  id="edit-client-system-code"
                  value={clientFormData.systemCode}
                  onChange={(e) => handleClientInputChange('systemCode', e.target.value)}
                  placeholder="SYS001"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-email">Email</Label>
                <Input
                  id="edit-client-email"
                  type="email"
                  value={clientFormData.email}
                  onChange={(e) => handleClientInputChange('email', e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-phone">Số điện thoại</Label>
                <Input
                  id="edit-client-phone"
                  value={clientFormData.phone}
                  onChange={(e) => handleClientInputChange('phone', e.target.value)}
                  placeholder="0123-456-789"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-contact">Người liên hệ</Label>
                <Input
                  id="edit-client-contact"
                  value={clientFormData.contactPerson}
                  onChange={(e) => handleClientInputChange('contactPerson', e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <Label htmlFor="edit-client-employee">Nhân viên phụ trách</Label>
                <Select 
                  value={clientFormData.assignedEmployee} 
                  onValueChange={(value) => handleClientInputChange('assignedEmployee', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhân viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không gắn nhân viên</SelectItem>
                    {employees.map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.fullName}>
                        {employee.fullName} - {employee.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-client-address">Địa chỉ</Label>
              <Textarea
                id="edit-client-address"
                value={clientFormData.address}
                onChange={(e) => handleClientInputChange('address', e.target.value)}
                placeholder="Địa chỉ công ty..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Hủy
              </Button>
              <Button 
                onClick={handleUpdateClient}
                disabled={updateClientMutation.isPending}
              >
                {updateClientMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fee Management Dialog */}
      <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
        <DialogContent aria-describedby="fee-dialog-description" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Quản lý phí thuê - {selectedClient?.name}
            </DialogTitle>
            <DialogDescription id="fee-dialog-description">
              Xem lịch sử, lên lịch và quản lý phí thuê tài khoản cho khách hàng.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Lên lịch sửa phí
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Lịch sử thay đổi
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Lịch chờ xử lý
              </TabsTrigger>
            </TabsList>
            
            {/* Schedule Fee Change Tab */}
            <TabsContent value="schedule" className="mt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="current-percentage">Phí hiện tại</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
                      <span className="text-lg font-semibold text-green-600">
                        {selectedClient?.currentFeePercentage || '0'}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new-percentage">Phí mới (%)</Label>
                    <Input
                      id="new-percentage"
                      type="number"
                      value={feeFormData.newPercentage}
                      onChange={(e) => handleFeeInputChange('newPercentage', e.target.value)}
                      placeholder="Nhập phí mới"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="change-type">Loại thay đổi</Label>
                  <Select value={feeFormData.changeType} onValueChange={(value) => handleFeeInputChange('changeType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại thay đổi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">🚀 Sửa ngay lập tức</SelectItem>
                      <SelectItem value="scheduled">📅 Từ tháng X-Y (khoảng thời gian cụ thể)</SelectItem>
                      <SelectItem value="from_month">⏰ Từ tháng X đến khi có thay đổi mới</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {feeFormData.changeType === 'scheduled' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium mb-3 text-blue-800 dark:text-blue-200">Thiết lập khoảng thời gian</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="from-month">Từ tháng</Label>
                        <Select value={feeFormData.fromMonth.toString()} onValueChange={(value) => handleFeeInputChange('fromMonth', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                              <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="from-year">Năm</Label>
                        <Input
                          id="from-year"
                          type="number"
                          value={feeFormData.fromYear}
                          onChange={(e) => handleFeeInputChange('fromYear', e.target.value)}
                          min="2024"
                          max="2030"
                        />
                      </div>
                      <div>
                        <Label htmlFor="to-month">Đến tháng</Label>
                        <Select value={feeFormData.toMonth} onValueChange={(value) => handleFeeInputChange('toMonth', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn tháng" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                              <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="to-year">Năm</Label>
                        <Input
                          id="to-year"
                          type="number"
                          value={feeFormData.toYear}
                          onChange={(e) => handleFeeInputChange('toYear', e.target.value)}
                          min="2024"
                          max="2030"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {feeFormData.changeType === 'from_month' && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium mb-3 text-green-800 dark:text-green-200">Thiết lập thời gian bắt đầu</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="from-month-only">Từ tháng</Label>
                        <Select value={feeFormData.fromMonth.toString()} onValueChange={(value) => handleFeeInputChange('fromMonth', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                              <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="from-year-only">Năm</Label>
                        <Input
                          id="from-year-only"
                          type="number"
                          value={feeFormData.fromYear}
                          onChange={(e) => handleFeeInputChange('fromYear', e.target.value)}
                          min="2024"
                          max="2030"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setFeeDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button 
                    onClick={handleCreateFeeChange}
                    disabled={createFeeChangeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createFeeChangeMutation.isPending ? 'Đang xử lý...' : 'Cập nhật phí'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Lịch sử thay đổi phí</h3>
                  <Badge variant="secondary">{feeHistory.length} bản ghi</Badge>
                </div>
                
                {feeHistory.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Phí cũ</TableHead>
                          <TableHead>Phí mới</TableHead>
                          <TableHead>Loại thay đổi</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Thời gian hiệu lực</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feeHistory.map((change: any) => (
                          <TableRow key={change.id}>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(change.createdAt).toLocaleDateString('vi-VN')}
                                <div className="text-xs text-muted-foreground">
                                  {new Date(change.createdAt).toLocaleTimeString('vi-VN')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-red-600 font-medium">{change.oldPercentage}%</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-green-600 font-medium">{change.newPercentage}%</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={change.changeType === 'immediate' ? 'default' : 'secondary'}>
                                {change.changeType === 'immediate' ? 'Ngay lập tức' : 
                                 change.changeType === 'scheduled' ? 'Có lịch trình' : 'Từ tháng cụ thể'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={change.status === 'active' ? 'default' : 'outline'}>
                                {change.status === 'active' ? 'Đã áp dụng' : 'Chờ xử lý'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {change.effectiveFromMonth && change.effectiveFromYear ? 
                                `${change.effectiveFromMonth}/${change.effectiveFromYear}` +
                                (change.effectiveToMonth && change.effectiveToYear ? 
                                  ` - ${change.effectiveToMonth}/${change.effectiveToYear}` : ' →') : 
                                'Ngay lập tức'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có lịch sử thay đổi phí</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pending Changes Tab */}
            <TabsContent value="pending" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Lịch chờ xử lý</h3>
                  <Badge variant="outline">{feeHistory.filter((f: any) => f.status === 'pending').length} chờ xử lý</Badge>
                </div>
                
                {feeHistory.filter((f: any) => f.status === 'pending').length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ngày tạo</TableHead>
                          <TableHead>Phí mới</TableHead>
                          <TableHead>Thời gian hiệu lực</TableHead>
                          <TableHead>Loại thay đổi</TableHead>
                          <TableHead>Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feeHistory.filter((f: any) => f.status === 'pending').map((change: any) => (
                          <TableRow key={change.id}>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(change.createdAt).toLocaleDateString('vi-VN')}
                                <div className="text-xs text-muted-foreground">
                                  {new Date(change.createdAt).toLocaleTimeString('vi-VN')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-blue-600 font-medium">{change.newPercentage}%</span>
                            </TableCell>
                            <TableCell>
                              {change.effectiveFromMonth && change.effectiveFromYear ? 
                                `${change.effectiveFromMonth}/${change.effectiveFromYear}` +
                                (change.effectiveToMonth && change.effectiveToYear ? 
                                  ` - ${change.effectiveToMonth}/${change.effectiveToYear}` : ' →') : 
                                'Ngay lập tức'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {change.changeType === 'immediate' ? 'Ngay lập tức' : 
                                 change.changeType === 'scheduled' ? 'Có lịch trình' : 'Từ tháng cụ thể'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteFeeChange(change.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Hủy
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Không có lịch chờ xử lý</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Reconciliation Creation Dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileCheck className="h-5 w-5" />
              <span>Tạo link đối soát khách hàng</span>
            </DialogTitle>
            <DialogDescription>
              Tạo báo cáo đối soát chi tiết cho khách hàng với thông tin tài khoản và chi tiêu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Reconciliation Type */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Loại báo cáo đối soát</Label>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reconciliationType"
                    value="single"
                    checked={reconciliationFormData.type === "single"}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, type: e.target.value as any})}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Tạo đơn lẻ</div>
                    <div className="text-sm text-gray-500">Tạo báo cáo đối soát cho 1 khách hàng cụ thể</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reconciliationType"
                    value="multiple"
                    checked={reconciliationFormData.type === "multiple"}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, type: e.target.value as any})}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Điền nhiều khách hàng</div>
                    <div className="text-sm text-gray-500">Chọn nhiều khách hàng để tạo báo cáo cùng lúc</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reconciliationType"
                    value="system_report"
                    checked={reconciliationFormData.type === "system_report"}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, type: e.target.value as any})}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Báo cáo theo hệ thống</div>
                    <div className="text-sm text-gray-500">Tạo báo cáo tổng hợp cho toàn bộ hệ thống</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Client Selection */}
            {reconciliationFormData.type === "single" && (
              <div className="space-y-2">
                <Label>Chọn khách hàng</Label>
                <Select 
                  value={reconciliationFormData.clientId} 
                  onValueChange={(value) => setReconciliationFormData({...reconciliationFormData, clientId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khách hàng..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name} ({client.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reconciliationFormData.type === "multiple" && (
              <div className="space-y-2">
                <Label>Chọn nhiều khách hàng</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {clients.map((client: any) => (
                    <label key={client.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reconciliationFormData.clientIds.includes(client.id.toString())}
                        onChange={(e) => {
                          const clientIds = e.target.checked 
                            ? [...reconciliationFormData.clientIds, client.id.toString()]
                            : reconciliationFormData.clientIds.filter(id => id !== client.id.toString());
                          setReconciliationFormData({...reconciliationFormData, clientIds});
                        }}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{client.name} ({client.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Report Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tháng báo cáo</Label>
                <Select 
                  value={reconciliationFormData.month.toString()} 
                  onValueChange={(value) => setReconciliationFormData({...reconciliationFormData, month: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                      <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Năm</Label>
                <Input
                  type="number"
                  value={reconciliationFormData.year}
                  onChange={(e) => setReconciliationFormData({...reconciliationFormData, year: parseInt(e.target.value)})}
                  min="2024"
                  max="2030"
                />
              </div>
            </div>

            {/* Report Content Options */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Nội dung báo cáo</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={reconciliationFormData.includeDetails}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, includeDetails: e.target.checked})}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Chi tiết tài khoản</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={reconciliationFormData.includeExpenses}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, includeExpenses: e.target.checked})}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Chi tiêu theo ngày</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={reconciliationFormData.includeFees}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, includeFees: e.target.checked})}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Phí thuê tài khoản</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={reconciliationFormData.includeBalance}
                    onChange={(e) => setReconciliationFormData({...reconciliationFormData, includeBalance: e.target.checked})}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Số dư còn lại</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)}>
                Hủy
              </Button>
              <Button 
                onClick={() => {
                  // Mock function to generate reconciliation report
                  const selectedClient = reconciliationFormData.type === "single" 
                    ? clients.find(c => c.id.toString() === reconciliationFormData.clientId)
                    : null;
                  const reportUrl = selectedClient 
                    ? `/reconciliation/${selectedClient.code}` 
                    : '/reconciliation/system-report';
                  window.open(reportUrl, '_blank');
                  setReconciliationDialogOpen(false);
                  toast({
                    title: "Thành công",
                    description: "Đã tạo link báo cáo đối soát",
                  });
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Link className="h-4 w-4 mr-2" />
                Tạo báo cáo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Assignment Dialog */}
      <Dialog open={employeeAssignDialogOpen} onOpenChange={setEmployeeAssignDialogOpen} modal={false}>
        <DialogContent aria-describedby="employee-assign-dialog-description" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gắn nhân viên cho khách hàng</DialogTitle>
            <DialogDescription id="employee-assign-dialog-description">
              Chọn nhân viên phụ trách khách hàng {assigningEmployeeClient?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee-select">Chọn nhân viên</Label>
              <Select 
                value={employeeAssignFormData.employeeId} 
                onValueChange={(value) => handleEmployeeAssignInputChange('employeeId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên..." />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl" style={{ opacity: 1, filter: 'none', backdropFilter: 'none' }}>
                  <SelectItem value="none">Không gắn nhân viên</SelectItem>
                  {employees.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.fullName} - {employee.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEmployeeAssignDialogOpen(false)}>
                Hủy
              </Button>
              <Button 
                onClick={handleAssignEmployee}
                disabled={assignEmployeeMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {assignEmployeeMutation.isPending ? 'Đang gắn...' : 'Gắn nhân viên'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}