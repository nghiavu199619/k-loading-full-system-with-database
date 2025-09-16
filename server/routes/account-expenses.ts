import { Request, Response, Router } from "express";
import { storage } from "../storage";
import type { WebSocketManager } from "../middleware/websocket";
import { requireAuth } from "../middleware/auth";
// MongoDB migration - temporarily disabled drizzle imports
import { insertAccountExpenseSchema } from "@shared/schema";
import type { InsertAccountExpense } from "@shared/schema";
import { rawToUI, uiToRaw, dataCenter } from "../../packages/data-center/src/index";
import { requireTabPermission } from "../middleware/permissions";

console.log('🔧 ACCOUNT EXPENSES ROUTER LOADED!');

export function setupAccountExpensesRoutes(app: any, wsManager: WebSocketManager) {
  console.log('✅ ACCOUNT EXPENSES ROUTES REGISTERED');

  // Main entry endpoint for expense tab
  app.get('/api/account-expenses', requireAuth, requireTabPermission('expense-management', 'view'), async (req: any, res: Response) => {
    try {
      console.log('📊 ACCOUNT EXPENSES ENDPOINT HIT');
      const { month, year } = req.query;
      const user = req.user;
      let userId = user?.id; // From auth middleware

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // If not director, use their director's id for data access
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing expenses for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own expenses`);
      }

      if (!month || !year) {
        return res.status(400).json({ 
          error: 'Missing required parameters: month, year' 
        });
      }

      console.log(`🔍 FETCHING EXPENSES: User=${userId}, Month=${month}, Year=${year}`);
      const expenses = await storage.getAccountExpenses(
        parseInt(month as string),
        parseInt(year as string),
        userId
      );

      // Debug: Show expenses for the specific account and client we just saved
      const targetExpenses = expenses.filter(e => e.accountId === 119351 && e.clientId === 8);
      if (targetExpenses.length > 0) {
        console.log(`🔍 TARGET EXPENSES (119351-8):`, targetExpenses.map(e => ({
          id: e.id,
          accountId: e.accountId, 
          clientId: e.clientId,
          amount: e.amount,
          userId: e.userId,
          updatedAt: e.updatedAt
        })));
      } else {
        console.log(`❌ NO TARGET EXPENSES FOUND for Account 119351, Client 8`);
      }

      // Debug: Show sample of recent saves for this month/year
      if (expenses.length > 0) {
        const recentExpenses = expenses.slice(0, 3);
        console.log(`🔍 SAMPLE EXPENSES:`, recentExpenses.map(e => ({
          id: e.id,
          accountId: e.accountId, 
          clientId: e.clientId,
          amount: e.amount,
          updatedAt: e.updatedAt
        })));
      }

      console.log(`📊 RETURNING ${expenses.length} EXPENSES`);
      res.json(expenses); // Return array directly like other endpoints
    } catch (error) {
      console.error('❌ ACCOUNT EXPENSES ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to fetch account expenses',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Save/update account expense
  app.post('/api/account-expenses', requireAuth, async (req: any, res: Response) => {
    try {
      console.log('💾 SAVING ACCOUNT EXPENSE:', req.body);
      
      const user = req.user;
      let userId = user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // If not director, use their director's id for data storage
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) saving expense for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} saving own expense`);
      }

      console.log(`🔍 SINGLE SAVE: userId=${userId}`);

      // Validate the request body
      const validatedData = insertAccountExpenseSchema.parse({
        ...req.body,
        userId: userId
      });

      const expense = await storage.saveAccountExpense(validatedData);

      // Broadcast expense change via WebSocket
      const changeData = {
        type: 'EXPENSE_UPDATE',
        data: expense,
        sessionId: req.body.sessionId || 'unknown',
        userId: userId,
        timestamp: new Date().toISOString()
      };

      console.log('📡 BROADCASTING EXPENSE CHANGE:', changeData);
      wsManager.broadcast(changeData);

      console.log('✅ EXPENSE SAVED AND BROADCASTED');
      res.json({ 
        success: true, 
        data: expense 
      });
    } catch (error) {
      console.error('❌ SAVE EXPENSE ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to save account expense',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete account expense
  app.delete('/api/account-expenses', async (req: Request, res: Response) => {
    try {
      console.log('🗑️ DELETING ACCOUNT EXPENSE:', req.body);
      const { userId, accountId, clientId, month, year, sessionId } = req.body;

      if (!userId || !accountId || !clientId || !month || !year) {
        return res.status(400).json({ 
          error: 'Missing required parameters' 
        });
      }

      const deleted = await storage.deleteAccountExpense(
        parseInt(userId),
        parseInt(accountId),
        parseInt(clientId),
        parseInt(month),
        parseInt(year)
      );

      if (deleted) {
        // Broadcast delete via WebSocket
        const changeData = {
          type: 'EXPENSE_DELETE',
          data: { accountId, clientId, month, year },
          sessionId: sessionId || 'unknown',
          userId: userId,
          timestamp: new Date().toISOString()
        };

        console.log('📡 BROADCASTING EXPENSE DELETE:', changeData);
        wsManager.broadcast(changeData);
      }

      console.log(`✅ EXPENSE DELETED: ${deleted}`);
      res.json({ 
        success: true, 
        deleted: deleted 
      });
    } catch (error) {
      console.error('❌ DELETE EXPENSE ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to delete account expense',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // ✅ MISSING BULK UPDATE ENDPOINT: Handle batch expense updates
  app.put('/api/account-expenses/bulk', requireAuth, async (req: any, res: Response) => {
    try {
      console.log('💾 BULK EXPENSE UPDATE:', req.body);
      
      const user = req.user;
      let userId = user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // If not director, use their director's id for data storage
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) saving expenses for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} saving own expenses`);
      }

      console.log(`🔍 BULK UPDATE: userId=${userId}`);

      const { changes, month, year, sessionId } = req.body;
      
      if (!changes || !Array.isArray(changes)) {
        return res.status(400).json({ error: 'Changes array is required' });
      }

      // Process each expense change with data-center validation
      const results = [];
      for (const change of changes) {
        try {
          console.log(`💾 PROCESSING EXPENSE: Account ${change.accountId}, Client ${change.clientId}, Amount ${change.amount}`);
          
          console.log(`💾 SAVING ACCOUNT EXPENSE: {
  accountId: ${change.accountId},
  clientId: ${change.clientId},
  amount: ${change.amount},
  month: ${change.month || month},
  year: ${change.year || year},
  userId: ${userId},
  type: 'expense',
  date: ${new Date().toISOString()}
}`);
          
          const expenseData = {
            accountId: change.accountId,
            clientId: change.clientId,
            amount: change.amount,
            month: change.month || month,
            year: change.year || year,
            userId: userId,
            type: 'expense',
            date: new Date()
          } as InsertAccountExpense;

          const savedExpense = await storage.saveAccountExpense(expenseData);
          results.push(savedExpense);
          
          console.log(`✅ EXPENSE SAVED: ${savedExpense.id}`);
        } catch (changeError) {
          console.error(`❌ EXPENSE SAVE ERROR for change:`, change, changeError);
          // Continue with other changes
        }
      }

      // Broadcast changes via WebSocket
      if (results.length > 0) {
        const broadcastData = {
          type: 'BATCH_UPDATE',
          changes: results.map(expense => ({
            accountId: expense.accountId,
            clientId: expense.clientId,
            // ✅ USE DATA-CENTER: Convert DB format back to raw number for frontend
            amount: typeof expense.amount === 'string' ? 
              uiToRaw(expense.amount, { returnNumber: true }) : 
              expense.amount
          })),
          sessionId: sessionId || 'unknown',
          userId: userId,
          timestamp: new Date().toISOString()
        };

        console.log(`📡 BROADCASTING BULK EXPENSE UPDATE: ${results.length} changes`);
        wsManager.broadcast(broadcastData);
      }

      console.log(`✅ BULK EXPENSE UPDATE COMPLETE: ${results.length}/${changes.length} saved`);
      res.json({ 
        success: true, 
        saved: results.length,
        total: changes.length,
        data: results 
      });
    } catch (error) {
      console.error('❌ BULK EXPENSE SAVE ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to bulk save expenses',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get expense changes for real-time sync
  app.get('/api/account-expenses/changes', async (req: Request, res: Response) => {
    try {
      const { since, sessionId } = req.query;
      
      console.log(`🔄 GETTING EXPENSE CHANGES: Since=${since}, Session=${sessionId}`);
      const changes = await storage.getAccountExpenseChanges(
        since as string,
        sessionId as string
      );

      console.log(`📊 RETURNING ${changes.length} EXPENSE CHANGES`);
      res.json({ 
        success: true, 
        changes: changes 
      });
    } catch (error) {
      console.error('❌ GET EXPENSE CHANGES ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to get expense changes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get accounts and clients for matrix setup
  app.get('/api/account-expenses/matrix-data', async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      console.log(`🔍 GETTING MATRIX DATA for User=${userId}`);
      
      // Get user's ad accounts and clients
      const [accounts, clients] = await Promise.all([
        storage.getAdAccounts(parseInt(userId as string)),
        storage.getClients(parseInt(userId as string))
      ]);

      console.log(`📊 MATRIX DATA: ${accounts.length} accounts, ${clients.length} clients`);
      res.json({ 
        success: true, 
        accounts: accounts,
        clients: clients,
        accountsCount: accounts.length,
        clientsCount: clients.length
      });
    } catch (error) {
      console.error('❌ GET MATRIX DATA ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to get matrix data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('🚀 ACCOUNT EXPENSES ROUTES SETUP COMPLETE');
}