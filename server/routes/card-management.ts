import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertCardManagementSchema } from '@shared/schema';
import { requireAuth } from '../middleware/auth';
import { requireTabPermission } from '../middleware/permissions';
import { nanoid } from 'nanoid';

const router = Router();

// WebSocket manager import - same as via management
let wsManager: any = null;
try {
  const wsModule = require('../websocket');
  wsManager = wsModule.wsManager;
} catch (error) {
  console.log('⚠️ WebSocket manager not available in card management routes');
}

// GET all cards for current user
router.get('/', requireAuth, requireTabPermission('card-management', 'view'), async (req, res) => {
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
      console.log(`👷 Employee ${originalUserId} (${user.role}) viewing cards for Director ${userId}`);
    } else {
      console.log(`👑 Director ${userId} using own ID for data operations`);
    }

    console.log(`📋 CARD MANAGEMENT: Retrieved cards for user ${userId} (original: ${originalUserId})`);
    const cards = await storage.getCardManagement(userId);
    res.json(cards);
  } catch (error) {
    console.error('❌ GET CARD MANAGEMENT ERROR:', error);
    res.status(500).json({ error: 'Failed to retrieve card management data' });
  }
});

// POST - Create new card
router.post('/', requireAuth, requireTabPermission('card-management', 'edit'), async (req, res) => {
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
      console.log(`👷 Employee ${originalUserId} (${user.role}) creating card for Director ${userId}`);
    } else {
      console.log(`✅ CARD MANAGEMENT: Creating card for user ${userId} (original: ${originalUserId})`);
    }

    const validatedData = insertCardManagementSchema.parse({
      ...req.body,
      userId
    });

    const newCard = await storage.createCardManagement(validatedData);
    
    // Log the creation
    await storage.createCardManagementChange({
      cardId: newCard.id,
      fieldName: 'created',
      oldValue: null,
      newValue: JSON.stringify(newCard),
      userId: originalUserId, // Use original user ID for change tracking
      changeType: 'create',
      sessionId: req.body.sessionId || nanoid(),
      batchId: req.body.batchId || nanoid()
    });

    // WebSocket broadcast for realtime updates
    if (wsManager) {
      const broadcastData = {
        type: 'CARD_CREATED',
        data: newCard,
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING CARD CREATION:', newCard.id);
      wsManager.broadcast(broadcastData);
    }

    res.status(201).json(newCard);
  } catch (error) {
    console.error('❌ CREATE CARD MANAGEMENT ERROR:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT - Update existing card
router.put('/:id', requireAuth, requireTabPermission('card-management', 'edit'), async (req, res) => {
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
      console.log(`👷 Employee ${originalUserId} (${user.role}) updating card for Director ${userId}`);
    }

    const cardId = parseInt(req.params.id);
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    // Get current card for change tracking
    const currentCards = await storage.getCardManagement(userId);
    const currentCard = currentCards.find(c => c.id === cardId);
    
    if (!currentCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const validatedData = insertCardManagementSchema.partial().parse(req.body);
    const updatedCard = await storage.updateCardManagement(cardId, validatedData);

    // Track field changes
    for (const [field, newValue] of Object.entries(validatedData)) {
      const oldValue = (currentCard as any)[field];
      if (oldValue !== newValue) {
        await storage.createCardManagementChange({
          cardId: cardId,
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
        type: 'CARD_UPDATED',
        data: updatedCard,
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING CARD UPDATE:', cardId);
      wsManager.broadcast(broadcastData);
    }

    res.json(updatedCard);
  } catch (error) {
    console.error('❌ UPDATE CARD MANAGEMENT ERROR:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE - Delete card
router.delete('/:id', requireAuth, requireTabPermission('card-management', 'edit'), async (req, res) => {
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
      console.log(`👷 Employee ${originalUserId} (${user.role}) deleting card for Director ${userId}`);
    }

    const cardId = parseInt(req.params.id);
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    // Get current card for change tracking
    const currentCards = await storage.getCardManagement(userId);
    const currentCard = currentCards.find(c => c.id === cardId);
    
    if (!currentCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await storage.deleteCardManagement(cardId);

    // Log the deletion
    await storage.createCardManagementChange({
      cardId: cardId,
      fieldName: 'deleted',
      oldValue: JSON.stringify(currentCard),
      newValue: null,
      userId,
      changeType: 'delete',
      sessionId: req.body?.sessionId || nanoid(),
      batchId: req.body?.batchId || nanoid()
    });

    // WebSocket broadcast for realtime updates
    if (wsManager) {
      const broadcastData = {
        type: 'CARD_DELETED',
        data: { id: cardId, deletedCard: currentCard },
        userId: originalUserId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING CARD DELETION:', cardId);
      wsManager.broadcast(broadcastData);
    }

    res.status(204).send();
  } catch (error) {
    console.error('❌ DELETE CARD MANAGEMENT ERROR:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// GET changes for real-time sync
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

    const changes = await storage.getCardManagementChanges(
      since as string, 
      sessionId as string, 
      userId
    );
    
    res.json(changes);
  } catch (error) {
    console.error('❌ GET CARD MANAGEMENT CHANGES ERROR:', error);
    res.status(500).json({ error: 'Failed to retrieve changes' });
  }
});

// POST batch operations for bulk saves
router.post('/batch', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { changes, sessionId, batchId } = req.body;
    
    console.log('📋 CARD MANAGEMENT BATCH SAVE:', {
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
          const validatedData = insertCardManagementSchema.parse({
            ...data,
            userId
          });
          const newCard = await storage.createCardManagement(validatedData);
          
          await storage.createCardManagementChange({
            cardId: newCard.id,
            fieldName: 'created',
            oldValue: null,
            newValue: JSON.stringify(newCard),
            userId,
            changeType: 'create',
            sessionId: sessionId || nanoid(),
            batchId: batchId || nanoid()
          });
          
          results.push({ operation, success: true, data: newCard });
          
        } else if (operation === 'update') {
          const cardId = parseInt(id);
          if (isNaN(cardId)) {
            results.push({ operation, success: false, error: 'Invalid card ID' });
            continue;
          }
          
          const currentCards = await storage.getCardManagement(userId);
          const currentCard = currentCards.find(c => c.id === cardId);
          
          if (!currentCard) {
            results.push({ operation, success: false, error: 'Card not found' });
            continue;
          }
          
          const validatedData = insertCardManagementSchema.partial().parse(data);
          const updatedCard = await storage.updateCardManagement(cardId, validatedData);
          
          // Track field changes
          for (const [field, newValue] of Object.entries(validatedData)) {
            const oldValue = (currentCard as any)[field];
            if (oldValue !== newValue) {
              await storage.createCardManagementChange({
                cardId: cardId,
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
          
          results.push({ operation, success: true, data: updatedCard });
          
        } else if (operation === 'delete') {
          const cardId = parseInt(id);
          if (isNaN(cardId)) {
            results.push({ operation, success: false, error: 'Invalid card ID' });
            continue;
          }
          
          const currentCards = await storage.getCardManagement(userId);
          const currentCard = currentCards.find(c => c.id === cardId);
          
          if (!currentCard) {
            results.push({ operation, success: false, error: 'Card not found' });
            continue;
          }
          
          await storage.deleteCardManagement(cardId);
          
          await storage.createCardManagementChange({
            cardId: cardId,
            fieldName: 'deleted',
            oldValue: JSON.stringify(currentCard),
            newValue: null,
            userId,
            changeType: 'delete',
            sessionId: sessionId || nanoid(),
            batchId: batchId || nanoid()
          });
          
          results.push({ operation, success: true, data: { id: cardId } });
        } else {
          results.push({ operation, success: false, error: 'Unknown operation' });
        }
      } catch (error) {
        console.error('❌ BATCH OPERATION ERROR:', error);
        results.push({ operation, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // WebSocket broadcast for batch changes
    if (wsManager && results.some(r => r.success)) {
      const broadcastData = {
        type: 'CARD_BATCH_UPDATE',
        data: results.filter(r => r.success),
        userId,
        timestamp: new Date().toISOString()
      };
      console.log('📡 BROADCASTING CARD BATCH UPDATE:', results.length);
      wsManager.broadcast(broadcastData);
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ CARD MANAGEMENT BATCH ERROR:', error);
    res.status(500).json({ error: 'Failed to process batch changes' });
  }
});

export default router;