import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth';
import { requireAuth as unifiedRequireAuth } from './auth-bridge';

// Remove local declaration - already defined in server/types.ts

// Main authentication middleware - uses unified auth bridge  
export const requireAuth = unifiedRequireAuth;

// Debug wrapper to ensure middleware is called
export const debugRequireAuth = async (req: Request, res: Response, next: NextFunction) => {
  console.log('🔧 DEBUG: requireAuth middleware called for:', req.path);
  const authHeader = req.headers.authorization;
  console.log('🔧 DEBUG: Authorization header present:', !!authHeader);
  if (authHeader) {
    console.log('🔧 DEBUG: Token preview:', authHeader.substring(0, 20) + '...');
  }
  return unifiedRequireAuth(req, res, next);
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Chưa đăng nhập" 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Không có quyền truy cập" 
      });
    }

    next();
  };
};

// Director only middleware
export const requireDirector = requireRole(['director']);

// Manager or Director middleware
export const requireManager = requireRole(['director', 'manager']);

// Any authenticated user middleware
export const requireEmployee = requireRole(['director', 'manager', 'employee']);

// Legacy admin alias for compatibility
export const requireAdmin = requireDirector;

// Optional auth middleware - adds user info if token exists but doesn't require it
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const validation = await authService.validateSession(token);
      if (validation.valid) {
        req.user = validation.user;
        req.session = validation.session;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Rate limiting middleware for login endpoints
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const rateLimitLogin = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;

  // Clean old entries
  Array.from(loginAttempts.entries()).forEach(([key, data]) => {
    if (now - data.lastAttempt > windowMs) {
      loginAttempts.delete(key);
    }
  });

  const attempts = loginAttempts.get(ip);
  
  if (attempts && attempts.count >= maxAttempts) {
    const timeLeft = Math.ceil((windowMs - (now - attempts.lastAttempt)) / 1000 / 60);
    return res.status(429).json({
      success: false,
      message: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${timeLeft} phút.`
    });
  }

  // Record this attempt
  loginAttempts.set(ip, {
    count: (attempts?.count || 0) + 1,
    lastAttempt: now
  });

  next();
};

// Clear rate limit on successful login
export const clearRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  loginAttempts.delete(ip);
  next();
};