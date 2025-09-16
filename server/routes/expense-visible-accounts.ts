import type { Express, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { storage } from '../storage';
import { z } from 'zod';
import type { WebSocketManager } from '../middleware/websocket';

// Request validation schemas
const saveVisibleAccountsSchema = z.object({
  accountIds: z.array(z.number()),
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2020).max(2030).optional()
});

export function setupExpenseVisibleAccountsRoutes(app: Express, wsManager: WebSocketManager) {
  // Get visible accounts for current user (hierarchical)
  app.get('/api/expense-visible-accounts', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      let ownerId = user?.id;
      
      // If not director, use their director's id as ownerId (shared settings)
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing expense visible accounts for Director ${ownerId}`);
      }
      
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
      console.log(`🔍 FETCHING VISIBLE ACCOUNTS: User=${user.id}, Owner=${ownerId}, Month=${month}, Year=${year}`);
      const visibleAccounts = await storage.getExpenseVisibleAccounts(ownerId, Number(month), Number(year));
      
      console.log(`📊 RETURNING ${visibleAccounts.length} VISIBLE ACCOUNTS`);
      res.json(visibleAccounts);
    } catch (error) {
      console.error('❌ EXPENSE VISIBLE ACCOUNTS ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to fetch visible accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Save visible accounts (hierarchical)
  app.post('/api/expense-visible-accounts', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      let ownerId = user?.id;
      
      // If not director, use their director's id as ownerId (shared settings)
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) updating expense visible accounts for Director ${ownerId}`);
      }
      
      const { accountIds, month = new Date().getMonth() + 1, year = new Date().getFullYear() } = saveVisibleAccountsSchema.parse(req.body);
      
      console.log(`💾 SAVING VISIBLE ACCOUNTS: User=${user.id}, Owner=${ownerId}, Month=${month}, Year=${year}, Accounts=${accountIds.length}`);
      
      // Save accounts for specific month/year
      const savedAccounts = await storage.saveExpenseVisibleAccounts(ownerId, accountIds, month, year);
      
      console.log(`✅ SAVED ${savedAccounts.length} VISIBLE ACCOUNTS FOR ${month}/${year}`);
      
      // ✅ WEBSOCKET BROADCAST: Notify other clients about visible accounts change
      const broadcastData = {
        type: 'VISIBLE_ACCOUNTS_CHANGED',
        data: {
          saved: savedAccounts.length,
          month,
          year,
          accounts: savedAccounts,
          ownerId
        },
        userId: user.id,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📡 BROADCASTING VISIBLE ACCOUNTS CHANGE: ${savedAccounts.length} accounts for ${month}/${year}`);
      wsManager.broadcast(broadcastData);
      
      res.json({ 
        success: true, 
        saved: savedAccounts.length,
        month,
        year,
        accounts: savedAccounts 
      });
    } catch (error) {
      console.error('❌ SAVE VISIBLE ACCOUNTS ERROR:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ 
          error: 'Failed to save visible accounts',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // ✅ BULK OPERATIONS: Add all accounts with expenses for a month
  app.post('/api/expense-visible-accounts/add-with-expenses', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      let ownerId = user?.id;
      
      // If employee, use their director's id as ownerId (shared settings)
      if (user?.role === 'employee' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} adding accounts with expenses for Director ${ownerId}`);
      }
      
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.body;
      
      console.log(`🚀 ADDING ALL ACCOUNTS WITH EXPENSES: User=${user.id}, Owner=${ownerId}, Month=${month}, Year=${year}`);
      
      const savedAccounts = await storage.addAllAccountsWithExpenses(ownerId, month, year);
      
      console.log(`✅ ADDED ${savedAccounts.length} ACCOUNTS WITH EXPENSES FOR ${month}/${year}`);
      
      // ✅ WEBSOCKET BROADCAST: Notify other clients about added accounts
      const broadcastData = {
        type: 'VISIBLE_ACCOUNTS_ADDED',
        data: {
          added: savedAccounts.length,
          month,
          year,
          accounts: savedAccounts,
          ownerId
        },
        userId: user.id,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📡 BROADCASTING VISIBLE ACCOUNTS ADDITION: ${savedAccounts.length} accounts`);
      wsManager.broadcast(broadcastData);
      
      res.json({ 
        success: true, 
        added: savedAccounts.length,
        month,
        year,
        accounts: savedAccounts 
      });
    } catch (error) {
      console.error('❌ ADD ACCOUNTS WITH EXPENSES ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to add accounts with expenses',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ✅ BULK OPERATIONS: Remove accounts inactive for X months
  app.post('/api/expense-visible-accounts/remove-inactive', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user;
      let ownerId = user?.id;
      
      // If employee, use their director's id as ownerId (shared settings)
      if (user?.role === 'employee' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} removing inactive accounts for Director ${ownerId}`);
      }
      
      const { monthsThreshold = 2 } = req.body;
      
      console.log(`🗑️ REMOVING INACTIVE ACCOUNTS: User=${user.id}, Owner=${ownerId}, Threshold=${monthsThreshold} months`);
      
      const result = await storage.removeInactiveAccounts(ownerId, monthsThreshold);
      
      console.log(`✅ REMOVED ${result.removed} INACTIVE ACCOUNTS`);
      
      // ✅ WEBSOCKET BROADCAST: Notify other clients about removed accounts
      const broadcastData = {
        type: 'VISIBLE_ACCOUNTS_REMOVED',
        data: {
          removed: result.removed,
          monthsThreshold,
          ownerId
        },
        userId: user.id,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📡 BROADCASTING VISIBLE ACCOUNTS REMOVAL: ${result.removed} accounts`);
      wsManager.broadcast(broadcastData);
      
      res.json({ 
        success: true, 
        removed: result.removed,
        monthsThreshold
      });
    } catch (error) {
      console.error('❌ REMOVE INACTIVE ACCOUNTS ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to remove inactive accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}