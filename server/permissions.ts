// K-Loading Role-Based Permission System
// Implements Director > Manager > Employee hierarchy

export interface Permission {
  name: string;
  description: string;
  category: string;
}

export interface RoleDefinition {
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  canManageRoles: string[];
}

// Comprehensive permissions for K-Loading system
export const PERMISSIONS: Record<string, Permission> = {
  // User Management
  'USER_CREATE': { name: 'USER_CREATE', description: 'Tạo tài khoản người dùng mới', category: 'user_management' },
  'USER_READ': { name: 'USER_READ', description: 'Xem thông tin người dùng', category: 'user_management' },
  'USER_UPDATE': { name: 'USER_UPDATE', description: 'Chỉnh sửa thông tin người dùng', category: 'user_management' },
  'USER_DELETE': { name: 'USER_DELETE', description: 'Xóa tài khoản người dùng', category: 'user_management' },
  'USER_MANAGE_ROLES': { name: 'USER_MANAGE_ROLES', description: 'Quản lý vai trò người dùng', category: 'user_management' },
  
  // Client Management
  'CLIENT_CREATE': { name: 'CLIENT_CREATE', description: 'Tạo khách hàng mới', category: 'client_management' },
  'CLIENT_READ': { name: 'CLIENT_READ', description: 'Xem thông tin khách hàng', category: 'client_management' },
  'CLIENT_UPDATE': { name: 'CLIENT_UPDATE', description: 'Chỉnh sửa thông tin khách hàng', category: 'client_management' },
  'CLIENT_DELETE': { name: 'CLIENT_DELETE', description: 'Xóa khách hàng', category: 'client_management' },
  
  // Ad Account Management
  'ACCOUNT_CREATE': { name: 'ACCOUNT_CREATE', description: 'Tạo tài khoản quảng cáo mới', category: 'account_management' },
  'ACCOUNT_READ': { name: 'ACCOUNT_READ', description: 'Xem tài khoản quảng cáo', category: 'account_management' },
  'ACCOUNT_UPDATE': { name: 'ACCOUNT_UPDATE', description: 'Chỉnh sửa tài khoản quảng cáo', category: 'account_management' },
  'ACCOUNT_DELETE': { name: 'ACCOUNT_DELETE', description: 'Xóa tài khoản quảng cáo', category: 'account_management' },
  
  // Expense Management
  'EXPENSE_CREATE': { name: 'EXPENSE_CREATE', description: 'Tạo chi phí mới', category: 'expense_management' },
  'EXPENSE_READ': { name: 'EXPENSE_READ', description: 'Xem chi phí', category: 'expense_management' },
  'EXPENSE_UPDATE': { name: 'EXPENSE_UPDATE', description: 'Chỉnh sửa chi phí', category: 'expense_management' },
  'EXPENSE_DELETE': { name: 'EXPENSE_DELETE', description: 'Xóa chi phí', category: 'expense_management' },
  
  // Budget Management
  'BUDGET_CREATE': { name: 'BUDGET_CREATE', description: 'Tạo ngân sách mới', category: 'budget_management' },
  'BUDGET_READ': { name: 'BUDGET_READ', description: 'Xem ngân sách', category: 'budget_management' },
  'BUDGET_UPDATE': { name: 'BUDGET_UPDATE', description: 'Chỉnh sửa ngân sách', category: 'budget_management' },
  'BUDGET_DELETE': { name: 'BUDGET_DELETE', description: 'Xóa ngân sách', category: 'budget_management' },
  
  // Via Management
  'VIA_CREATE': { name: 'VIA_CREATE', description: 'Tạo via mới', category: 'via_management' },
  'VIA_READ': { name: 'VIA_READ', description: 'Xem danh sách via', category: 'via_management' },
  'VIA_UPDATE': { name: 'VIA_UPDATE', description: 'Chỉnh sửa thông tin via', category: 'via_management' },
  'VIA_DELETE': { name: 'VIA_DELETE', description: 'Xóa via', category: 'via_management' },
  
  // Threshold Management
  'THRESHOLD_CREATE': { name: 'THRESHOLD_CREATE', description: 'Tạo ngưỡng mới', category: 'threshold_management' },
  'THRESHOLD_READ': { name: 'THRESHOLD_READ', description: 'Xem danh sách ngưỡng', category: 'threshold_management' },
  'THRESHOLD_UPDATE': { name: 'THRESHOLD_UPDATE', description: 'Chỉnh sửa ngưỡng', category: 'threshold_management' },
  'THRESHOLD_DELETE': { name: 'THRESHOLD_DELETE', description: 'Xóa ngưỡng', category: 'threshold_management' },
  
  // Dashboard & Reports
  'DASHBOARD_VIEW': { name: 'DASHBOARD_VIEW', description: 'Xem tổng quan hệ thống', category: 'reporting' },
  'REPORTS_GENERATE': { name: 'REPORTS_GENERATE', description: 'Tạo báo cáo', category: 'reporting' },
  'ANALYTICS_VIEW': { name: 'ANALYTICS_VIEW', description: 'Xem phân tích dữ liệu', category: 'reporting' },
  
  // System Administration
  'SYSTEM_SETTINGS': { name: 'SYSTEM_SETTINGS', description: 'Quản lý cài đặt hệ thống', category: 'system_admin' },
  'ACTIVITY_LOGS': { name: 'ACTIVITY_LOGS', description: 'Xem nhật ký hoạt động', category: 'system_admin' },
  'DATA_EXPORT': { name: 'DATA_EXPORT', description: 'Xuất dữ liệu', category: 'system_admin' },
  'DATA_IMPORT': { name: 'DATA_IMPORT', description: 'Nhập dữ liệu', category: 'system_admin' },
  'BACKUP_RESTORE': { name: 'BACKUP_RESTORE', description: 'Sao lưu và khôi phục', category: 'system_admin' },
};

// Role definitions with hierarchical permissions
export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  director: {
    name: 'director',
    displayName: 'Giám đốc',
    description: 'Toàn quyền truy cập và quản lý hệ thống',
    canManageRoles: ['director', 'manager', 'employee'],
    permissions: [
      // Full access to everything
      'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_MANAGE_ROLES',
      'CLIENT_CREATE', 'CLIENT_READ', 'CLIENT_UPDATE', 'CLIENT_DELETE',
      'ACCOUNT_CREATE', 'ACCOUNT_READ', 'ACCOUNT_UPDATE', 'ACCOUNT_DELETE',
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
      'BUDGET_CREATE', 'BUDGET_READ', 'BUDGET_UPDATE', 'BUDGET_DELETE',
      'VIA_CREATE', 'VIA_READ', 'VIA_UPDATE', 'VIA_DELETE',
      'THRESHOLD_CREATE', 'THRESHOLD_READ', 'THRESHOLD_UPDATE', 'THRESHOLD_DELETE',
      'DASHBOARD_VIEW', 'REPORTS_GENERATE', 'ANALYTICS_VIEW',
      'SYSTEM_SETTINGS', 'ACTIVITY_LOGS', 'DATA_EXPORT', 'DATA_IMPORT', 'BACKUP_RESTORE'
    ]
  },
  
  manager: {
    name: 'manager',
    displayName: 'Quản lý',
    description: 'Quản lý nhân viên và hoạt động kinh doanh',
    canManageRoles: ['employee'],
    permissions: [
      // User management for employees only
      'USER_CREATE', 'USER_READ', 'USER_UPDATE', 
      // Full business operations
      'CLIENT_CREATE', 'CLIENT_READ', 'CLIENT_UPDATE', 'CLIENT_DELETE',
      'ACCOUNT_CREATE', 'ACCOUNT_READ', 'ACCOUNT_UPDATE', 'ACCOUNT_DELETE',
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
      'BUDGET_CREATE', 'BUDGET_READ', 'BUDGET_UPDATE', 'BUDGET_DELETE',
      'VIA_CREATE', 'VIA_READ', 'VIA_UPDATE', 'VIA_DELETE',
      'THRESHOLD_CREATE', 'THRESHOLD_READ', 'THRESHOLD_UPDATE', 'THRESHOLD_DELETE',
      // Reporting
      'DASHBOARD_VIEW', 'REPORTS_GENERATE', 'ANALYTICS_VIEW',
      // Limited admin
      'ACTIVITY_LOGS', 'DATA_EXPORT'
    ]
  },
  
  employee: {
    name: 'employee',
    displayName: 'Nhân viên',
    description: 'Truy cập hạn chế theo phân quyền cụ thể',
    canManageRoles: [],
    permissions: [
      // Basic read access
      'CLIENT_READ', 'ACCOUNT_READ', 'EXPENSE_READ', 'BUDGET_READ',
      // Basic dashboard
      'DASHBOARD_VIEW',
      // Can update assigned data only (controlled by additional permissions)
      'EXPENSE_UPDATE', 'ACCOUNT_UPDATE'
    ]
  }
};

// Permission checking utilities
export class PermissionManager {
  static hasPermission(userRole: string, permission: string, userPermissions?: string[]): boolean {
    const roleDefinition = ROLE_DEFINITIONS[userRole];
    if (!roleDefinition) return false;
    
    // Check role-based permissions
    if (roleDefinition.permissions.includes(permission)) {
      return true;
    }
    
    // Check additional user-specific permissions
    if (userPermissions && userPermissions.includes(permission)) {
      return true;
    }
    
    return false;
  }
  
  static canManageUser(managerRole: string, targetRole: string): boolean {
    const roleDefinition = ROLE_DEFINITIONS[managerRole];
    if (!roleDefinition) return false;
    
    return roleDefinition.canManageRoles.includes(targetRole);
  }
  
  static getRolePermissions(role: string): string[] {
    const roleDefinition = ROLE_DEFINITIONS[role];
    return roleDefinition ? roleDefinition.permissions : [];
  }
  
  static getAllPermissions(): Permission[] {
    return Object.values(PERMISSIONS);
  }
  
  static getPermissionsByCategory(): Record<string, Permission[]> {
    const result: Record<string, Permission[]> = {};
    
    Object.values(PERMISSIONS).forEach(permission => {
      if (!result[permission.category]) {
        result[permission.category] = [];
      }
      result[permission.category].push(permission);
    });
    
    return result;
  }
  
  static isHigherRole(role1: string, role2: string): boolean {
    const hierarchy = { director: 3, manager: 2, employee: 1 };
    return (hierarchy[role1 as keyof typeof hierarchy] || 0) > (hierarchy[role2 as keyof typeof hierarchy] || 0);
  }
}

// Default permissions for new users based on role
export const getDefaultPermissions = (role: string): string[] => {
  return ROLE_DEFINITIONS[role]?.permissions || [];
};

// Permission middleware factory
export const requirePermission = (permission: string) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Chưa đăng nhập" 
      });
    }

    const hasPermission = PermissionManager.hasPermission(
      req.user.role, 
      permission, 
      req.user.permissions
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false, 
        message: `Không có quyền ${PERMISSIONS[permission]?.description || permission}` 
      });
    }

    next();
  };
};

// Multiple permissions middleware (user needs ALL permissions)
export const requireAllPermissions = (permissions: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Chưa đăng nhập" 
      });
    }

    const hasAllPermissions = permissions.every(permission => 
      PermissionManager.hasPermission(
        req.user.role, 
        permission, 
        req.user.permissions
      )
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        success: false, 
        message: "Không đủ quyền truy cập" 
      });
    }

    next();
  };
};

// Any permissions middleware (user needs ANY of the permissions)
export const requireAnyPermission = (permissions: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Chưa đăng nhập" 
      });
    }

    const hasAnyPermission = permissions.some(permission => 
      PermissionManager.hasPermission(
        req.user.role, 
        permission, 
        req.user.permissions
      )
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        success: false, 
        message: "Không có quyền truy cập" 
      });
    }

    next();
  };
};