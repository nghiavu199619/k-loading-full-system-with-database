import { Router } from "express";
import { db } from "../db";
import { paymentManagement, type PaymentManagement, type InsertPaymentManagement } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get all payment records
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Determine which user's data to fetch
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }
    console.log(`👑 Director ${user.id} using own ID for payment data operations`);

    const payments = await db.select().from(paymentManagement)
      .where(eq(paymentManagement.userId, dataUserId))
      .orderBy(paymentManagement.paymentDate, paymentManagement.createdAt);

    console.log(`📋 PAYMENT MANAGEMENT: Retrieved ${payments.length} payments for user ${dataUserId} (original: ${user.id})`);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Create new payment record
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Determine data ownership
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }

    const paymentData: InsertPaymentManagement = {
      ...req.body,
      userId: dataUserId
    };

    const [newPayment] = await db.insert(paymentManagement)
      .values(paymentData)
      .returning();

    // Log activity (simplified for now)

    console.log(`✅ Created payment: ${newPayment.id} for user ${dataUserId}`);
    res.json(newPayment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// Update payment record
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const paymentId = parseInt(req.params.id);
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }
    
    // Get existing payment
    const [existingPayment] = await db.select().from(paymentManagement)
      .where(eq(paymentManagement.id, paymentId));

    if (!existingPayment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Check access permissions
    if (existingPayment.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update payment
    const [updatedPayment] = await db.update(paymentManagement)
      .set(req.body)
      .where(eq(paymentManagement.id, paymentId))
      .returning();

    // Log activity for changed fields (simplified for now)

    console.log(`✅ Updated payment: ${paymentId}`);
    res.json(updatedPayment);
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Delete payment record
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const paymentId = parseInt(req.params.id);
    let dataUserId = user.id;
    if (user.role === 'director') {
      dataUserId = user.id;
    } else {
      dataUserId = user.createdBy || user.id;
    }
    
    // Get existing payment
    const [existingPayment] = await db.select().from(paymentManagement)
      .where(eq(paymentManagement.id, paymentId));

    if (!existingPayment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Check access permissions
    if (existingPayment.userId !== dataUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete payment
    await db.delete(paymentManagement)
      .where(eq(paymentManagement.id, paymentId));

    // Log activity (simplified for now)

    console.log(`✅ Deleted payment: ${paymentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

export default router;