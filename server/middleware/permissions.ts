import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    createdBy?: number;
    fullName?: string;
  };
}

// Tab permission mapping
export const TAB_PERMISSIONS = {
  'dashboard': 'dashboard',
  'account-management': 'account-management', 
  'expense-management': 'expense-management',
  'client-management': 'client-management',
  'employee-management': 'employee-management',
  'activity-history': 'activity-history',
  'system-settings': 'system-settings',
  'card-management': 'card-management',
  'via-management': 'via-management',
  'threshold-management': 'threshold-management',
  'time-tracking': 'time-tracking'
} as const;

export type TabName = keyof typeof TAB_PERMISSIONS;
export type PermissionLevel = 'none' | 'view' | 'edit';

/**
 * Check if user has permission for a specific tab
 */
export async function checkUserPermission(
  userId: number, 
  tabName: TabName, 
  requiredLevel: PermissionLevel = 'view'
): Promise<boolean> {
  try {
    // Get user info to check role
    const user = await storage.getUserById(userId);
    if (!user) return false;

    // Directors have full access to everything
    if (user.role === 'director') {
      console.log(`👑 Director ${userId} has full access to ${tabName}`);
      return true;
    }

    // Get user permissions from database
    const permissions = await storage.getEmployeePermissions(userId);
    const tabPermission = permissions.find(p => p.tabName === tabName);
    
    if (!tabPermission) {
      console.log(`❌ No permission found for user ${userId} on tab ${tabName}`);
      return false;
    }

    // Check permission level hierarchy: edit > view > none
    const permissionHierarchy = { none: 0, view: 1, edit: 2 };
    const userLevel = permissionHierarchy[tabPermission.permission as PermissionLevel];
    const requiredLevelValue = permissionHierarchy[requiredLevel];

    const hasPermission = userLevel >= requiredLevelValue;
    
    console.log(`🔐 User ${userId} (${user.role}) permission check for ${tabName}: ${tabPermission.permission} ${hasPermission ? '✅' : '❌'} ${requiredLevel}`);
    
    return hasPermission;
  } catch (error) {
    console.error(`❌ Permission check error for user ${userId}, tab ${tabName}:`, error);
    return false;
  }
}

/**
 * Middleware factory to require specific tab permission
 */
export function requireTabPermission(tabName: TabName, requiredLevel: PermissionLevel = 'view') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const hasPermission = await checkUserPermission(req.user.id, tabName, requiredLevel);
      
      if (!hasPermission) {
        const levelText = requiredLevel === 'edit' ? 'chỉnh sửa' : 'xem';
        return res.status(403).json({ 
          error: `Không có quyền ${levelText} trang ${tabName}`,
          tabName,
          requiredLevel,
          userId: req.user.id
        });
      }

      next();
    } catch (error) {
      console.error(`❌ Permission middleware error:`, error);
      res.status(500).json({ error: 'Lỗi kiểm tra quyền truy cập' });
    }
  };
}

/**
 * Get user's accessible tabs with their permission levels
 */
export async function getUserAccessibleTabs(userId: number): Promise<Record<TabName, PermissionLevel>> {
  try {
    const user = await storage.getUserById(userId);
    if (!user) return {} as Record<TabName, PermissionLevel>;

    // Directors have full access
    if (user.role === 'director') {
      const allTabs = Object.keys(TAB_PERMISSIONS) as TabName[];
      return allTabs.reduce((acc, tab) => {
        acc[tab] = 'edit';
        return acc;
      }, {} as Record<TabName, PermissionLevel>);
    }

    // Get permissions from database
    const permissions = await storage.getEmployeePermissions(userId);
    const accessibleTabs = {} as Record<TabName, PermissionLevel>;

    permissions.forEach(permission => {
      if (permission.tabName in TAB_PERMISSIONS) {
        accessibleTabs[permission.tabName as TabName] = permission.permission as PermissionLevel;
      }
    });

    return accessibleTabs;
  } catch (error) {
    console.error(`❌ Error getting accessible tabs for user ${userId}:`, error);
    return {} as Record<TabName, PermissionLevel>;
  }
}

/**
 * Middleware to add user permissions to request object
 */
export async function addUserPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.user) {
      const permissions = await getUserAccessibleTabs(req.user.id);
      (req as any).userPermissions = permissions;
    }
    next();
  } catch (error) {
    console.error(`❌ Error adding user permissions:`, error);
    next();
  }
}

// Time tracking authorization middleware
export function authorizeTimeTracking(requiredLevel: 'view' | 'edit') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: "Chưa đăng nhập" 
        });
      }

      // Directors have full access
      if (req.user.role === 'director') {
        return next();
      }

      // Check user permissions for time-tracking
      const hasPermission = await checkUserPermission(req.user.id, 'time-tracking', requiredLevel);
      
      if (!hasPermission) {
        const levelText = requiredLevel === 'edit' ? 'chỉnh sửa' : 'xem';
        return res.status(403).json({ 
          success: false, 
          message: `Không có quyền ${levelText} chấm công` 
        });
      }

      next();
    } catch (error) {
      console.error(`❌ Time tracking permission error:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi kiểm tra quyền truy cập' 
      });
    }
  };
}