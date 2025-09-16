/**
 * Universal Server-side Real-time Sync Service
 * Handles auto-save and real-time updates for any data table
 */

import { db } from '../db';
import { eq, sql } from 'drizzle-orm';

interface TableConfig {
  table: any; // Drizzle table reference
  changeTable: any; // Changes tracking table
  keyField: string; // Primary key field name
  broadcastType: string; // WebSocket broadcast type
}

interface ChangeRecord {
  id: string | number;
  field: string;
  value: any;
  sessionId: string;
  timestamp: string;
}

class RealtimeSyncServer {
  private config: TableConfig;
  private broadcast?: (message: any) => void;

  constructor(config: TableConfig, broadcast?: (message: any) => void) {
    this.config = config;
    this.broadcast = broadcast;
  }

  /**
   * Save single field change
   */
  async saveChange(change: ChangeRecord): Promise<any> {
    const { id, field, value, sessionId, timestamp } = change;

    try {
      // Update main table
      const updateData = { [field]: value };
      const updated = await db
        .update(this.config.table)
        .set(updateData)
        .where(eq(this.config.table[this.config.keyField], id))
        .returning();

      // Record change for sync
      await db.insert(this.config.changeTable).values({
        recordId: id.toString(),
        field,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        sessionId,
        timestamp: new Date(timestamp)
      });

      // Broadcast to other users
      if (this.broadcast) {
        this.broadcast({
          type: this.config.broadcastType,
          data: {
            id,
            field,
            value,
            sessionId,
            timestamp
          }
        });
      }

      return updated[0];
    } catch (error) {
      console.error('Save change error:', error);
      throw error;
    }
  }

  /**
   * Save multiple changes at once
   */
  async saveBulkChanges(changes: ChangeRecord[]): Promise<any[]> {
    const results = [];

    try {
      // Process each change
      for (const change of changes) {
        const result = await this.saveChange(change);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Bulk save error:', error);
      throw error;
    }
  }

  /**
   * Get changes since timestamp for sync
   */
  async getChangesSince(timestamp: string, excludeSessionId?: string): Promise<any[]> {
    try {
      const changes = await db
        .select()
        .from(this.config.changeTable)
        .where(sql`timestamp > ${timestamp}`);

      // Filter out the requesting session's changes
      const filteredChanges = excludeSessionId ? 
        changes.filter(change => change.sessionId !== excludeSessionId) : 
        changes;

      return filteredChanges.slice(0, 100).map(change => ({
        id: change.recordId,
        field: change.field,
        value: this.parseValue(change.value),
        sessionId: change.sessionId,
        timestamp: change.timestamp
      }));
    } catch (error) {
      console.error('Get changes error:', error);
      return [];
    }
  }

  /**
   * Parse stored value back to original type
   */
  private parseValue(value: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(value);
    } catch {
      // If not JSON, return as string
      return value;
    }
  }

  /**
   * Cleanup old changes (call periodically)
   */
  async cleanupOldChanges(olderThanHours: number = 24): Promise<void> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      await db
        .delete(this.config.changeTable)
        .where(sql`timestamp < ${cutoffTime.toISOString()}`);

      console.log(`🧹 Cleaned up old changes for ${this.config.broadcastType}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get all records for initial load
   */
  async getAllRecords(): Promise<any[]> {
    try {
      return await db.select().from(this.config.table);
    } catch (error) {
      console.error('Get all records error:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create sync service for specific table
 */
export function createRealtimeSyncServer(config: TableConfig, broadcast?: (message: any) => void): RealtimeSyncServer {
  return new RealtimeSyncServer(config, broadcast);
}

/**
 * Express route factory for realtime sync endpoints
 */
export function createSyncRoutes(syncService: RealtimeSyncServer, basePath: string) {
  return {
    // GET /api/{basePath} - Get all records
    getAll: async (req: any, res: any) => {
      try {
        const records = await syncService.getAllRecords();
        res.json(records);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch records' });
      }
    },

    // PUT /api/{basePath} - Save single change
    saveChange: async (req: any, res: any) => {
      try {
        const result = await syncService.saveChange(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to save change' });
      }
    },

    // PUT /api/{basePath}/bulk - Save multiple changes
    saveBulk: async (req: any, res: any) => {
      try {
        const results = await syncService.saveBulkChanges(req.body.changes);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: 'Failed to save bulk changes' });
      }
    },

    // GET /api/{basePath}/updates - Get recent changes
    getUpdates: async (req: any, res: any) => {
      try {
        const { since, session } = req.query;
        const changes = await syncService.getChangesSince(since, session);
        res.json({
          changes,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get updates' });
      }
    }
  };
}

export { RealtimeSyncServer };
export type { TableConfig, ChangeRecord };