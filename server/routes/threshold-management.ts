import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { thresholdManagement, adAccounts } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
// Simplified permissions - Directors have full access, others inherit from director
const hasFullAccess = (user: any) => {
  return user.role === 'director' || user.role === 'accounting_manager' || user.role === 'operations_manager';
};

// Simple activity logging - can be enhanced later
const logActivitySimple = async (activity: any) => {
  console.log('📝 Activity:', activity);
};

const router = Router();

// Apply authentication middleware
router.use(requireAuth);

// Get all thresholds for user
router.get("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { month, year } = req.query;
    
    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to view threshold management" });
    }

    console.log(`🔍 getUserById(${user.id}) returned:`, user);
    
    // Determine data access based on user role and hierarchy
    let dataUserId = user.id;
    if (user.role === 'director') {
      console.log(`👑 Director ${user.id} using own ID for data operations`);
      dataUserId = user.id;
    } else if (user.role === 'accounting_manager' || user.role === 'operations_manager') {
      console.log(`👥 Manager ${user.id} accessing director's data`);
      dataUserId = user.createdBy || user.id;
    } else {
      console.log(`👤 Employee ${user.id} accessing director's data`);
      dataUserId = user.createdBy || user.id;
    }

    // Simple query without JOIN for now - we'll handle mapping client-side
    let query = db.select().from(thresholdManagement)
      .where(eq(thresholdManagement.userId, dataUserId))
      .orderBy(desc(thresholdManagement.createdAt));

    // Apply month/year filter if provided
    if (month && year) {
      query = db.select().from(thresholdManagement)
        .where(
          and(
            eq(thresholdManagement.userId, dataUserId),
            eq(thresholdManagement.month, parseInt(month as string)),
            eq(thresholdManagement.year, parseInt(year as string))
          )
        )
        .orderBy(desc(thresholdManagement.createdAt));
    }

    const thresholds = await query;
    console.log(`📋 THRESHOLD MANAGEMENT: Retrieved thresholds for user ${dataUserId} (original: ${user.id})`);

    res.json(thresholds);
  } catch (error) {
    console.error("Error fetching thresholds:", error);
    res.status(500).json({ error: "Failed to fetch thresholds" });
  }
});

// Get single threshold
router.get("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to view threshold management" });
    }

    const [threshold] = await db.select().from(thresholdManagement)
      .where(eq(thresholdManagement.id, parseInt(req.params.id)));

    if (!threshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }

    // Check access permissions
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    if (threshold.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(threshold);
  } catch (error) {
    console.error("Error fetching threshold:", error);
    res.status(500).json({ error: "Failed to fetch threshold" });
  }
});

// Create new threshold
router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to create thresholds" });
    }

    // Determine data ownership
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    // Check if threshold already exists for this accountId and user
    const existingThreshold = await db.select()
      .from(thresholdManagement)
      .where(
        and(
          eq(thresholdManagement.accountId, req.body.accountId),
          eq(thresholdManagement.userId, dataUserId)
        )
      );

    if (existingThreshold.length > 0) {
      console.log(`⚠️ Duplicate threshold attempt blocked for account ${req.body.accountId}, user ${dataUserId}`);
      return res.status(200).json(existingThreshold[0]); // Return existing instead of creating duplicate
    }

    const thresholdData = {
      ...req.body,
      userId: dataUserId,
      month: req.body.month || new Date().getMonth() + 1,
      year: req.body.year || new Date().getFullYear()
    };

    const [newThreshold] = await db.insert(thresholdManagement)
      .values(thresholdData)
      .returning();

    // Log activity
    await logActivitySimple({
      tableName: 'threshold_management',
      recordId: newThreshold.id,
      fieldName: 'create',
      oldValue: null,
      newValue: JSON.stringify(newThreshold),
      userId: user.id,
      actionType: 'create'
    });

    console.log(`✅ Created threshold: ${newThreshold.accountId} for user ${dataUserId}`);
    res.json(newThreshold);
  } catch (error) {
    console.error("Error creating threshold:", error);
    res.status(500).json({ error: "Failed to create threshold" });
  }
});

// Update threshold
router.patch("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to update thresholds" });
    }

    const thresholdId = parseInt(req.params.id);
    
    // Get existing threshold
    const [existingThreshold] = await db.select().from(thresholdManagement)
      .where(eq(thresholdManagement.id, thresholdId));

    if (!existingThreshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }

    // Check access permissions
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    if (existingThreshold.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [updatedThreshold] = await db.update(thresholdManagement)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(thresholdManagement.id, thresholdId))
      .returning();

    // Log changes
    for (const [key, value] of Object.entries(req.body)) {
      if (existingThreshold[key as keyof typeof existingThreshold] !== value) {
        await logActivitySimple({
          tableName: 'threshold_management',
          recordId: thresholdId,
          fieldName: key,
          oldValue: String(existingThreshold[key as keyof typeof existingThreshold] || ''),
          newValue: String(value || ''),
          userId: user.id,
          actionType: 'update'
        });
      }
    }

    console.log(`✅ Updated threshold: ${updatedThreshold.accountId}`);
    res.json(updatedThreshold);
  } catch (error) {
    console.error("Error updating threshold:", error);
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

// Bulk update thresholds
router.patch("/bulk", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to update thresholds" });
    }

    const { ids, updateData } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or missing IDs" });
    }

    // Determine data access
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    // Verify all thresholds belong to user
    const existingThresholds = await db.select().from(thresholdManagement)
      .where(eq(thresholdManagement.userId, dataUserId));
    
    const validIds = existingThresholds
      .filter(t => ids.includes(t.id))
      .map(t => t.id);

    if (validIds.length === 0) {
      return res.status(403).json({ error: "No valid thresholds found for update" });
    }

    // Perform bulk update
    const updatedThresholds = [];
    for (const id of validIds) {
      const [existingThreshold] = await db.select().from(thresholdManagement)
        .where(eq(thresholdManagement.id, id));

      const [updated] = await db.update(thresholdManagement)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(thresholdManagement.id, id))
        .returning();

      updatedThresholds.push(updated);

      // Log changes
      for (const [key, value] of Object.entries(updateData)) {
        if (existingThreshold[key as keyof typeof existingThreshold] !== value) {
          await logActivitySimple({
            tableName: 'threshold_management',
            recordId: id,
            fieldName: key,
            oldValue: String(existingThreshold[key as keyof typeof existingThreshold] || ''),
            newValue: String(value || ''),
            userId: user.id,
            actionType: 'bulk_update'
          });
        }
      }
    }

    console.log(`✅ Bulk updated ${updatedThresholds.length} thresholds`);
    res.json({ 
      message: `Updated ${updatedThresholds.length} thresholds`,
      updatedThresholds 
    });
  } catch (error) {
    console.error("Error bulk updating thresholds:", error);
    res.status(500).json({ error: "Failed to bulk update thresholds" });
  }
});

// Delete threshold
router.delete("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to delete thresholds" });
    }

    const thresholdId = parseInt(req.params.id);
    
    // Get existing threshold
    const [existingThreshold] = await db.select().from(thresholdManagement)
      .where(eq(thresholdManagement.id, thresholdId));

    if (!existingThreshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }

    // Check access permissions
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    if (existingThreshold.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.delete(thresholdManagement)
      .where(eq(thresholdManagement.id, thresholdId));

    // Log activity
    await logActivitySimple({
      tableName: 'threshold_management',
      recordId: thresholdId,
      fieldName: 'delete',
      oldValue: JSON.stringify(existingThreshold),
      newValue: null,
      userId: user.id,
      actionType: 'delete'
    });

    console.log(`✅ Deleted threshold: ${existingThreshold.accountId}`);
    res.json({ message: "Threshold deleted successfully" });
  } catch (error) {
    console.error("Error deleting threshold:", error);
    res.status(500).json({ error: "Failed to delete threshold" });
  }
});

export default router;