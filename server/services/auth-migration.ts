import { db } from '../db';
import { authUsers, logsKloading } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Migration service to update the system to use auth_users
 * This includes migrating logs and adding default admin user
 */
export class AuthMigrationService {
  
  async createDefaultAdminUser(): Promise<void> {
    try {
      // Check if admin user already exists
      const existingAdmin = await db.select().from(authUsers)
        .where(eq(authUsers.role, 'admin'))
        .limit(1);
      
      if (existingAdmin.length > 0) {
        console.log('✓ Admin user already exists');
        return;
      }

      // Create default admin user
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('admin123456', 12);
      
      const [newAdmin] = await db.insert(authUsers).values({
        username: 'admin',
        email: 'admin@kloading.com', // Match existing email format
        passwordHash,
        fullName: 'Administrator',
        role: 'admin',
        status: 'active',
        emailVerified: true
      }).returning();

      console.log('✅ Created default admin user:', newAdmin.email);
      console.log('📧 Login: admin@k-loading.com');
      console.log('🔑 Password: admin123456');
      
    } catch (error) {
      console.error('❌ Error creating default admin user:', error);
    }
  }

  async updateLogsWithAuthUsers(): Promise<void> {
    try {
      // Update existing logs to link with auth_users where possible
      // This is a best-effort migration based on userSession patterns
      
      const logs = await db.select().from(logsKloading)
        .where(sql`${logsKloading.userId} IS NULL`);
      
      let updated = 0;
      
      for (const log of logs) {
        // Try to extract user ID from session token
        if (log.userSession && log.userSession.startsWith('auth_')) {
          const userId = parseInt(log.userSession.replace('auth_', ''));
          if (!isNaN(userId)) {
            // Check if user exists
            const [user] = await db.select().from(authUsers)
              .where(eq(authUsers.id, userId))
              .limit(1);
            
            if (user) {
              await db.update(logsKloading)
                .set({ 
                  userId: user.id,
                  userName: user.fullName || user.username 
                })
                .where(eq(logsKloading.id, log.id));
              updated++;
            }
          }
        }
      }
      
      console.log(`✅ Updated ${updated} logs with auth_users references`);
      
    } catch (error) {
      console.error('❌ Error updating logs with auth users:', error);
    }
  }

  async runMigration(): Promise<void> {
    console.log('🚀 Starting auth_users migration...');
    
    await this.createDefaultAdminUser();
    await this.updateLogsWithAuthUsers();
    
    console.log('✅ Auth migration completed');
  }
}

export const authMigrationService = new AuthMigrationService();