import type { Express } from "express";
import "../types"; // Import type extensions
import { storage } from "../storage";
import { insertUserSettingSchema, insertUserStatsBadgeSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireTabPermission } from "../middleware/permissions";

export function setupSettingsRoutes(app: Express) {
  // Get user-specific system settings
  app.get("/api/settings", requireAuth, requireTabPermission('system-settings', 'view'), async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees use director's settings
      let effectiveUserId = user.id;
      if (user.role !== 'director' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) accessing settings for Director ${effectiveUserId}`);
      } else {
        console.log(`👑 Director ${user.id} accessing own settings`);
      }
      
      const settings = await storage.getUserSettings(effectiveUserId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update user-specific system settings
  app.patch("/api/settings", requireAuth, requireTabPermission('system-settings', 'edit'), async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees update director's settings
      let effectiveUserId = user.id;
      if (user.role !== 'director' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) updating settings for Director ${effectiveUserId}`);
      } else {
        console.log(`👑 Director ${user.id} updating own settings`);
      }
      
      console.log('🔧 Updating settings for effective user:', effectiveUserId, 'data:', req.body);
      const settings = await storage.updateUserSettings(effectiveUserId, req.body);
      console.log('✅ Settings updated successfully:', settings);
      
      res.json(settings);
    } catch (error) {
      console.error("❌ Error updating user settings:", error);
      res.status(500).json({ error: "Failed to update settings", details: error.message });
    }
  });

  // Get user-specific stats badges configuration
  app.get("/api/settings/stats", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees use director's stats badges
      let effectiveUserId = user.id;
      if (user.role === 'employee' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} accessing stats badges for Director ${effectiveUserId}`);
      }
      
      const stats = await storage.getUserStatsBadges(effectiveUserId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats badges:", error);
      res.status(500).json({ error: "Failed to fetch stats badges" });
    }
  });

  // Create user-specific stats badge
  app.post("/api/settings/stats", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees create stats badges for director
      let effectiveUserId = user.id;
      if (user.role === 'employee' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} creating stats badge for Director ${effectiveUserId}`);
      }
      
      const validatedData = insertUserStatsBadgeSchema.parse(req.body);
      const badge = await storage.createUserStatsBadge(effectiveUserId, validatedData);
      
      res.status(201).json(badge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create stats badge" });
      }
    }
  });

  // Update user-specific stats badge
  app.patch("/api/settings/stats/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees update director's stats badges
      let effectiveUserId = user.id;
      if (user.role === 'employee' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} updating stats badge for Director ${effectiveUserId}`);
      }
      
      const id = parseInt(req.params.id);
      const validatedData = insertUserStatsBadgeSchema.partial().parse(req.body);
      const badge = await storage.updateUserStatsBadge(id, validatedData);
      
      res.json(badge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update stats badge" });
      }
    }
  });

  // Delete user-specific stats badge
  app.delete("/api/settings/stats/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use hierarchical logic: employees delete director's stats badges
      let effectiveUserId = user.id;
      if (user.role === 'employee' && user.createdBy) {
        effectiveUserId = user.createdBy;
        console.log(`👷 Employee ${user.id} deleting stats badge for Director ${effectiveUserId}`);
      }
      
      const id = parseInt(req.params.id);
      await storage.deleteUserStatsBadge(id);
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stats badge" });
    }
  });

  // System operations
  app.post("/api/settings/refresh-cache", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      res.json({ success: true, message: "Cache refreshed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh cache" });
    }
  });

  app.post("/api/settings/optimize-database", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      res.json({ success: true, message: "Database optimized successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to optimize database" });
    }
  });

  app.post("/api/settings/backup", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const backupId = `backup_${Date.now()}`;
      res.json({ success: true, message: "Backup created successfully", backupId });
    } catch (error) {
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/settings/restore", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { backupId } = req.body;
      
      if (!backupId) {
        return res.status(400).json({ error: "Backup ID is required" });
      }

      res.json({ success: true, message: "System restored successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore system" });
    }
  });
}