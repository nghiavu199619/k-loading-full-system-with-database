import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Shield, Activity, Settings, Copy, CheckCircle2, User, Lock } from "lucide-react";

export default function Welcome() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sampleDataCreated, setSampleDataCreated] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['/api/employee-roles'] });
      setSampleDataCreated(true);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "Thông tin đã được sao chép vào clipboard",
    });
  };

  const sampleCredentials = [
    { username: 'admin', password: 'admin123', role: 'Quản lý', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
    { username: 'ketoan1', password: 'ketoan123', role: 'Kế toán', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    { username: 'vanchanh1', password: 'vanchanh123', role: 'Vận hành', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
          <Building2 className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Chào mừng đến với KAG Financial</h1>
          <p className="text-xl text-muted-foreground">Hệ thống quản lý tài khoản quảng cáo chuyên nghiệp</p>
        </div>
      </div>

      {/* Sample Data Setup */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Khởi tạo hệ thống</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Để bắt đầu sử dụng hệ thống, bạn cần tạo dữ liệu mẫu bao gồm tài khoản quản trị và nhân viên.
          </p>
          
          <div className="flex justify-center">
            <Button
              onClick={() => initializeSampleDataMutation.mutate()}
              disabled={initializeSampleDataMutation.isPending || sampleDataCreated}
              size="lg"
              className="flex items-center space-x-2"
            >
              {sampleDataCreated ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Đã tạo dữ liệu mẫu</span>
                </>
              ) : (
                <>
                  <Users className="h-5 w-5" />
                  <span>
                    {initializeSampleDataMutation.isPending ? 'Đang tạo...' : 'Tạo dữ liệu mẫu'}
                  </span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Login Credentials */}
      {sampleDataCreated && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Thông tin đăng nhập</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sampleCredentials.map((cred, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={cred.color}>{cred.role}</Badge>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Username:</span>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {cred.username}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(cred.username)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Password:</span>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {cred.password}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(cred.password)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Lưu ý:</strong> Đây là tài khoản mẫu để demo. Trong môi trường thực tế, 
                bạn nên thay đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Overview */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Tính năng hệ thống</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Building2 className="h-5 w-5" />
                <span>Quản lý tài khoản</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Quản lý tài khoản quảng cáo</li>
                <li>• Hỗ trợ nhiều nền tảng</li>
                <li>• Import hàng loạt</li>
                <li>• Tính toán VAT tự động</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Activity className="h-5 w-5" />
                <span>Chi phí tài khoản</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Theo dõi chi phí theo khách hàng</li>
                <li>• Giao diện Excel-like</li>
                <li>• Phân loại chi phí chi tiết</li>
                <li>• Báo cáo thời gian thực</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Users className="h-5 w-5" />
                <span>Quản lý khách hàng</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Thông tin khách hàng</li>
                <li>• Gán tài khoản</li>
                <li>• Theo dõi chi tiêu</li>
                <li>• Báo cáo tùy chỉnh</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Shield className="h-5 w-5" />
                <span>Phân quyền nhân viên</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Kế toán: Chi phí, báo cáo</li>
                <li>• Vận hành: Tài khoản, khách hàng</li>
                <li>• Quản lý: Toàn quyền</li>
                <li>• Lịch sử hoạt động chi tiết</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Next Steps */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Bước tiếp theo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Đăng nhập bằng một trong các tài khoản mẫu ở trên</li>
            <li>Thêm tài khoản quảng cáo vào hệ thống</li>
            <li>Tạo khách hàng và gán tài khoản</li>
            <li>Nhập chi phí theo tháng cho từng khách hàng</li>
            <li>Theo dõi báo cáo và thống kê chi tiết</li>
          </ol>
          
          <div className="pt-4">
            <Button asChild className="w-full">
              <a href="/employee-login">Đăng nhập ngay</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}