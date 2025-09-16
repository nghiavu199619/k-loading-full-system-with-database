import type { Express } from "express";
import { storage } from "../storage";
import { debugRequireAuth as requireAuth } from "../middleware/auth";

export function setupSystemLogRoutes(app: Express) {
  // Get system logs (requires authentication)
  app.get("/api/system-logs", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getSystemLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      res.status(500).json({ error: "Failed to fetch system logs" });
    }
  });

  // Get system logs by user (requires authentication)
  app.get("/api/system-logs/user/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Check if user has permission to view logs for this user
      const currentUserId = (req as any).user?.id;
      const currentUserRole = (req as any).user?.role;
      
      // Directors can see all logs, employees can only see their own
      if (currentUserRole !== 'director' && currentUserId !== userId) {
        return res.status(403).json({ error: "Không có quyền xem logs của user khác" });
      }
      
      const logs = await storage.getSystemLogsByUser(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  });

  // Get system logs by table (requires authentication)
  app.get("/api/system-logs/table/:tableName", requireAuth, async (req, res) => {
    try {
      const tableName = req.params.tableName;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const logs = await storage.getSystemLogsByTable(tableName, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching table logs:", error);
      res.status(500).json({ error: "Failed to fetch table logs" });
    }
  });

  // Create manual system log (for testing - requires authentication)
  app.post("/api/system-logs", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const logData = {
        ...req.body,
        userId: userId,
        userSession: (req as any).sessionID || 'api',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };
      
      const log = await storage.createSystemLog(logData);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating system log:", error);
      res.status(500).json({ error: "Failed to create system log" });
    }
  });
}