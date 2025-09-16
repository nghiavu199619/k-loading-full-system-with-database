import type { Express } from "express";
import { storage } from "../storage";
import { insertClientSchema } from "@shared/schema";
import { z } from "zod";
import { debugRequireAuth as requireAuth } from "../middleware/auth";
import { requirePermission } from "../permissions";
import { ActivityLogger } from "../services/activity-logger";
import { requireTabPermission } from "../middleware/permissions";

export function setupClientRoutes(app: Express) {
  // Get clients by ownership (hierarchical filtering)
  app.get("/api/clients", requireAuth, requireTabPermission('client-management', 'view'), async (req, res) => {
    try {
      const user = (req as any).user;
      let ownerId = user?.id;
      
      // If not director, use their director's id as ownerId
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing data owned by Director ${ownerId}`);
      }
      
      const clients = await storage.getClients(ownerId);
      console.log(`🔍 Viewing ${clients.length} clients owned by Director ${ownerId}`);
      
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Create new client (hierarchical ownership)
  app.post("/api/clients", requireAuth, requireTabPermission('client-management', 'edit'), async (req, res) => {
    try {
      const user = (req as any).user;
      const validatedData = insertClientSchema.parse(req.body);
      
      // Determine ownership: Directors own their data, employees assign to their director
      let ownerId = user?.id;
      if (user?.role !== 'director' && user?.createdBy) {
        ownerId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) creating client for Director ${ownerId}`);
      }
      
      const clientWithOwnership = { ...validatedData, userId: ownerId };
      const client = await storage.createClient(clientWithOwnership);
      
      // Log client creation (field-level only)
      await ActivityLogger.logFieldChange({
        tableName: 'clients',
        recordId: client.id,
        actionType: 'create',
        fieldName: 'client',
        oldValue: null,
        newValue: client.name,
        userId: user.id,
        userSession: ActivityLogger.getRequestContext(req)?.userSession,
        userName: user.username || 'Unknown',
        ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
        userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
      });
      
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create client" });
      }
    }
  });

  // Update client (simplified auth)
  app.patch("/api/clients/:id", requireAuth, requireTabPermission('client-management', 'edit'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const validatedData = insertClientSchema.partial().parse(req.body);
      
      // Get old data for logging
      const oldClient = await storage.getClient(id);
      const client = await storage.updateClient(id, validatedData, user.id);
      
      // Log client update (field-level only)
      if (oldClient) {
        for (const [fieldName, newValue] of Object.entries(validatedData)) {
          const oldValue = (oldClient as any)[fieldName];
          if (oldValue !== newValue) {
            await ActivityLogger.logFieldChange({
              tableName: 'clients',
              recordId: id,
              actionType: 'update',
              fieldName,
              oldValue,
              newValue,
              userId: user.id,
              userSession: ActivityLogger.getRequestContext(req)?.userSession,
              userName: user.username || 'Unknown',
              ipAddress: ActivityLogger.getRequestContext(req)?.ipAddress,
              userAgent: ActivityLogger.getRequestContext(req)?.userAgent,
            });
          }
        }
      }
      
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update client" });
      }
    }
  });

  // Client accounts relationships (requires authentication)
  app.get("/api/client-accounts", requireAuth, requireTabPermission('client-management', 'view'), async (req, res) => {
    try {
      const user = (req as any).user;
      let userId = user?.id;
      
      // If not director, use their director's id for data access
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing client accounts for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own client accounts`);
      }
      
      const clientAccounts = await storage.getClientAccounts(userId);
      res.json(clientAccounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client accounts" });
    }
  });

  app.get("/api/clients-with-accounts", requireAuth, requireTabPermission('client-management', 'view'), async (req, res) => {
    try {
      const user = (req as any).user;
      let userId = user?.id;
      
      // If not director, use their director's id for data access
      if (user?.role !== 'director' && user?.createdBy) {
        userId = user.createdBy;
        console.log(`👷 Employee ${user.id} (${user.role}) viewing clients with accounts for Director ${userId}`);
      } else {
        console.log(`👑 Director ${user?.id} viewing own clients with accounts`);
      }
      
      console.log(`🔍 CLIENTS-WITH-ACCOUNTS: Fetching for user ${userId}`);
      const clientsWithAccounts = await storage.getClientsWithAccounts(userId);
      console.log(`✅ CLIENTS-WITH-ACCOUNTS: Found ${clientsWithAccounts.length} clients`);
      res.json(clientsWithAccounts);
    } catch (error) {
      console.error("❌ CLIENTS-WITH-ACCOUNTS ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: "Failed to fetch clients with accounts", details: errorMessage });
    }
  });
}