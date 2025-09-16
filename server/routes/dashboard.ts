import type { Express } from "express";
import { storage } from "../storage";
import { debugRequireAuth as requireAuth } from "../middleware/auth";
import { requirePermission } from "../permissions";

export function setupDashboardRoutes(app: Express) {
  // Dashboard stats with user-based filtering
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const user = (req as any).user;
      let userId = user?.id; // Get authenticated user ID
      
      // If not director, use their director's id for data access
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing dashboard stats for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own dashboard stats`);
      }
      
      console.log(`📊 Dashboard stats request for user ${userId}, month ${month}/${year}`);
      
      const stats = await storage.getDashboardStats(month, year, userId);
      
      console.log(`📊 Dashboard stats result:`, stats);
      res.json(stats);
    } catch (error) {
      console.error('❌ Dashboard stats error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });
}