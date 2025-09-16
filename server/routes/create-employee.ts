import { Router, Request, Response } from 'express';
import { authService } from '../auth';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { authUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Director creates employee endpoint - Creates employee with proper role hierarchy
router.post('/create-by-director', requireAuth, async (req: Request, res: Response) => {
  try {
    const directorId = (req as any).user?.id;
    
    if (!directorId) {
      return res.status(401).json({
        success: false,
        message: "Không thể xác định giám đốc"
      });
    }

    // Verify the creator is actually a director
    const [director] = await db.select().from(authUsers)
      .where(eq(authUsers.id, directorId))
      .limit(1);

    if (!director || director.role !== 'director') {
      return res.status(403).json({
        success: false,
        message: "Chỉ giám đốc mới có thể tạo nhân viên"
      });
    }

    const { username, email, fullName, password, role } = req.body;
    
    if (!username || !password || !fullName) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin bắt buộc" 
      });
    }

    // Check if user already exists
    const existingUser = await db.select().from(authUsers)
      .where(eq(authUsers.username, username))
      .limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Tên đăng nhập đã tồn tại" 
      });
    }

    // Check email if provided
    if (email) {
      const existingEmail = await db.select().from(authUsers)
        .where(eq(authUsers.email, email))
        .limit(1);
      
      if (existingEmail.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Email đã được sử dụng" 
        });
      }
    }

    // Create employee with proper hierarchy
    const employeeData = {
      username,
      email: email || `${username}@company.com`,
      fullName,
      password,
      role: 'employee' // Force employee role when created by director
    };

    const result = await authService.createEmployeeByDirector(employeeData, directorId);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: result.message,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          fullName: result.user?.fullName,
          role: result.user?.role,
          status: result.user?.status,
          createdBy: result.user?.createdBy
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Create employee by director error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống"
    });
  }
});

export default router;