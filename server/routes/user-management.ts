import type { Express } from "express";
import { storage } from "../storage";
import { insertAuthUserSchema, type AuthUser } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requireDirector, requireManager } from "../middleware/auth";
import { requirePermission, PermissionManager } from "../permissions";
import bcrypt from "bcrypt";

export function setupUserManagementRoutes(app: Express) {
  
  // ===== USER CRUD OPERATIONS =====
  
  // Get all users (filtered based on role hierarchy)
  app.get("/api/users", requireAuth, requirePermission('USER_READ'), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const users = await storage.getAllUsers();
      
      // Filter users based on role hierarchy
      const filteredUsers = users.filter(user => {
        // Directors can see everyone
        if (currentUser.role === 'director') return true;
        
        // Managers can see employees and other managers (but not directors)
        if (currentUser.role === 'manager') {
          return user.role !== 'director';
        }
        
        // Employees can only see themselves
        return user.id === currentUser.id;
      });
      
      // Remove sensitive information
      const safeUsers = filteredUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        department: user.department,
        position: user.position,
        managerId: user.managerId,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải danh sách người dùng" });
    }
  });

  // ===== ROLE & PERMISSION MANAGEMENT =====

  // Get role definitions
  app.get("/api/users/roles", requireAuth, requirePermission('USER_READ'), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      
      // Return available roles based on user's permission level
      const availableRoles = [];
      
      if (currentUser.role === 'director') {
        availableRoles.push('director', 'manager', 'employee');
      } else if (currentUser.role === 'manager') {
        availableRoles.push('employee');
      }
      
      const roles = availableRoles.map(role => ({
        name: role,
        displayName: role === 'director' ? 'Giám đốc' : 
                    role === 'manager' ? 'Quản lý' : 'Nhân viên',
        permissions: PermissionManager.getRolePermissions(role)
      }));
      
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải danh sách vai trò" });
    }
  });

  // ===== USER STATISTICS =====

  // Get user activity statistics
  app.get("/api/users/stats", requireAuth, requirePermission('USER_READ'), async (req, res) => {
    try {
      const stats = await storage.getUserStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải thống kê người dùng" });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", requireAuth, requirePermission('USER_READ'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = (req as any).user;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      }
      
      // Check permission to view this user
      const canView = currentUser.role === 'director' || 
                     (currentUser.role === 'manager' && user.role !== 'director') ||
                     (user.id === currentUser.id);
      
      if (!canView) {
        return res.status(403).json({ success: false, message: "Không có quyền xem thông tin người dùng này" });
      }
      
      // Remove sensitive information
      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        department: user.department,
        position: user.position,
        managerId: user.managerId,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      
      res.json(safeUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải thông tin người dùng" });
    }
  });

  // Create new user (role-based restrictions)
  app.post("/api/users", requireAuth, requirePermission('USER_CREATE'), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      const userData = req.body;
      
      // Validate input
      const validatedData = insertAuthUserSchema.parse(userData);
      
      // Check if user can create this role
      if (!PermissionManager.canManageUser(currentUser.role, validatedData.role)) {
        return res.status(403).json({ 
          success: false, 
          message: `Không có quyền tạo người dùng với vai trò ${validatedData.role}` 
        });
      }
      
      // Hash password
      if (!validatedData.password) {
        return res.status(400).json({ 
          success: false, 
          message: "Mật khẩu là bắt buộc" 
        });
      }
      const passwordHash = await bcrypt.hash(validatedData.password, 12);
      
      // Prepare user data
      const newUserData = {
        username: validatedData.username,
        email: validatedData.email,
        passwordHash,
        fullName: validatedData.fullName,
        role: validatedData.role,
        department: userData.department,
        position: userData.position,
        managerId: userData.managerId || (currentUser.role !== 'director' ? currentUser.id : undefined),
        permissions: userData.permissions || [],
        status: 'active'
      };
      
      const newUser = await storage.createUser(newUserData);
      
      // Remove sensitive information from response
      const safeUser = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        status: newUser.status,
        department: newUser.department,
        position: newUser.position,
        managerId: newUser.managerId,
        createdAt: newUser.createdAt
      };
      
      res.status(201).json({ success: true, user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      
      console.error('Error creating user:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tạo người dùng" });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAuth, requirePermission('USER_UPDATE'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = (req as any).user;
      const updateData = req.body;
      
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      }
      
      // Check permission to update this user
      const canUpdate = currentUser.role === 'director' || 
                       (currentUser.role === 'manager' && existingUser.role !== 'director') ||
                       (userId === currentUser.id);
      
      if (!canUpdate) {
        return res.status(403).json({ success: false, message: "Không có quyền cập nhật người dùng này" });
      }
      
      // If changing role, check permission
      if (updateData.role && updateData.role !== existingUser.role) {
        if (!PermissionManager.canManageUser(currentUser.role, updateData.role)) {
          return res.status(403).json({ 
            success: false, 
            message: `Không có quyền thay đổi vai trò thành ${updateData.role}` 
          });
        }
      }
      
      // Hash new password if provided
      if (updateData.password) {
        updateData.passwordHash = await bcrypt.hash(updateData.password, 12);
        delete updateData.password;
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Remove sensitive information
      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        status: updatedUser.status,
        department: updatedUser.department,
        position: updatedUser.position,
        managerId: updatedUser.managerId,
        updatedAt: updatedUser.updatedAt
      };
      
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ success: false, message: "Lỗi khi cập nhật người dùng" });
    }
  });

  // Delete user (only directors can delete, managers can deactivate)
  app.delete("/api/users/:id", requireAuth, requirePermission('USER_DELETE'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = (req as any).user;
      
      const userToDelete = await storage.getUserById(userId);
      if (!userToDelete) {
        return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      }
      
      // Only directors can delete users
      if (currentUser.role !== 'director') {
        return res.status(403).json({ success: false, message: "Chỉ Giám đốc mới có quyền xóa người dùng" });
      }
      
      // Cannot delete yourself
      if (userId === currentUser.id) {
        return res.status(400).json({ success: false, message: "Không thể xóa chính mình" });
      }
      
      await storage.deleteUser(userId);
      res.json({ success: true, message: "Xóa người dùng thành công" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ success: false, message: "Lỗi khi xóa người dùng" });
    }
  });

  // ===== ROLE & PERMISSION MANAGEMENT =====

  // Get role definitions
  app.get("/api/users/roles", requireAuth, requirePermission('USER_READ'), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      
      // Return available roles based on user's permission level
      const availableRoles = [];
      
      if (currentUser.role === 'director') {
        availableRoles.push('director', 'manager', 'employee');
      } else if (currentUser.role === 'manager') {
        availableRoles.push('employee');
      }
      
      const roles = availableRoles.map(role => ({
        name: role,
        displayName: role === 'director' ? 'Giám đốc' : 
                    role === 'manager' ? 'Quản lý' : 'Nhân viên',
        permissions: PermissionManager.getRolePermissions(role)
      }));
      
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải danh sách vai trò" });
    }
  });

  // Get all permissions
  app.get("/api/users/permissions", requireAuth, requirePermission('USER_MANAGE_ROLES'), async (req, res) => {
    try {
      const permissions = PermissionManager.getPermissionsByCategory();
      res.json(permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải danh sách quyền" });
    }
  });

  // Update user permissions (directors only)
  app.patch("/api/users/:id/permissions", requireAuth, requireDirector, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { permissions } = req.body;
      
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: "Danh sách quyền không hợp lệ" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      }
      
      await storage.updateUserPermissions(userId, permissions);
      res.json({ success: true, message: "Cập nhật quyền thành công" });
    } catch (error) {
      console.error('Error updating permissions:', error);
      res.status(500).json({ success: false, message: "Lỗi khi cập nhật quyền" });
    }
  });

  // ===== ORGANIZATION HIERARCHY =====

  // Get user's subordinates
  app.get("/api/users/:id/subordinates", requireAuth, requireManager, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = (req as any).user;
      
      // Can only get subordinates of self or users you manage
      if (userId !== currentUser.id && currentUser.role !== 'director') {
        return res.status(403).json({ success: false, message: "Không có quyền xem thông tin này" });
      }
      
      const subordinates = await storage.getUserSubordinates(userId);
      
      const safeSubordinates = subordinates.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        department: user.department,
        position: user.position,
        lastLogin: user.lastLogin
      }));
      
      res.json(safeSubordinates);
    } catch (error) {
      console.error('Error fetching subordinates:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải danh sách cấp dưới" });
    }
  });

  // Get organization chart
  app.get("/api/users/organization-chart", requireAuth, requireManager, async (req, res) => {
    try {
      const orgChart = await storage.getOrganizationChart();
      res.json(orgChart);
    } catch (error) {
      console.error('Error fetching organization chart:', error);
      res.status(500).json({ success: false, message: "Lỗi khi tải sơ đồ tổ chức" });
    }
  });

}