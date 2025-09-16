import { useQuery } from '@tanstack/react-query';

export interface UserPermissions {
  permissions: Record<string, string>;
  role: string;
}

export type PermissionLevel = 'none' | 'view' | 'edit';
export type TabName = 
  | 'dashboard'
  | 'account-management'
  | 'expense-management'
  | 'card-management'
  | 'client-management'
  | 'employee-management'
  | 'activity-history'
  | 'system-settings'
  | 'via-management'
  | 'threshold-management'
  | 'payment-management'
  | 'time-tracking'
  | 'financial-report';

/**
 * Hook to get current user's permissions
 */
export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['/api/auth/permissions'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    permissions: data?.permissions || {},
    role: data?.role || 'employee',
    isLoading,
    error,
  };
}

/**
 * Hook to check if user has specific permission
 */
export function useHasPermission(tabName: TabName, requiredLevel: PermissionLevel = 'view') {
  const { permissions, role } = usePermissions();

  // Directors have full access
  if (role === 'director') {
    return true;
  }

  const userPermission = permissions[tabName] as PermissionLevel;
  if (!userPermission || userPermission === 'none') {
    return false;
  }

  // Check permission hierarchy: edit > view > none
  const levels = { none: 0, view: 1, edit: 2 };
  return levels[userPermission] >= levels[requiredLevel];
}

/**
 * Hook to get accessible tabs for navigation
 */
export function useAccessibleTabs() {
  const { permissions, role } = usePermissions();

  const allTabs = [
    { key: 'dashboard', label: 'Tổng quan', path: '/dashboard' },
    { key: 'account-management', label: 'Tài khoản quảng cáo', path: '/account-management' },
    { key: 'expense-management', label: 'Theo dõi chi phí', path: '/expense-management' },
    { key: 'card-management', label: 'Quản lý Thẻ', path: '/card-management' },
    { key: 'via-management', label: 'Quản Lý Via', path: '/via-management' },
    { key: 'threshold-management', label: 'Quản Lý Ngưỡng', path: '/threshold-management' },
    { key: 'payment-management', label: 'Quản Lý Thanh toán', path: '/payment-management' },
    { key: 'financial-report', label: 'Báo cáo Tài chính', path: '/financial-report' },
    { key: 'time-tracking', label: 'Chấm công', path: '/time-tracking' },
    { key: 'client-management', label: 'Quản lý khách hàng', path: '/client-management' },
    { key: 'employee-management', label: 'Quản lý nhân viên', path: '/employee-management' },
    { key: 'activity-history', label: 'Lịch sử hoạt động', path: '/activity-history' },
    { key: 'system-settings', label: 'Cài đặt hệ thống', path: '/system-settings' },
  ];

  if (role === 'director') {
    return allTabs;
  }

  return allTabs.filter(tab => {
    const permission = permissions[tab.key as TabName];
    return permission && permission !== 'none';
  });
}