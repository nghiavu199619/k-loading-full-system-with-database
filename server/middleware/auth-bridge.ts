// Authentication Bridge - Unified auth system for both employee and auth_users
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authService, verifyToken } from '../auth';
import { storage } from '../storage';
import { JWT_SECRET } from '../config/jwt';

export interface UnifiedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  isAuthenticated: boolean;
  authType: 'employee' | 'auth_users';
}

// Unified authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ Missing token. Auth header:', authHeader, 'All headers:', Object.keys(req.headers));
      return res.status(401).json({ 
        success: false, 
        message: "Token xác thực không tồn tại" 
      });
    }

    console.log('🔍 Checking token:', token.substring(0, 20) + '...', 'for route:', req.path);

    // Try auth_users system first
    try {
      const validation = await authService.validateSession(token);
      
      if (validation.valid && validation.user) {
        console.log('✅ Auth users validation successful');
        req.user = {
          ...validation.user,
          isAuthenticated: true,
          authType: 'auth_users'
        } as any;
        req.session = validation.session;
        return next();
      }
    } catch (authError) {
      console.log('🔄 Auth users validation failed, trying employee auth...');
    }

    // Try employee authentication as fallback
    try {
      const decoded = verifyToken(token) as any;  // Use the same verifyToken function from auth.ts
      console.log('🔍 Employee token decoded:', { employeeId: decoded.employeeId, id: decoded.id });
      
      if (decoded.employeeId || decoded.id) {
        const employee = await storage.getEmployee(decoded.employeeId || decoded.id);
        
        if (employee && employee.isActive) {
          console.log('✅ Employee validation successful');
          req.user = {
            id: employee.id,
            username: employee.username,
            email: employee.email || '',
            fullName: employee.fullName,
            role: employee.role || 'director',
            status: employee.isActive ? 'active' : 'inactive',
            isAuthenticated: true,
            authType: 'employee'
          } as any;
          
          return next();
        }
      }
    } catch (employeeError) {
      console.log('❌ Employee auth validation failed:', employeeError instanceof Error ? employeeError.message : 'Unknown error');
    }

    console.log('❌ All authentication methods failed');
    return res.status(401).json({ 
      success: false, 
      message: "Token không hợp lệ hoặc đã hết hạn" 
    });
    
  } catch (error) {
    console.error('❌ Unified auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi xác thực hệ thống" 
    });
  }
};

// Helper function to generate compatible tokens
export const generateCompatibleToken = (userId: number, authType: 'employee' | 'auth_users') => {
  const payload = authType === 'employee' 
    ? { employeeId: userId, id: userId } 
    : { userId, id: userId };
    
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};