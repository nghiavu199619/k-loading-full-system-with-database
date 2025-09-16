import { useLocation } from "wouter";
import { Building2 } from "lucide-react";

const pageNames: Record<string, string> = {
  "/": "Trang chủ",
  "/dashboard": "Dashboard",
  "/account-expenses": "Chi phí tài khoản",
  "/account-management": "Quản lý tài khoản",
  "/client-management": "Quản lý khách hàng",
  "/employee-management": "Quản lý nhân viên",
  "/activity-logs": "Lịch sử hoạt động",
  "/employee-login": "Đăng nhập nhân viên",
};

export function MobileHeader() {
  const [location] = useLocation();
  const currentPageName = pageNames[location] || "KAG Financial";

  return (
    <header className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
      <div className="flex items-center space-x-3 ml-12">
        <Building2 className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg truncate">{currentPageName}</h1>
      </div>
    </header>
  );
}