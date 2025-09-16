import type { Express } from "express";
import "../types"; // Import type extensions
import { storage } from "../storage";
import { insertEmployeeSchema, insertEmployeeRoleSchema } from "@shared/schema";
import { z } from "zod";
import { 
  authenticateEmployee, 
  hashPassword, 
  verifyPassword, 
  generateToken,
  DEFAULT_ROLE_PERMISSIONS 
} from "../auth";
import { requireAuth, requireDirector, requireManager, requireEmployee } from "../middleware/auth";
import { ActivityLogger } from "../services/activity-logger";
import { requireTabPermission } from "../middleware/permissions";

// Create a simple permission checker for employee routes
const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    if (!req.employee) {
      return res.status(401).json({ error: "Chưa đăng nhập" });
    }

    const permissions = DEFAULT_ROLE_PERMISSIONS[req.employee.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
    
    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: "Không có quyền truy cập" });
    }

    next();
  };
};

export function setupEmployeeRoutes(app: Express) {
  // Director creates employee endpoint - Creates employee with proper role hierarchy
  app.post('/api/employees/create-by-director', requireAuth, async (req, res) => {
    try {
      const directorId = (req as any).user?.id;
      
      if (!directorId) {
        return res.status(401).json({
          success: false,
          message: "Không thể xác định giám đốc"
        });
      }

      // Import required modules for this endpoint
      const { authService } = await import('../auth');
      const { db } = await import('../db');
      const { authUsers } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      // Verify the creator is actually a director
      const [director] = await db.select().from(authUsers)
        .where(eq(authUsers.id, directorId))
        .limit(1);

      if (!director || director.role !== 'director') {
        return res.status(403).json({
          success: false,
          message: "Chỉ giám đốc mới có thể tạo nhân viên"
        });
      }

      const { username, email, fullName, password } = req.body;
      
      if (!username || !password || !fullName) {
        return res.status(400).json({ 
          success: false, 
          message: "Thiếu thông tin bắt buộc" 
        });
      }

      // Create employee with proper hierarchy
      const employeeData = {
        username,
        email: email || `${username}@company.com`,
        fullName,
        password,
        role: 'employee' // Force employee role when created by director
      };

      // Get client IP and user agent for logging
      const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      const result = await authService.createEmployeeByDirector(employeeData, directorId, {
        ipAddress: clientIP as string,
        userAgent: userAgent as string
      });

      if (result.success) {
        // Log employee creation (field-level only)
        await ActivityLogger.logFieldChange({
          tableName: 'auth_users',
          recordId: result.user?.id || 0,
          actionType: 'create',
          fieldName: 'employee',
          oldValue: null,
          newValue: result.user?.fullName || username,
          userId: directorId,
          userSession: 'director-session',
          userName: director.fullName,
          ipAddress: clientIP as string,
          userAgent: userAgent as string,
        });

        return res.status(201).json({
          success: true,
          message: result.message,
          user: {
            id: result.user?.id,
            username: result.user?.username,
            email: result.user?.email,
            fullName: result.user?.fullName,
            role: result.user?.role,
            status: result.user?.status,
            createdBy: result.user?.createdBy
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('❌ Create employee by director error:', error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống"
      });
    }
  });

  // Employee login
  app.post("/api/employees/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username và password là bắt buộc" });
      }

      const employee = await storage.getEmployeeByUsername(username);
      if (!employee) {
        return res.status(401).json({ error: "Thông tin đăng nhập không chính xác" });
      }

      const isValidPassword = await verifyPassword(password, employee.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Thông tin đăng nhập không chính xác" });
      }

      const token = generateToken(employee.id);
      
      // Log employee login (field-level only)
      await ActivityLogger.logFieldChange({
        tableName: 'employees',
        recordId: employee.id,
        actionType: 'login',
        fieldName: 'login',
        oldValue: null,
        newValue: 'Đăng nhập thành công',
        userId: employee.id,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: employee.username || 'Unknown',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      res.json({
        employee: {
          id: employee.id,
          username: employee.username,
          fullName: employee.fullName,
          role: employee.role,
          isActive: employee.isActive
        },
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Đăng nhập thất bại" });
    }
  });

  // Get current employee info
  app.get("/api/employees/me", authenticateEmployee, async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.employeeId!);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json({
        id: employee.id,
        username: employee.username,
        fullName: employee.fullName,
        role: employee.role,
        isActive: employee.isActive
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get employee info" });
    }
  });

  // Get employees under director's management (hierarchical filtering)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      let directorId = user?.id;
      
      // If not director, use their director's id to view employees under same director
      if (user?.role !== 'director' && user?.createdBy) {
        directorId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing employees under Director ${directorId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own employees`);
      }

      // Get only employees created by this director (excluding other directors)
      const employees = await storage.getEmployeesByDirector(directorId);
      
      console.log(`👑 Director ${directorId} has ${employees.length} team members`);
      console.log(`👥 Team member roles:`, employees.map(emp => `${emp.fullName} (${emp.role})`));
      
      // Remove password hashes from response
      const safeEmployees = employees.map(emp => ({
        id: emp.id,
        username: emp.username,
        fullName: emp.fullName,
        email: emp.email,
        role: emp.role,
        status: emp.status,
        createdBy: emp.createdBy,
        createdAt: emp.createdAt,
        lastLogin: emp.lastLogin
      }));
      
      res.json(safeEmployees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ error: "Không thể lấy danh sách nhân viên" });
    }
  });

  // Create employee (hierarchical system) - UPDATED SYSTEM  
  app.post("/api/employees", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      let directorId = user?.id;
      
      // If not director, use their director's id as the createdBy (employees create under same director)
      if (user?.role !== 'director' && user?.createdBy) {
        directorId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) creating employee for Director ${directorId}`);
      } else {
        console.log(`👑 Director ${user?.id} creating employee`);
      }

      const { username, email, fullName, password, role } = req.body;
      
      console.log(`🔧 Creating employee with data:`, { username, email, fullName, role, hasPassword: !!password });
      
      if (!username || !fullName || !password) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
      }

      // Check if username already exists in auth_users
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Tên đăng nhập đã tồn tại" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create employee as auth_user with specified role and createdBy=director
      const employeeData = {
        username,
        email: email || null,
        fullName,
        passwordHash: hashedPassword,
        role: role || 'employee', // Use provided role or default to employee
        status: 'active',
        createdBy: directorId // Director who created this employee
      };

      const employee = await storage.createAuthUser(employeeData);
      
      console.log(`👑 Director ${directorId} created employee ${employee.id}`);
      
      // Log employee creation using unified ActivityLogger
      if (req.user) {
        await ActivityLogger.logFieldChange({
          tableName: 'auth_users',
          recordId: employee.id,
          actionType: 'create',
          fieldName: 'employee_create',
          oldValue: null,
          newValue: employee.fullName || employee.username,
          userId: req.user.id,
          userName: req.user.fullName || req.user.username,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      // Return employee without password hash
      res.status(201).json({
        id: employee.id,
        username: employee.username,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
        status: employee.status,
        createdBy: employee.createdBy,
        createdAt: employee.createdAt
      });
    } catch (error) {
      console.error("Create employee error:", error);
      
      if (error instanceof Error && error.message.includes('unique')) {
        return res.status(400).json({ error: "Tên đăng nhập đã tồn tại" });
      }
      
      res.status(500).json({ error: "Không thể tạo nhân viên" });
    }
  });

  // Update employee (management only)
  app.patch("/api/employees/:id", requireAuth, requireTabPermission('employee-management', 'edit'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, fullName, role, status, password } = req.body;
      
      const updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;
      if (password) updateData.passwordHash = await hashPassword(password);
      
      // Permission already checked by middleware - no additional role check needed

      // Get original data for logging
      const originalEmployee = await storage.getUserById(id);
      
      const employee = await storage.updateAuthUser(id, updateData);
      
      // Log employee management changes using unified ActivityLogger
      if (req.user) {
        // Log specific field changes
        for (const [fieldName, newValue] of Object.entries(updateData)) {
          if (fieldName !== 'updatedAt') { // Skip automatic timestamp updates
            const oldValue = originalEmployee ? (originalEmployee as any)[fieldName] : null;
            
            await ActivityLogger.logFieldChange({
              tableName: 'auth_users',
              recordId: employee.id,
              actionType: 'update',
              fieldName: fieldName,
              oldValue: oldValue,
              newValue: newValue,
              userId: req.user.id,
              userName: req.user.fullName || req.user.username,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            });
          }
        }
      }
      
      // Return employee without password hash
      res.json({
        id: employee.id,
        username: employee.username,
        fullName: employee.fullName,
        role: employee.role,
        status: employee.status,
        createdAt: employee.createdAt
      });
    } catch (error) {
      console.error("Update employee error:", error);
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  // Delete employee (director only)
  app.delete("/api/employees/:id", requireAuth, requireTabPermission('employee-management', 'edit'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Permission already checked by middleware - no additional role check needed

      // Check if employee exists - employee with edit permissions can delete any employee
      const employee = await storage.getUserById(id);
      if (!employee) {
        return res.status(404).json({ error: "Không tìm thấy nhân viên" });
      }

      await storage.deleteAuthUser(id);
      
      // Log employee deletion using unified ActivityLogger
      if (req.user) {
        await ActivityLogger.logFieldChange({
          tableName: 'auth_users',
          recordId: id,
          actionType: 'delete',
          fieldName: 'employee_delete',
          oldValue: employee.fullName || employee.username,
          newValue: null,
          userId: req.user.id,
          userName: req.user.fullName || req.user.username,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.json({ success: true, message: "Xóa nhân viên thành công" });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ error: "Không thể xóa nhân viên" });
    }
  });

  // Get employee roles  
  app.get("/api/employee-roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getEmployeeRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching employee roles:", error);
      res.status(500).json({ error: "Lỗi khi lấy danh sách vai trò" });
    }
  });

  // Create new role (management only)
  app.post("/api/employee-roles", authenticateEmployee, requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
    try {
      const validatedData = insertEmployeeRoleSchema.parse(req.body);
      const role = await storage.createEmployeeRole(validatedData);
      
      // Log role creation
      await ActivityLogger.logFieldChange({
        tableName: 'employee_roles',
        recordId: role.id,
        actionType: 'create',
        fieldName: 'role_creation',
        oldValue: null,
        newValue: role.name,
        userId: req.employeeId!,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: 'Employee',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create role" });
      }
    }
  });

  // Employee Permissions Routes
  app.get("/api/employees/:id/permissions", requireAuth, requireTabPermission('employee-management', 'view'), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const permissions = await storage.getEmployeePermissions(employeeId);
      res.json(permissions);
    } catch (error) {
      console.error("Error getting employee permissions:", error);
      res.status(500).json({ error: "Failed to get employee permissions" });
    }
  });

  app.post("/api/employees/:id/permissions", requireAuth, requireTabPermission('employee-management', 'edit'), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { permissions } = req.body;
      
      await storage.batchSetEmployeePermissions(employeeId, permissions);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting employee permissions:", error);
      res.status(500).json({ error: "Failed to set employee permissions" });
    }
  });

  // Get current user's accessible tabs and permission levels
  app.get("/api/auth/permissions", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: "Chưa đăng nhập" });
      }

      // Directors have full access to everything
      if (user.role === 'director') {
        const allPermissions = {
          'dashboard': 'edit',
          'account-management': 'edit',
          'expense-management': 'edit',
          'client-management': 'edit',
          'employee-management': 'edit',
          'activity-history': 'edit',
          'system-settings': 'edit',
          'card-management': 'edit',
          'via-management': 'edit',
          'threshold-management': 'edit'
        };
        return res.json({ permissions: allPermissions, role: user.role });
      }

      // Get permissions from database for non-director users
      const permissions = await storage.getEmployeePermissions(user.id);
      const permissionMap: Record<string, string> = {};
      
      permissions.forEach(perm => {
        permissionMap[perm.tabName] = perm.permission;
      });

      res.json({ permissions: permissionMap, role: user.role });
    } catch (error) {
      console.error("Error getting user permissions:", error);
      res.status(500).json({ error: "Failed to get user permissions" });
    }
  });
}