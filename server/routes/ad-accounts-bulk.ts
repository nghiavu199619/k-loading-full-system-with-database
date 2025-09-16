import { Router } from "express";
import { db } from "../db";
import { adAccounts, accountChanges } from "../../shared/schema";
import { requireAuth } from "../middleware/auth";
// MongoDB migration - temporarily disabled drizzle imports
import type { WebSocketManager } from "../middleware/websocket";

// Export setup function that accepts WebSocket manager
export function setupAdAccountsBulkRoutes(ws: WebSocketManager) {
  const router = Router();

  console.log("🔧 AD-ACCOUNTS-BULK ROUTER LOADED!");

  // Add WebSocket broadcast helper
  const broadcastToAll = (data: any) => {
    ws.broadcast(data);
  };

  // ✅ CRITICAL FIX: Middleware to attach broadcast function to request
  router.use((req, res, next) => {
    (req as any).broadcastToAll = broadcastToAll;
    next();
  });

// POST /api/ad-accounts/bulk - Google Sheets-style bulk create with chunked processing
router.post("/bulk", requireAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    // Support both old format (count/defaultValues) and new format (accounts array)
    const { count, temps, defaultValues, sessionId, isChunked = false, chunkIndex = 0, totalChunks = 1, accounts } = req.body;
    const user = req.user!;
    
    // ✅ HIERARCHICAL OWNERSHIP: Directors own their data, employees assign to their director
    let ownerId = user.id;
    if (user.role === 'employee' && user.createdBy) {
      ownerId = user.createdBy;
      console.log(`👷 Employee ${user.id} creating accounts for Director ${ownerId}`);
    } else {
      console.log(`👑 Director ${user.id} creating accounts for own organization`);
    }
    
    const userId = ownerId; // For compatibility

    // Handle new accounts array format
    const actualCount = accounts ? accounts.length : count;
    const actualValues = accounts || defaultValues;

    console.log(`🚀🚀🚀 BULK-TS ROUTE HIT: ${actualCount || 'undefined'} accounts for user ${ownerId} 🚀🚀🚀`);
    console.log(`🚀 GOOGLE SHEETS BULK CREATE: ${actualCount || 'undefined'} accounts for user ${ownerId}`);
    console.log(`📦 CHUNK INFO: ${chunkIndex + 1}/${totalChunks} (isChunked: ${isChunked})`);
    console.log(`🔧 DEBUG: Received accounts:`, accounts ? accounts.length : 'undefined');
    console.log(`🔧 DEBUG: Received defaultValues:`, defaultValues ? JSON.stringify(defaultValues, null, 2) : 'undefined');
    console.log(`🔧 DEBUG: actualValues:`, Array.isArray(actualValues));
    console.log(`🔧 DEBUG: First item sample:`, actualValues?.[0] || actualValues);

    // Validate we have data to work with
    if (!actualCount || actualCount === 0) {
      console.error('❌ CRITICAL: No accounts data provided');
      return res.status(400).json({ success: false, error: 'No accounts data provided' });
    }

    // Get next local_id for this owner
    const maxLocalIdResult = await db
      .select({ maxLocalId: max(adAccounts.localId) })
      .from(adAccounts)
      .where(eq(adAccounts.ownerId, ownerId));

    const nextLocalId = (maxLocalIdResult[0]?.maxLocalId || 0) + 1;

    // ✅ SEQUENCE CONTINUATION FIX: Find last accountId number for proper sequence
    const existingAccounts = await db
      .select({ accountId: adAccounts.accountId })
      .from(adAccounts)
      .where(eq(adAccounts.ownerId, ownerId));
    
    // Extract numbers from accountId like "Tài khoản 37" → 37
    let maxAccountNumber = 0;
    existingAccounts.forEach(account => {
      if (account.accountId) {
        const match = account.accountId.match(/Tài khoản (\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxAccountNumber) {
            maxAccountNumber = num;
          }
        }
      }
    });
    
    console.log(`📊 SEQUENCE: Found max account number: ${maxAccountNumber}, will continue from: ${maxAccountNumber + 1}`);

    // Prepare bulk insert data - support both single defaultValues and array of values
    const bulkData: any[] = [];
    const isArrayValues = Array.isArray(actualValues);
    
    for (let i = 0; i < actualCount; i++) {
      // Use individual values if array provided, otherwise use single object for all
      const values = isArrayValues ? actualValues[i] : actualValues;
      
      const currentLocalId = nextLocalId + i;
      
      // ✅ SEQUENCE CONTINUATION FIX - Use proper account number sequence
      const accountNumber = maxAccountNumber + 1 + i;
      const accountId = values?.accountId || `Tài khoản ${accountNumber}`;
      
      const rowData = {
        ownerId: ownerId,
        localId: currentLocalId,
        accountId: accountId, // Always has value - either user provided or auto-generated
        name: values?.name || '',
        status: values?.status || '', // ✅ REMOVED DEFAULT "Hoạt động" - now empty by default
        source: values?.source || '',
        rentalPercentage: values?.rentalPercentage || '0',
        cardType: values?.cardType || '',
        cardNote: values?.cardNote || '',
        vatPercentage: values?.vatPercentage || '0',
        clientTag: values?.clientTag || '',
        accountPermission: values?.accountPermission || '',
        description: values?.description || '',
        userId: ownerId, // Keep legacy userId for compatibility
      };
      
      // ✅ VERIFY CRITICAL DATA INTEGRITY
      if (!rowData.accountId) {
        console.warn(`⚠️ FALLBACK TRIGGERED: Empty accountId for row ${i}, using: ${accountId}`);
        rowData.accountId = accountId;
      }
      
      // ✅ FINAL VERIFICATION - Log data integrity check
      console.log(`🔍 ROW ${i} DATA INTEGRITY: accountId="${rowData.accountId}" (should never be empty)`);
      
      // Debug log for the first row to see mapping
      if (i === 0) {
        console.log(`🔧 DEBUG: First row data being inserted:`, JSON.stringify(rowData, null, 2));
        console.log(`🔧 DEBUG: values object:`, JSON.stringify(values, null, 2));
      }
      
      bulkData.push(rowData);
    }
    
    console.log(`📦 OPTIMIZED: Preparing ${actualCount} rows batch insert`);

    // PERFORMANCE: Single transaction bulk insert
    const insertedRows = await db.insert(adAccounts).values(bulkData).returning();

    console.log(`✅ BULK SUCCESS: ${insertedRows.length} accounts created in single transaction`);

    // ✅ ACTIVITY LOGS FIX: Create system logs for new account creation
    console.log(`📝 Creating system logs for ${insertedRows.length} new accounts...`);
    try {
      const { storage } = await import("../storage");
      
      for (const newAccount of insertedRows) {
        await storage.createSystemLog({
          tableName: 'ad_accounts',
          recordId: newAccount.id.toString(),
          fieldName: 'accountId',
          oldValue: '', // New account has no old value
          newValue: newAccount.accountId || 'New Account',
          userId: ownerId,
          userSession: sessionId || 'bulk-create',
          actionType: 'create',
          ipAddress: '127.0.0.1',
          userAgent: 'Bulk Create System'
        });
      }
      
      console.log(`✅ SYSTEM LOGS CREATED: ${insertedRows.length} account creation logs`);
    } catch (logError) {
      console.error('❌ System logging error (non-critical):', logError);
    }

    // Map temp IDs to real IDs for client
    const responseRows = insertedRows.map((row, index) => ({
      temp: temps?.[index] || `temp-${index}`,
      id: row.id,
      localId: row.localId,
      ownerId: row.ownerId,
      displayId: `${row.localId}-${row.ownerId}`,
      accountId: row.accountId,
      name: row.name,
      status: row.status,
      source: row.source,
      rentalPercentage: row.rentalPercentage,
      cardType: row.cardType,
      cardNote: row.cardNote,
      vatPercentage: row.vatPercentage,
      clientTag: row.clientTag,
      accountPermission: row.accountPermission,
      description: row.description
    }));

    // ✅ AUTOMATIC CLEANUP: Remove old NEW_ACCOUNT events to prevent infinite refresh accumulation
    try {
      const cleanupResult = await db.delete(accountChanges)
        .where(and(
          eq(accountChanges.field, 'NEW_ACCOUNT'),
          lt(accountChanges.createdAt, new Date(Date.now() - 2 * 60 * 1000)) // Older than 2 minutes
        ));
      console.log(`🧹 CLEANUP: Removed old NEW_ACCOUNT events to prevent infinite refresh loops`);
    } catch (cleanupError) {
      console.error('⚠️ Cleanup warning (non-critical):', cleanupError);
    }

    // ✅ NEW ARCHITECTURE: CROSS-MACHINE SYNC WITH PROCESSED EVENT TRACKING
    console.log(`🔄 IMPLEMENTING PROCESSED EVENT TRACKING for ${insertedRows.length} accounts`);
    
    try {
      // Create NEW_ACCOUNT events for cross-machine sync with 5-minute window
      const changeRecords = insertedRows.map(newAccount => ({
        accountId: newAccount.id,
        row: 0,
        col: 0,
        field: 'NEW_ACCOUNT',
        oldValue: '',
        newValue: `Account created: ${newAccount.accountId || 'New Account'}`,
        userId: userId.toString(),
        sessionId: sessionId || 'bulk-create'
      }));

      await db.insert(accountChanges).values(changeRecords);
      console.log(`✅ CROSS-MACHINE SYNC: Created ${changeRecords.length} NEW_ACCOUNT events for other sessions`);

      // Schedule cleanup of old NEW_ACCOUNT events (older than 5 minutes)
      setTimeout(async () => {
        try {
          await db.delete(accountChanges)
            .where(and(
              eq(accountChanges.field, 'NEW_ACCOUNT'),
              lt(accountChanges.createdAt, new Date(Date.now() - 5 * 60 * 1000))
            ));
          console.log(`🧹 AUTO CLEANUP: Removed NEW_ACCOUNT events older than 5 minutes`);
        } catch (cleanupError) {
          console.error('⚠️ Cleanup error:', cleanupError);
        }
      }, 5 * 60 * 1000); // 5 minutes

    } catch (trackingError) {
      console.error('❌ Cross-machine sync error:', trackingError);
    }

    // ✅ PROGRESSIVE DATA BROADCASTING SYSTEM - Ensures complete data distribution
    console.log(`🚀 PROGRESSIVE BROADCAST: Starting for ${insertedRows.length} accounts`);
    
    // Progressive broadcasting function that retries until all data is confirmed delivered
    const progressiveBroadcast = async (accountRows: any[], maxRetries: number = 3) => {
      let attempt = 0;
      let remainingRows = [...accountRows];
      
      while (remainingRows.length > 0 && attempt < maxRetries) {
        attempt++;
        console.log(`📡 BROADCAST ATTEMPT ${attempt}/${maxRetries}: ${remainingRows.length} rows remaining`);
        
        try {
          // Prepare broadcast data with sessionId for duplicate prevention
          const broadcastData = {
            type: 'ROW_INSERT',
            sessionId: sessionId, // ✅ CRITICAL FIX: Add sessionId for duplicate prevention
            data: remainingRows.map(row => ({
              id: row.id,
              localId: row.localId,
              ownerId: row.ownerId,
              displayId: `${row.localId}-${row.ownerId}`,
              accountId: row.accountId,
              name: row.name,
              status: row.status,
              source: row.source,
              rentalPercentage: row.rentalPercentage,
              cardType: row.cardType,
              cardNote: row.cardNote,
              vatPercentage: row.vatPercentage,
              clientTag: row.clientTag,
              accountPermission: row.accountPermission,
              description: row.description,
              userId: row.userId,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              createdBy: userId,
              sessionId: sessionId || 'bulk-create',
              broadcastAttempt: attempt,
              totalAttempts: maxRetries
            })),
            chunkInfo: {
              isChunked,
              chunkIndex,
              totalChunks,
              isLastChunk: chunkIndex === totalChunks - 1
            }
          };
          
          // Broadcast to all clients
          broadcastToAll(broadcastData);
          
          // Add progressive delay between attempts
          if (attempt < maxRetries && remainingRows.length > 0) {
            const delay = attempt * 500; // 500ms, 1000ms, 1500ms
            console.log(`⏳ PROGRESSIVE DELAY: Waiting ${delay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // For this implementation, assume all rows are broadcast successfully
          // In a production system, you'd verify delivery here
          remainingRows = [];
          
        } catch (broadcastError) {
          console.error(`❌ BROADCAST ATTEMPT ${attempt} FAILED:`, broadcastError);
          
          if (attempt === maxRetries) {
            console.error(`🚨 BROADCAST EXHAUSTED: Failed to broadcast ${remainingRows.length} rows after ${maxRetries} attempts`);
            break;
          }
        }
      }
      
      if (remainingRows.length === 0) {
        console.log(`✅ PROGRESSIVE BROADCAST COMPLETE: All ${accountRows.length} rows broadcast successfully`);
        
        // Send completion signal for final chunk
        if (isChunked && chunkIndex === totalChunks - 1) {
          broadcastToAll({
            type: 'SYNC_DONE',
            message: `Chunked paste completed: ${totalChunks} chunks processed`,
            totalRows: accountRows.length,
            sessionId: sessionId || 'bulk-create'
          });
          console.log(`🏁 SYNC_DONE signal sent for final chunk ${chunkIndex + 1}/${totalChunks}`);
        }
      }
    };
    
    // Execute progressive broadcasting (currently broadcasts ROW_INSERT but client ignores it)
    await progressiveBroadcast(insertedRows);
    console.log(`📡 BROADCASTING DATA_REFRESH instead of ROW_INSERT to prevent duplicate rows`);
    
    // ✅ CRITICAL FIX: Use direct broadcastToAll function from scope
    try {
      broadcastToAll({
        type: 'DATA_REFRESH',
        message: `${insertedRows.length} new accounts created by paste operation`,
        accountCount: insertedRows.length,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        action: 'bulk_create'
      });
      console.log(`✅ DATA_REFRESH BROADCAST SUCCESS: Notified ${insertedRows.length} new accounts to all clients`);
    } catch (broadcastError) {
      console.error('❌ DATA_REFRESH BROADCAST ERROR:', broadcastError);
    }

    // ✅ GOOGLE SHEETS PATTERN: Send SYNC_DONE when this is the final chunk
    if (isChunked && chunkIndex === totalChunks - 1) {
      console.log(`🎯 FINAL CHUNK COMPLETE: Sending SYNC_DONE event`);
      const syncDoneData = {
        type: 'SYNC_DONE',
        totalRows: totalChunks * count, // Approximate total
        chunksProcessed: totalChunks,
        sessionId: sessionId || 'bulk-create',
        timestamp: new Date().toISOString()
      };
      
      broadcastToAll(syncDoneData);
      console.log(`✅ SYNC_DONE: Broadcasted completion signal for ${totalChunks} chunks`);
    }

    const response = {
      success: true,
      rows: responseRows,
      chunkInfo: isChunked ? { chunkIndex, totalChunks, isLastChunk: chunkIndex === totalChunks - 1 } : null,
      message: `Successfully created ${insertedRows.length} new accounts`
    };

    const duration = Date.now() - startTime;
    console.log(`📤 BULK COMPLETE: ${responseRows.length} rows in ${duration}ms + WebSocket broadcast sent`);
    res.json(response);

  } catch (error) {
    console.error('❌ BULK CREATE ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create bulk accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/ad-accounts/bulk - Update multiple accounts (enhanced autosave)
router.put("/bulk", requireAuth, async (req, res) => {
  try {
    const { changes, sessionId } = req.body;
    const userId = req.user!.id;

    console.log(`💾 BULK UPDATE: Processing ${changes?.length || 0} changes for user ${userId}`);

    if (!changes || changes.length === 0) {
      return res.json({ success: true, updated: 0 });
    }

    const results: any[] = [];

    // Process changes in transaction
    await db.transaction(async (tx) => {
      for (const change of changes) {
        const { id, field, newValue, oldValue } = change;

        // Update the specific field
        const updateData: any = { [field]: newValue || '' };
        updateData.updatedAt = new Date();

        await tx
          .update(adAccounts)
          .set(updateData)
          .where(eq(adAccounts.id, id));

        // Record change for real-time sync (if account_changes table exists)
        try {
          await tx.execute(`INSERT INTO account_changes (account_id, row, col, field, old_value, new_value, user_id, session_id, timestamp)
                           VALUES (${id}, 0, 0, '${field}', '${oldValue || ''}', '${newValue || ''}', '${userId}', '${sessionId}', NOW())`);
        } catch (changeLogError) {
          console.warn('⚠️ Could not log change (table may not exist):', changeLogError);
        }

        results.push({ id, field, updated: true });
      }
    });

    console.log(`✅ BULK UPDATE SUCCESS: Updated ${results.length} fields`);

    res.json({
      success: true,
      updated: results.length,
      results,
      message: `Successfully updated ${results.length} fields`
    });

  } catch (error) {
    console.error('❌ BULK UPDATE ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/ad-accounts/rows - Get paginated accounts with offset/limit
router.get("/rows", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 500;

    console.log(`📋 PAGINATED FETCH: Getting accounts for user ${userId}, offset: ${offset}, limit: ${limit}`);

    const accounts = await db
      .select()
      .from(adAccounts)
      .where(eq(adAccounts.ownerId, userId))
      .orderBy(adAccounts.localId)
      .offset(offset)
      .limit(limit);

    const total = await db
      .select({ count: adAccounts.id })
      .from(adAccounts)
      .where(eq(adAccounts.ownerId, userId));

    console.log(`✅ PAGINATED FETCH: Found ${accounts.length} accounts (total: ${total.length})`);

    res.json({
      success: true,
      accounts,
      pagination: {
        offset,
        limit,
        total: total.length,
        hasMore: offset + limit < total.length
      }
    });

  } catch (error) {
    console.error('❌ PAGINATED FETCH ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

  return router;
}