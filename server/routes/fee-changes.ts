import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Fee change schema for validation
const feeChangeSchema = z.object({
  clientId: z.number(),
  newPercentage: z.string(),
  changeType: z.enum(['immediate', 'scheduled', 'from_month']),
  fromMonth: z.union([z.string(), z.number()]).optional(),
  fromYear: z.union([z.string(), z.number()]).optional(),
  toMonth: z.union([z.string(), z.number()]).optional(),
  toYear: z.union([z.string(), z.number()]).optional(),
});

// Create fee change
router.post('/', requireAuth, async (req, res) => {
  try {
    const validatedData = feeChangeSchema.parse(req.body);
    const user = req.user!;

    // Use hierarchical logic: employees create fee changes for director
    let effectiveUserId = user.id;
    if (user.role === 'employee' && user.createdBy) {
      effectiveUserId = user.createdBy;
      console.log(`👷 Employee ${user.id} creating fee change for Director ${effectiveUserId}`);
    }

    // Get current percentage for old value
    const clientAccounts = await storage.getClientAccountsByClient(validatedData.clientId);
    const currentPercentage = clientAccounts.length > 0 ? clientAccounts[0].rentalPercentage : "0";

    const feeChangeData = {
      clientId: validatedData.clientId,
      oldPercentage: currentPercentage,
      newPercentage: validatedData.newPercentage,
      changeType: validatedData.changeType,
      effectiveFromMonth: validatedData.fromMonth ? parseInt(validatedData.fromMonth.toString()) : null,
      effectiveFromYear: validatedData.fromYear ? parseInt(validatedData.fromYear.toString()) : null,
      effectiveToMonth: validatedData.toMonth ? parseInt(validatedData.toMonth.toString()) : null,
      effectiveToYear: validatedData.toYear ? parseInt(validatedData.toYear.toString()) : null,
      status: validatedData.changeType === 'immediate' ? 'active' : 'pending',
      userId: effectiveUserId,
    };

    // Create fee change record
    const feeChange = await storage.createFeeChange(feeChangeData);

    // If immediate change, update client accounts
    if (validatedData.changeType === 'immediate') {
      await storage.updateClientAccountsPercentage(validatedData.clientId, validatedData.newPercentage);
    }

    res.json(feeChange);
  } catch (error) {
    console.error('❌ Error creating fee change:', error);
    res.status(500).json({ error: 'Không thể tạo lịch sửa phí' });
  }
});

// Get fee history for a client
router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const userId = req.user!.id;
    
    // Get fee history for the client
    const feeHistory = await storage.getFeeChangesByClient(clientId, userId);
    
    res.json(feeHistory);
  } catch (error) {
    console.error('❌ Error fetching fee history:', error);
    res.status(500).json({ error: 'Không thể lấy lịch sử thay đổi phí' });
  }
});

// Delete fee change (only pending ones)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const feeChangeId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if fee change exists and is pending
    const feeChange = await storage.getFeeChangeById(feeChangeId);
    if (!feeChange) {
      return res.status(404).json({ error: 'Không tìm thấy lịch sửa phí' });
    }
    
    if (feeChange.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể hủy lịch chờ xử lý' });
    }
    
    // Delete the fee change
    await storage.deleteFeeChange(feeChangeId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting fee change:', error);
    res.status(500).json({ error: 'Không thể hủy lịch sửa phí' });
  }
});

// Get fee changes for a client
router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const feeChanges = await storage.getFeeChangesByClient(clientId);
    res.json(feeChanges);
  } catch (error) {
    console.error('❌ Error fetching fee changes:', error);
    res.status(500).json({ error: 'Không thể lấy lịch sử sửa phí' });
  }
});

export default router;