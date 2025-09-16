import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertViaManagementSchema, insertViaManagementChangeSchema } from '@shared/schema';
import { requireAuth } from '../middleware/auth-bridge';
import { requireTabPermission } from '../middleware/permissions';
import { nanoid } from 'nanoid';

export default function setupViaManagementRoutes(wsManager?: any) {
  const router = express.Router();

// Get all vias for user
router.get('/', requireAuth, requireTabPermission('via-management', 'view'), async (req, res) => {
  try {
    let userId = req.user?.id;
    const originalUserId = userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Employee users access director's data
    const user = await storage.getUserById(userId);
    if (user?.role !== 'director' && user?.createdBy) {
      userId = user.createdBy;
      console.log(`👷 Employee ${originalUserId} (${user.role}) viewing vias for Director ${userId}`);
    } else {
      console.log(`👑 Director ${userId} using own ID for data operations`);
    }

    console.log(`📋 VIA MANAGEMENT: Retrieved vias for user ${userId} (original: ${originalUserId})`);
    const vias = await storage.getViaManagement(userId);
    res.json(vias);
  } catch (error) {
    console.error('❌ GET VIA MANAGEMENT ERROR:', error);
    res.status(500).json({ error: 'Failed to retrieve via management data' });
  }
});

// Create new via
router.post('/', requireAuth, requireTabPermission('via-management', 'edit'), async (req, res) => {
  try {
    let userId = req.user?.id;
    const originalUserId = userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Employee users create under director's data
    const user = await storage.getUserById(userId);
    if (user?.role !== 'director' && user?.createdBy) {
      userId = user.createdBy;
      console.log(`👷 Employee ${originalUserId} (${user.role}) creating via for Director ${userId}`);
    } else {
      console.log(`✅ VIA MANAGEMENT: Creating via for user ${userId} (original: ${originalUserId})`);
    }

    const validatedData = insertViaManagementSchema.parse({
      ...req.body,
      userId
    });

    const newVia = await storage.createViaManagement(validatedData);
    
    // Log the creation
    await storage.createViaManagementChange({
      viaId: newVia.id,
      fieldName: 'created',
      oldValue: null,
      newValue: JSON.stringify(newVia),
      userId: originalUserId, // Use original user ID for change tracking
      changeType: 'create',
      sessionId: req.body.sessionId || nanoid(),
      batchId: req.body.batchId || nanoid()
    });

    // WebSocket broadcast for realtime updates
    if (wsManager) {
      const broadcastData = {
        type: 'VIA_CREATED',
        data: newVia,
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING VIA CREATION:', newVia.id);
      wsManager.broadcast(broadcastData);
    }

    res.status(201).json(newVia);
  } catch (error) {
    console.error('❌ CREATE VIA MANAGEMENT ERROR:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create via' });
  }
});

// Update via
router.put('/:id', requireAuth, requireTabPermission('via-management', 'edit'), async (req, res) => {
  try {
    let userId = req.user?.id;
    const originalUserId = userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Employee users update director's data
    const user = await storage.getUserById(userId);
    if (user?.role !== 'director' && user?.createdBy) {
      userId = user.createdBy;
      console.log(`👷 Employee ${originalUserId} (${user.role}) updating via for Director ${userId}`);
    }

    const viaId = parseInt(req.params.id);
    if (isNaN(viaId)) {
      return res.status(400).json({ error: 'Invalid via ID' });
    }

    // Get current via for change tracking
    const currentVias = await storage.getViaManagement(userId);
    const currentVia = currentVias.find(v => v.id === viaId);
    
    if (!currentVia) {
      return res.status(404).json({ error: 'Via not found' });
    }

    const validatedData = insertViaManagementSchema.partial().parse(req.body);
    const updatedVia = await storage.updateViaManagement(viaId, validatedData);

    // Track field changes
    for (const [field, newValue] of Object.entries(validatedData)) {
      const oldValue = (currentVia as any)[field];
      if (oldValue !== newValue) {
        await storage.createViaManagementChange({
          viaId: viaId,
          fieldName: field,
          oldValue: oldValue?.toString() || null,
          newValue: newValue?.toString() || null,
          userId: originalUserId, // Use original user ID for change tracking
          changeType: 'update',
          sessionId: req.body.sessionId || nanoid(),
          batchId: req.body.batchId || nanoid()
        });
      }
    }

    // WebSocket broadcast for realtime updates
    if (wsManager) {
      const broadcastData = {
        type: 'VIA_UPDATED',
        data: updatedVia,
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING VIA UPDATE:', viaId);
      wsManager.broadcast(broadcastData);
    }

    res.json(updatedVia);
  } catch (error) {
    console.error('❌ UPDATE VIA MANAGEMENT ERROR:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update via' });
  }
});

// Delete via
router.delete('/:id', requireAuth, requireTabPermission('via-management', 'edit'), async (req, res) => {
  try {
    let userId = req.user?.id;
    const originalUserId = userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Employee users delete from director's data
    const user = await storage.getUserById(userId);
    if (user?.role !== 'director' && user?.createdBy) {
      userId = user.createdBy;
      console.log(`👷 Employee ${originalUserId} (${user.role}) deleting via for Director ${userId}`);
    }

    const viaId = parseInt(req.params.id);
    if (isNaN(viaId)) {
      return res.status(400).json({ error: 'Invalid via ID' });
    }

    // Get current via for change tracking
    const currentVias = await storage.getViaManagement(userId);
    const currentVia = currentVias.find(v => v.id === viaId);
    
    if (!currentVia) {
      return res.status(404).json({ error: 'Via not found' });
    }

    await storage.deleteViaManagement(viaId);

    // Log the deletion
    await storage.createViaManagementChange({
      viaId: viaId,
      fieldName: 'deleted',
      oldValue: JSON.stringify(currentVia),
      newValue: null,
      userId,
      changeType: 'delete',
      sessionId: req.body?.sessionId || nanoid(),
      batchId: req.body?.batchId || nanoid()
    });

    // WebSocket broadcast for realtime updates
    if (wsManager) {
      const broadcastData = {
        type: 'VIA_DELETED',
        data: { id: viaId, deletedVia: currentVia },
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING VIA DELETION:', viaId);
      wsManager.broadcast(broadcastData);
    }

    res.status(204).send();
  } catch (error) {
    console.error('❌ DELETE VIA MANAGEMENT ERROR:', error);
    res.status(500).json({ error: 'Failed to delete via' });
  }
});

// Get changes since timestamp (for real-time sync)
router.get('/changes', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { since, sessionId } = req.query;
    
    if (!since || !sessionId) {
      return res.status(400).json({ error: 'since and sessionId parameters required' });
    }

    const changes = await storage.getViaManagementChanges(
      since as string,
      sessionId as string,
      userId
    );

    res.json(changes);
  } catch (error) {
    console.error('❌ GET VIA MANAGEMENT CHANGES ERROR:', error);
    res.status(500).json({ error: 'Failed to retrieve changes' });
  }
});

// Batch save multiple vias
router.post('/batch', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { changes, sessionId, batchId } = req.body;
    
    console.log('📋 VIA MANAGEMENT BATCH SAVE:', {
      userId,
      changesCount: changes?.length,
      sessionId,
      batchId,
      changes: JSON.stringify(changes, null, 2)
    });
    
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'Changes must be an array' });
    }

    const results = [];
    
    for (const change of changes) {
      const { operation, id, data } = change;
      
      try {
        if (operation === 'create') {
          const validatedData = insertViaManagementSchema.parse({
            ...data,
            userId
          });
          const newVia = await storage.createViaManagement(validatedData);
          
          await storage.createViaManagementChange({
            viaId: newVia.id,
            fieldName: 'created',
            oldValue: null,
            newValue: JSON.stringify(newVia),
            userId,
            changeType: 'create',
            sessionId: sessionId || nanoid(),
            batchId: batchId || nanoid()
          });
          
          results.push({ operation, success: true, data: newVia });
          
        } else if (operation === 'update') {
          const viaId = parseInt(id);
          if (isNaN(viaId)) {
            results.push({ operation, success: false, error: 'Invalid via ID' });
            continue;
          }
          
          const currentVias = await storage.getViaManagement(userId);
          const currentVia = currentVias.find(v => v.id === viaId);
          
          if (!currentVia) {
            results.push({ operation, success: false, error: 'Via not found' });
            continue;
          }
          
          const validatedData = insertViaManagementSchema.partial().parse(data);
          const updatedVia = await storage.updateViaManagement(viaId, validatedData);
          
          // Track field changes
          for (const [field, newValue] of Object.entries(validatedData)) {
            const oldValue = (currentVia as any)[field];
            if (oldValue !== newValue) {
              await storage.createViaManagementChange({
                viaId: viaId,
                fieldName: field,
                oldValue: oldValue?.toString() || null,
                newValue: newValue?.toString() || null,
                userId,
                changeType: 'update',
                sessionId: sessionId || nanoid(),
                batchId: batchId || nanoid()
              });
            }
          }
          
          results.push({ operation, success: true, data: updatedVia });
          
        } else if (operation === 'delete') {
          const viaId = parseInt(id);
          if (isNaN(viaId)) {
            results.push({ operation, success: false, error: 'Invalid via ID' });
            continue;
          }
          
          const currentVias = await storage.getViaManagement(userId);
          const currentVia = currentVias.find(v => v.id === viaId);
          
          if (!currentVia) {
            results.push({ operation, success: false, error: 'Via not found' });
            continue;
          }
          
          await storage.deleteViaManagement(viaId);
          
          await storage.createViaManagementChange({
            viaId: viaId,
            fieldName: 'deleted',
            oldValue: JSON.stringify(currentVia),
            newValue: null,
            userId,
            changeType: 'delete',
            sessionId: sessionId || nanoid(),
            batchId: batchId || nanoid()
          });
          
          results.push({ operation, success: true });
        }
      } catch (error) {
        console.error(`❌ BATCH OPERATION ${operation} ERROR:`, error);
        results.push({ operation, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('❌ BATCH VIA MANAGEMENT ERROR:', error);
    res.status(500).json({ error: 'Failed to process batch operations' });
  }
});

  return router;
}