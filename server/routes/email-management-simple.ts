import { Router } from "express";
import { storage } from "../mongodb-storage.js";
import { requireAuth } from "../middleware/auth-simple.js";

const router = Router();

// Get email accounts for current user
router.get("/accounts", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const accounts = await storage.getEmailAccounts(userId);
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    res.status(500).json({ error: "Failed to fetch email accounts" });
  }
});

// Create new email account
router.post("/accounts", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const accountData = {
      ...req.body,
      userId
    };

    const account = await storage.createEmailAccount(accountData);
    res.json(account);
  } catch (error) {
    console.error("Error creating email account:", error);
    res.status(500).json({ error: "Failed to create email account" });
  }
});

export default router;