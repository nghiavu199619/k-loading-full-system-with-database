import { Router } from "express";
import { db } from "../db.js";
import { bankOrders } from "@shared/schema";
import { requireAuth } from "../middleware/auth.js";
import { eq, desc, and } from "drizzle-orm";
// Permission check functions
const hasFullAccess = (user: any) => {
  return user.role === 'director' || user.role === 'manager';
};
// Activity logging (simplified)
const logActivitySimple = async (data: any) => {
  // Logging will be implemented when needed
  console.log('🔗 Bank Order Activity:', data);
};

const router = Router();

// Get all bank orders
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Determine data ownership based on user role
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id; // Directors see their own data
    } else {
      dataUserId = user.createdBy || user.id; // Employees see their director's data
    }

    const orders = await db
      .select()
      .from(bankOrders)
      .where(eq(bankOrders.userId, dataUserId))
      .orderBy(desc(bankOrders.createdAt));

    console.log(`📋 BANK ORDERS: Retrieved ${orders.length} orders for user ${dataUserId} (original: ${user.id})`);
    res.json(orders);
  } catch (error) {
    console.error("Error fetching bank orders:", error);
    res.status(500).json({ error: "Failed to fetch bank orders" });
  }
});

// Get single bank order
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orderId = parseInt(req.params.id);
    const [order] = await db
      .select()
      .from(bankOrders)
      .where(eq(bankOrders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: "Bank order not found" });
    }

    // Check access permissions
    const dataUserId = user.role === 'director' ? user.id : (user.createdBy || user.id);
    if (order.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching bank order:", error);
    res.status(500).json({ error: "Failed to fetch bank order" });
  }
});

// Create new bank order
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to create bank orders" });
    }

    // Determine data ownership
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    // Generate unique order code
    const orderCode = `BO${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const orderData = {
      ...req.body,
      orderCode,
      createdBy: user.id,
      userId: dataUserId,
      status: 'pending'
    };

    const [newOrder] = await db.insert(bankOrders)
      .values(orderData)
      .returning();

    // Update hasBankOrder for selected accounts
    if (req.body.selectedAccounts && Array.isArray(req.body.selectedAccounts)) {
      const { thresholdManagement } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      for (const account of req.body.selectedAccounts) {
        try {
          await db.update(thresholdManagement)
            .set({ hasBankOrder: true })
            .where(and(
              eq(thresholdManagement.accountId, account.accountId),
              eq(thresholdManagement.month, req.body.month || new Date().getMonth() + 1),
              eq(thresholdManagement.year, req.body.year || new Date().getFullYear()),
              eq(thresholdManagement.userId, dataUserId)
            ));
        } catch (updateError) {
          console.warn(`Failed to update hasBankOrder for account ${account.accountId}:`, updateError);
        }
      }
    }

    // Log activity
    await logActivitySimple({
      tableName: 'bank_orders',
      recordId: newOrder.id,
      fieldName: 'create',
      oldValue: null,
      newValue: JSON.stringify(newOrder),
      userId: user.id,
      actionType: 'create'
    });

    console.log(`✅ Created bank order: ${newOrder.orderCode} for user ${dataUserId}`);
    res.json(newOrder);
  } catch (error) {
    console.error("Error creating bank order:", error);
    res.status(500).json({ error: "Failed to create bank order" });
  }
});

// Update bank order
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to update bank orders" });
    }

    const orderId = parseInt(req.params.id);
    
    // Get existing order
    const [existingOrder] = await db.select().from(bankOrders)
      .where(eq(bankOrders.id, orderId));

    if (!existingOrder) {
      return res.status(404).json({ error: "Bank order not found" });
    }

    // Check access permissions
    const dataUserId = user.role === 'director' ? user.id : (user.createdBy || user.id);
    if (existingOrder.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [updatedOrder] = await db
      .update(bankOrders)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(bankOrders.id, orderId))
      .returning();

    // Log activity for each changed field
    Object.keys(req.body).forEach(async (field) => {
      if (req.body[field] !== (existingOrder as any)[field]) {
        await logActivitySimple({
          tableName: 'bank_orders',
          recordId: orderId,
          fieldName: field,
          oldValue: JSON.stringify((existingOrder as any)[field]),
          newValue: JSON.stringify(req.body[field]),
          userId: user.id,
          actionType: 'update'
        });
      }
    });

    console.log(`✅ Updated bank order: ${orderId}`);
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating bank order:", error);
    res.status(500).json({ error: "Failed to update bank order" });
  }
});

// Approve bank order (accounting)
router.post("/:id/approve-accounting", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has accounting role or is director
    if (user.role !== 'director' && !user.permissions?.includes('accounting_approval')) {
      return res.status(403).json({ error: "No permission to approve accounting" });
    }

    const orderId = parseInt(req.params.id);
    const { notes } = req.body;

    const [updatedOrder] = await db
      .update(bankOrders)
      .set({
        accountingApproval: {
          approved: true,
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
          notes: notes || ''
        },
        updatedAt: new Date()
      })
      .where(eq(bankOrders.id, orderId))
      .returning();

    // Log activity
    await logActivitySimple({
      tableName: 'bank_orders',
      recordId: orderId,
      fieldName: 'accounting_approval',
      oldValue: 'pending',
      newValue: 'approved',
      userId: user.id,
      actionType: 'approve'
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error approving bank order (accounting):", error);
    res.status(500).json({ error: "Failed to approve bank order" });
  }
});

// Approve bank order (operations)
router.post("/:id/approve-operations", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has operations role or is director
    if (user.role !== 'director' && !user.permissions?.includes('operations_approval')) {
      return res.status(403).json({ error: "No permission to approve operations" });
    }

    const orderId = parseInt(req.params.id);
    const { notes } = req.body;

    const [updatedOrder] = await db
      .update(bankOrders)
      .set({
        operationsApproval: {
          approved: true,
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
          notes: notes || ''
        },
        status: 'completed', // Mark as completed when operations approves
        updatedAt: new Date()
      })
      .where(eq(bankOrders.id, orderId))
      .returning();

    // Log activity
    await logActivitySimple({
      tableName: 'bank_orders',
      recordId: orderId,
      fieldName: 'operations_approval',
      oldValue: 'pending',
      newValue: 'approved',
      userId: user.id,
      actionType: 'approve'
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error approving bank order (operations):", error);
    res.status(500).json({ error: "Failed to approve bank order" });
  }
});

// Delete bank order
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasFullAccess(user)) {
      return res.status(403).json({ error: "No permission to delete bank orders" });
    }

    const orderId = parseInt(req.params.id);
    
    // Get existing order
    const [existingOrder] = await db.select().from(bankOrders)
      .where(eq(bankOrders.id, orderId));

    if (!existingOrder) {
      return res.status(404).json({ error: "Bank order not found" });
    }

    // Check access permissions
    const dataUserId = user.role === 'director' ? user.id : (user.createdBy || user.id);
    if (existingOrder.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.delete(bankOrders).where(eq(bankOrders.id, orderId));

    // Log activity
    await logActivitySimple({
      tableName: 'bank_orders',
      recordId: orderId,
      fieldName: 'delete',
      oldValue: JSON.stringify(existingOrder),
      newValue: null,
      userId: user.id,
      actionType: 'delete'
    });

    console.log(`🗑️ Deleted bank order: ${orderId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bank order:", error);
    res.status(500).json({ error: "Failed to delete bank order" });
  }
});

export { router as bankOrdersRouter };