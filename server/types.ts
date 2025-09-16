import type { Request } from "express";
import type { AuthUser, AuthSession } from '@shared/schema';

// Extend Express Request type for authentication
declare global {
  namespace Express {
    interface Request {
      // Legacy employee system (for backward compatibility)
      employeeId?: number;
      employee?: {
        id: number;
        username: string;
        fullName: string;
        role: string;
        isActive: boolean;
      };
      
      // New auth_users system
      user?: AuthUser;
      session?: AuthSession;
    }
  }
}