import { Router, Request, Response } from 'express';
import { authService } from '../auth';
import { rateLimitLogin, clearRateLimit, requireAuth, requireAdmin, optionalAuth, debugRequireAuth } from '../middleware/auth';
import * as authBridge from '../middleware/auth-bridge';
import { loginSchema, insertAuthUserSchema } from '@shared/schema';
import { ActivityLogger } from '../services/activity-logger';
import { z } from 'zod';

const router = Router();

// ============ PUBLIC ENDPOINTS ============

// Register endpoint
router.post('/register', rateLimitLogin, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = insertAuthUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: validationResult.error.errors
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const result = await authService.register(validationResult.data, ipAddress);

    if (result.success) {
      clearRateLimit(req, res, () => {});
      
      // REMOVED: Old ActivityLogger call - causing duplicates. Auto-logging now handles this.
      
      return res.status(201).json({
        success: true,
        message: result.message,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          fullName: result.user?.fullName,
          role: result.user?.role,
          status: result.user?.status
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Register endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống"
    });
  }
});

// Login endpoint
router.post('/login', rateLimitLogin, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không hợp lệ",
        errors: validationResult.error.errors
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    
    const result = await authService.login({
      username: validationResult.data.email,  // Use email as username
      password: validationResult.data.password
    }, ipAddress, userAgent);

    if (result.success) {
      clearRateLimit(req, res, () => {});
      
      // Log successful login
      if (result.user) {
        await ActivityLogger.logFieldChange({
          tableName: 'auth_users',
          recordId: result.user.id,
          actionType: 'login',
          fieldName: 'login',
          oldValue: null,
          newValue: 'Đăng nhập thành công',
          userId: result.user.id,
          userName: result.user.fullName || result.user.username,
          ipAddress,
          userAgent
        });
      }
      
      // Set JWT token in cookie (httpOnly for security)
      res.cookie('k_loading_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({
        success: true,
        message: result.message,
        token: result.token,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          fullName: result.user?.fullName,
          role: result.user?.role,
          status: result.user?.status,
          twoFactorEnabled: result.user?.twoFactorEnabled,
          lastLogin: result.user?.lastLogin
        }
      });
    } else if (result.requires2FA) {
      return res.status(200).json({
        success: false,
        requires2FA: true,
        userId: result.user?.id,
        message: result.message
      });
    } else {
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Login endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống"
    });
  }
});

// 2FA verification endpoint
router.post('/verify-2fa', async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin xác thực"
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.verify2FA(userId, token, ipAddress, userAgent);

    if (result.success) {
      // REMOVED: Old ActivityLogger call - causing duplicate 2FA logs
      
      // Set JWT token in cookie
      res.cookie('k_loading_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: result.message,
        token: result.token,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          fullName: result.user?.fullName,
          role: result.user?.role,
          status: result.user?.status,
          lastLogin: result.user?.lastLogin
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ 2FA verification endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống"
    });
  }
});

// Logout endpoint
router.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    const sessionToken = req.session?.sessionToken;
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    if (sessionToken) {
      await authService.logout(sessionToken);
    }

    // Log successful logout
    if (userId && req.user) {
      await ActivityLogger.logFieldChange({
        tableName: 'auth_users',
        recordId: userId,
        actionType: 'logout',
        fieldName: 'logout',
        oldValue: null,
        newValue: 'Đăng xuất thành công',
        userId: userId,
        userName: req.user.fullName || req.user.username,
        ipAddress,
        userAgent
      });
    }

    // Clear cookie
    res.clearCookie('k_loading_token');

    return res.json({
      success: true,
      message: "Đăng xuất thành công"
    });

  } catch (error) {
    console.error('❌ Logout endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đăng xuất"
    });
  }
});

// ============ PROTECTED ENDPOINTS ============

// Get current user profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa đăng nhập"
      });
    }
    
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        status: req.user.status,
        twoFactorEnabled: req.user.twoFactorEnabled,
        emailVerified: req.user.emailVerified,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Get user profile error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin người dùng"
    });
  }
});

// Change password
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin mật khẩu"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 8 ký tự"
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa đăng nhập"
      });
    }
    
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    return res.json(result);

  } catch (error) {
    console.error('❌ Change password error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đổi mật khẩu"
    });
  }
});

// Setup 2FA
router.post('/setup-2fa', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa đăng nhập"
      });
    }
    
    const result = await authService.setup2FA(req.user.id);

    return res.json(result);

  } catch (error) {
    console.error('❌ Setup 2FA error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi thiết lập 2FA"
    });
  }
});

// Enable 2FA
router.post('/enable-2fa', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã xác thực"
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa đăng nhập"
      });
    }
    
    const result = await authService.enable2FA(req.user.id, token);

    return res.json(result);

  } catch (error) {
    console.error('❌ Enable 2FA error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi kích hoạt 2FA"
    });
  }
});

// Disable 2FA
router.post('/disable-2fa', requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mật khẩu xác nhận"
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa đăng nhập"
      });
    }
    
    const result = await authService.disable2FA(req.user.id, password);

    return res.json(result);

  } catch (error) {
    console.error('❌ Disable 2FA error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tắt 2FA"
    });
  }
});

// ============ ADMIN ENDPOINTS ============

// Get all users (admin only)
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await authService.getAllUsers();

    // Remove sensitive data
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLogin: user.lastLogin,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return res.json({
      success: true,
      users: safeUsers
    });

  } catch (error) {
    console.error('❌ Get users error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách người dùng"
    });
  }
});

// Update user status (admin only)
router.put('/users/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ"
      });
    }

    const result = await authService.updateUserStatus(userId, status);

    return res.json(result);

  } catch (error) {
    console.error('❌ Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái người dùng"
    });
  }
});

// Get login attempts (admin only)
router.get('/login-attempts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const attempts = await authService.getLoginAttempts(limit);

    return res.json({
      success: true,
      attempts
    });

  } catch (error) {
    console.error('❌ Get login attempts error:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử đăng nhập"
    });
  }
});



export default router;