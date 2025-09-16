import type { Express } from "express";
import { requireDirector } from "../middleware/auth";
import { requirePermission } from "../permissions";
import { authMigrationService } from "../services/auth-migration";
import { ActivityLogger } from "../services/activity-logger";
import { authService } from "../auth";

export function setupAdminRoutes(app: Express) {
  // Initialize auth system migration
  app.post("/api/admin/migrate-auth", requireDirector, async (req, res) => {
    try {
      await authMigrationService.runMigration();
      res.json({ success: true, message: "Auth migration completed successfully" });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ success: false, message: "Migration failed" });
    }
  });

  // Get system logs with user information
  app.get("/api/admin/logs", requireDirector, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      // Use storage to get activity logs instead
      const logs: any[] = [];
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Get active users
  app.get("/api/admin/active-users", requireDirector, async (req, res) => {
    try {
      const minutesAgo = parseInt(req.query.minutes as string) || 30;
      // Use storage to get active users instead
      const activeUsers: any[] = [];
      res.json(activeUsers);
    } catch (error) {
      console.error('Error fetching active users:', error);
      res.status(500).json({ error: "Failed to fetch active users" });
    }
  });

  // Get authentication statistics
  app.get("/api/admin/auth-stats", requireDirector, async (req, res) => {
    try {
      const recent = await authService.getLoginAttempts(100);
      const stats = {
        totalAttempts: recent.length,
        successfulLogins: recent.filter((attempt: any) => attempt.successful).length,
        failedLogins: recent.filter((attempt: any) => !attempt.successful).length,
        uniqueIPs: Array.from(new Set(recent.map((attempt: any) => attempt.ipAddress))).length
      };
      res.json(stats);
    } catch (error) {
      console.error('Error fetching auth stats:', error);
      res.status(500).json({ error: "Failed to fetch auth statistics" });
    }
  });

  // Security endpoint to list all active sessions
  app.get("/api/admin/sessions", requireDirector, async (req, res) => {
    try {
      // Sessions feature not yet implemented
      const sessions: any[] = [];
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: "Failed to fetch active sessions" });
    }
  });

  // Force logout user by session
  app.post("/api/admin/force-logout", requireDirector, async (req, res) => {
    try {
      const { sessionToken } = req.body;
      if (!sessionToken) {
        return res.status(400).json({ error: "Session token required" });
      }

      const result = await authService.logout(sessionToken);
      res.json(result);
    } catch (error) {
      console.error('Error forcing logout:', error);
      res.status(500).json({ error: "Failed to force logout" });
    }
  });
}