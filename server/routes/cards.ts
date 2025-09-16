import express from 'express';
import { db } from '../db';
import { cardManagement } from '@shared/schema';
// MongoDB migration - temporarily disabled drizzle imports
import { requireAuth } from '../middleware/auth';
import { nanoid } from 'nanoid';

// Export a function that accepts WebSocket manager
export default function(wsManager?: any) {
  const router = express.Router();

// Generate random card ID
const generateCardId = () => {
  return 'CARD_' + nanoid(9).toUpperCase();
};

// Get all cards for user (hierarchical access)
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    let ownerId = user.id;
    
    // If not director, use their director's id as ownerId
    if (user.role !== 'director' && user.createdBy) {
      ownerId = user.createdBy;
    }
    
    const cards = await db.select()
      .from(cardManagement)
      .where(eq(cardManagement.userId, ownerId))
      .orderBy(cardManagement.createdAt);

    res.json(cards);
  } catch (error) {
    console.error('❌ Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Create new card (hierarchical ownership)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const cardData = req.body;
    
    // Determine ownership: Directors own their data, employees assign to their director
    let ownerId = user.id;
    if (user.role !== 'director' && user.createdBy) {
      ownerId = user.createdBy;
    }

    // Generate card ID if not provided
    if (!cardData.cardId) {
      cardData.cardId = generateCardId();
    }

    const [newCard] = await db.insert(cardManagement)
      .values({
        ...cardData,
        userId: ownerId,
        addAmount: cardData.addAmount || '0',
      })
      .returning();

    // Broadcast WebSocket event with user context
    if (wsManager) {
      wsManager.broadcast(ownerId, {
        type: 'CARD_CREATED',
        userId: user.id,
        data: newCard
      });
    }
    
    res.status(201).json(newCard);
  } catch (error) {
    console.error('❌ Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// Update card (PUT method for client compatibility)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const cardId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Determine ownership for access control
    let ownerId = user.id;
    if (user.role !== 'director' && user.createdBy) {
      ownerId = user.createdBy;
    }

    const [updatedCard] = await db.update(cardManagement)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(cardManagement.id, cardId),
        eq(cardManagement.userId, ownerId)
      ))
      .returning();

    if (!updatedCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Broadcast WebSocket event with user context
    if (wsManager) {
      wsManager.broadcast(ownerId, {
        type: 'CARD_UPDATED',
        userId: user.id,
        data: updatedCard
      });
    }
    
    res.json(updatedCard);
  } catch (error) {
    console.error('❌ Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Delete card (hierarchical access)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const cardId = parseInt(req.params.id);
    
    // Determine ownership for access control
    let ownerId = user.id;
    if (user.role !== 'director' && user.createdBy) {
      ownerId = user.createdBy;
    }

    const [deletedCard] = await db.delete(cardManagement)
      .where(and(
        eq(cardManagement.id, cardId),
        eq(cardManagement.userId, ownerId)
      ))
      .returning();

    if (!deletedCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Broadcast WebSocket event with user context
    if (wsManager) {
      wsManager.broadcast(ownerId, {
        type: 'CARD_DELETED',
        userId: user.id,
        data: { id: deletedCard.id, cardId: deletedCard.cardId }
      });
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

return router;
}