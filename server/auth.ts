import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "./db";
import { authUsers, authSessions } from "@shared/schema";
import { eq, and, or, lt } from "drizzle-orm";
import type { AuthUser, InsertAuthUser } from "@shared/schema";
import { ActivityLogger } from "./services/activity-logger";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'k-loading-financial-management-secret-key';
const JWT_EXPIRES_IN = '30d';

console.log('🔑 JWT Configuration loaded with secret:', JWT_SECRET.substring(0, 12) + '...');

// Default role permissions
export const DEFAULT_ROLE_PERMISSIONS = {
  director: ['USER_READ', 'USER_WRITE', 'USER_DELETE', 'ADMIN_READ', 'ADMIN_WRITE'],
  manager: ['USER_READ', 'USER_WRITE'],
  employee: ['USER_READ']
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
export const generateToken = (user: AuthUser): string => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authenticate employee (legacy function)
export const authenticateEmployee = async (username: string, password: string): Promise<AuthUser | null> => {
  try {
    const [user] = await db.select().from(authUsers)
      .where(or(
        eq(authUsers.username, username),
        eq(authUsers.email, username)
      ))
      .limit(1);

    if (!user || user.status !== 'active') {
      return null;
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error authenticating employee:', error);
    return null;
  }
};

// Auth Service
export const authService = {
  // Register new user
  async register(userData: InsertAuthUser, ipAddress: string = '127.0.0.1') {
    try {
      // Check if user already exists
      const existingUser = await db.select().from(authUsers)
        .where(or(
          eq(authUsers.username, userData.username),
          eq(authUsers.email, userData.email || '')
        ))
        .limit(1);

      if (existingUser.length > 0) {
        return {
          success: false,
          message: "Tên đăng nhập hoặc email đã tồn tại"
        };
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Create user
      const [newUser] = await db.insert(authUsers).values({
        ...userData,
        passwordHash,
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return {
        success: true,
        message: "Tạo tài khoản thành công",
        user: newUser
      };
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        message: "Lỗi hệ thống khi tạo tài khoản"
      };
    }
  },

  // Login user
  async login(loginData: { username: string; password: string }, ipAddress: string = '127.0.0.1', userAgent: string = '') {
    try {
      const { username, password } = loginData;

      // Find user
      const [user] = await db.select().from(authUsers)
        .where(or(
          eq(authUsers.username, username),
          eq(authUsers.email, username)
        ))
        .limit(1);

      if (!user || user.status !== 'active') {
        return {
          success: false,
          message: "Tên đăng nhập hoặc mật khẩu không đúng"
        };
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return {
          success: false,
          message: "Tên đăng nhập hoặc mật khẩu không đúng"
        };
      }

      // Generate token
      const token = generateToken(user);

      // Update last login
      await db.update(authUsers)
        .set({ 
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          updatedAt: new Date()
        })
        .where(eq(authUsers.id, user.id));

      // Create session
      const sessionToken = nanoid();
      await db.insert(authSessions).values({
        sessionToken: token,  // Store JWT token as sessionToken
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ipAddress,
        userAgent: userAgent || '',
      });

      return {
        success: true,
        message: "Đăng nhập thành công",
        user,
        token,
        sessionToken: token
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: "Lỗi hệ thống khi đăng nhập"
      };
    }
  },

  // Validate session
  async validateSession(token: string) {
    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        return { valid: false };
      }

      // Get user with fresh data
      const [user] = await db.select().from(authUsers)
        .where(eq(authUsers.id, decoded.id))
        .limit(1);

      if (!user || user.status !== 'active') {
        return { valid: false };
      }

      // Check session exists
      const [session] = await db.select().from(authSessions)
        .where(and(
          eq(authSessions.userId, user.id),
          eq(authSessions.sessionToken, token)
        ))
        .limit(1);

      return {
        valid: true,
        user,
        session: session || null
      };
    } catch (error) {
      return { valid: false };
    }
  },

  // Create employee by director
  async createEmployeeByDirector(employeeData: any, directorId: number) {
    try {
      // Hash password
      const passwordHash = await hashPassword(employeeData.password);

      // Create employee
      const [newEmployee] = await db.insert(authUsers).values({
        username: employeeData.username,
        email: employeeData.email,
        fullName: employeeData.fullName,
        passwordHash,
        role: 'employee',
        status: 'active',
        managerId: directorId,
        createdBy: directorId,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return {
        success: true,
        message: "Tạo nhân viên thành công",
        user: newEmployee
      };
    } catch (error) {
      console.error('Create employee error:', error);
      return {
        success: false,
        message: "Lỗi khi tạo nhân viên"
      };
    }
  },

  // Logout user
  async logout(token: string) {
    try {
      // Remove session
      await db.delete(authSessions)
        .where(eq(authSessions.token, token));

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false };
    }
  },

  // Get login attempts (placeholder)
  async getLoginAttempts(limit: number = 50) {
    return [];
  }
};