import { 
  users, companies, budgetCategories, budgets, transactions, clients, reconciliations, reconciliationItems,
  adAccounts, clientAccounts, accountChanges, systemSettings, statsBadges, feeChanges,
  testClients, testAccounts, testClientChanges, testAccountChanges,
  userSessions, typingIndicators, cursorPositions, logsKloading, authUsers, authSessions, employeeManagementLogs,
  userSettings, userStatsBadges, processedEvents, accountExpenses, accountExpenseChanges, expenseVisibleAccounts,
  viaManagement, viaManagementChanges, cardManagement, cardManagementChanges,
  // Time tracking tables
  attendance, payroll, leaveRequests, performanceMetrics, salaryBonuses, shiftSchedules, monthlyRevenues,
  type User, type InsertUser, type Company, type InsertCompany, type BudgetCategory, type InsertBudgetCategory,
  type Budget, type InsertBudget, type Transaction, type InsertTransaction, type Client, type InsertClient,
  type Reconciliation, type InsertReconciliation, type ReconciliationItem, type InsertReconciliationItem,
  type AdAccount, type InsertAdAccount, 
  type ClientAccount, type InsertClientAccount, type AccountChange, type InsertAccountChange,
  type AccountExpense, type InsertAccountExpense, type FeeChange, type InsertFeeChange,
  type SystemSetting, type InsertSystemSetting, type StatsBadge, type InsertStatsBadge,
  type TestClient, type InsertTestClient, type TestAccount, type InsertTestAccount,
  type AuthUser, type InsertAuthUser, type ExpenseVisibleAccount, type InsertExpenseVisibleAccount,
  type ViaManagement, type InsertViaManagement, type ViaManagementChange, type InsertViaManagementChange,
  type CardManagement, type InsertCardManagement, type CardManagementChange, type InsertCardManagementChange,
  // Time tracking types
  type Attendance, type InsertAttendance, type Payroll, type InsertPayroll, 
  type LeaveRequest, type InsertLeaveRequest, type PerformanceMetric, type InsertPerformanceMetric,
  type SalaryBonus, type InsertSalaryBonus, type ShiftSchedule, type InsertShiftSchedule,
  type MonthlyRevenue, type InsertMonthlyRevenue
} from "@shared/schema";
import { employeePermissions } from "@shared/schema";

import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and, desc, sql, asc, ne, inArray, or, gte, lte } from "drizzle-orm";
import { queryCache } from "./cache/query-cache";

export interface IStorage {
  // Users - Legacy system
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Auth Users - New role-based system
  getAllUsers(): Promise<AuthUser[]>;
  getUserById(id: number): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<AuthUser | undefined>;
  createUser(user: any): Promise<AuthUser>;
  updateUser(id: number, updates: any): Promise<AuthUser>;
  deleteUser(id: number): Promise<void>;
  updateUserPermissions(userId: number, permissions: string[]): Promise<void>;
  getUserSubordinates(managerId: number): Promise<AuthUser[]>;
  getOrganizationChart(): Promise<any>;
  getUserStatistics(): Promise<any>;

  // Hierarchical employee management methods
  getEmployeesByDirector(directorId: number): Promise<AuthUser[]>;
  createAuthUser(userData: any): Promise<AuthUser>;
  updateAuthUser(id: number, updates: any): Promise<AuthUser>;
  deleteAuthUser(id: number): Promise<void>;
  
  // Employee Management Logging
  createEmployeeManagementLog(log: any): Promise<void>;
  getEmployeeManagementLogs(directorId: number): Promise<any[]>;
  
  // Employee operations now use auth_users system (see createAuthUser, updateAuthUser, etc.)

  // Companies
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;

  // Budget system removed - now focused on account expenses

  // Transaction system replaced with account expenses tracking

  // Clients - with user filtering
  getClients(userId?: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>, userId?: number): Promise<Client>;

  // Reconciliations
  getReconciliations(): Promise<(Reconciliation & { client: Client })[]>;
  getReconciliationByToken(token: string): Promise<(Reconciliation & { client: Client; items: (ReconciliationItem & { transaction: Transaction })[] }) | undefined>;
  createReconciliation(reconciliation: InsertReconciliation): Promise<Reconciliation>;
  updateReconciliationStatus(id: number, status: string, approvedBy?: number): Promise<Reconciliation>;

  // Dashboard Statistics
  getDashboardStats(month: number, year: number): Promise<{
    totalRevenue: string;
    totalExpenses: string;
    netProfit: string;
    pendingReconciliations: number;
  }>;

  // Ad Accounts - with user filtering
  getAdAccounts(userId?: number): Promise<AdAccount[]>;
  getAdAccountById(id: number, userId?: number): Promise<AdAccount | undefined>;
  getAdAccountsByIds(ids: number[], userId?: number): Promise<AdAccount[]>;
  createAdAccount(account: InsertAdAccount): Promise<AdAccount>;
  updateAdAccount(id: number, account: Partial<InsertAdAccount>, userId?: number): Promise<AdAccount>;
  deleteAdAccount(id: number, userId?: number): Promise<void>;

  // Account Expenses - with user filtering for expense management tab
  getAccountExpenses(userId: number, month: number, year: number): Promise<AccountExpense[]>;
  saveAccountExpense(expense: InsertAccountExpense & { userId: number }): Promise<AccountExpense>;
  deleteAccountExpense(userId: number, accountId: number, clientId: number, month: number, year: number): Promise<boolean>;
  getAccountExpenseChanges(since: string, sessionId: string): Promise<any[]>;

  // Client Accounts - with user filtering
  getClientAccounts(userId?: number): Promise<(ClientAccount & { client: Client; account: AdAccount })[]>;
  getClientsWithAccounts(userId?: number): Promise<(Client & { accountAssignments: (ClientAccount & { account: AdAccount })[] })[]>;
  createClientAccount(assignment: InsertClientAccount): Promise<ClientAccount>;
  getClientAccountsByClient(clientId: number): Promise<ClientAccount[]>;
  updateClientAccountsPercentage(clientId: number, newPercentage: string): Promise<void>;

  // Fee Changes
  createFeeChange(feeChange: any): Promise<any>;
  getFeeChangesByClient(clientId: number): Promise<any[]>;

  // Track account changes for autosave
  createAccountChange(change: InsertAccountChange): Promise<AccountChange>;
  getAccountChangesSince(timestamp: string, excludeSessionId?: string): Promise<AccountChange[]>;
  deleteAccountExpensesByAccountAndClient(accountId: number, clientId: number, month: number, year: number): Promise<void>;

  // System Settings
  getSystemSettings(): Promise<any>;
  updateSystemSettings(settings: any): Promise<any>;
  resetSystemSettings(): Promise<any>;
  exportSettings(): Promise<any>;
  getStatsBadgesConfig(): Promise<any>;
  updateStatsBadgesConfig(badges: any): Promise<any>;

  // Test Tables for Universal Sync Demo - with user filtering
  getTestClients(userId?: number): Promise<TestClient[]>;
  createTestClient(client: InsertTestClient): Promise<TestClient>;
  updateTestClient(id: number, client: Partial<InsertTestClient>): Promise<TestClient>;
  deleteTestClient(id: number): Promise<void>;
  getTestClientChanges(since?: Date, sessionId?: string): Promise<any[]>;
  saveTestClientChange(change: any): Promise<void>;

  getTestAccounts(userId?: number): Promise<TestAccount[]>;
  createTestAccount(account: InsertTestAccount): Promise<TestAccount>;
  updateTestAccount(id: number, account: Partial<InsertTestAccount>): Promise<TestAccount>;
  deleteTestAccount(id: number): Promise<void>;
  getTestAccountChanges(since?: Date, sessionId?: string): Promise<any[]>;
  saveTestAccountChange(change: any): Promise<void>;

  // Advanced Collaboration Features
  upsertUserSession(session: any): Promise<any>;
  deactivateUserSession(sessionId: string): Promise<void>;
  getActiveSessions(): Promise<any[]>;
  
  setTypingIndicator(indicator: any): Promise<any>;
  removeTypingIndicator(sessionId: string, tableId: string, recordId: number, fieldName: string): Promise<void>;
  getTypingIndicators(tableId: string): Promise<any[]>;
  
  updateCursorPosition(position: any): Promise<any>;
  getCursorPositions(tableId: string): Promise<any[]>;
  
  resolveAccountConflict(recordId: number, field: string, value: any, sessionId: string, resolution: string): Promise<any>;

  // System Logging for audit trail and change tracking
  createSystemLog(logData: any): Promise<any>;
  getSystemLogs(limit?: number): Promise<any[]>;
  getSystemLogsByUser(userId: number, limit?: number): Promise<any[]>;
  getSystemLogsByTable(tableName: string, limit?: number): Promise<any[]>;
  getSystemLogsByUserList(userIds: number[], limit?: number): Promise<any[]>;
  
  // Activity logs methods
  getActivityLogsByUser(userId: number, limit?: number): Promise<any[]>;
  getActivityLogsByUserList(userIds: number[], limit?: number): Promise<any[]>;
  
  // Login attempts methods
  getLoginAttemptsByUser(userId: number, limit?: number): Promise<any[]>;
  getLoginAttemptsByUserList(userIds: number[], limit?: number): Promise<any[]>;
  
  // Employee hierarchy methods
  getEmployeeIdsByDirector(directorId: number): Promise<number[]>;

  // User-specific settings
  getUserSettings(userId: number): Promise<any>;
  updateUserSettings(userId: number, settings: any): Promise<any>;
  getUserStatsBadges(userId: number): Promise<any>;
  createUserStatsBadge(userId: number, badge: any): Promise<any>;
  updateUserStatsBadge(id: number, badge: any): Promise<any>;
  deleteUserStatsBadge(id: number): Promise<void>;
  
  // Account changes tracking
  createAccountChange(change: any): Promise<any>;
  getAccountChanges(since: string, sessionId: string, userId: number): Promise<any[]>;
  
  // Fee changes methods
  getFeeChangesByClient(clientId: number, userId: number): Promise<any[]>;
  getFeeChangeById(id: number): Promise<any | undefined>;
  deleteFeeChange(id: number): Promise<void>;
  
  // Expense Visible Accounts - Monthly Settings
  getExpenseVisibleAccounts(userId: number, month: number, year: number): Promise<ExpenseVisibleAccount[]>;
  saveExpenseVisibleAccounts(userId: number, accountIds: number[], month: number, year: number): Promise<ExpenseVisibleAccount[]>;
  clearExpenseVisibleAccounts(userId: number, month: number, year: number): Promise<void>;
  // Smart Account Management
  addAllAccountsWithExpenses(userId: number, month: number, year: number): Promise<ExpenseVisibleAccount[]>;
  removeInactiveAccounts(userId: number, monthsThreshold: number): Promise<{ removed: number }>;

  // Via Management
  getViaManagement(userId: number): Promise<ViaManagement[]>;
  createViaManagement(via: InsertViaManagement): Promise<ViaManagement>;
  updateViaManagement(id: number, via: Partial<InsertViaManagement>): Promise<ViaManagement>;
  deleteViaManagement(id: number): Promise<void>;
  
  // Via Management changes tracking
  createViaManagementChange(change: InsertViaManagementChange): Promise<ViaManagementChange>;
  getViaManagementChanges(since: string, sessionId: string, userId: number): Promise<ViaManagementChange[]>;

  // Card Management
  getCardManagement(userId: number): Promise<CardManagement[]>;
  createCardManagement(card: InsertCardManagement): Promise<CardManagement>;
  updateCardManagement(id: number, card: Partial<InsertCardManagement>): Promise<CardManagement>;
  deleteCardManagement(id: number): Promise<void>;
  
  // Card Management changes tracking
  createCardManagementChange(change: InsertCardManagementChange): Promise<CardManagementChange>;
  getCardManagementChanges(since: string, sessionId: string, userId: number): Promise<CardManagementChange[]>;

  // ========================================================================
  // TIME TRACKING & PAYROLL INTERFACE METHODS
  // ========================================================================

  // Attendance Management
  getAttendanceRecords(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<Attendance[]>;
  clockInOut(employeeId: number, userId: number, data: { type: 'in' | 'out'; location?: string; notes?: string; ipAddress?: string; deviceInfo?: string }): Promise<Attendance>;
  updateAttendanceRecord(id: number, userId: number, updates: Partial<InsertAttendance>): Promise<Attendance>;

  // Payroll Management
  getPayrollRecords(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<Payroll[]>;
  calculatePayroll(userId: number, data: { month: number; year: number; employeeIds?: number[] }): Promise<Payroll[]>;
  approvePayroll(id: number, approverId: number, notes?: string): Promise<Payroll>;

  // Leave Requests Management
  getLeaveRequests(userId: number, filters?: { status?: string; employeeId?: number }): Promise<LeaveRequest[]>;
  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  approveLeaveRequest(id: number, approverId: number, status: string, notes?: string): Promise<LeaveRequest>;

  // Performance Metrics
  getPerformanceMetrics(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<PerformanceMetric[]>;
  updatePerformanceMetric(id: number, userId: number, updates: Partial<InsertPerformanceMetric>): Promise<PerformanceMetric>;

  // Salary Bonuses
  getSalaryBonuses(userId: number, filters?: { month?: number; year?: number; bonusType?: string; employeeId?: number }): Promise<SalaryBonus[]>;
  calculateBonuses(userId: number, data: { month: number; year: number; bonusType?: string }): Promise<SalaryBonus[]>;

  // Shift Schedules
  getShiftSchedules(userId: number, filters?: { startDate?: string; endDate?: string; employeeId?: number }): Promise<ShiftSchedule[]>;
  createShiftSchedule(schedule: InsertShiftSchedule): Promise<ShiftSchedule>;

  // Monthly Revenues
  getMonthlyRevenues(userId: number, filters?: { year?: number }): Promise<MonthlyRevenue[]>;
  updateMonthlyRevenue(id: number, userId: number, updates: Partial<InsertMonthlyRevenue>): Promise<MonthlyRevenue>;

  // Dashboard & Statistics
  getTimeTrackingDashboard(userId: number, filters: { month: number; year: number }): Promise<any>;

}

export class DatabaseStorage implements IStorage {
  // Helper method to get effective user ID for data operations (employee uses director's ID)
  private async getEffectiveUserId(userId?: number): Promise<number | undefined> {
    if (!userId) return undefined;
    
    const user = await this.getUserById(userId);
    if (user?.role === 'employee' && user.createdBy) {
      console.log(`🔄 Employee ${userId} using Director ${user.createdBy} for data operations`);
      return user.createdBy;
    }
    
    console.log(`👑 Director ${userId} using own ID for data operations`);
    return userId;
  }
  async getUser(id: number): Promise<User | undefined> {
    // Legacy method - use getUserById instead for auth users
    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return user as any || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Legacy method - use getUserByUsernameAuth instead for auth users
    const [user] = await db.select().from(authUsers).where(eq(authUsers.username, username));
    return user as any || undefined;
  }

  async getUserByUsernameAuth(username: string): Promise<AuthUser | undefined> {
    const [user] = await db.select()
      .from(authUsers)
      .where(eq(authUsers.username, username))
      .limit(1);
    return user;
  }

  // Legacy user creation removed - use createAuthUser instead

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company> {
    const [updatedCompany] = await db.update(companies).set(company).where(eq(companies.id, id)).returning();
    return updatedCompany;
  }

  // Transaction system removed - replaced with account expenses tracking

  async getClients(userId?: number): Promise<Client[]> {
    const baseQuery = db.select().from(clients);
    
    if (userId) {
      // For hierarchical access: employee can access director's data
      const user = await this.getUserById(userId);
      if (user?.role === 'employee' && user.createdBy) {
        // Employee sees clients from their director (owner)
        return await baseQuery
          .where(eq(clients.userId, user.createdBy))
          .orderBy(clients.name);
      } else {
        // Director sees their own clients
        return await baseQuery
          .where(eq(clients.userId, userId))
          .orderBy(clients.name);
      }
    }
    
    return await baseQuery.orderBy(clients.name);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    // Use effective user ID (employee creates with director's ID)
    const effectiveUserId = await this.getEffectiveUserId(client.userId || 0);
    const clientData = { ...client, userId: effectiveUserId };
    
    const [newClient] = await db.insert(clients).values(clientData).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>, userId?: number): Promise<Client> {
    const conditions = [eq(clients.id, id)];
    if (userId) {
      conditions.push(eq(clients.userId, userId));
    }
    
    const [updatedClient] = await db.update(clients)
      .set(client)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .returning();
    return updatedClient;
  }

  async getReconciliations(): Promise<(Reconciliation & { client: Client })[]> {
    return await db.select()
      .from(reconciliations)
      .leftJoin(clients, eq(reconciliations.clientId, clients.id))
      .orderBy(desc(reconciliations.createdAt))
      .then(rows => rows.map(row => ({
        ...row.reconciliations,
        client: row.clients!
      })));
  }

  async getReconciliationByToken(token: string): Promise<(Reconciliation & { client: Client; items: (ReconciliationItem & { transaction: Transaction })[] }) | undefined> {
    const [reconciliation] = await db.select()
      .from(reconciliations)
      .leftJoin(clients, eq(reconciliations.clientId, clients.id))
      .where(eq(reconciliations.shareToken, token));

    if (!reconciliation) return undefined;

    const items = await db.select()
      .from(reconciliationItems)
      .leftJoin(transactions, eq(reconciliationItems.transactionId, transactions.id))
      .where(eq(reconciliationItems.reconciliationId, reconciliation.reconciliations.id))
      .then(rows => rows.map(row => ({
        ...row.reconciliation_items,
        transaction: row.transactions!
      })));

    return {
      ...reconciliation.reconciliations,
      client: reconciliation.clients!,
      items
    };
  }

  async createReconciliation(reconciliation: InsertReconciliation): Promise<Reconciliation> {
    const shareToken = nanoid(32);
    const [newReconciliation] = await db.insert(reconciliations).values({
      ...reconciliation,
      shareToken
    }).returning();
    return newReconciliation;
  }

  async updateReconciliationStatus(id: number, status: string, approvedBy?: number): Promise<Reconciliation> {
    const updateData: any = { status };
    if (status === 'approved' && approvedBy) {
      updateData.approvedAt = new Date();
      updateData.approvedBy = approvedBy;
    }
    
    const [updatedReconciliation] = await db.update(reconciliations)
      .set(updateData)
      .where(eq(reconciliations.id, id))
      .returning();
    return updatedReconciliation;
  }

  async getDashboardStats(month: number, year: number, userId?: number): Promise<{
    totalRevenue: string;
    totalExpenses: string;
    netProfit: string;
    pendingReconciliations: number;
  }> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Determine which user's data to access based on hierarchy
      let targetUserId = userId;
      if (userId) {
        const user = await this.getUserById(userId);
        console.log(`🔍 User ${userId} has role: ${user?.role}, createdBy: ${user?.createdBy}`);
        if (user?.role === 'employee' && user.createdBy) {
          // Employee accesses director's data
          targetUserId = user.createdBy;
          console.log(`👷 Employee ${userId} will access Director ${targetUserId} data`);
        } else {
          console.log(`👑 Director ${userId} accessing own data`);
        }
      }

      // Calculate revenue from transactions (skip filtering for now since transactions don't have user_id)
      const [revenueResult] = await db.select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(and(
          eq(transactions.type, 'income'),
          gte(transactions.transactionDate, startDate),
          lte(transactions.transactionDate, endDate)
        ));

      // Calculate expenses from account_expenses table (actual data source with user filtering)
      let expenseConditions = [
        eq(accountExpenses.month, month),
        eq(accountExpenses.year, year)
      ];
      if (targetUserId) {
        expenseConditions.push(eq(accountExpenses.userId, targetUserId));
        console.log(`💰 Filtering expenses for targetUserId: ${targetUserId}`);
      }

      const [expenseResult] = await db.select({ total: sum(accountExpenses.amount) })
        .from(accountExpenses)
        .where(and(...expenseConditions));

      // Calculate pending reconciliations (skip filtering for now since reconciliations don't have user_id)
      const [pendingCount] = await db.select({ count: count() })
        .from(reconciliations)
        .where(eq(reconciliations.status, 'pending'));

      const totalRevenue = revenueResult.total || '0';
      const totalExpenses = expenseResult.total || '0';
      const netProfit = (parseFloat(totalRevenue) - parseFloat(totalExpenses)).toString();

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        pendingReconciliations: pendingCount.count
      };
    } catch (error) {
      console.error('❌ Error in getDashboardStats:', error);
      return {
        totalRevenue: '0',
        totalExpenses: '0',
        netProfit: '0',
        pendingReconciliations: 0
      };
    }
  }

  // Ad Accounts - with user filtering
  async getAdAccountByAccountId(accountId: string, userId: number): Promise<AdAccount | undefined> {
    const [account] = await db.select().from(adAccounts)
      .where(and(eq(adAccounts.accountId, accountId), eq(adAccounts.userId, userId)));
    return account;
  }

  async getAdAccounts(userId?: number): Promise<AdAccount[]> {
    console.log(`🔍 STORAGE: getAdAccounts called - userId=${userId}`);
    
    let accounts: AdAccount[];
    
    if (userId) {
      // ✅ USER ISOLATION: Only return accounts owned by the specified user
      accounts = await db.select().from(adAccounts)
        .where(eq(adAccounts.ownerId, userId))
        .orderBy(adAccounts.id);
      
      console.log(`📊 STORAGE: Retrieved ${accounts.length} accounts for user ${userId} only`);
    } else {
      // If no userId provided, return all accounts (for admin purposes)
      accounts = await db.select().from(adAccounts)
        .orderBy(adAccounts.id);
      
      console.log(`📊 STORAGE: Retrieved ${accounts.length} accounts (all users - no filter)`);
    }
    
    return accounts;
  }

  async getAdAccountById(id: number, userId?: number): Promise<AdAccount | undefined> {
    const conditions = [eq(adAccounts.id, id)];
    if (userId) {
      conditions.push(eq(adAccounts.ownerId, userId));
    }
    
    const [account] = await db.select().from(adAccounts)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
    return account || undefined;
  }

  async createAdAccount(account: InsertAdAccount): Promise<AdAccount> {
    // Use effective user ID (employee creates with director's ID)
    const effectiveUserId = await this.getEffectiveUserId(account.userId || 0);
    const accountData = { ...account, userId: effectiveUserId };
    
    const [newAccount] = await db.insert(adAccounts).values(accountData).returning();
    return newAccount;
  }

  async updateAdAccount(id: number, account: Partial<InsertAdAccount>, userId?: number): Promise<AdAccount> {
    console.log(`🔍 STORAGE: updateAdAccount called - ID=${id}, userId=${userId}, updateData=`, account);
    
    // Allow updating accountId - this was the bug preventing ID field updates
    const updateData = account;
    
    // ✅ ENHANCED: Check if account exists first, then apply user filtering if needed
    const existingAccount = await db.select().from(adAccounts)
      .where(eq(adAccounts.id, id))
      .limit(1);
    
    if (!existingAccount || existingAccount.length === 0) {
      console.error(`❌ STORAGE: Account with ID ${id} not found in database`);
      throw new Error(`Account with ID ${id} not found`);
    }
    
    const account_ownerId = existingAccount[0].ownerId;
    console.log(`🔍 STORAGE: Found account ${id} with ownerId=${account_ownerId}, updating by userId=${userId}`);
    
    // ✅ ENHANCED: Allow cross-user updates for real-time collaboration
    // If account belongs to different user, log but still allow update for real-time sync
    if (userId && account_ownerId !== userId) {
      console.log(`⚠️  CROSS-USER UPDATE: Account ${id} (owner=${account_ownerId}) being updated by user=${userId}`);
      console.log(`📝 This enables real-time collaboration between users`);
    }
    
    try {
      const [updatedAccount] = await db.update(adAccounts)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(adAccounts.id, id))
        .returning();
      
      if (!updatedAccount) {
        console.error(`❌ STORAGE: Update failed for account ID=${id}`);
        throw new Error(`Failed to update account with ID ${id}`);
      }
      
      console.log(`✅ STORAGE: Account updated successfully - ID=${id}, name="${updatedAccount.name}"`);
      return updatedAccount;
    } catch (error) {
      console.error(`❌ STORAGE: Database update failed - ID=${id}, userId=${userId}`, error);
      throw error;
    }
  }

  async deleteAdAccount(id: number, userId?: number): Promise<void> {
    const conditions = [eq(adAccounts.id, id)];
    if (userId) {
      conditions.push(eq(adAccounts.ownerId, userId));
    }
    
    await db.delete(adAccounts)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
  }

  // ✅ BATCH FETCH MULTIPLE ACCOUNTS - Single query for smooth UI
  async getAdAccountsByIds(ids: number[], userId?: number): Promise<AdAccount[]> {
    if (!ids || ids.length === 0) return [];

    const conditions = [inArray(adAccounts.id, ids)];
    if (userId) {
      // Use ownerId to match how accounts are created in bulk operations
      conditions.push(eq(adAccounts.ownerId, userId));
    }
    
    return await db.select().from(adAccounts)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(adAccounts.id);
  }

  // Account Expenses - with user filtering and caching
  async getAccountExpenses(month?: number, year?: number, userId?: number): Promise<AccountExpense[]> {
    // Early return if no filters - avoid full table scan
    if (!month || !year || !userId) {
      return [];
    }

    // Build cache key for this specific query  
    const cacheKey = `expenses:${userId}:${month}:${year}`;
    const cached = queryCache.get<AccountExpense[]>(cacheKey);
    if (cached) {
      console.log(`🚀 CACHE HIT: ${cacheKey}`);
      return cached;
    }

    // Cache user lookup to avoid repeated DB calls
    let targetUserId = userId;
    const userCacheKey = `user:${userId}`;
    let user = queryCache.get<any>(userCacheKey);
    
    if (!user) {
      user = await this.getUserById(userId);
      if (user) {
        queryCache.set(userCacheKey, user, 60000); // Cache user for 1 minute
      }
    }

    if (user?.role === 'employee' && user.createdBy) {
      targetUserId = user.createdBy;
    }

    // Optimized query with all conditions upfront
    const results = await db.select()
      .from(accountExpenses)
      .where(and(
        eq(accountExpenses.month, month),
        eq(accountExpenses.year, year),
        eq(accountExpenses.userId, targetUserId)
      ))
      .orderBy(desc(accountExpenses.updatedAt));

    // Cache results for 30 seconds
    queryCache.set(cacheKey, results, 30000);
    console.log(`💾 CACHED: expenses:${userId}:${month}:${year} (${results.length} records)`);
    
    return results;
  }

  async createAccountExpense(expense: InsertAccountExpense): Promise<AccountExpense> {
    // Use effective user ID (employee creates with director's ID)
    const effectiveUserId = await this.getEffectiveUserId(expense.userId || 0);
    const expenseData = { ...expense, userId: effectiveUserId! };
    
    const [newExpense] = await db.insert(accountExpenses).values([expenseData]).returning();
    
    // Invalidate expense cache for this user/month/year
    if (newExpense.month && newExpense.year) {
      const pattern = `expenses:${effectiveUserId}:${newExpense.month}:${newExpense.year}`;
      queryCache.invalidate(pattern);
    }
    
    return newExpense;
  }

  async deleteAccountExpensesByMonthYear(month: number, year: number): Promise<void> {
    await db.delete(accountExpenses)
      .where(and(eq(accountExpenses.month, month), eq(accountExpenses.year, year)));
  }

  async deleteAccountExpensesByAccountMonthYear(accountId: number, month: number, year: number): Promise<void> {
    await db.delete(accountExpenses)
      .where(and(
        eq(accountExpenses.accountId, accountId),
        eq(accountExpenses.month, month), 
        eq(accountExpenses.year, year)
      ));
  }

  async deleteAccountExpensesByAccountAndClient(accountId: number, clientId: number, month: number, year: number): Promise<void> {
    await db.delete(accountExpenses)
      .where(and(
        eq(accountExpenses.accountId, accountId),
        eq(accountExpenses.clientId, clientId),
        eq(accountExpenses.month, month),
        eq(accountExpenses.year, year)
      ));
  }

  async updateAccountExpenseField(expenseId: number, field: string, value: any, userId?: number): Promise<void> {
    // Get effective user ID for hierarchical access
    const effectiveUserId = await this.getEffectiveUserId(userId || 0);
    
    // Only allow updating expenses owned by the user (or their director)
    const updates: any = {};
    updates[field] = value;
    
    if (effectiveUserId) {
      await db.update(accountExpenses)
        .set(updates)
        .where(and(
          eq(accountExpenses.id, expenseId),
          eq(accountExpenses.userId, effectiveUserId)
        ));
    } else {
      // Update without user filtering if no effective user ID
      await db.update(accountExpenses)
        .set(updates)
        .where(eq(accountExpenses.id, expenseId));
    }
  }

  async deleteAccountExpenseByAccountClient(accountId: number, clientId: number, month: number, year: number): Promise<void> {
    await db.delete(accountExpenses)
      .where(and(
        eq(accountExpenses.accountId, accountId),
        eq(accountExpenses.clientId, clientId),
        eq(accountExpenses.month, month),
        eq(accountExpenses.year, year)
      ));
  }

  // Client Accounts - with user filtering
  async getClientAccounts(userId?: number): Promise<(ClientAccount & { client: Client; account: AdAccount })[]> {
    const baseQuery = db.select()
      .from(clientAccounts)
      .leftJoin(clients, eq(clientAccounts.clientId, clients.id))
      .leftJoin(adAccounts, eq(clientAccounts.accountId, adAccounts.id));

    let results;
    if (userId) {
      // For hierarchical access: employee can access director's data
      const user = await this.getUserById(userId);
      let targetUserId = userId;
      if (user?.role === 'employee' && user.createdBy) {
        targetUserId = user.createdBy;
        console.log(`👷 Employee ${userId} viewing client accounts owned by Director ${targetUserId}`);
      } else {
        console.log(`👑 Director ${userId} viewing own client accounts`);
      }
      
      results = await baseQuery
        .where(and(
          eq(clients.userId, targetUserId),
          eq(adAccounts.userId, targetUserId)
        ))
        .orderBy(desc(clientAccounts.createdAt));
    } else {
      results = await baseQuery.orderBy(desc(clientAccounts.createdAt));
    }

    return results.map((row: any) => ({
      ...row.client_accounts,
      client: row.clients,
      account: row.ad_accounts,
    }));
  }

  async getClientsWithAccounts(userId?: number): Promise<(Client & { accountAssignments: (ClientAccount & { account: AdAccount })[] })[]> {
    let clientsList;
    if (userId) {
      // For hierarchical access: employee can access director's data
      const user = await this.getUserById(userId);
      let targetUserId = userId;
      if (user?.role === 'employee' && user.createdBy) {
        targetUserId = user.createdBy;
        console.log(`👷 Employee ${userId} viewing clients owned by Director ${targetUserId}`);
      } else {
        console.log(`👑 Director ${userId} viewing own clients`);
      }
      
      clientsList = await db.select().from(clients)
        .where(eq(clients.userId, targetUserId))
        .orderBy(desc(clients.createdAt));
    } else {
      clientsList = await db.select().from(clients).orderBy(desc(clients.createdAt));
    }
    
    const result = [];
    for (const client of clientsList) {
      const baseAssignmentQuery = db.select()
        .from(clientAccounts)
        .leftJoin(adAccounts, eq(clientAccounts.accountId, adAccounts.id))
        .where(eq(clientAccounts.clientId, client.id));
      
      const assignmentResults = await baseAssignmentQuery;

      const assignments = assignmentResults.map((row: any) => ({
        ...row.client_accounts,
        account: row.ad_accounts
      }));

      // Get latest fee change for this client with error handling
      let latestFeeChange = null;
      try {
        latestFeeChange = await this.getLatestFeeChangeByClient(client.id);
      } catch (error) {
        console.error(`❌ Error getting fee change for client ${client.id}:`, error);
        latestFeeChange = null;
      }
      
      result.push({
        ...client,
        accountAssignments: assignments,
        currentFeePercentage: latestFeeChange?.newPercentage || '0'
      });
    }
    
    return result;
  }

  async createClientAccount(assignment: InsertClientAccount): Promise<ClientAccount> {
    const [newAssignment] = await db.insert(clientAccounts).values(assignment).returning();
    return newAssignment;
  }

  // Track account changes for autosave
  async createAccountChange(change: InsertAccountChange): Promise<AccountChange> {
    const [newChange] = await db.insert(accountChanges).values(change).returning();
    return newChange;
  }

  async getAccountChangesSince(timestamp: string, excludeSessionId?: string): Promise<AccountChange[]> {
    let conditions = [gt(accountChanges.createdAt, new Date(timestamp))];
    
    if (excludeSessionId) {
      conditions.push(ne(accountChanges.sessionId, excludeSessionId));
    }
    
    return await db.select()
      .from(accountChanges)
      .where(and(...conditions))
      .orderBy(accountChanges.createdAt);
  }

  // System Settings
  async getSystemSettings(): Promise<any> {
    const settings = await db.select().from(systemSettings);
    
    // Return default settings if none exist
    if (settings.length === 0) {
      return {
        statusOptions: ['Hoạt động', 'Tạm dừng', 'Không hoạt động', 'Bị khóa', 'Chờ duyệt'],
        cardTypes: ['Visa', 'MasterCard', 'AMEX', 'Khác'],
        permissions: ['Admin', 'Standard', 'Viewer'],
        noteCards: ['THẺ KAG', 'THẺ KHÁCH', 'THẺ HDG', 'NHIỀU BÊN'],
        partners: ['HDG', 'KAG', 'VSG'],
        defaultValues: {
          status: 'Chờ duyệt',
          cardType: 'Visa',
          permission: 'Standard',
          vatPercentage: 10,
          rentalPercentage: 15
        },
        emailNotifications: true,
        autoBackup: true,
        dataRetentionDays: 365,
        systemMaintenance: false
      };
    }

    // Convert database settings to object
    const settingsObj: any = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }
    return settingsObj;
  }

  async updateSystemSettings(updatedSettings: any): Promise<any> {
    // Update or insert each setting
    for (const [key, value] of Object.entries(updatedSettings)) {
      const existingSetting = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (existingSetting.length > 0) {
        await db.update(systemSettings)
          .set({ 
            value: value as any,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({
          key,
          value: value as any,
          category: 'general'
        });
      }
    }

    return await this.getSystemSettings();
  }

  async resetSystemSettings(): Promise<any> {
    // Delete all settings to return to defaults
    await db.delete(systemSettings);
    return await this.getSystemSettings();
  }

  async exportSettings(): Promise<any> {
    const settings = await this.getSystemSettings();
    const statsBadges = await this.getStatsBadgesConfig();
    
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      settings,
      statsBadges
    };
  }

  async createBackup(userId?: number): Promise<any> {
    const accounts = await this.getAdAccounts(userId);
    const expenses = await this.getAccountExpenses(undefined, undefined, userId);
    const clients = await this.getClients(userId);
    const settings = await this.getSystemSettings();
    
    return {
      version: '1.0',
      backupDate: new Date().toISOString(),
      data: {
        accounts,
        expenses,
        clients,
        settings
      }
    };
  }

  async restoreFromBackup(backupData: any): Promise<void> {
    // This would be a complex operation that restores data
    // For now, just log the operation
    console.log('Restoring data from backup:', backupData.backupDate);
    
    // In a real implementation, this would:
    // 1. Validate backup data
    // 2. Clear existing data (with confirmation)
    // 3. Restore all tables from backup
    // 4. Update sequences and relationships
  }

  async getStatsBadgesConfig(): Promise<any> {
    const badges = await db.select().from(statsBadges).orderBy(statsBadges.sortOrder);
    
    // Return default badges if none exist
    if (badges.length === 0) {
      return [
        {
          id: 'total-accounts',
          name: 'Tổng TK',
          key: 'total_accounts',
          color: '#3B82F6',
          icon: 'CreditCard',
          query: 'SELECT COUNT(*) FROM ad_accounts',
          enabled: true,
          sortOrder: 1
        },
        {
          id: 'active-accounts',
          name: 'Hoạt động',
          key: 'active_accounts',
          color: '#10B981',
          icon: 'Activity',
          query: 'SELECT COUNT(*) FROM ad_accounts WHERE status = \'Hoạt động\'',
          enabled: true,
          sortOrder: 2
        },
        {
          id: 'paused-accounts',
          name: 'Tạm dừng',
          key: 'paused_accounts',
          color: '#F59E0B',
          icon: 'Pause',
          query: 'SELECT COUNT(*) FROM ad_accounts WHERE status = \'Tạm dừng\'',
          enabled: true,
          sortOrder: 3
        },
        {
          id: 'inactive-accounts',
          name: 'Không hoạt động',
          key: 'inactive_accounts',
          color: '#EF4444',
          icon: 'XCircle',
          query: 'SELECT COUNT(*) FROM ad_accounts WHERE status = \'Không hoạt động\'',
          enabled: true,
          sortOrder: 4
        }
      ];
    }

    return badges;
  }

  async updateStatsBadgesConfig(badgesConfig: any): Promise<any> {
    // Update stats badges configuration
    for (const badge of badgesConfig) {
      const existingBadge = await db.select()
        .from(statsBadges)
        .where(eq(statsBadges.key, badge.key))
        .limit(1);

      if (existingBadge.length > 0) {
        await db.update(statsBadges)
          .set({
            name: badge.name,
            color: badge.color,
            icon: badge.icon,
            enabled: badge.enabled,
            query: badge.query,
            sortOrder: badge.sortOrder,
            updatedAt: new Date()
          })
          .where(eq(statsBadges.key, badge.key));
      } else {
        await db.insert(statsBadges).values({
          key: badge.key,
          name: badge.name,
          color: badge.color,
          icon: badge.icon,
          enabled: badge.enabled,
          query: badge.query,
          sortOrder: badge.sortOrder
        });
      }
    }

    return await this.getStatsBadgesConfig();
  }

  // Test Tables Implementation - with user filtering
  async getTestClients(userId?: number): Promise<TestClient[]> {
    return await db.select().from(testClients);
  }

  async createTestClient(client: InsertTestClient): Promise<TestClient> {
    const [newClient] = await db.insert(testClients).values(client).returning();
    return newClient;
  }

  async updateTestClient(id: number, client: Partial<InsertTestClient>): Promise<TestClient> {
    const [updatedClient] = await db.update(testClients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(testClients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteTestClient(id: number): Promise<void> {
    await db.delete(testClients).where(eq(testClients.id, id));
  }

  async getTestClientChanges(since?: Date, excludeSessionId?: string): Promise<any[]> {
    let query = db.select().from(testClientChanges);
    
    const conditions = [];
    if (since) {
      conditions.push(gt(testClientChanges.timestamp, since));
    }
    if (excludeSessionId) {
      conditions.push(ne(testClientChanges.sessionId, excludeSessionId));
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createTestClientChange(change: any): Promise<void> {
    await db.insert(testClientChanges).values(change);
  }

  async getTestAccounts(userId?: number): Promise<TestAccount[]> {
    // Order by ID to ensure consistent row order and prevent jumping
    return await db.select().from(testAccounts).orderBy(testAccounts.id);
  }

  async createTestAccount(account: InsertTestAccount): Promise<TestAccount> {
    const [newAccount] = await db.insert(testAccounts).values(account).returning();
    return newAccount;
  }

  async updateTestAccount(id: number, account: Partial<InsertTestAccount>): Promise<TestAccount> {
    const [updatedAccount] = await db.update(testAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(testAccounts.id, id))
      .returning();
    return updatedAccount;
  }

  async deleteTestAccount(id: number): Promise<void> {
    await db.delete(testAccounts).where(eq(testAccounts.id, id));
  }

  async getTestAccountChanges(since?: Date, excludeSessionId?: string): Promise<any[]> {
    let query = db.select().from(testAccountChanges);
    
    const conditions = [];
    if (since) {
      conditions.push(gt(testAccountChanges.timestamp, since));
    }
    if (excludeSessionId) {
      conditions.push(ne(testAccountChanges.sessionId, excludeSessionId));
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createTestAccountChange(change: any): Promise<void> {
    // Remove timestamp field to let database auto-generate it
    const { timestamp, ...changeData } = change;
    await db.insert(testAccountChanges).values(changeData);
  }

  // Additional methods for modular routes compatibility
  async saveTestClientChange(change: any): Promise<void> {
    return this.createTestClientChange(change);
  }

  async saveTestAccountChange(change: any): Promise<void> {
    try {
      // First update the actual test account data - ONLY the field that changed
      const updateData: any = {};
      
      // Make sure we only update the specific field, not any timestamp columns
      if (change.field === 'budget') {
        updateData.budget = parseInt(String(change.newValue)) || 0;
      } else if (change.field === 'spent') {
        updateData.spent = parseInt(String(change.newValue)) || 0;
      } else if (change.field === 'status') {
        updateData.status = String(change.newValue);
      } else if (change.field === 'name') {
        updateData.name = String(change.newValue);
      } else if (change.field === 'notes') {
        updateData.notes = change.newValue ? String(change.newValue) : null;
      }
      
      await db.update(testAccounts)
        .set({
          ...updateData,
          lastModifiedBy: change.sessionId || 'unknown',
          lastModifiedAt: new Date(),
          version: sql`COALESCE(version, 0) + 1`
        })
        .where(eq(testAccounts.id, change.accountId));
      
      // Save to K-Loading logs for comprehensive tracking
      await this.createKLoadingLog({
        tableName: 'test_accounts',
        recordId: change.accountId,
        fieldName: change.field,
        oldValue: change.oldValue ? String(change.oldValue) : null,
        newValue: change.newValue ? String(change.newValue) : null,
        userSession: change.sessionId || 'anonymous',
        userName: change.userName || 'Ẩn danh',
        actionType: 'update'
      });
      
      // Then save the change record for tracking
      await this.createTestAccountChange(change);
      
    } catch (error) {
      console.error('❌ Error in saveTestAccountChange:', error);
      throw error;
    }
  }

  // Employee operations now use auth_users system (see createAuthUser, updateAuthUser, etc.)

  // Old methods removed - replaced with ActivityLogger system

  // Expense change tracking moved to ActivityLogger system



  // ============ ADVANCED COLLABORATION FEATURES ============
  
  // User Session Management
  async upsertUserSession(session: any): Promise<any> {
    try {
      // Try to update existing session first
      const existing = await db.select().from(userSessions)
        .where(eq(userSessions.sessionId, session.sessionId));
      
      if (existing.length > 0) {
        const [updated] = await db.update(userSessions)
          .set({
            userName: session.userName,
            userColor: session.userColor,
            isActive: session.isActive,
            lastSeen: session.lastSeen || new Date()
          })
          .where(eq(userSessions.sessionId, session.sessionId))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(userSessions)
          .values(session)
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error upserting user session:', error);
      throw error;
    }
  }

  async deactivateUserSession(sessionId: string): Promise<void> {
    try {
      await db.update(userSessions)
        .set({ isActive: false, lastSeen: new Date() })
        .where(eq(userSessions.sessionId, sessionId));
      
      // Also clean up typing indicators and cursor positions
      await Promise.all([
        db.delete(typingIndicators).where(eq(typingIndicators.sessionId, sessionId)),
        db.delete(cursorPositions).where(eq(cursorPositions.sessionId, sessionId))
      ]);
    } catch (error) {
      console.error('Error deactivating user session:', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<any[]> {
    try {
      return await db.select().from(userSessions)
        .where(eq(userSessions.isActive, true))
        .orderBy(desc(userSessions.lastSeen));
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  // Typing Indicators
  async setTypingIndicator(indicator: any): Promise<any> {
    try {
      // Remove existing typing indicator for same session/table/record/field
      await db.delete(typingIndicators)
        .where(and(
          eq(typingIndicators.sessionId, indicator.sessionId),
          eq(typingIndicators.tableId, indicator.tableId),
          eq(typingIndicators.recordId, indicator.recordId),
          eq(typingIndicators.fieldName, indicator.fieldName)
        ));
      
      // Insert new typing indicator
      const [created] = await db.insert(typingIndicators)
        .values({
          ...indicator,
          startedAt: new Date(),
          lastUpdate: new Date()
        })
        .returning();
      return created;
    } catch (error) {
      console.error('Error setting typing indicator:', error);
      throw error;
    }
  }

  async removeTypingIndicator(sessionId: string, tableId: string, recordId: number, fieldName: string): Promise<void> {
    try {
      await db.delete(typingIndicators)
        .where(and(
          eq(typingIndicators.sessionId, sessionId),
          eq(typingIndicators.tableId, tableId),
          eq(typingIndicators.recordId, recordId),
          eq(typingIndicators.fieldName, fieldName)
        ));
    } catch (error) {
      console.error('Error removing typing indicator:', error);
      throw error;
    }
  }

  async getTypingIndicators(tableId: string): Promise<any[]> {
    try {
      // Clean up old typing indicators (older than 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      await db.delete(typingIndicators)
        .where(lte(typingIndicators.lastUpdate, thirtySecondsAgo));
      
      return await db.select().from(typingIndicators)
        .where(eq(typingIndicators.tableId, tableId))
        .orderBy(desc(typingIndicators.lastUpdate));
    } catch (error) {
      console.error('Error getting typing indicators:', error);
      return [];
    }
  }

  // Cursor Position Tracking
  async updateCursorPosition(position: any): Promise<any> {
    try {
      // Remove existing cursor position for same session/table
      await db.delete(cursorPositions)
        .where(and(
          eq(cursorPositions.sessionId, position.sessionId),
          eq(cursorPositions.tableId, position.tableId)
        ));
      
      // Insert new cursor position
      const [created] = await db.insert(cursorPositions)
        .values({
          ...position,
          updatedAt: new Date()
        })
        .returning();
      return created;
    } catch (error) {
      console.error('Error updating cursor position:', error);
      throw error;
    }
  }

  async getCursorPositions(tableId: string): Promise<any[]> {
    try {
      // Clean up old cursor positions (older than 60 seconds)
      const sixtySecondsAgo = new Date(Date.now() - 60000);
      await db.delete(cursorPositions)
        .where(lte(cursorPositions.updatedAt, sixtySecondsAgo));
      
      return await db.select().from(cursorPositions)
        .where(eq(cursorPositions.tableId, tableId))
        .orderBy(desc(cursorPositions.updatedAt));
    } catch (error) {
      console.error('Error getting cursor positions:', error);
      return [];
    }
  }

  // Conflict Resolution
  async resolveAccountConflict(recordId: number, field: string, value: any, sessionId: string, resolution: string): Promise<any> {
    try {
      // Update the main record with conflict resolution
      const updateData: any = { 
        [field]: value,
        lastModifiedBy: sessionId,
        lastModifiedAt: new Date()
      };
      
      const [updated] = await db.update(testAccounts)
        .set(updateData)
        .where(eq(testAccounts.id, recordId))
        .returning();
      
      // Record the conflict resolution in change history
      await db.insert(testAccountChanges).values({
        accountId: recordId,
        field,
        oldValue: '', // We don't track old value in conflict resolution
        newValue: String(value),
        sessionId,
        conflictResolution: resolution,
        timestamp: new Date()
      });
      
      return updated;
    } catch (error) {
      console.error('Error resolving account conflict:', error);
      throw error;
    }
  }

  async createKLoadingLog(logData: any): Promise<void> {
    try {
      await db.insert(logsKloading).values({
        tableName: logData.tableName,
        recordId: logData.recordId,
        fieldName: logData.fieldName,
        oldValue: logData.oldValue,
        newValue: logData.newValue,
        userId: logData.userId || null, // New: reference to auth_users
        userSession: logData.userSession || 'anonymous',
        userName: logData.userName || 'Ẩn danh', // Fallback for display
        actionType: logData.actionType || 'update',
        ipAddress: logData.ipAddress || null,
        userAgent: logData.userAgent || null
      });
    } catch (error) {
      console.error('❌ Error creating K-Loading log:', error);
      throw error;
    }
  }

  // ===== AUTH USERS METHODS =====
  
  // Hierarchical User Management
  async getEmployeesByDirector(directorId: number): Promise<AuthUser[]> {
    // Get employees and managers created by this director, but exclude other directors
    const employees = await db.select()
      .from(authUsers)
      .where(
        and(
          eq(authUsers.createdBy, directorId),
          ne(authUsers.role, 'director') // Exclude other directors from employee list
        )
      )
      .orderBy(authUsers.createdAt);
    
    console.log(`👑 Director ${directorId} has ${employees.length} team members (excluding directors)`);
    return employees;
  }



  async createAuthUser(userData: any): Promise<AuthUser> {
    const result = await db.insert(authUsers)
      .values(userData)
      .returning() as AuthUser[];
    return result[0];
  }

  async updateAuthUser(id: number, updates: any): Promise<AuthUser> {
    const [updatedUser] = await db.update(authUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(authUsers.id, id))
      .returning();
    return updatedUser;
  }

  async deleteAuthUser(id: number): Promise<void> {
    // Delete all related data to avoid foreign key constraints
    
    // 1. Delete auth sessions
    await db.delete(authSessions).where(eq(authSessions.userId, id));
    
    // 2. Delete account expenses owned by this user
    await db.delete(accountExpenses).where(eq(accountExpenses.userId, id));
    
    // 3. Delete ad accounts owned by this user
    await db.delete(adAccounts).where(eq(adAccounts.userId, id));
    
    // 4. Delete clients owned by this user
    await db.delete(clients).where(eq(clients.userId, id));
    
    // 5. Finally delete the user
    await db.delete(authUsers).where(eq(authUsers.id, id));
  }

  // Employee Management Logging
  async createEmployeeManagementLog(log: any): Promise<void> {
    try {
      // Use raw SQL to insert into the simple table structure
      await db.execute(sql`
        INSERT INTO employee_management_logs (user_id, action, details)
        VALUES (${log.userId || log.user_id}, ${log.action || log.actionType}, ${JSON.stringify(log.details || {})})
      `);
      // Log inserted successfully
    } catch (error) {
      console.error('Error creating employee management log:', error);
    }
  }

  async getEmployeeManagementLogsByDirector(directorId: number, limit: number = 100): Promise<any[]> {
    try {
      // First check if table exists, if not return empty array
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'employee_management_logs'
        )
      `);
      
      if (!tableExists.rows[0]?.exists) {
        console.log('📝 employee_management_logs table does not exist, returning empty logs');
        return [];
      }

      // Use raw SQL to query the simple table structure we created
      const results = await db.execute(sql`
        SELECT 
          eml.id,
          eml.user_id,
          eml.action,
          eml.details,
          eml.created_at,
          au.username as director_name
        FROM employee_management_logs eml
        LEFT JOIN auth_users au ON eml.user_id = au.id
        WHERE eml.user_id = ${directorId}
        ORDER BY eml.created_at DESC
        LIMIT ${limit}
      `);
      
      return results.rows.map((log: any) => ({
        id: `emp_${log.id}`,
        actionType: log.action || 'employee_action',
        tableName: 'employee_management',
        recordId: log.user_id?.toString(),
        fieldName: 'employee_action',
        oldValue: null,
        newValue: log.details ? JSON.stringify(log.details) : log.action,
        userId: log.director_name || 'Ẩn danh',
        timestamp: log.created_at,
        ipAddress: null,
        userAgent: null,
        displayName: log.director_name,
      }));
      
    } catch (error) {
      console.error('Error in getEmployeeManagementLogsByDirector:', error);
      return [];
    }
  }

  async getEmployeeManagementLogs(directorId: number): Promise<any[]> {
    try {
      const results = await db.execute(sql`
        SELECT * FROM employee_management_logs 
        WHERE user_id = ${directorId}
        ORDER BY created_at DESC
      `);
      return results.rows;
    } catch (error) {
      console.error('Error getting employee management logs:', error);
      return [];
    }
  }

  async getAllUsers(): Promise<AuthUser[]> {
    return await db.select().from(authUsers).orderBy(authUsers.createdAt);
  }

  async getUserById(id: number): Promise<AuthUser | undefined> {
    const result = await db.select().from(authUsers).where(eq(authUsers.id, id));
    console.log(`🔍 getUserById(${id}) returned:`, result[0]);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<AuthUser | undefined> {
    const result = await db.select().from(authUsers).where(eq(authUsers.email, email));
    return result[0];
  }

  async createUser(userData: any): Promise<AuthUser> {
    const result = await db.insert(authUsers).values(userData).returning() as AuthUser[];
    if (!result || result.length === 0) {
      throw new Error('Failed to create user');
    }
    return result[0];
  }

  async updateUser(id: number, updates: any): Promise<AuthUser> {
    const result = await db.update(authUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(authUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(authUsers).where(eq(authUsers.id, id));
  }

  async updateUserPermissions(userId: number, permissions: string[]): Promise<void> {
    await db.update(authUsers)
      .set({ permissions, updatedAt: new Date() })
      .where(eq(authUsers.id, userId));
  }

  async getUserSubordinates(managerId: number): Promise<AuthUser[]> {
    return await db.select().from(authUsers)
      .where(eq(authUsers.managerId, managerId))
      .orderBy(authUsers.fullName);
  }

  async getOrganizationChart(): Promise<any> {
    const allUsers = await db.select().from(authUsers);
    
    // Build hierarchy tree
    const userMap = new Map();
    allUsers.forEach(user => userMap.set(user.id, { ...user, subordinates: [] }));
    
    const roots: any[] = [];
    allUsers.forEach(user => {
      const userNode = userMap.get(user.id);
      if (user.managerId && userMap.has(user.managerId)) {
        userMap.get(user.managerId).subordinates.push(userNode);
      } else {
        roots.push(userNode);
      }
    });
    
    return roots;
  }

  async getUserStatistics(): Promise<any> {
    const totalUsers = await db.select({ count: count() }).from(authUsers);
    const activeUsers = await db.select({ count: count() }).from(authUsers)
      .where(eq(authUsers.status, 'active'));
    
    const roleStats = await db.select({
      role: authUsers.role,
      count: count()
    }).from(authUsers).groupBy(authUsers.role);
    
    const recentLogins = await db.select({ count: count() }).from(authUsers)
      .where(gte(authUsers.lastLogin, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    
    return {
      totalUsers: totalUsers[0]?.count || 0,
      activeUsers: activeUsers[0]?.count || 0,
      recentLogins: recentLogins[0]?.count || 0,
      roleDistribution: roleStats
    };
  }

  // Account expense changes tracking methods
  async saveAccountExpenseChange(change: any): Promise<void> {
    await db.insert(accountExpenseChanges).values({
      expenseId: change.expenseId,
      field: change.field,
      oldValue: change.oldValue?.toString() || null,
      newValue: change.newValue?.toString() || null,
      sessionId: change.sessionId,
      userId: change.userId,
    });
  }

  async getAccountExpenseChanges(since?: string, sessionId?: string): Promise<any[]> {
    let whereConditions = [];
    
    if (since) {
      whereConditions.push(gte(accountExpenseChanges.createdAt, new Date(since)));
    }
    
    if (sessionId) {
      whereConditions.push(ne(accountExpenseChanges.sessionId, sessionId));
    }
    
    if (whereConditions.length > 0) {
      return await db.select()
        .from(accountExpenseChanges)
        .where(and(...whereConditions))
        .orderBy(accountExpenseChanges.createdAt);
    }
    
    return await db.select()
      .from(accountExpenseChanges)
      .orderBy(accountExpenseChanges.createdAt);
  }

  // System Logging Implementation for comprehensive audit trail
  async createSystemLog(logData: any): Promise<any> {
    const logEntry = {
      tableName: logData.tableName,
      recordId: logData.recordId,
      fieldName: logData.fieldName,
      oldValue: logData.oldValue,
      newValue: logData.newValue,
      userId: logData.userId,
      userSession: logData.userSession || 'system',
      actionType: logData.actionType || 'update',
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent
    };

    const [log] = await db.insert(logsKloading).values(logEntry).returning();
    console.log(`📝 System Log Created: ${logData.tableName}.${logData.fieldName} by user ${logData.userId}`);
    return log;
  }

  async getSystemLogs(limit: number = 100): Promise<any[]> {
    return await db.select()
      .from(logsKloading)
      .orderBy(desc(logsKloading.timestamp))
      .limit(limit);
  }

  async getSystemLogsByUser(userId: number, limit: number = 50): Promise<any[]> {
    const results = await db.select()
      .from(logsKloading)
      .where(eq(logsKloading.userId, userId))
      .orderBy(desc(logsKloading.timestamp))
      .limit(limit);
    
    // Map to frontend format
    return results.map(log => ({
      ...log,
      action: log.actionType, // Map actionType to action for frontend
      description: `${log.tableName} - ${log.fieldName}` // Simple description
    }));
  }

  async getSystemLogsByUserList(userIds: number[], limit: number = 100): Promise<any[]> {
    if (userIds.length === 0) return [];
    
    const { authUsers } = await import("@shared/schema");
    
    // Join with auth_users to get real user names
    const results = await db
      .select({
        id: logsKloading.id,
        tableName: logsKloading.tableName,
        recordId: logsKloading.recordId,
        fieldName: logsKloading.fieldName,
        oldValue: logsKloading.oldValue,
        newValue: logsKloading.newValue,
        userId: logsKloading.userId,
        userSession: logsKloading.userSession,
        userName: authUsers.fullName, // Use real name from auth_users
        actionType: logsKloading.actionType,
        timestamp: logsKloading.timestamp,
        ipAddress: logsKloading.ipAddress,
        userAgent: logsKloading.userAgent
      })
      .from(logsKloading)
      .leftJoin(authUsers, eq(logsKloading.userId, authUsers.id))
      .where(inArray(logsKloading.userId, userIds))
      .orderBy(desc(logsKloading.timestamp))
      .limit(limit);
    
    // Map to frontend format
    return results.map(log => ({
      ...log,
      action: log.actionType, // Map actionType to action for frontend
      description: `${log.tableName} - ${log.fieldName}` // Simple description
    }));
  }

  async getActivityLogs(limit: number = 100): Promise<any[]> {
    try {
      // Fallback to existing logs from logs_kloading table until activityLogs is properly set up
      const results = await db.execute(sql`
        SELECT 
          lk.id,
          lk.action_type as action,
          CONCAT(lk.table_name, ' - ', COALESCE(lk.field_name, 'general')) as description,
          lk.user_id as "userId",
          au.full_name as "userName",
          lk.timestamp,
          lk.ip_address as "ipAddress",
          lk.user_agent as "userAgent",
          lk.old_value as "oldValue",
          lk.new_value as "newValue",
          lk.table_name as "tableName",
          lk.field_name as "fieldName",
          lk.record_id as "recordId"
        FROM logs_kloading lk
        LEFT JOIN auth_users au ON lk.user_id = au.id
        WHERE lk.timestamp IS NOT NULL
        ORDER BY lk.timestamp DESC
        LIMIT ${limit}
      `);
      
      return results.rows.map((row: any) => ({
        id: row.id,
        action: row.action || 'unknown',
        description: row.description || 'Hoạt động hệ thống',
        userId: row.userId,
        userName: row.userName || 'Không xác định',
        timestamp: row.timestamp,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        oldValue: row.oldValue,
        newValue: row.newValue,
        tableName: row.tableName,
        fieldName: row.fieldName,
        recordId: row.recordId,
        metadata: {
          oldValue: row.oldValue,
          newValue: row.newValue,
          tableName: row.tableName,
          fieldName: row.fieldName,
          recordId: row.recordId
        }
      }));
    } catch (error) {
      console.error('Error getting activity logs:', error);
      return [];
    }
  }

  async getActivityLogsByUser(userId: number, limit: number = 50): Promise<any[]> {
    const { activityLogs } = await import("@shared/schema");
    return await db.select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  async getActivityLogsByUserList(userIds: number[], limit: number = 100): Promise<any[]> {
    // Temporarily disable activity logs due to schema mismatch
    return [];
  }

  async getLoginAttemptsByUser(userId: number, limit: number = 50): Promise<any[]> {
    const { authLoginAttempts, authUsers } = await import("@shared/schema");
    
    // Get user email first
    const user = await db.select().from(authUsers).where(eq(authUsers.id, userId)).limit(1);
    if (!user.length) return [];
    
    return await db.select({
      id: authLoginAttempts.id,
      tableName: sql`'auth_login_attempts'`.as('tableName'),
      recordId: sql`${userId}`.as('recordId'),
      fieldName: sql`CASE WHEN ${authLoginAttempts.successful} = true THEN 'đăng nhập thành công' ELSE 'đăng nhập thất bại' END`.as('fieldName'),
      oldValue: sql`null`.as('oldValue'),
      newValue: authLoginAttempts.email,
      userId: sql`${userId}`.as('userId'),
      userSession: sql`'login'`.as('userSession'),
      userName: sql`${user[0].fullName}`.as('userName'),
      actionType: sql`'login'`.as('actionType'),
      timestamp: authLoginAttempts.attemptAt,
      ipAddress: authLoginAttempts.ipAddress,
      userAgent: sql`'browser'`.as('userAgent')
    })
      .from(authLoginAttempts)
      .where(eq(authLoginAttempts.email, user[0].email))
      .orderBy(desc(authLoginAttempts.attemptAt))
      .limit(limit);
  }

  async getLoginAttemptsByUserList(userIds: number[], limit: number = 100): Promise<any[]> {
    if (userIds.length === 0) return [];
    
    const { authLoginAttempts, authUsers } = await import("@shared/schema");
    
    // Get all user emails
    const users = await db.select().from(authUsers).where(inArray(authUsers.id, userIds));
    if (!users.length) return [];
    
    const emails = users.map(u => u.email);
    
    // Join with users table to get proper user info and avoid subquery issues
    return await db
      .select({
        id: authLoginAttempts.id,
        tableName: sql`'auth_login_attempts'`.as('tableName'),
        recordId: authUsers.id,
        fieldName: sql`CASE WHEN ${authLoginAttempts.successful} = true THEN 'đăng nhập thành công' ELSE 'đăng nhập thất bại' END`.as('fieldName'),
        oldValue: sql`null`.as('oldValue'),
        newValue: authLoginAttempts.email,
        userId: authUsers.id,
        userSession: sql`'login'`.as('userSession'),
        userName: authUsers.fullName,
        actionType: sql`'login'`.as('actionType'),
        timestamp: authLoginAttempts.attemptAt,
        ipAddress: authLoginAttempts.ipAddress,
        userAgent: sql`'browser'`.as('userAgent')
      })
      .from(authLoginAttempts)
      .innerJoin(authUsers, eq(authLoginAttempts.email, authUsers.email))
      .where(inArray(authLoginAttempts.email, emails))
      .orderBy(desc(authLoginAttempts.attemptAt))
      .limit(limit);
  }

  async getEmployeeIdsByDirector(directorId: number): Promise<number[]> {
    // Get all employees created by this director
    const employees = await db.select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.createdBy, directorId));
    
    return employees.map(emp => emp.id);
  }

  async getSystemLogsByTable(tableName: string, limit: number = 50): Promise<any[]> {
    return await db.select()
      .from(logsKloading)
      .where(eq(logsKloading.tableName, tableName))
      .orderBy(desc(logsKloading.timestamp))
      .limit(limit);
  }

  // ============ USER-SPECIFIC SETTINGS ============

  async getUserSettings(userId: number): Promise<any> {
    try {
      // ✅ SETTINGS HIERARCHY FIX: Employees inherit director's settings
      // First check if this user is an employee
      const [user] = await db.select({ role: authUsers.role, createdBy: authUsers.createdBy })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .limit(1);

      if (user && user.role === 'employee' && user.createdBy) {
        // Employee: Use director's settings
        console.log(`👷 Employee ${userId} inheriting settings from Director ${user.createdBy}`);
        const [directorSettings] = await db.select()
          .from(userSettings)
          .where(eq(userSettings.userId, user.createdBy))
          .limit(1);

        if (directorSettings) {
          console.log(`✅ Found director settings:`, directorSettings);
          return directorSettings;
        } else {
          // Create default settings for director if none exist
          console.log(`🔧 Creating default settings for Director ${user.createdBy}`);
          const [newDirectorSettings] = await db.insert(userSettings)
            .values({ 
              userId: user.createdBy,
              statusOptions: ['Hoạt động', 'Tạm dừng', 'Không hoạt động', 'Bị khóa', 'Chờ duyệt'],
              noteCards: ['THẺ KAG', 'THẺ KHÁCH', 'THẺ HDG', 'NHIỀU BÊN'],
              bankSettings: [
                {code: 'ACB', name: 'Ngân hàng TMCP Á Châu', logo: 'acb'},
                {code: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', logo: 'vcb'},
                {code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', logo: 'bidv'},
                {code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', logo: 'tcb'},
                {code: 'LPB', name: 'Ngân hàng TMCP Bưu điện Liên Việt', logo: 'lpb'}
              ],
              accountSettings: [],
              partners: ['HDG', 'KAG', 'VSG'],
              ttExOptions: ['NO', 'YES', 'PENDING', 'EXPIRED'],
              currencyOptions: [
                {code: 'VND', symbol: '₫'},
                {code: 'USD', symbol: '$'},
                {code: 'EUR', symbol: '€'},
                {code: 'JPY', symbol: '¥'}
              ],
              currencySettings: {
                primaryCurrency: 'VND',
                secondaryCurrencies: [],
                exchangeRates: {},
                displayFormat: 'symbol',
                decimalPlaces: 0,
                thousandSeparator: ',',
                decimalSeparator: '.'
              }
            })
            .returning();
          return newDirectorSettings;
        }
      }

      // Director or other roles: Use own settings
      const [userSetting] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (!userSetting) {
        // Create default settings for new user
        console.log(`🔧 Creating default settings for user ${userId}`);
        const [newSettings] = await db.insert(userSettings)
          .values({ 
            userId,
            statusOptions: ['Hoạt động', 'Tạm dừng', 'Không hoạt động', 'Bị khóa', 'Chờ duyệt'],
            noteCards: ['THẺ KAG', 'THẺ KHÁCH', 'THẺ HDG', 'NHIỀU BÊN'],
            bankSettings: [
              {code: 'ACB', name: 'Ngân hàng TMCP Á Châu', logo: 'acb'},
              {code: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', logo: 'vcb'},
              {code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', logo: 'bidv'},
              {code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', logo: 'tcb'},
              {code: 'LPB', name: 'Ngân hàng TMCP Bưu điện Liên Việt', logo: 'lpb'}
            ],
            accountSettings: [],
            partners: ['HDG', 'KAG', 'VSG'],
            ttExOptions: ['NO', 'YES', 'PENDING', 'EXPIRED'],
            currencyOptions: [
              {code: 'VND', symbol: '₫'},
              {code: 'USD', symbol: '$'},
              {code: 'EUR', symbol: '€'},
              {code: 'JPY', symbol: '¥'}
            ],
            currencySettings: {
              primaryCurrency: 'VND',
              secondaryCurrencies: [],
              exchangeRates: {},
              displayFormat: 'symbol',
              decimalPlaces: 0,
              thousandSeparator: ',',
              decimalSeparator: '.'
            }
          })
          .returning();
        return newSettings;
      }

      return userSetting;
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(userId: number, settings: any): Promise<any> {
    try {
      // Check if user settings exist
      const existing = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing settings
        const [updated] = await db.update(userSettings)
          .set({
            ...settings,
            updatedAt: new Date()
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        // Create new settings
        const [created] = await db.insert(userSettings)
          .values({
            userId,
            ...settings
          })
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  async getUserStatsBadges(userId: number): Promise<any[]> {
    try {
      const badges = await db.select()
        .from(userStatsBadges)
        .where(eq(userStatsBadges.userId, userId))
        .orderBy(userStatsBadges.position);

      // Return default badges if none exist for user
      if (badges.length === 0) {
        const defaultBadges = [
          {
            name: 'Tổng TK',
            color: '#3B82F6',
            icon: 'CreditCard',
            query: 'SELECT COUNT(*) FROM ad_accounts WHERE user_id = ' + userId,
            enabled: true,
            position: 1
          },
          {
            name: 'Hoạt động',
            color: '#10B981',
            icon: 'Activity',
            query: `SELECT COUNT(*) FROM ad_accounts WHERE user_id = ${userId} AND status = 'Hoạt động'`,
            enabled: true,
            position: 2
          },
          {
            name: 'Tạm dừng',
            color: '#F59E0B',
            icon: 'Pause',
            query: `SELECT COUNT(*) FROM ad_accounts WHERE user_id = ${userId} AND status = 'Tạm dừng'`,
            enabled: true,
            position: 3
          }
        ];

        // Create default badges for user
        for (const badge of defaultBadges) {
          await db.insert(userStatsBadges)
            .values({
              userId,
              ...badge
            });
        }

        return defaultBadges;
      }

      return badges;
    } catch (error) {
      console.error('Error getting user stats badges:', error);
      return [];
    }
  }

  async createUserStatsBadge(userId: number, badge: any): Promise<any> {
    try {
      const [created] = await db.insert(userStatsBadges)
        .values({
          userId,
          ...badge
        })
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating user stats badge:', error);
      throw error;
    }
  }

  async updateUserStatsBadge(id: number, badge: any): Promise<any> {
    try {
      const [updated] = await db.update(userStatsBadges)
        .set({
          ...badge,
          updatedAt: new Date()
        })
        .where(eq(userStatsBadges.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating user stats badge:', error);
      throw error;
    }
  }

  async deleteUserStatsBadge(id: number): Promise<void> {
    try {
      await db.delete(userStatsBadges)
        .where(eq(userStatsBadges.id, id));
    } catch (error) {
      console.error('Error deleting user stats badge:', error);
      throw error;
    }
  }

  // Employee Permission Methods
  async getEmployeePermissions(employeeId: number): Promise<any[]> {
    try {
      const permissions = await db.select()
        .from(employeePermissions)
        .where(eq(employeePermissions.employeeId, employeeId));
      return permissions;
    } catch (error) {
      console.error('Error getting employee permissions:', error);
      return [];
    }
  }

  async setEmployeePermission(employeeId: number, tabName: string, permission: string): Promise<any> {
    try {
      const [result] = await db.insert(employeePermissions)
        .values({
          employeeId,
          tabName,
          permission,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [employeePermissions.employeeId, employeePermissions.tabName],
          set: {
            permission,
            updatedAt: new Date()
          }
        })
        .returning();
      return result;
    } catch (error) {
      console.error('Error setting employee permission:', error);
      throw error;
    }
  }

  async batchSetEmployeePermissions(employeeId: number, permissions: { tabName: string, permission: string }[]): Promise<void> {
    try {
      for (const perm of permissions) {
        await this.setEmployeePermission(employeeId, perm.tabName, perm.permission);
      }
    } catch (error) {
      console.error('Error batch setting employee permissions:', error);
      throw error;
    }
  }
  

  
  // Main account changes tracking method with anti-infinite-loop protection
  async getAccountChanges(since: string, sessionId: string, userId: number): Promise<any[]> {
    try {
      const sinceDate = new Date(since);
      
      // Get effective user ID for hierarchical access
      const effectiveUserId = await this.getEffectiveUserId(userId);
      
      console.log(`🔍 Getting account changes for userId=${userId}, effectiveUserId=${effectiveUserId}, since=${since}, sessionId=${sessionId}`);
      
      // Query 1: Regular changes with normal time filter  
      const regularChanges = await db.select()
        .from(accountChanges)
        .where(and(
          gt(accountChanges.createdAt, sinceDate),
          eq(accountChanges.userId, effectiveUserId?.toString() || userId.toString()),
          ne(accountChanges.field, 'NEW_ACCOUNT'), // Exclude NEW_ACCOUNT from regular query
          ne(accountChanges.sessionId, sessionId)  // Regular changes exclude own session
        ))
        .orderBy(accountChanges.createdAt);
      
      // Query 2: NEW_ACCOUNT events with 5-minute window for cross-machine detection
      const newAccountWindowDate = new Date(Date.now() - 5 * 60 * 1000); // 5-minute window for cross-machine sync
      const unprocessedNewAccountChanges = await db
        .select({
          id: accountChanges.id,
          accountId: accountChanges.accountId,
          row: accountChanges.row,
          col: accountChanges.col,
          field: accountChanges.field,
          oldValue: accountChanges.oldValue,
          newValue: accountChanges.newValue,
          sessionId: accountChanges.sessionId,
          userId: accountChanges.userId,
          createdAt: accountChanges.createdAt
        })
        .from(accountChanges)
        .leftJoin(processedEvents, and(
          eq(processedEvents.sessionId, sessionId),
          eq(processedEvents.eventType, 'NEW_ACCOUNT'),
          eq(processedEvents.eventId, accountChanges.id)
        ))
        .where(and(
          gt(accountChanges.createdAt, newAccountWindowDate), // 5-minute window for NEW_ACCOUNT
          eq(accountChanges.userId, effectiveUserId?.toString() || userId.toString()),
          eq(accountChanges.field, 'NEW_ACCOUNT'), // Only NEW_ACCOUNT events
          ne(accountChanges.sessionId, sessionId), // Exclude own session
          isNull(processedEvents.id) // Only unprocessed events
        ))
        .orderBy(accountChanges.createdAt);

      // Mark NEW_ACCOUNT events as processed to prevent infinite loops
      if (unprocessedNewAccountChanges.length > 0) {
        const processedEventRecords = unprocessedNewAccountChanges.map(change => ({
          sessionId: sessionId,
          eventType: 'NEW_ACCOUNT',
          eventId: change.id
        }));
        
        await db.insert(processedEvents).values(processedEventRecords).onConflictDoNothing();
        console.log(`🔄 MARKED ${unprocessedNewAccountChanges.length} NEW_ACCOUNT events as processed for session ${sessionId}`);
      }
      
      // Combine results
      const allChanges = [...regularChanges, ...unprocessedNewAccountChanges];
      
      console.log(`📝 Found ${regularChanges.length} regular changes + ${unprocessedNewAccountChanges.length} NEW_ACCOUNT changes (5min window) = ${allChanges.length} total`);
      
      // Debug logging for NEW_ACCOUNT detection
      if (unprocessedNewAccountChanges.length > 0) {
        console.log(`🆕 UNPROCESSED NEW_ACCOUNT changes (5min window):`, unprocessedNewAccountChanges.map(c => ({
          accountId: c.accountId,
          timestamp: c.createdAt,
          sessionId: c.sessionId,
          ageMinutes: Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000)
        })));
      }
      
      return allChanges.map(change => ({
        accountId: change.accountId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        timestamp: change.createdAt,
        sessionId: change.sessionId // Include for debugging
      }));
    } catch (error) {
      console.error('Error getting account changes:', error);
      return [];
    }
  }



  async saveAccountExpense(expense: InsertAccountExpense & { userId: number }): Promise<AccountExpense> {
    console.log(`💾 SAVING ACCOUNT EXPENSE:`, expense);
    
    try {
      // Check if expense already exists (upsert logic)
      const existing = await db
        .select()
        .from(accountExpenses)
        .where(
          and(
            eq(accountExpenses.userId, expense.userId),
            eq(accountExpenses.accountId, expense.accountId),
            eq(accountExpenses.clientId, expense.clientId),
            eq(accountExpenses.month, expense.month),
            eq(accountExpenses.year, expense.year)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(accountExpenses)
          .set({
            amount: expense.amount,
            description: expense.description,
            // category field removed - not in schema
            updatedAt: new Date(),
          })
          .where(eq(accountExpenses.id, existing[0].id))
          .returning();

        console.log(`✅ UPDATED EXISTING EXPENSE: ID=${updated.id}`);
        return updated;
      } else {
        // Create new
        const [created] = await db
          .insert(accountExpenses)
          .values(expense)
          .returning();

        console.log(`✅ CREATED NEW EXPENSE: ID=${created.id}`);
        return created;
      }
    } catch (error) {
      console.error('❌ SAVE ACCOUNT EXPENSE ERROR:', error);
      throw error;
    }
  }

  async deleteAccountExpense(userId: number, accountId: number, clientId: number, month: number, year: number): Promise<boolean> {
    console.log(`🗑️ DELETING ACCOUNT EXPENSE: User=${userId}, Account=${accountId}, Client=${clientId}, Month=${month}, Year=${year}`);
    
    try {
      const result = await db
        .delete(accountExpenses)
        .where(
          and(
            eq(accountExpenses.userId, userId),
            eq(accountExpenses.accountId, accountId),
            eq(accountExpenses.clientId, clientId),
            eq(accountExpenses.month, month),
            eq(accountExpenses.year, year)
          )
        );

      console.log(`✅ DELETED ACCOUNT EXPENSE: Affected rows=${result.rowCount || 0}`);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('❌ DELETE ACCOUNT EXPENSE ERROR:', error);
      throw error;
    }
  }

  // Fee Changes methods
  async getClientAccountsByClient(clientId: number): Promise<ClientAccount[]> {
    return await db.select().from(clientAccounts)
      .where(eq(clientAccounts.clientId, clientId));
  }

  async updateClientAccountsPercentage(clientId: number, newPercentage: string): Promise<void> {
    // Check if client has any account assignments
    const existingAccounts = await db.select().from(clientAccounts).where(eq(clientAccounts.clientId, clientId));
    
    if (existingAccounts.length > 0) {
      // Update existing records
      await db.update(clientAccounts)
        .set({ rentalPercentage: newPercentage })
        .where(eq(clientAccounts.clientId, clientId));
      console.log(`✅ Updated ${existingAccounts.length} client account records with new percentage: ${newPercentage}%`);
    } else {
      // No client accounts exist, just log this (percentage will be shown from fee_changes history)
      console.log(`ℹ️ No client accounts found for client ${clientId}, percentage stored in fee_changes only`);
    }
  }

  async createFeeChange(feeChange: any): Promise<any> {
    const [result] = await db.insert(feeChanges)
      .values(feeChange)
      .returning();
    return result;
  }

  async getFeeChangesByClient(clientId: number, userId?: number): Promise<any[]> {
    if (userId) {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      return await db.select()
        .from(feeChanges)
        .where(and(
          eq(feeChanges.clientId, clientId),
          eq(feeChanges.userId, effectiveUserId!)
        ))
        .orderBy(desc(feeChanges.createdAt));
    } else {
      // Fallback for single-parameter call
      return await db.select()
        .from(feeChanges)
        .where(eq(feeChanges.clientId, clientId))
        .orderBy(desc(feeChanges.createdAt));
    }
  }

  async getFeeChangeById(id: number): Promise<any | undefined> {
    const [result] = await db.select()
      .from(feeChanges)
      .where(eq(feeChanges.id, id))
      .limit(1);
    return result;
  }

  async deleteFeeChange(id: number): Promise<void> {
    await db.delete(feeChanges).where(eq(feeChanges.id, id));
  }

  async getFeeChangesByClientOld(clientId: number): Promise<any[]> {
    return await db.select().from(feeChanges)
      .where(eq(feeChanges.clientId, clientId))
      .orderBy(desc(feeChanges.createdAt));
  }

  async getLatestFeeChangeByClient(clientId: number): Promise<any | null> {
    const [result] = await db.select().from(feeChanges)
      .where(and(eq(feeChanges.clientId, clientId), eq(feeChanges.status, 'active')))
      .orderBy(desc(feeChanges.createdAt))
      .limit(1);
    return result || null;
  }

  // ================ EXPENSE VISIBLE ACCOUNTS METHODS ================
  
  async getExpenseVisibleAccounts(userId: number, month: number, year: number): Promise<ExpenseVisibleAccount[]> {
    try {
      console.log(`🔍 FETCHING VISIBLE ACCOUNTS: UserId=${userId}, Month=${month}, Year=${year}`);
      
      const visibleAccounts = await db.select({
        id: expenseVisibleAccounts.id,
        userId: expenseVisibleAccounts.userId,
        accountId: expenseVisibleAccounts.accountId,
        month: expenseVisibleAccounts.month,
        year: expenseVisibleAccounts.year,
        createdAt: expenseVisibleAccounts.createdAt,
        updatedAt: expenseVisibleAccounts.updatedAt,
      })
        .from(expenseVisibleAccounts)
        .where(and(
          eq(expenseVisibleAccounts.userId, userId),
          eq(expenseVisibleAccounts.month, month),
          eq(expenseVisibleAccounts.year, year)
        ));
      
      console.log(`📊 FOUND ${visibleAccounts.length} VISIBLE ACCOUNTS FOR ${month}/${year}`);
      return visibleAccounts;
    } catch (error) {
      console.error('❌ GET VISIBLE ACCOUNTS ERROR:', error);
      throw error;
    }
  }

  async saveExpenseVisibleAccounts(userId: number, accountIds: number[], month: number, year: number): Promise<ExpenseVisibleAccount[]> {
    try {
      console.log(`💾 SAVING VISIBLE ACCOUNTS: User=${userId}, Month=${month}, Year=${year}, Accounts=${accountIds.length}`);
      
      // Clear existing visible accounts for this user/month/year
      console.log(`🗑️ CLEARING VISIBLE ACCOUNTS: UserId=${userId}, Month=${month}, Year=${year}`);
      const deleteResult = await db.delete(expenseVisibleAccounts)
        .where(and(
          eq(expenseVisibleAccounts.userId, userId),
          eq(expenseVisibleAccounts.month, month),
          eq(expenseVisibleAccounts.year, year)
        ));
      console.log(`✅ CLEARED VISIBLE ACCOUNTS: Deleted=${deleteResult.rowCount || 0}`);
      
      // Insert new visible accounts
      if (accountIds.length > 0) {
        console.log(`💾 SAVING ${accountIds.length} VISIBLE ACCOUNTS: UserId=${userId}, Month=${month}, Year=${year}`);
        const insertData = accountIds.map(accountId => ({
          userId,
          accountId,
          month,
          year,
        }));
        
        const savedAccounts = await db.insert(expenseVisibleAccounts)
          .values(insertData)
          .returning();
        
        console.log(`✅ SAVED ${savedAccounts.length} VISIBLE ACCOUNTS FOR ${month}/${year}`);
        return savedAccounts;
      }
      
      console.log(`✅ NO ACCOUNTS TO SAVE - CLEARED ALL FOR ${month}/${year}`);
      return [];
    } catch (error) {
      console.error('❌ SAVE VISIBLE ACCOUNTS ERROR:', error);
      throw error;
    }
  }

  // Removed duplicate implementation - using the simplified version below

  async addAllAccountsWithExpenses(userId: number, month: number, year: number): Promise<ExpenseVisibleAccount[]> {
    try {
      console.log(`🔍 FINDING ACCOUNTS WITH EXPENSES: Month=${month}, Year=${year}`);
      
      // Get all accounts that have expenses in the specified month/year
      const accountsWithExpenses = await db
        .selectDistinct({ accountId: accountExpenses.accountId })
        .from(accountExpenses)
        .where(and(
          eq(accountExpenses.month, month),
          eq(accountExpenses.year, year),
          eq(accountExpenses.userId, userId)
        ));

      const accountIds = accountsWithExpenses.map(a => a.accountId);
      console.log(`📊 FOUND ${accountIds.length} ACCOUNTS WITH EXPENSES`);

      if (accountIds.length > 0) {
        return await this.saveExpenseVisibleAccounts(userId, accountIds, month, year);
      }

      return [];
    } catch (error) {
      console.error('❌ ADD ACCOUNTS WITH EXPENSES ERROR:', error);
      throw error;
    }
  }

  async removeInactiveAccounts(userId: number, monthsThreshold: number = 2): Promise<{ removed: number }> {
    try {
      console.log(`🔍 FINDING INACTIVE ACCOUNTS: Threshold=${monthsThreshold} months`);
      
      const currentDate = new Date();
      const thresholdDate = new Date(currentDate);
      thresholdDate.setMonth(thresholdDate.getMonth() - monthsThreshold);
      
      // Get accounts that haven't had expenses in the last X months
      const recentExpenses = await db
        .selectDistinct({ accountId: accountExpenses.accountId })
        .from(accountExpenses)
        .where(and(
          eq(accountExpenses.userId, userId),
          gte(accountExpenses.createdAt, thresholdDate)
        ));

      const activeAccountIds = new Set(recentExpenses.map(e => e.accountId));
      
      // Remove inactive accounts from all months
      const deleteResult = await db.delete(expenseVisibleAccounts)
        .where(and(
          eq(expenseVisibleAccounts.userId, userId),
          inArray(expenseVisibleAccounts.accountId, 
            Array.from(activeAccountIds).length > 0 ? 
            sql`(SELECT account_id FROM expense_visible_accounts WHERE user_id = ${userId} AND account_id NOT IN (${sql.join(Array.from(activeAccountIds), sql`, `)}))` :
            sql`(SELECT account_id FROM expense_visible_accounts WHERE user_id = ${userId})`
          )
        ));

      const removedCount = deleteResult.rowCount || 0;
      console.log(`✅ REMOVED ${removedCount} INACTIVE ACCOUNTS`);
      
      return { removed: removedCount };
    } catch (error) {
      console.error('❌ REMOVE INACTIVE ACCOUNTS ERROR:', error);
      throw error;
    }
  }

  async clearExpenseVisibleAccounts(userId: number): Promise<void> {
    try {
      console.log(`🗑️ CLEARING VISIBLE ACCOUNTS: UserId=${userId}`);
      
      const result = await db.delete(expenseVisibleAccounts)
        .where(eq(expenseVisibleAccounts.userId, userId));
      
      console.log(`✅ CLEARED VISIBLE ACCOUNTS: Deleted=${result.rowCount || 0}`);
    } catch (error) {
      console.error('❌ CLEAR VISIBLE ACCOUNTS ERROR:', error);
      throw error;
    }
  }

  // Via Management methods
  async getViaManagement(userId: number): Promise<ViaManagement[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      console.log(`📋 VIA MANAGEMENT: Retrieved vias for user ${effectiveUserId || userId} (original: ${userId})`);
      
      const vias = await db.select()
        .from(viaManagement)
        .where(eq(viaManagement.userId, effectiveUserId || userId))
        .orderBy(viaManagement.createdAt);
      
      return vias;
    } catch (error) {
      console.error('❌ GET VIA MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async createViaManagement(via: InsertViaManagement): Promise<ViaManagement> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(via.userId);
      const viaToCreate = { ...via, userId: effectiveUserId || via.userId };
      
      console.log(`✅ VIA MANAGEMENT: Creating via for user ${viaToCreate.userId} (original: ${via.userId})`);
      
      const [newVia] = await db.insert(viaManagement)
        .values(viaToCreate)
        .returning();
      
      return newVia;
    } catch (error) {
      console.error('❌ CREATE VIA MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async updateViaManagement(id: number, via: Partial<InsertViaManagement>): Promise<ViaManagement> {
    try {
      console.log(`🔄 VIA MANAGEMENT: Updating via ${id}`);
      
      const [updatedVia] = await db.update(viaManagement)
        .set({ ...via, updatedAt: sql`NOW()` })
        .where(eq(viaManagement.id, id))
        .returning();
      
      return updatedVia;
    } catch (error) {
      console.error('❌ UPDATE VIA MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async deleteViaManagement(id: number): Promise<void> {
    try {
      console.log(`🗑️ VIA MANAGEMENT: Deleting via ${id}`);
      
      await db.delete(viaManagement)
        .where(eq(viaManagement.id, id));
      
    } catch (error) {
      console.error('❌ DELETE VIA MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async createViaManagementChange(change: InsertViaManagementChange): Promise<ViaManagementChange> {
    try {
      const [newChange] = await db.insert(viaManagementChanges)
        .values(change)
        .returning();
      
      return newChange;
    } catch (error) {
      console.error('❌ CREATE VIA MANAGEMENT CHANGE ERROR:', error);
      throw error;
    }
  }

  async getViaManagementChanges(since: string, sessionId: string, userId: number): Promise<ViaManagementChange[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      const sinceDate = new Date(since);
      
      const changes = await db.select()
        .from(viaManagementChanges)
        .where(and(
          eq(viaManagementChanges.userId, effectiveUserId || userId),
          gte(viaManagementChanges.createdAt, sinceDate),
          ne(viaManagementChanges.sessionId, sessionId)
        ))
        .orderBy(viaManagementChanges.createdAt);
      
      return changes;
    } catch (error) {
      console.error('❌ GET VIA MANAGEMENT CHANGES ERROR:', error);
      throw error;
    }
  }

  // Card Management methods
  async getCardManagement(userId: number): Promise<CardManagement[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      console.log(`📋 CARD MANAGEMENT: Retrieved cards for user ${effectiveUserId || userId} (original: ${userId})`);
      
      const cards = await db.select()
        .from(cardManagement)
        .where(eq(cardManagement.userId, effectiveUserId || userId))
        .orderBy(cardManagement.createdAt);
      
      return cards;
    } catch (error) {
      console.error('❌ GET CARD MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async createCardManagement(card: InsertCardManagement): Promise<CardManagement> {
    try {
      const [newCard] = await db.insert(cardManagement)
        .values(card)
        .returning();
      
      console.log(`✅ CARD MANAGEMENT: Created card ${newCard.id} for user ${card.userId}`);
      return newCard;
    } catch (error) {
      console.error('❌ CREATE CARD MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async updateCardManagement(id: number, card: Partial<InsertCardManagement>): Promise<CardManagement> {
    try {
      const [updatedCard] = await db.update(cardManagement)
        .set({ ...card, updatedAt: new Date() })
        .where(eq(cardManagement.id, id))
        .returning();
      
      if (!updatedCard) {
        throw new Error(`Card with id ${id} not found`);
      }
      
      console.log(`✅ CARD MANAGEMENT: Updated card ${id}`);
      return updatedCard;
    } catch (error) {
      console.error('❌ UPDATE CARD MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async deleteCardManagement(id: number): Promise<void> {
    try {
      await db.delete(cardManagement)
        .where(eq(cardManagement.id, id));
      
      console.log(`✅ CARD MANAGEMENT: Deleted card ${id}`);
    } catch (error) {
      console.error('❌ DELETE CARD MANAGEMENT ERROR:', error);
      throw error;
    }
  }

  async createCardManagementChange(change: InsertCardManagementChange): Promise<CardManagementChange> {
    try {
      const [newChange] = await db.insert(cardManagementChanges)
        .values(change)
        .returning();
      
      return newChange;
    } catch (error) {
      console.error('❌ CREATE CARD MANAGEMENT CHANGE ERROR:', error);
      throw error;
    }
  }

  async getCardManagementChanges(since: string, sessionId: string, userId: number): Promise<CardManagementChange[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      const sinceDate = new Date(since);
      
      const changes = await db.select()
        .from(cardManagementChanges)
        .where(and(
          eq(cardManagementChanges.userId, effectiveUserId || userId),
          gte(cardManagementChanges.createdAt, sinceDate),
          ne(cardManagementChanges.sessionId, sessionId)
        ))
        .orderBy(cardManagementChanges.createdAt);
      
      return changes;
    } catch (error) {
      console.error('❌ GET CARD MANAGEMENT CHANGES ERROR:', error);
      throw error;
    }
  }

  // ========================================================================
  // TIME TRACKING & PAYROLL IMPLEMENTATION METHODS
  // ========================================================================

  // Attendance Management
  async getAttendanceRecords(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<Attendance[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(attendance).where(eq(attendance.userId, effectiveUserId || userId));
      
      if (filters?.month && filters?.year) {
        query = query.where(and(
          eq(attendance.userId, effectiveUserId || userId),
          sql`EXTRACT(MONTH FROM ${attendance.date}) = ${filters.month}`,
          sql`EXTRACT(YEAR FROM ${attendance.date}) = ${filters.year}`
        ));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(attendance.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(desc(attendance.date));
    } catch (error) {
      console.error('❌ GET ATTENDANCE RECORDS ERROR:', error);
      throw error;
    }
  }

  async clockInOut(employeeId: number, userId: number, data: { type: 'in' | 'out'; location?: string; notes?: string; ipAddress?: string; deviceInfo?: string }): Promise<Attendance> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find today's attendance record
      const [existingRecord] = await db.select()
        .from(attendance)
        .where(and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, today)
        ))
        .limit(1);
      
      if (data.type === 'in') {
        if (existingRecord) {
          // Update clock in time
          const [updated] = await db.update(attendance)
            .set({
              clockIn: new Date(),
              location: data.location,
              notes: data.notes,
              ipAddress: data.ipAddress,
              deviceInfo: data.deviceInfo
            })
            .where(eq(attendance.id, existingRecord.id))
            .returning();
          return updated;
        } else {
          // Create new attendance record
          const [newRecord] = await db.insert(attendance)
            .values({
              employeeId,
              userId,
              date: new Date(),
              clockIn: new Date(),
              location: data.location,
              notes: data.notes,
              ipAddress: data.ipAddress,
              deviceInfo: data.deviceInfo
            })
            .returning();
          return newRecord;
        }
      } else {
        // Clock out
        if (!existingRecord) {
          throw new Error('Không tìm thấy bản ghi chấm công để kết thúc ca');
        }
        
        const clockOut = new Date();
        const clockIn = existingRecord.clockIn;
        const totalHours = clockIn ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0;
        
        const [updated] = await db.update(attendance)
          .set({
            clockOut,
            totalHours: totalHours.toString(),
            notes: data.notes || existingRecord.notes
          })
          .where(eq(attendance.id, existingRecord.id))
          .returning();
        return updated;
      }
    } catch (error) {
      console.error('❌ CLOCK IN/OUT ERROR:', error);
      throw error;
    }
  }

  async updateAttendanceRecord(id: number, userId: number, updates: Partial<InsertAttendance>): Promise<Attendance> {
    try {
      const [updated] = await db.update(attendance)
        .set(updates)
        .where(and(
          eq(attendance.id, id),
          eq(attendance.userId, userId)
        ))
        .returning();
      
      if (!updated) {
        throw new Error('Không tìm thấy bản ghi chấm công để cập nhật');
      }
      
      return updated;
    } catch (error) {
      console.error('❌ UPDATE ATTENDANCE RECORD ERROR:', error);
      throw error;
    }
  }

  // Payroll Management
  async getPayrollRecords(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<Payroll[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(payroll).where(eq(payroll.userId, effectiveUserId || userId));
      
      if (filters?.month) {
        query = query.where(eq(payroll.month, filters.month));
      }
      
      if (filters?.year) {
        query = query.where(eq(payroll.year, filters.year));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(payroll.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(desc(payroll.year), desc(payroll.month));
    } catch (error) {
      console.error('❌ GET PAYROLL RECORDS ERROR:', error);
      throw error;
    }
  }

  async calculatePayroll(userId: number, data: { month: number; year: number; employeeIds?: number[] }): Promise<Payroll[]> {
    try {
      // This is a placeholder implementation
      // Real implementation would calculate based on attendance, performance, etc.
      const results: Payroll[] = [];
      
      console.log(`📊 Calculating payroll for ${data.month}/${data.year}`);
      // Actual calculation logic would go here
      
      return results;
    } catch (error) {
      console.error('❌ CALCULATE PAYROLL ERROR:', error);
      throw error;
    }
  }

  async approvePayroll(id: number, approverId: number, notes?: string): Promise<Payroll> {
    try {
      const [updated] = await db.update(payroll)
        .set({
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date(),
          notes
        })
        .where(eq(payroll.id, id))
        .returning();
      
      if (!updated) {
        throw new Error('Không tìm thấy bản ghi lương để duyệt');
      }
      
      return updated;
    } catch (error) {
      console.error('❌ APPROVE PAYROLL ERROR:', error);
      throw error;
    }
  }

  // Leave Requests Management
  async getLeaveRequests(userId: number, filters?: { status?: string; employeeId?: number }): Promise<LeaveRequest[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(leaveRequests).where(eq(leaveRequests.userId, effectiveUserId || userId));
      
      if (filters?.status) {
        query = query.where(eq(leaveRequests.status, filters.status));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(leaveRequests.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(desc(leaveRequests.createdAt));
    } catch (error) {
      console.error('❌ GET LEAVE REQUESTS ERROR:', error);
      throw error;
    }
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    try {
      const [newRequest] = await db.insert(leaveRequests)
        .values(request)
        .returning();
      
      return newRequest;
    } catch (error) {
      console.error('❌ CREATE LEAVE REQUEST ERROR:', error);
      throw error;
    }
  }

  async approveLeaveRequest(id: number, approverId: number, status: string, notes?: string): Promise<LeaveRequest> {
    try {
      const [updated] = await db.update(leaveRequests)
        .set({
          status,
          approvedBy: approverId,
          approvedAt: new Date(),
          approvalNotes: notes
        })
        .where(eq(leaveRequests.id, id))
        .returning();
      
      if (!updated) {
        throw new Error('Không tìm thấy đơn xin nghỉ để duyệt');
      }
      
      return updated;
    } catch (error) {
      console.error('❌ APPROVE LEAVE REQUEST ERROR:', error);
      throw error;
    }
  }

  // Performance Metrics
  async getPerformanceMetrics(userId: number, filters?: { month?: number; year?: number; employeeId?: number }): Promise<PerformanceMetric[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(performanceMetrics).where(eq(performanceMetrics.userId, effectiveUserId || userId));
      
      if (filters?.month) {
        query = query.where(eq(performanceMetrics.month, filters.month));
      }
      
      if (filters?.year) {
        query = query.where(eq(performanceMetrics.year, filters.year));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(performanceMetrics.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(desc(performanceMetrics.year), desc(performanceMetrics.month));
    } catch (error) {
      console.error('❌ GET PERFORMANCE METRICS ERROR:', error);
      throw error;
    }
  }

  async updatePerformanceMetric(id: number, userId: number, updates: Partial<InsertPerformanceMetric>): Promise<PerformanceMetric> {
    try {
      const [updated] = await db.update(performanceMetrics)
        .set(updates)
        .where(and(
          eq(performanceMetrics.id, id),
          eq(performanceMetrics.userId, userId)
        ))
        .returning();
      
      if (!updated) {
        throw new Error('Không tìm thấy thống kê hiệu suất để cập nhật');
      }
      
      return updated;
    } catch (error) {
      console.error('❌ UPDATE PERFORMANCE METRIC ERROR:', error);
      throw error;
    }
  }

  // Salary Bonuses
  async getSalaryBonuses(userId: number, filters?: { month?: number; year?: number; bonusType?: string; employeeId?: number }): Promise<SalaryBonus[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(salaryBonuses).where(eq(salaryBonuses.userId, effectiveUserId || userId));
      
      if (filters?.month) {
        query = query.where(eq(salaryBonuses.month, filters.month));
      }
      
      if (filters?.year) {
        query = query.where(eq(salaryBonuses.year, filters.year));
      }
      
      if (filters?.bonusType) {
        query = query.where(eq(salaryBonuses.bonusType, filters.bonusType));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(salaryBonuses.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(desc(salaryBonuses.year), desc(salaryBonuses.month));
    } catch (error) {
      console.error('❌ GET SALARY BONUSES ERROR:', error);
      throw error;
    }
  }

  async calculateBonuses(userId: number, data: { month: number; year: number; bonusType?: string }): Promise<SalaryBonus[]> {
    try {
      // This is a placeholder implementation
      // Real implementation would calculate bonuses based on revenue, performance, etc.
      const results: SalaryBonus[] = [];
      
      console.log(`💰 Calculating bonuses for ${data.month}/${data.year}, type: ${data.bonusType || 'all'}`);
      // Actual calculation logic would go here
      
      return results;
    } catch (error) {
      console.error('❌ CALCULATE BONUSES ERROR:', error);
      throw error;
    }
  }

  // Shift Schedules
  async getShiftSchedules(userId: number, filters?: { startDate?: string; endDate?: string; employeeId?: number }): Promise<ShiftSchedule[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(shiftSchedules).where(eq(shiftSchedules.userId, effectiveUserId || userId));
      
      if (filters?.startDate) {
        query = query.where(gte(shiftSchedules.shiftDate, new Date(filters.startDate)));
      }
      
      if (filters?.endDate) {
        query = query.where(lte(shiftSchedules.shiftDate, new Date(filters.endDate)));
      }
      
      if (filters?.employeeId) {
        query = query.where(eq(shiftSchedules.employeeId, filters.employeeId));
      }
      
      return await query.orderBy(shiftSchedules.shiftDate);
    } catch (error) {
      console.error('❌ GET SHIFT SCHEDULES ERROR:', error);
      throw error;
    }
  }

  async createShiftSchedule(schedule: InsertShiftSchedule): Promise<ShiftSchedule> {
    try {
      const [newSchedule] = await db.insert(shiftSchedules)
        .values(schedule)
        .returning();
      
      return newSchedule;
    } catch (error) {
      console.error('❌ CREATE SHIFT SCHEDULE ERROR:', error);
      throw error;
    }
  }

  // Monthly Revenues
  async getMonthlyRevenues(userId: number, filters?: { year?: number }): Promise<MonthlyRevenue[]> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      let query = db.select().from(monthlyRevenues).where(eq(monthlyRevenues.userId, effectiveUserId || userId));
      
      if (filters?.year) {
        query = query.where(eq(monthlyRevenues.year, filters.year));
      }
      
      return await query.orderBy(desc(monthlyRevenues.year), desc(monthlyRevenues.month));
    } catch (error) {
      console.error('❌ GET MONTHLY REVENUES ERROR:', error);
      throw error;
    }
  }

  async updateMonthlyRevenue(id: number, userId: number, updates: Partial<InsertMonthlyRevenue>): Promise<MonthlyRevenue> {
    try {
      const [updated] = await db.update(monthlyRevenues)
        .set(updates)
        .where(and(
          eq(monthlyRevenues.id, id),
          eq(monthlyRevenues.userId, userId)
        ))
        .returning();
      
      if (!updated) {
        throw new Error('Không tìm thấy doanh thu tháng để cập nhật');
      }
      
      return updated;
    } catch (error) {
      console.error('❌ UPDATE MONTHLY REVENUE ERROR:', error);
      throw error;
    }
  }

  // Dashboard & Statistics
  async getTimeTrackingDashboard(userId: number, filters: { month: number; year: number }): Promise<any> {
    try {
      const effectiveUserId = await this.getEffectiveUserId(userId);
      
      // Get basic stats for the dashboard
      const stats = {
        totalEmployees: 0,
        activeToday: 0,
        totalPayroll: 0,
        totalBonuses: 0,
        attendanceRate: 0,
        avgWorkHours: 0
      };
      
      console.log(`📊 Getting time tracking dashboard for ${filters.month}/${filters.year}`);
      
      // Actual dashboard calculation logic would go here
      // This would involve querying attendance, payroll, performance tables
      
      return stats;
    } catch (error) {
      console.error('❌ GET TIME TRACKING DASHBOARD ERROR:', error);
      throw error;
    }
  }

  // ===== EMAIL MANAGEMENT METHODS =====
  
  async createEmailAccount(data: any): Promise<any> {
    const { emailAccounts } = await import("@shared/schema");
    const [account] = await db.insert(emailAccounts).values(data).returning();
    console.log(`📧 Created email account: ${account.emailAddress}`);
    return account;
  }

  async getEmailAccountsByUser(userId: number): Promise<any[]> {
    const { emailAccounts } = await import("@shared/schema");
    const accounts = await db.select()
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, userId))
      .orderBy(emailAccounts.createdAt);
    
    console.log(`📧 Found ${accounts.length} email accounts for user ${userId}`);
    return accounts;
  }

  async getEmailAccountById(id: number): Promise<any | null> {
    const { emailAccounts } = await import("@shared/schema");
    const [account] = await db.select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, id));
    
    return account || null;
  }

  async updateEmailAccount(id: number, data: any): Promise<any> {
    const { emailAccounts } = await import("@shared/schema");
    const [account] = await db.update(emailAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailAccounts.id, id))
      .returning();
    
    console.log(`📧 Updated email account: ${account.emailAddress}`);
    return account;
  }

  async deleteEmailAccount(id: number): Promise<void> {
    const { emailAccounts, emailMessages, emailFolders } = await import("@shared/schema");
    // Delete related data first
    await db.delete(emailMessages).where(eq(emailMessages.accountId, id));
    await db.delete(emailFolders).where(eq(emailFolders.accountId, id));
    await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
    
    console.log(`📧 Deleted email account with ID: ${id}`);
  }

  async createEmailFolder(data: any): Promise<any> {
    const { emailFolders } = await import("@shared/schema");
    const [folder] = await db.insert(emailFolders).values(data).returning();
    console.log(`📁 Created email folder: ${folder.folderName}`);
    return folder;
  }

  async getEmailFoldersByAccount(accountId: number): Promise<any[]> {
    const { emailFolders } = await import("@shared/schema");
    const folders = await db.select()
      .from(emailFolders)
      .where(eq(emailFolders.accountId, accountId))
      .orderBy(emailFolders.folderName);
    
    return folders;
  }

  async updateEmailFolderCounts(folderId: number, unreadCount: number, totalCount: number): Promise<void> {
    const { emailFolders } = await import("@shared/schema");
    await db.update(emailFolders)
      .set({ 
        unreadCount, 
        totalCount, 
        updatedAt: new Date() 
      })
      .where(eq(emailFolders.id, folderId));
  }

  async createEmailMessage(data: any): Promise<any> {
    const { emailMessages } = await import("@shared/schema");
    const [message] = await db.insert(emailMessages).values(data).returning();
    return message;
  }

  async getEmailMessagesByFolder(folderId: number, limit = 50, offset = 0): Promise<any[]> {
    const { emailMessages } = await import("@shared/schema");
    const messages = await db.select()
      .from(emailMessages)
      .where(eq(emailMessages.folderId, folderId))
      .orderBy(desc(emailMessages.receivedAt))
      .limit(limit)
      .offset(offset);
    
    return messages;
  }

  async markEmailAsRead(messageId: number, isRead = true): Promise<void> {
    const { emailMessages } = await import("@shared/schema");
    await db.update(emailMessages)
      .set({ isRead, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId));
  }

  async flagEmail(messageId: number, isFlagged = true): Promise<void> {
    const { emailMessages } = await import("@shared/schema");
    await db.update(emailMessages)
      .set({ isFlagged, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId));
  }

  async updateEmailAccountSync(accountId: number): Promise<void> {
    const { emailAccounts } = await import("@shared/schema");
    await db.update(emailAccounts)
      .set({ lastSyncAt: new Date() })
      .where(eq(emailAccounts.id, accountId));
  }
}

export const storage = new DatabaseStorage();
