import express from 'express';
import { IStorage } from '../storage';
import { requireAuth } from '../middleware/auth';

export function createAdAccountsBatchFetchRoutes(storage: IStorage) {
  const router = express.Router();

  // ✅ BATCH FETCH MULTIPLE ACCOUNTS - Single request for smooth UI
  router.post('/batch-fetch', requireAuth, async (req, res) => {
    try {
      const { accountIds } = req.body;
      const userId = req.user!.id;

      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid accountIds array' 
        });
      }

      console.log(`🔄 BATCH FETCH: ${accountIds.length} accounts for user ${userId}`);

      // Fetch all accounts in single database query
      const accounts = await storage.getAdAccountsByIds(accountIds, userId);
      
      console.log(`✅ BATCH FETCH SUCCESS: Found ${accounts.length} accounts`);

      res.json(accounts);

    } catch (error) {
      console.error('❌ Batch fetch error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to batch fetch accounts' 
      });
    }
  });

  return router;
}