import type { Express } from "express";
import { storage } from "../storage";
import { insertAdAccountSchema, accountChanges } from "@shared/schema";
import { z } from "zod";
import type { WebSocketManager } from "../middleware/websocket";
import { debugRequireAuth as requireAuth } from "../middleware/auth";
import { requirePermission } from "../permissions";
// Removed deprecated logging middleware - using ActivityLogger instead
import { ActivityLogger } from "../services/activity-logger";
import { db } from "../db";
import { adAccounts } from "@shared/schema";
// MongoDB migration - temporarily disabled drizzle imports
import { requireTabPermission } from "../middleware/permissions";

export function setupAdAccountRoutes(app: Express, ws: WebSocketManager) {
  // ❌ REMOVED: Bulk endpoint moved to ad-accounts-bulk.ts with enhanced WebSocket support
  
  // Get ad accounts by ownership (hierarchical filtering)
  app.get("/api/ad-accounts", requireAuth, requireTabPermission('account-management', 'view'), async (req, res) => {
    try {
      const user = (req as any).user;
      let ownerId = user?.id;
      
      console.log(`🔍 DEBUG: User ${user?.id} role=${user?.role} createdBy=${user?.createdBy}`);
      
      // If not director, use their director's id as ownerId
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing accounts owned by Director ${ownerId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own accounts`);
      }
      
      console.log(`🔍 Final ownerId being passed to storage: ${ownerId}`);
      const accounts = await storage.getAdAccounts(ownerId);
      console.log(`🔍 Viewing ${accounts.length} accounts owned by Director ${ownerId}`);
      
      res.json(accounts);
    } catch (error) {
      console.error('❌ Ad accounts error:', error);
      res.status(500).json({ error: "Failed to fetch ad accounts" });
    }
  });

  // Create new ad account (hierarchical ownership)
  app.post("/api/ad-accounts", requireAuth, requireTabPermission('account-management', 'edit'), async (req, res) => {
    try {
      const user = (req as any).user;
      const validatedData = insertAdAccountSchema.parse(req.body);
      
      // Determine ownership: Directors own their data, employees assign to their director
      let ownerId = user?.id;
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) creating account for Director ${ownerId}`);
      }
      
      const accountWithOwnership = { ...validatedData, userId: ownerId };
      const account = await storage.createAdAccount(accountWithOwnership);
      
      // Log account creation (field-level only)
      await ActivityLogger.logFieldChange({
        tableName: 'ad_accounts',
        recordId: account.id,
        actionType: 'create',
        fieldName: 'account',
        oldValue: null,
        newValue: account.name || account.accountId,
        userId: user.id,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: user.username || 'Unknown',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      // Note: Real-time sync handled by ActivityLogger
      
      ws.broadcast({
        type: 'AD_ACCOUNT_CREATED',
        data: account
      });
      
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create ad account" });
      }
    }
  });

  // Note: Bulk operations are handled by the dedicated bulk router imported above

  // Batch update endpoint for HandsontableUniversal compatibility
  app.post("/api/ad-accounts/batch-update", requireAuth, async (req, res) => {
    console.log('🚀 BATCH UPDATE API CALLED - Request body:', JSON.stringify(req.body, null, 2));
    try {
      const user = (req as any).user;
      let ownerId = user?.id;
      
      // If employee, use their director's id as ownerId
      if (user?.role === 'employee' && user?.createdBy) {
        ownerId = user.createdBy;
      }
      
      // Handle batch changes format from HandsontableUniversal
      const changes = Array.isArray(req.body) ? req.body : req.body.changes || [];
      
      if (!Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({ error: "No changes provided" });
      }
      
      console.log(`📝 Processing ${changes.length} ad account batch changes`);
      console.log('🔍 First change sample:', changes[0]);
      
      const results = [];
      const broadcasts: any[] = []; // Collect broadcasts for batching
      for (const change of changes) {
        try {
          const accountId = parseInt(change.id || change.accountId);
          const field = change.field;
          const newValue = change.value || change.newValue;
          
          // Removed excessive logging for production performance
          
          if (!accountId) {
            console.error(`❌ Invalid accountId: ${accountId} for change:`, change);
            continue;
          }
          
          if (!field) {
            console.error(`❌ Invalid field: ${field} for change:`, change);
            continue;
          }
          
          if (newValue === undefined) {
            console.error(`❌ Invalid newValue: ${newValue} for change:`, change);
            continue;
          }
          
          // Map field names to database column names
          const fieldMapping: { [key: string]: string } = {
            'accountId': 'accountId',
            'name': 'name',
            'status': 'status',
            'source': 'source',
            'rentalPercentage': 'rentalPercentage',
            'cardType': 'cardType',
            'cardNote': 'cardNote',
            'vatPercentage': 'vatPercentage',
            'clientTag': 'clientTag',
            'accountPermission': 'accountPermission',
            'description': 'description'
          };
          
          const dbField = fieldMapping[field] || field;
          
          // Handle percentage fields with proper null/empty value handling
          let processedValue = newValue;
          if (dbField === 'rentalPercentage' || dbField === 'vatPercentage') {
            if (processedValue === null || processedValue === '' || processedValue === 'null' || processedValue === undefined) {
              processedValue = '0'; // Use '0' for database constraints
            } else if (typeof processedValue === 'string') {
              processedValue = processedValue.replace('%', '');
            }
          } else {
            // For all other fields, handle null/empty properly
            if (processedValue === null || processedValue === undefined) {
              processedValue = '';
            }
          }
          
          const updateData = { [dbField]: processedValue };
          
          // ✅ CRITICAL FIX: Get current value from database BEFORE update for proper old/new logging
          const currentAccount = await storage.getAdAccountById(accountId, ownerId);
          const currentValue = currentAccount ? (currentAccount as any)[dbField] : '';
          
          // Enhanced validation logging
          console.log(`🔧 Processing update: ID=${accountId}, Field=${dbField}, DB_Old="${currentValue}", New="${processedValue}"`);
          
          // Update account in database
          const updatedAccount = await storage.updateAdAccount(accountId, updateData, ownerId);
          results.push(updatedAccount);
          
          console.log(`✅ ACCOUNT UPDATED SUCCESSFULLY: ID=${accountId}, Field=${field}`);
          
          // Log field change only (single source of truth)
          await ActivityLogger.logFieldChange({
            tableName: 'ad_accounts',
            recordId: accountId,
            actionType: 'update',
            fieldName: dbField,
            oldValue: currentValue,
            newValue: processedValue,
            userId: user.id,
            userSession: ActivityLogger.getRequestContext(req)?.userSession,
            userName: user.username || 'Unknown',
            ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
            userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
          });
          
          console.log(`📝 SINGLE LOG ENTRY: ID=${accountId}, Field=${dbField}, Old="${currentValue}" → New="${processedValue}"`);
          
          console.log(`✅ CHANGE TRACKED SUCCESSFULLY: ID=${accountId}, Field=${field}`);
          
          // Store broadcast data instead of immediate send
          broadcasts.push({
            accountId: accountId,
            field: field,
            oldValue: currentValue ? String(currentValue) : '',
            newValue: processedValue,
            sessionId: change.sessionId || ''
          });
        } catch (error) {
          console.error('❌ BATCH UPDATE ERROR for change:', change);
          console.error('❌ Error details:', error);
          console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        }
      }
      
      // ✅ BATCH BROADCASTING: Send all collected broadcasts efficiently
      if (broadcasts.length > 0) {
        // Group by sessionId for optimal batching
        const changesBySession = new Map<string, any[]>();
        
        for (const broadcast of broadcasts) {
          const sessionId = broadcast.sessionId || 'unknown';
          if (!changesBySession.has(sessionId)) {
            changesBySession.set(sessionId, []);
          }
          changesBySession.get(sessionId)!.push(broadcast);
        }
        
        // Send batched broadcasts per session
        for (const [sessionId, sessionChanges] of Array.from(changesBySession.entries())) {
          if (sessionChanges.length === 1) {
            // Single change - individual broadcast
            const change: any = sessionChanges[0];
            const broadcastData = {
              type: 'DATA_UPDATE',
              accountId: change.accountId,
              field: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
              sessionId: sessionId,
              timestamp: new Date().toISOString()
            };
            
            ws.broadcast(broadcastData);
            console.log(`✅ SINGLE BROADCAST: ID=${change.accountId}, Field=${change.field}`);
          } else {
            // Multiple changes - batch broadcast
            const batchData = {
              type: 'BATCH_UPDATE',
              changes: sessionChanges.map((change: any) => ({
                accountId: change.accountId,
                field: change.field,
                oldValue: change.oldValue,
                newValue: change.newValue
              })),
              sessionId: sessionId,
              timestamp: new Date().toISOString(),
              count: sessionChanges.length
            };
            
            ws.broadcast(batchData);
            console.log(`✅ BATCH BROADCAST: ${sessionChanges.length} changes for session ${sessionId}`);
          }
        }
      }
      
      res.json({ success: true, processed: results.length, updated: results });
    } catch (error) {
      console.error('Batch update error:', error);
      res.status(500).json({ error: "Failed to batch update ad accounts" });
    }
  });

  // Real-time updates endpoint for collaborative editing
  app.get("/api/ad-accounts/updates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const since = req.query.since as string;
      const sessionId = req.query.sessionId as string;
      
      let ownerId = user?.id;
      
      // If employee, use their director's id as ownerId
      if (user?.role === 'employee' && user?.createdBy) {
        ownerId = user.createdBy;
      }
      
      // Get changes from tracking table efficiently
      const changes = await storage.getAccountChanges(since, sessionId, ownerId);
      
      // Check if any changes require full refresh (new accounts, deletions)
      const needsFullRefresh = changes.some(change => 
        change.field === 'NEW_ACCOUNT' || 
        change.field === 'ACCOUNT_DELETED' ||
        change.type === 'NEW_ACCOUNT' ||
        change.type === 'ACCOUNT_CREATED' ||
        change.type === 'ACCOUNT_DELETED'
      );
      
      res.json({
        timestamp: new Date().toISOString(),
        changes: changes,
        needsFullRefresh
      });
    } catch (error) {
      console.error('Error getting ad account updates:', error);
      res.status(500).json({ error: "Failed to get ad account updates" });
    }
  });

  // ✅ BATCH FETCH API - Single request for multiple accounts (smooth UI)
  app.post('/api/ad-accounts/batch-fetch', requireAuth, async (req, res) => {
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

  // Get single account by ID (requires authentication) - supports robust real-time sync Method 3
  // MUST BE AFTER /updates endpoint to avoid route conflicts
  app.get("/api/ad-accounts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }
      
      console.log(`🔍 GET INDIVIDUAL ACCOUNT: Looking for account ID ${id} for user ${user?.id} (${user?.role})`);
      
      const account = await storage.getAdAccountById(id, user?.id);
      
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      console.log(`✅ FOUND INDIVIDUAL ACCOUNT: ID ${id}, name: "${account.name}"`);
      res.json(account);
    } catch (error) {
      console.error(`❌ ERROR getting individual account ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to get ad account" });
    }
  });

  // Clean up duplicate accounts (emergency endpoint)
  app.delete("/api/ad-accounts/cleanup-duplicates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      let ownerId = user?.id;
      
      // If employee, use their director's id as ownerId
      if (user?.role === 'employee' && user?.createdBy) {
        ownerId = user.createdBy;
      }
      
      console.log(`🧹 Cleaning up duplicate accounts for user ${user?.id} (effective: ${ownerId})`);
      
      // Find accounts with default names that are likely duplicates
      const accounts = await storage.getAdAccounts(ownerId);
      const duplicates = accounts.filter(acc => 
        !acc.accountId || 
        acc.name === '' || 
        acc.name === 'TikTok Ads giày dép' ||
        acc.description === 'TikTok Ads giày dép'
      );
      
      if (duplicates.length === 0) {
        return res.json({ 
          message: 'No duplicate accounts found',
          deletedCount: 0 
        });
      }
      
      // Delete duplicate accounts
      const deletePromises = duplicates.map(account => 
        storage.deleteAdAccount(account.id)
      );
      
      await Promise.all(deletePromises);
      
      console.log(`✅ Deleted ${duplicates.length} duplicate accounts`);
      
      res.json({
        message: `Successfully deleted ${duplicates.length} duplicate accounts`,
        deletedCount: duplicates.length,
        deletedAccounts: duplicates.map(acc => ({ id: acc.id, name: acc.name }))
      });
      
    } catch (error) {
      console.error('❌ Error cleaning up duplicates:', error);
      res.status(500).json({ message: 'Failed to cleanup duplicate accounts' });
    }
  });

  // ALL PARAMETERIZED ROUTES MUST COME AFTER SPECIFIC ROUTES TO AVOID CONFLICTS
  
  // Update ad account (requires authentication)
  app.patch("/api/ad-accounts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAdAccountSchema.partial().parse(req.body);
      
      // Get old values before update for activity logging
      const oldAccount = await storage.getAdAccountById(id);
      
      const account = await storage.updateAdAccount(id, validatedData);
      
      // Log account update (field-level only)
      for (const [fieldName, newValue] of Object.entries(validatedData)) {
        const oldValue = oldAccount ? (oldAccount as any)[fieldName] : null;
        if (oldValue !== newValue) {
          await ActivityLogger.logFieldChange({
            tableName: 'ad_accounts',
            recordId: id,
            actionType: 'update',
            fieldName,
            oldValue,
            newValue,
            userId: req.user!.id,
            userSession: ActivityLogger.getRequestContext(req)?.userSession,
            userName: req.user!.username || 'Unknown',
            ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
            userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
          });
        }
      }
      
      ws.broadcast({
        type: 'AD_ACCOUNT_UPDATED',
        data: account
      });
      
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update ad account" });
      }
    }
  });

  // Update account status specifically (requires authentication)
  app.patch("/api/ad-accounts/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Get old values before update for activity logging
      const oldAccount = await storage.getAdAccountById(id);
      
      const account = await storage.updateAdAccount(id, { status });
      
      // Log status update (field-level only)
      await ActivityLogger.logFieldChange({
        tableName: 'ad_accounts',
        recordId: id,
        actionType: 'update',
        fieldName: 'status',
        oldValue: oldAccount?.status,
        newValue: status,
        userId: req.user!.id,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: req.user!.username || 'Unknown',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      console.log('📡 Broadcasting status update via WebSocket:', { id, status });
      ws.broadcast({
        type: 'ACCOUNT_STATUS_UPDATED',
        data: { id, status, account }
      });
      
      res.json(account);
    } catch (error) {
      console.error('Error updating account status:', error);
      res.status(500).json({ error: "Failed to update account status" });
    }
  });

  // Delete ad account (requires authentication)
  app.delete("/api/ad-accounts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const sessionId = req.headers['x-session-id'] as string || '';
      
      // Get account data before deletion for activity logging
      const accountToDelete = await storage.getAdAccountById(id);
      
      await storage.deleteAdAccount(id);
      
      // Log account deletion (field-level only)
      await ActivityLogger.logFieldChange({
        tableName: 'ad_accounts',
        recordId: id,
        actionType: 'delete',
        fieldName: 'account',
        oldValue: accountToDelete?.name || accountToDelete?.accountId,
        newValue: null,
        userId: user.id,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: user.username || 'Unknown',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      // Note: Real-time sync handled by ActivityLogger
      
      ws.broadcast({
        type: 'AD_ACCOUNT_DELETED',
        data: { id }
      });
      
      console.log(`✅ Account ${id} deleted successfully by user ${user.id}`);
      res.status(204).send();
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      res.status(500).json({ error: "Failed to delete ad account" });
    }
  });
}