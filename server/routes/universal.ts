import type { Express } from "express";
import { storage } from "../storage";
import { insertTestClientSchema, insertTestAccountSchema, insertUserSessionSchema, insertTypingIndicatorSchema, insertCursorPositionSchema } from "@shared/schema";
import { z } from "zod";
import type { WebSocketManager } from "../middleware/websocket";
import { debugRequireAuth as requireAuth } from "../middleware/auth";

export function setupUniversalRoutes(app: Express, ws: WebSocketManager) {
  // Universal real-time sync system - DISABLED (replaced by WebSocket-based system)
  app.get("/api/universal/updates", (req, res) => {
    res.status(503).json({ error: "Universal sync disabled - using WebSocket system instead" });
  });

  // Test clients (for Universal system demo) - requires authentication for user isolation
  app.get("/api/test-clients", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const clients = await storage.getTestClients(userId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch test clients" });
    }
  });

  app.put("/api/test-clients", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const changes = req.body;
      
      if (!Array.isArray(changes)) {
        return res.status(400).json({ error: "Changes must be an array" });
      }

      for (const change of changes) {
        // Add user isolation
        change.userId = userId;
        await storage.saveTestClientChange(change);
      }

      ws.broadcast({
        type: 'TEST_CLIENTS_UPDATED',
        data: changes,
        userId // Only broadcast to same user
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update test clients" });
    }
  });

  // Test accounts (for Universal system demo) - requires authentication for user isolation
  app.get("/api/test-accounts", requireAuth, async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      const userId = (req as any).user?.id;
      const accounts = await storage.getTestAccounts(userId);
      res.json(accounts || []);
    } catch (error) {
      console.error('Test accounts error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to fetch test accounts", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/test-accounts", requireAuth, async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      const userId = (req as any).user?.id;
      const changes = req.body;
      
      if (!Array.isArray(changes)) {
        return res.status(400).json({ error: "Changes must be an array" });
      }

      for (const change of changes) {
        // Add user isolation
        change.userId = userId;
        await storage.saveTestAccountChange(change);
      }

      ws.broadcast({
        type: 'TEST_ACCOUNTS_UPDATED',
        data: changes,
        userId // Only broadcast to same user
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Test accounts update error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to update test accounts", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Batch update endpoint for test accounts (required by client) - requires auth for user isolation
  app.post("/api/test-accounts/batch-update", requireAuth, async (req, res) => {
    console.log('🔥 BATCH UPDATE ENDPOINT HIT!', req.body);
    
    try {
      // Block problematic sessions that keep sending old data
      const blockedSessions = ['session_ymgkj8tqc'];
      if (blockedSessions.includes(req.body.sessionId)) {
        console.log('🚫 BLOCKING ZOMBIE SESSION:', req.body.sessionId);
        return res.status(200).json({ success: true, processed: 0, message: 'Session blocked' });
      }
      
      // Set headers early and consistently
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Handle both formats: direct array or object with changes property
      let changes;
      if (Array.isArray(req.body)) {
        changes = req.body;
      } else if (req.body && Array.isArray(req.body.changes)) {
        changes = req.body.changes;
      } else {
        console.log('❌ Invalid data format:', req.body);
        return res.status(400).json({ error: "Request must contain changes array" });
      }

      console.log(`📝 Processing ${changes.length} test account changes`);

      // Convert client format to database schema format
      const dbChanges = changes.map((change: any) => ({
        accountId: change.accountId,
        field: change.field,
        oldValue: String(change.oldValue || ''),
        newValue: String(change.newValue || ''),
        sessionId: req.body.sessionId || 'unknown'
        // timestamp will be auto-generated by database defaultNow()
      }));

      for (const change of dbChanges) {
        await storage.saveTestAccountChange(change);
      }

      ws.broadcast({
        type: 'TEST_ACCOUNTS_UPDATED',
        data: dbChanges
      });

      const result = { success: true, processed: changes.length };
      console.log('✅ Sending response:', result);
      res.json(result);
      
    } catch (error) {
      console.error('❌ Batch update error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to batch update test accounts", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Legacy sync endpoints (for backward compatibility)
  app.post("/api/redit-sync/join", async (req, res) => {
    try {
      // Legacy endpoint for joining real-time sync
      res.json({ success: true, message: "Joined sync session" });
    } catch (error) {
      res.status(500).json({ error: "Failed to join sync session" });
    }
  });

  app.get("/api/updates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const since = req.query.since as string;
      const sessionId = req.query.sessionId as string;
      
      const changes = await storage.getAccountChanges(since, sessionId, userId);
      const accounts = await storage.getAdAccounts(userId); // Add user isolation
      
      res.json({
        changes,
        accounts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch updates" });
    }
  });

  // ============ ADVANCED COLLABORATION FEATURES ============
  
  // User Session Management
  app.post("/api/collaboration/session/join", async (req, res) => {
    try {
      const { sessionId, userName, userColor } = req.body;
      
      // Register or update user session
      await storage.upsertUserSession({
        sessionId,
        userName: userName || 'Anonymous',
        userColor: userColor || '#3B82F6',
        isActive: true,
        lastSeen: new Date()
      });

      ws.broadcast({
        type: 'USER_JOINED',
        sessionId,
        userName,
        userColor
      });

      res.json({ success: true, message: "Joined collaboration session" });
    } catch (error) {
      res.status(500).json({ error: "Failed to join session" });
    }
  });

  app.post("/api/collaboration/session/leave", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      await storage.deactivateUserSession(sessionId);

      ws.broadcast({
        type: 'USER_LEFT',
        sessionId
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave session" });
    }
  });

  // Typing Indicators
  app.post("/api/collaboration/typing/start", async (req, res) => {
    try {
      const { sessionId, tableId, recordId, fieldName, userName, userColor } = req.body;
      
      await storage.setTypingIndicator({
        sessionId,
        tableId,
        recordId,
        fieldName,
        userName: userName || 'Anonymous',
        userColor: userColor || '#3B82F6'
      });

      ws.broadcast({
        type: 'TYPING_STARTED',
        data: { sessionId, tableId, recordId, fieldName, userName, userColor }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set typing indicator" });
    }
  });

  app.post("/api/collaboration/typing/stop", async (req, res) => {
    try {
      const { sessionId, tableId, recordId, fieldName } = req.body;
      
      await storage.removeTypingIndicator(sessionId, tableId, recordId, fieldName);

      ws.broadcast({
        type: 'TYPING_STOPPED',
        data: { sessionId, tableId, recordId, fieldName }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove typing indicator" });
    }
  });

  // Cursor Position Tracking
  app.post("/api/collaboration/cursor", async (req, res) => {
    try {
      const { sessionId, tableId, row, col, userName, userColor } = req.body;
      
      await storage.updateCursorPosition({
        sessionId,
        tableId,
        row,
        col,
        userName: userName || 'Anonymous',
        userColor: userColor || '#3B82F6'
      });

      ws.broadcast({
        type: 'CURSOR_MOVED',
        data: { sessionId, tableId, row, col, userName, userColor }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update cursor position" });
    }
  });

  // Get Active Users and Indicators
  app.get("/api/collaboration/status", async (req, res) => {
    try {
      const { tableId } = req.query;
      
      const [activeSessions, typingIndicators, cursorPositions] = await Promise.all([
        storage.getActiveSessions(),
        storage.getTypingIndicators(tableId as string),
        storage.getCursorPositions(tableId as string)
      ]);

      res.json({
        activeSessions,
        typingIndicators,
        cursorPositions
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get collaboration status" });
    }
  });

  // Conflict Resolution
  app.post("/api/collaboration/resolve-conflict", async (req, res) => {
    try {
      const { tableId, recordId, field, resolution, winningValue, sessionId } = req.body;
      
      // Update the record with conflict resolution
      if (tableId === 'test_accounts') {
        const result = await storage.resolveAccountConflict(recordId, field, winningValue, sessionId, resolution);
        
        ws.broadcast({
          type: 'CONFLICT_RESOLVED',
          data: { tableId, recordId, field, resolution, value: winningValue }
        });

        res.json({ success: true, result });
      } else {
        res.status(400).json({ error: "Unsupported table for conflict resolution" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve conflict" });
    }
  });
}