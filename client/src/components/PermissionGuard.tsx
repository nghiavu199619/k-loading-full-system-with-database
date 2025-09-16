import React from 'react';
import { useHasPermission, type TabName, type PermissionLevel } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

interface PermissionGuardProps {
  tabName: TabName;
  requiredLevel?: PermissionLevel;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component to guard content based on user permissions
 */
export function PermissionGuard({ 
  tabName, 
  requiredLevel = 'view', 
  children, 
  fallback 
}: PermissionGuardProps) {
  const hasPermission = useHasPermission(tabName, requiredLevel);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <ShieldX className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Không có quyền truy cập</strong>
            <br />
            Bạn không có quyền {requiredLevel === 'edit' ? 'chỉnh sửa' : 'xem'} tính năng này.
            Vui lòng liên hệ quản trị viên để được cấp quyền.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * HOC to wrap pages with permission checks
 */
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  tabName: TabName,
  requiredLevel: PermissionLevel = 'view'
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard tabName={tabName} requiredLevel={requiredLevel}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}