import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  CreditCard, 
  Users, 
  Building2, 
  Calculator, 
  FileText, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Activity,
  Settings,
  LogOut,
  FileCheck,
  Clock,
  Mail,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleTabs } from "@/hooks/usePermissions";

interface SidebarProps {
  className?: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  roleRequired?: string;
  disabled?: boolean;
}

const getIconForTab = (key: string) => {
  const iconMap: Record<string, any> = {
    'dashboard': Home,
    'account-management': CreditCard,
    'expense-management': Calculator,
    'card-management': CreditCard,
    'via-management': Building2,
    'threshold-management': FileText,
    'payment-management': FileCheck,
    'financial-report': FileText,
    'time-tracking': Clock,
    'email-management': Mail,
    'client-management': Users,
    'employee-management': UserCog,
    'activity-history': Activity,
    'system-settings': Settings,
    'ai-devops': Bot,
  };
  return iconMap[key] || Home;
};

const toolNavigation: NavigationItem[] = [
  {
    name: "Email Management",
    href: "/email-management",
    icon: Mail,
  },
  {
    name: "AI DevOps Agent",
    href: "/ai-devops",
    icon: Bot,
  }
];

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { collapsed, toggleCollapsed } = useSidebarContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isLoggingOut } = useAuth();
  const accessibleTabs = useAccessibleTabs();

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out",
          "bg-gradient-to-b from-white via-sky-50 to-blue-50 border-r border-sky-200 shadow-lg",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-sky-200">
            <div className="flex items-center justify-between">
              {!collapsed && (
                <div className="flex items-center space-x-2">
                  <Building2 className="h-6 w-6 text-sky-600" />
                  <span className="font-bold text-lg bg-gradient-to-r from-sky-700 to-blue-700 bg-clip-text text-transparent">KAG Financial</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log('🔧 Sidebar toggle clicked, current collapsed:', collapsed);
                  toggleCollapsed();
                }}
                className="hidden lg:flex p-2 hover:bg-sky-100 text-sky-600"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Main Navigation based on permissions */}
            {accessibleTabs.map((item) => {
              const isActive = location === item.path;
              const Icon = getIconForTab(item.key);
              
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-sky-100 hover:shadow-sm",
                    isActive
                      ? "bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 border-r-4 border-sky-500 shadow-sm"
                      : "text-slate-600 hover:text-sky-700"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}

            {/* Separator */}
            {!collapsed && (
              <div className="border-t border-sky-200 my-4">
                <div className="pt-4">
                  <p className="text-xs text-slate-500 px-3 mb-2 uppercase tracking-wider">
                    Tool
                  </p>
                </div>
              </div>
            )}

            {/* Tool Navigation */}
            {toolNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-sky-100 hover:shadow-sm",
                    isActive
                      ? "bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 border-r-4 border-sky-500 shadow-sm"
                      : "text-slate-600 hover:text-sky-700"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800">
            {/* User info */}
            {!collapsed && user && (
              <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                <p className="font-medium">{user.fullName}</p>
                <p className="text-gray-500">{user.email}</p>
              </div>
            )}
            
            {/* Logout button */}
            <Button
              variant="outline"
              size={collapsed ? "icon" : "sm"}
              onClick={logout}
              disabled={isLoggingOut}
              className={cn(
                "w-full transition-all duration-200",
                "hover:bg-red-50 hover:border-red-200 hover:text-red-600",
                collapsed && "px-2"
              )}
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && (
                <span className="ml-2">
                  {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </span>
              )}
            </Button>

            {/* Footer */}
            {!collapsed && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p>KAG Financial Management</p>
                <p>Version 1.0</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}