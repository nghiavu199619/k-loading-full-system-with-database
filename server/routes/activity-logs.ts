import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { requireTabPermission } from "../middleware/permissions";

export function setupActivityLogRoutes(app: Express) {
  // Get combined logs for current user and their employees (hierarchical access)
  app.get("/api/activity-logs", requireAuth, requireTabPermission('activity-history', 'view'), async (req, res) => {
    try {
      const currentUserId = (req as any).user?.id;
      const currentUserRole = (req as any).user?.role;
      const limit = parseInt(req.query.limit as string) || 100;
      
      let allLogs = [];
      
      if (currentUserRole === 'director') {
        // Directors can see logs for themselves and their employees
        const employeeIds = await storage.getEmployeeIdsByDirector(currentUserId);
        const userIds = [currentUserId, ...employeeIds];
        
        // Get system logs for director and employees (ONLY from logs_kloading to prevent duplicates)
        const systemLogs = await storage.getSystemLogsByUserList(userIds, limit);
        // REMOVED: activityLogs - causes duplicates with systemLogs from logs_kloading
        // Get login attempts for director and employees
        const loginAttempts = await storage.getLoginAttemptsByUserList(userIds, limit);
        // Get employee management logs for director
        const employeeLogs = await storage.getEmployeeManagementLogsByDirector(currentUserId, limit);
        
        allLogs = [...systemLogs, ...loginAttempts, ...employeeLogs];
      } else {
        // Employees can only see their own logs (ONLY from logs_kloading to prevent duplicates)
        const systemLogs = await storage.getSystemLogsByUser(currentUserId, limit);
        // REMOVED: activityLogs - causes duplicates with systemLogs from logs_kloading
        const loginAttempts = await storage.getLoginAttemptsByUser(currentUserId, limit);
        
        allLogs = [...systemLogs, ...loginAttempts];
      }
      
      // Sort by timestamp descending
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(allLogs.slice(0, limit));
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Get system logs by specific user (role-based access)
  app.get("/api/activity-logs/user/:userId", requireAuth, requireTabPermission('activity-history', 'view'), async (req, res) => {
    try {
      const currentUserId = (req as any).user?.id;
      const currentUserRole = (req as any).user?.role;
      const targetUserId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Allow all authenticated users to view any logs
      
      const logs = await storage.getSystemLogsByUser(targetUserId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user activity logs:", error);
      res.status(500).json({ error: "Failed to fetch user activity logs" });
    }
  });

  // Get system logs by table
  app.get("/api/activity-logs/table/:tableName", requireAuth, async (req, res) => {
    try {
      
      const tableName = req.params.tableName;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const logs = await storage.getSystemLogsByTable(tableName, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching table activity logs:", error);
      res.status(500).json({ error: "Failed to fetch table activity logs" });
    }
  });
}