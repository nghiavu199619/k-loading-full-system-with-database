import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"), // admin, user
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  taxCode: text("tax_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetCategories = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => budgetCategories.id).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 15, scale: 2 }).default("0").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  type: text("type").notNull(), // income, expense
  categoryId: integer("category_id").references(() => budgetCategories.id),
  clientId: integer("client_id").references(() => clients.id),
  status: text("status").default("pending").notNull(), // pending, confirmed, cancelled
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  systemCode: text("system_code"), // Mã hệ thống
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  contactPerson: text("contact_person"),
  assignedEmployee: text("assigned_employee"), // USER NV field
  userId: integer("user_id").references(() => authUsers.id), // User ownership
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reconciliations = pgTable("reconciliations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
});

export const reconciliationItems = pgTable("reconciliation_items", {
  id: serial("id").primaryKey(),
  reconciliationId: integer("reconciliation_id").references(() => reconciliations.id).notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
});

// Advertising Accounts Management
export const adAccounts = pgTable("ad_accounts", {
  id: serial("id").primaryKey(),
  localId: integer("local_id"), // Local ID per owner (1, 2, 3...)
  ownerId: integer("owner_id").references(() => authUsers.id), // Owner ID for local_id-owner_id format
  accountId: text("account_id"), // ID TKQC - removed unique constraint for bulk creation
  name: text("name"), // Tên tài khoản
  status: text("status"), // Trạng thái - ✅ REMOVED default "Hoạt động" and notNull constraint
  source: text("source"), // Nguồn tài khoản
  rentalPercentage: text("rental_percentage").default("0").notNull(), // % Thuê TK
  cardType: text("card_type"), // THẺ
  cardNote: text("card_note"), // Note thẻ  
  vatPercentage: text("vat_percentage").default("0").notNull(), // VAT %
  clientTag: text("client_tag"), // TAG KH
  accountPermission: text("account_permission"), // QUYỀN TK
  ttEx: text("tt_ex"), // TT EX - Trạng thái tương tác
  description: text("description"), // MÔ TẢ
  userId: integer("user_id").references(() => authUsers.id), // Legacy user reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});



// Client Account Assignments (many-to-many relationship)
export const clientAccounts = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  accountId: integer("account_id").references(() => adAccounts.id).notNull(),
  rentalPercentage: decimal("rental_percentage", { precision: 5, scale: 2 }).default("100").notNull(), // % thuê
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: text("status").default("active").notNull(), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Fee Change History
export const feeChanges = pgTable("fee_changes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  oldPercentage: decimal("old_percentage", { precision: 5, scale: 2 }).notNull(),
  newPercentage: decimal("new_percentage", { precision: 5, scale: 2 }).notNull(),
  changeType: text("change_type").notNull(), // immediate, scheduled, from_month
  effectiveFromMonth: integer("effective_from_month"),
  effectiveFromYear: integer("effective_from_year"),
  effectiveToMonth: integer("effective_to_month"),
  effectiveToYear: integer("effective_to_year"),
  status: text("status").default("pending").notNull(), // pending, active, expired
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Account changes log table for real-time autosave updates
export const accountChanges = pgTable("account_changes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => adAccounts.id),
  row: integer("row").notNull(),
  col: integer("col").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: text("user_id"), // For tracking who made the change
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sessionId: text("session_id") // For identifying different editing sessions
});

// Expense changes log table for real-time collaboration
export const expenseChanges = pgTable("expense_changes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => adAccounts.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  userId: text("user_id"), // For tracking who made the change
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sessionId: text("session_id") // For identifying different editing sessions
});



// Processed events tracking to prevent infinite refresh loops
export const processedEvents = pgTable("processed_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(),
  eventId: integer("event_id").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});



// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  approvedReconciliations: many(reconciliations),
}));

export const budgetCategoriesRelations = relations(budgetCategories, ({ many }) => ({
  budgets: many(budgets),
  transactions: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(budgetCategories, {
    fields: [budgets.categoryId],
    references: [budgetCategories.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(budgetCategories, {
    fields: [transactions.categoryId],
    references: [budgetCategories.id],
  }),
  client: one(clients, {
    fields: [transactions.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  transactions: many(transactions),
  reconciliations: many(reconciliations),
  accountAssignments: many(clientAccounts),

}));

export const reconciliationsRelations = relations(reconciliations, ({ one, many }) => ({
  client: one(clients, {
    fields: [reconciliations.clientId],
    references: [clients.id],
  }),
  approvedByUser: one(users, {
    fields: [reconciliations.approvedBy],
    references: [users.id],
  }),
  items: many(reconciliationItems),
}));

export const reconciliationItemsRelations = relations(reconciliationItems, ({ one }) => ({
  reconciliation: one(reconciliations, {
    fields: [reconciliationItems.reconciliationId],
    references: [reconciliations.id],
  }),
  transaction: one(transactions, {
    fields: [reconciliationItems.transactionId],
    references: [transactions.id],
  }),
}));

// New relations for advertising accounts
export const adAccountsRelations = relations(adAccounts, ({ many }) => ({

  clientAssignments: many(clientAccounts),
}));



export const clientAccountsRelations = relations(clientAccounts, ({ one }) => ({
  client: one(clients, {
    fields: [clientAccounts.clientId],
    references: [clients.id],
  }),
  account: one(adAccounts, {
    fields: [clientAccounts.accountId],
    references: [adAccounts.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetCategorySchema = createInsertSchema(budgetCategories).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertReconciliationSchema = createInsertSchema(reconciliations).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  approvedBy: true,
  shareToken: true,
});

export const insertReconciliationItemSchema = createInsertSchema(reconciliationItems).omit({
  id: true,
});

export const insertAdAccountSchema = createInsertSchema(adAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export const insertClientAccountSchema = createInsertSchema(clientAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertFeeChangeSchema = createInsertSchema(feeChanges).omit({
  id: true,
  createdAt: true,
});

// System Settings tables
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  category: text("category").default("general").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const statsBadges = pgTable("stats_badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  color: text("color").default("#3B82F6").notNull(),
  icon: text("icon").default("BarChart3").notNull(),
  query: text("query").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStatsBadgeSchema = createInsertSchema(statsBadges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User-specific settings tables
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  statusOptions: jsonb("status_options").$type<string[]>().default(['active', 'inactive', 'pending', 'suspended', 'paused', 'blocked', 'Hoạt động', 'Tạm dừng', 'Không hoạt động']),
  cardTypes: jsonb("card_types").$type<string[]>().default(['Visa', 'MasterCard', 'NAPAS', 'JCB', 'Prepaid']),
  permissions: jsonb("permissions").$type<string[]>().default(['Admin', 'Editor', 'Viewer', 'Advertiser']),
  noteCards: jsonb("note_cards").$type<string[]>().default(['THẺ KAG', 'THẺ KHÁCH', 'THẺ HDG', 'NHIỀU BÊN']),
  bankSettings: jsonb("bank_settings").$type<{code: string; name: string; logo?: string}[]>().default([
    {code: 'ACB', name: 'Ngân hàng TMCP Á Châu', logo: 'acb'},
    {code: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', logo: 'vcb'},
    {code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', logo: 'bidv'},
    {code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', logo: 'tcb'},
    {code: 'LPB', name: 'Ngân hàng TMCP Bưu điện Liên Việt', logo: 'lpb'}
  ]),
  accountSettings: jsonb("account_settings").$type<{bankCode: string; accountNumber: string; accountHolder: string; phoneSms: string; accountName: string; note: string}[]>().default([]),
  partners: jsonb("partners").$type<string[]>().default(['HDG', 'KAG', 'VSG']),
  ttExOptions: jsonb("tt_ex_options").$type<string[]>().default(['Đang dùng', 'Đã Chốt']), // ✅ TT EX settings added
  currencyOptions: jsonb("currency_options").$type<{code: string; symbol: string}[]>().default([
    {code: 'VND', symbol: '₫'},
    {code: 'USD', symbol: '$'},
    {code: 'EUR', symbol: '€'},
    {code: 'JPY', symbol: '¥'}
  ]), // ✅ Currency options for Tiền Tốt tab
  defaultStatus: varchar("default_status").default('active'),
  defaultCardType: varchar("default_card_type").default('Visa'),
  defaultPermission: varchar("default_permission").default('Advertiser'),
  defaultVatPercentage: integer("default_vat_percentage").default(10),
  defaultRentalPercentage: integer("default_rental_percentage").default(70),
  emailNotifications: boolean("email_notifications").default(true),
  autoBackup: boolean("auto_backup").default(false),
  dataRetentionDays: integer("data_retention_days").default(90),
  systemMaintenance: boolean("system_maintenance").default(false),
  currencySettings: jsonb("currency_settings").$type<{
    primaryCurrency: string;
    secondaryCurrencies: string[];
    exchangeRates: Record<string, number>;
    displayFormat: 'symbol' | 'code' | 'both';
    decimalPlaces: number;
    thousandSeparator: string;
    decimalSeparator: string;
  }>().default({
    primaryCurrency: 'VND',
    secondaryCurrencies: ['VND'],
    exchangeRates: { VND: 24000 },
    displayFormat: 'symbol',
    decimalPlaces: 0,
    thousandSeparator: ',',
    decimalSeparator: '.'
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userStatsBadges = pgTable("user_stats_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  name: varchar("name").notNull(),
  color: varchar("color").notNull(),
  icon: varchar("icon").notNull(),
  enabled: boolean("enabled").default(true),
  query: text("query").notNull(),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserStatsBadgeSchema = createInsertSchema(userStatsBadges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// K-Loading Logs table for comprehensive change tracking
export const logsKloading = pgTable("logs_kloading", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 100 }).notNull(),
  recordId: integer("record_id").notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: integer("user_id").references(() => authUsers.id), // Reference to auth_users
  userSession: varchar("user_session", { length: 100 }).default("anonymous"),
  userName: varchar("user_name", { length: 100 }).default("Ẩn danh"), // Deprecated - use userId instead
  actionType: varchar("action_type", { length: 50 }).default("update"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const insertLogsKloadingSchema = createInsertSchema(logsKloading).omit({
  id: true,
  timestamp: true,
});

// Authentication and User Management System
export const authUsers: any = pgTable("auth_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 100 }),
  role: varchar("role", { length: 50 }).default("director").notNull(), // Auto-director registration
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, inactive, suspended
  department: varchar("department", { length: 100 }),
  position: varchar("position", { length: 100 }),
  managerId: integer("manager_id"), // References supervisor - will be added after table creation
  createdBy: integer("created_by").references(() => authUsers.id), // Who created this user (for employees)
  permissions: jsonb("permissions").default('[]').notNull(), // Additional granular permissions
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token", { length: 255 }),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authLoginAttempts = pgTable("auth_login_attempts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  successful: boolean("successful").default(false),
  attemptAt: timestamp("attempt_at").defaultNow().notNull(),
});

export const authPermissions = pgTable("auth_permissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("general"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authRolePermissions = pgTable("auth_role_permissions", {
  id: serial("id").primaryKey(),
  role: varchar("role", { length: 50 }).notNull(),
  permissionId: integer("permission_id").references(() => authPermissions.id).notNull(),
  granted: boolean("granted").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const authUsersRelations = relations(authUsers, ({ many, one }) => ({
  sessions: many(authSessions),
  subordinates: many(authUsers, {
    relationName: "manager_subordinates",
  }),
  manager: one(authUsers, {
    fields: [authUsers.managerId],
    references: [authUsers.id],
    relationName: "manager_subordinates",
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [authSessions.userId],
    references: [authUsers.id],
  }),
}));

export const authRolePermissionsRelations = relations(authRolePermissions, ({ one }) => ({
  permission: one(authPermissions, {
    fields: [authRolePermissions.permissionId],
    references: [authPermissions.id],
  }),
}));

// Employee Management Activity Logs
export const employeeManagementLogs = pgTable("employee_management_logs", {
  id: serial("id").primaryKey(),
  actionType: varchar("action_type", { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
  directorId: integer("director_id").references(() => authUsers.id).notNull(), // Who performed the action
  targetEmployeeId: integer("target_employee_id").references(() => authUsers.id), // Employee being modified
  targetEmployeeUsername: varchar("target_employee_username", { length: 100 }), // Store username for deleted users
  oldValue: jsonb("old_value"), // Previous data
  newValue: jsonb("new_value"), // New data
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeManagementLogSchema = createInsertSchema(employeeManagementLogs).omit({
  id: true,
  createdAt: true,
});

export const employeeManagementLogsRelations = relations(employeeManagementLogs, ({ one }) => ({
  director: one(authUsers, {
    fields: [employeeManagementLogs.directorId],
    references: [authUsers.id],
    relationName: "director_logs",
  }),
  targetEmployee: one(authUsers, {
    fields: [employeeManagementLogs.targetEmployeeId],
    references: [authUsers.id],
    relationName: "employee_logs",
  }),
}));

export const logsKloadingRelations = relations(logsKloading, ({ one }) => ({
  user: one(authUsers, {
    fields: [logsKloading.userId],
    references: [authUsers.id],
  }),
}));

// Insert schemas
export const insertAuthUserSchema = createInsertSchema(authUsers).omit({
  id: true,
  passwordHash: true,
  lastLogin: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  emailVerificationToken: true,
  passwordResetToken: true,
  passwordResetExpires: true,
  twoFactorSecret: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Xác nhận mật khẩu không khớp",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;

// Account Expenses Tracking - Ma trận Account × Client
export const accountExpenses = pgTable("account_expenses", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => adAccounts.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  amount: text("amount").default("0"), // ✅ ALLOW NULL: nullable text field for Vietnamese numbers
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  date: timestamp("date").defaultNow().notNull(), // ✅ Added date field as required by database
  description: text("description"),
  type: text("type"), // ad_spend, management_fee, etc.
  userId: integer("user_id").references(() => authUsers.id).notNull(), // User ownership
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Account expense changes tracking for real-time sync
export const accountExpenseChanges = pgTable("account_expense_changes", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").references(() => accountExpenses.id).notNull(),
  field: text("field").notNull(), // 'amount', 'category', etc.
  oldValue: text("old_value"),
  newValue: text("new_value"),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").references(() => authUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountExpenseSchema = createInsertSchema(accountExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AccountExpense = typeof accountExpenses.$inferSelect;
export type InsertAccountExpense = typeof accountExpenses.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type InsertAuthSession = typeof authSessions.$inferInsert;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof insertAuthUserSchema>;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Reconciliation = typeof reconciliations.$inferSelect;
export type InsertReconciliation = z.infer<typeof insertReconciliationSchema>;

export type ReconciliationItem = typeof reconciliationItems.$inferSelect;
export type InsertReconciliationItem = z.infer<typeof insertReconciliationItemSchema>;

export type AdAccount = typeof adAccounts.$inferSelect;
export type InsertAdAccount = z.infer<typeof insertAdAccountSchema>;



export type ClientAccount = typeof clientAccounts.$inferSelect;
export type InsertClientAccount = z.infer<typeof insertClientAccountSchema>;

export type FeeChange = typeof feeChanges.$inferSelect;
export type InsertFeeChange = z.infer<typeof insertFeeChangeSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type StatsBadge = typeof statsBadges.$inferSelect;
export type InsertStatsBadge = z.infer<typeof insertStatsBadgeSchema>;

export const insertAccountChangeSchema = createInsertSchema(accountChanges).omit({
  id: true,
  createdAt: true,
});

export type AccountChange = typeof accountChanges.$inferSelect;
export type InsertAccountChange = z.infer<typeof insertAccountChangeSchema>;

// Employee roles and permissions
export const employeeRoles = pgTable("employee_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'accountant', 'operations', 'management'
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull(), // Array of permission strings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employee accounts table
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique(),
  fullName: text("full_name").notNull(),
  roleId: integer("role_id").references(() => employeeRoles.id), // Made optional to allow creating employees without roles
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true),
  hasPermissions: boolean("has_permissions").default(false), // Track if permissions are assigned
  createdBy: integer("created_by").references(() => authUsers.id), // Reference to auth_users instead of legacy users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// Activity logs table for audit trail
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  employeeId: integer("employee_id").references(() => employees.id),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'login', 'logout'
  resourceType: text("resource_type").notNull(), // 'account', 'budget', 'expense', 'employee'
  resourceId: text("resource_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Employee Relations
export const employeeRolesRelations = relations(employeeRoles, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  role: one(employeeRoles, {
    fields: [employees.roleId],
    references: [employeeRoles.id],
  }),
  createdByUser: one(users, {
    fields: [employees.createdBy],
    references: [users.id],
  }),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  employee: one(employees, {
    fields: [activityLogs.employeeId],
    references: [employees.id],
  }),
}));

// Employee schemas
export const insertEmployeeRoleSchema = createInsertSchema(employeeRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

// Employee Permissions Table
export const employeePermissions = pgTable('employee_permissions', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
  tabName: varchar('tab_name', { length: 100 }).notNull(), // dashboard, account-management, expense-management, etc.
  permission: varchar('permission', { length: 20 }).notNull().default('none'), // none, view, edit
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Employee Permission Relations
export const employeePermissionsRelations = relations(employeePermissions, ({ one }) => ({
  employee: one(authUsers, {
    fields: [employeePermissions.employeeId],
    references: [authUsers.id],
  }),
}));

// Employee Permission Schemas
export const insertEmployeePermissionSchema = createInsertSchema(employeePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Employee types
export type EmployeeRole = typeof employeeRoles.$inferSelect;
export type InsertEmployeeRole = z.infer<typeof insertEmployeeRoleSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type EmployeePermission = typeof employeePermissions.$inferSelect;
export type InsertEmployeePermission = z.infer<typeof insertEmployeePermissionSchema>;

// Test tables for universal sync demo
export const testClients = pgTable('test_clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const testAccounts = pgTable('test_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  budget: decimal('budget', { precision: 15, scale: 0 }).default('0'),
  spent: decimal('spent', { precision: 15, scale: 0 }).default('0'),
  notes: text('notes'),
  lastModifiedBy: varchar('last_modified_by', { length: 100 }).default('anonymous'),
  lastModifiedAt: timestamp('last_modified_at').defaultNow(),
  version: integer('version').default(1).notNull(),
  isLocked: boolean('is_locked').default(false), // For edit locking
  lockedBy: varchar('locked_by', { length: 100 }), // Who is currently editing
  lockedAt: timestamp('locked_at'), // When was it locked
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const testClientChanges = pgTable('test_client_changes', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => testClients.id),
  field: varchar('field', { length: 100 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userId: varchar('user_id', { length: 100 }).default('anonymous'),
  sessionId: varchar('session_id', { length: 100 }).default('default'),
  timestamp: timestamp('timestamp').defaultNow()
});

export const testAccountChanges = pgTable('test_account_changes', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => testAccounts.id),
  field: varchar('field', { length: 100 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userId: varchar('user_id', { length: 100 }).default('anonymous'),
  sessionId: varchar('session_id', { length: 100 }).default('default'),
  version: integer('version').default(1).notNull(), // For conflict resolution
  conflictResolution: varchar('conflict_resolution', { length: 50 }), // manual, auto_merge, latest_wins
  timestamp: timestamp('timestamp').defaultNow()
});

// Advanced collaboration tables
export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(),
  userName: varchar('user_name', { length: 100 }).default('Anonymous'),
  userColor: varchar('user_color', { length: 7 }).default('#3B82F6'), // Hex color for user cursor
  isActive: boolean('is_active').default(true),
  lastSeen: timestamp('last_seen').defaultNow(),
  currentCell: varchar('current_cell', { length: 20 }), // e.g., "A1", "B3"
  currentTable: varchar('current_table', { length: 50 }), // e.g., "test_accounts"
  isTyping: boolean('is_typing').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

export const typingIndicators = pgTable('typing_indicators', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  tableId: varchar('table_id', { length: 50 }).notNull(), // "test_accounts", "test_clients"
  recordId: integer('record_id').notNull(), // The row being edited
  fieldName: varchar('field_name', { length: 50 }).notNull(), // Column being edited
  userName: varchar('user_name', { length: 100 }).default('Anonymous'),
  userColor: varchar('user_color', { length: 7 }).default('#3B82F6'),
  startedAt: timestamp('started_at').defaultNow(),
  lastUpdate: timestamp('last_update').defaultNow()
});

export const cursorPositions = pgTable('cursor_positions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  tableId: varchar('table_id', { length: 50 }).notNull(),
  row: integer('row').notNull(),
  col: integer('col').notNull(),
  userName: varchar('user_name', { length: 100 }).default('Anonymous'),
  userColor: varchar('user_color', { length: 7 }).default('#3B82F6'),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Insert schemas for test tables
export const insertTestClientSchema = createInsertSchema(testClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTestAccountSchema = createInsertSchema(testAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastModifiedBy: true,
  lastModifiedAt: true,
  version: true,
  isLocked: true,
  lockedBy: true,
  lockedAt: true
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true
});

export const insertTypingIndicatorSchema = createInsertSchema(typingIndicators).omit({
  id: true,
  startedAt: true,
  lastUpdate: true
});

export const insertCursorPositionSchema = createInsertSchema(cursorPositions).omit({
  id: true,
  updatedAt: true
});

export type TestClient = typeof testClients.$inferSelect;
export type InsertTestClient = z.infer<typeof insertTestClientSchema>;
export type TestAccount = typeof testAccounts.$inferSelect;
export type InsertTestAccount = z.infer<typeof insertTestAccountSchema>;

// ✅ NEW TABLE: Expense Visible Accounts - Controls which ad accounts show in expense sheets
export const expenseVisibleAccounts = pgTable("expense_visible_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => adAccounts.id, { onDelete: "cascade" }),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(), // 2024, 2025, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});



// Create relations
export const expenseVisibleAccountsRelations = relations(expenseVisibleAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [expenseVisibleAccounts.userId],
    references: [authUsers.id],
  }),
  account: one(adAccounts, {
    fields: [expenseVisibleAccounts.accountId],
    references: [adAccounts.id],
  }),
}));

// Expense visible accounts schemas
export const insertExpenseVisibleAccountSchema = createInsertSchema(expenseVisibleAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExpenseVisibleAccount = typeof expenseVisibleAccounts.$inferSelect;
export type InsertExpenseVisibleAccount = z.infer<typeof insertExpenseVisibleAccountSchema>;

// Via Management table
export const viaManagement = pgTable("via_management", {
  id: serial("id").primaryKey(),
  tenNoiBo: text("ten_noi_bo").notNull(), // TÊN NỘI BỘ
  idVia: text("id_via").notNull(), // ID VIA
  pass: text("pass").notNull(), // PASS
  twoFA: text("two_fa"), // 2FA
  mail: text("mail"), // MAIL
  passMail: text("pass_mail"), // PASS MAIL
  mailKhoiPhuc: text("mail_khoi_phuc"), // MAIL Khôi phục
  passMailKhoiPhuc: text("pass_mail_khoi_phuc"), // PASS MAIL khôi phục
  phanChoNV: text("phan_cho_nv"), // phân cho NV
  ghiChuNoiBo: text("ghi_chu_noi_bo"), // Ghi Chú Nội Bộ
  userId: integer("user_id").references(() => authUsers.id).notNull(), // User ownership
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Via Management changes tracking
export const viaManagementChanges = pgTable("via_management_changes", {
  id: serial("id").primaryKey(),
  viaId: integer("via_id").references(() => viaManagement.id).notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  changeType: text("change_type").notNull(), // 'create', 'update', 'delete'
  sessionId: text("session_id"),
  batchId: text("batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Via Management Relations
export const viaManagementRelations = relations(viaManagement, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [viaManagement.userId],
    references: [authUsers.id],
  }),
  changes: many(viaManagementChanges),
}));

export const viaManagementChangesRelations = relations(viaManagementChanges, ({ one }) => ({
  via: one(viaManagement, {
    fields: [viaManagementChanges.viaId],
    references: [viaManagement.id],
  }),
  user: one(authUsers, {
    fields: [viaManagementChanges.userId],
    references: [authUsers.id],
  }),
}));

// Via Management schemas
export const insertViaManagementSchema = createInsertSchema(viaManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertViaManagementChangeSchema = createInsertSchema(viaManagementChanges).omit({
  id: true,
  createdAt: true,
});

// Card Management table - Match actual database structure
export const cardManagement = pgTable("card_management", {
  id: serial("id").primaryKey(),
  // Original fields (existing in DB)
  cardId: text("card_id"), // ID CARD 
  bank: text("bank").notNull(), // BANK
  name: text("name").notNull(), // Name
  cardNumber: text("card_number").notNull(), // So The
  expiryDate: text("expiry_date").notNull(), // Date
  cvv: text("cvv").notNull(), // Cvv
  topupAccount: text("topup_account"), // STK
  addAmount: decimal("add_amount", { precision: 15, scale: 2 }).default("0"), // SL đã ADD
  assignedEmployee: text("assigned_employee"), // Phân cho NV
  note: text("note"), // Note
  // Additional fields
  cardStatus: text("card_status").default('Active'),
  expiry: text("expiry"),
  cardType: text("card_type"),
  holder: text("holder"),
  tenNoiBo: text("ten_noi_bo"),
  pass: text("pass"),
  twoFa: text("two_fa"),
  mail: text("mail"),
  passMail: text("pass_mail"),
  phanChoNv: text("phan_cho_nv"),
  ghiChuNoiBo: text("ghi_chu_noi_bo"),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Card Management changes tracking
export const cardManagementChanges = pgTable("card_management_changes", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cardManagement.id).notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  changeType: text("change_type").notNull(), // 'create', 'update', 'delete'
  sessionId: text("session_id"),
  batchId: text("batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CardManagement = typeof cardManagement.$inferSelect;
export type CardManagementChange = typeof cardManagementChanges.$inferSelect;
export type InsertCardManagement = z.infer<typeof insertCardManagementSchema>;
export type InsertCardManagementChange = z.infer<typeof insertCardManagementChangeSchema>;

export const insertCardManagementSchema = createInsertSchema(cardManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCardManagementChangeSchema = createInsertSchema(cardManagementChanges).omit({
  id: true,
  createdAt: true,
});

// Email Management table
export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  accountName: text("account_name").notNull(), // Tên tài khoản
  emailAddress: text("email_address").notNull(), // Địa chỉ email
  provider: text("provider").notNull(), // gmail, outlook, yahoo
  // Encrypted credentials
  encryptedPassword: text("encrypted_password").notNull(), // Mật khẩu mã hóa AES-256
  encryptedAppPassword: text("encrypted_app_password"), // App password cho Gmail/Outlook
  // IMAP/SMTP settings
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  imapSecure: boolean("imap_secure").default(true),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").default(true),
  // Settings
  autoRefresh: boolean("auto_refresh").default(true),
  refreshInterval: integer("refresh_interval").default(60), // seconds
  isActive: boolean("is_active").default(true),
  // User ownership and permissions
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  createdBy: integer("created_by").references(() => authUsers.id),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at"),
});

// Email folders table
export const emailFolders = pgTable("email_folders", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => emailAccounts.id).notNull(),
  folderName: text("folder_name").notNull(), // INBOX, SENT, DRAFT, etc.
  folderPath: text("folder_path").notNull(), // Full IMAP path
  unreadCount: integer("unread_count").default(0),
  totalCount: integer("total_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email messages table
export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => emailAccounts.id).notNull(),
  folderId: integer("folder_id").references(() => emailFolders.id).notNull(),
  messageId: text("message_id").notNull(), // IMAP message ID
  subject: text("subject"),
  fromAddress: text("from_address"),
  fromName: text("from_name"),
  toAddresses: text("to_addresses").array(), // Array of recipients
  ccAddresses: text("cc_addresses").array(),
  bccAddresses: text("bcc_addresses").array(),
  body: text("body"), // Email body content
  htmlBody: text("html_body"), // HTML version
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  hasAttachments: boolean("has_attachments").default(false),
  size: integer("size"), // Message size in bytes
  receivedAt: timestamp("received_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email attachments table
export const emailAttachments = pgTable("email_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => emailMessages.id).notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  attachmentData: text("attachment_data"), // Base64 encoded data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email account relations
export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [emailAccounts.userId],
    references: [authUsers.id],
  }),
  creator: one(authUsers, {
    fields: [emailAccounts.createdBy],
    references: [authUsers.id],
  }),
  folders: many(emailFolders),
  messages: many(emailMessages),
}));

export const emailFoldersRelations = relations(emailFolders, ({ one, many }) => ({
  account: one(emailAccounts, {
    fields: [emailFolders.accountId],
    references: [emailAccounts.id],
  }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  account: one(emailAccounts, {
    fields: [emailMessages.accountId],
    references: [emailAccounts.id],
  }),
  folder: one(emailFolders, {
    fields: [emailMessages.folderId],
    references: [emailFolders.id],
  }),
  attachments: many(emailAttachments),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  message: one(emailMessages, {
    fields: [emailAttachments.messageId],
    references: [emailMessages.id],
  }),
}));

// Email schemas
export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

export const insertEmailFolderSchema = createInsertSchema(emailFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type EmailFolder = typeof emailFolders.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type InsertEmailFolder = z.infer<typeof insertEmailFolderSchema>;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

// Threshold Management (Quản Lý Ngưỡng) Table
export const thresholdManagement = pgTable("threshold_management", {
  id: serial("id").primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(), // ID TKQC
  accountName: varchar("account_name", { length: 255 }).notNull(), // Tên TKQC  
  tag: varchar("tag", { length: 100 }), // Tag
  status: varchar("status", { length: 50 }).default("Active"), // Trạng thái
  totalThreshold: decimal("total_threshold", { precision: 15, scale: 2 }).default("0"), // Tổng ngưỡng
  sharePercentage: decimal("share_percentage", { precision: 5, scale: 2 }).default("0"), // % Chia
  shareAmount: decimal("share_amount", { precision: 15, scale: 2 }).default("0"), // Chia (VNĐ)
  monthlySpend: decimal("monthly_spend", { precision: 15, scale: 2 }).default("0"), // Chi tiêu tháng
  cutPercentage: decimal("cut_percentage", { precision: 5, scale: 2 }).default("0"), // % Cắt
  cutAmount: decimal("cut_amount", { precision: 15, scale: 2 }).default("0"), // Cắt (VNĐ)
  reportMonth: integer("report_month").default(new Date().getMonth() + 1), // Báo cáo tháng - Month
  reportYear: integer("report_year").default(new Date().getFullYear()), // Báo cáo tháng - Year
  isCompleted: varchar("is_completed", { length: 20 }).default("Chưa chốt"), // Chốt tháng: Đã chốt/Chưa chốt
  hasBankOrder: boolean("has_bank_order").default(false), // Đã tạo lệnh bank hay chưa
  month: integer("month").default(new Date().getMonth() + 1),
  year: integer("year").default(new Date().getFullYear()),
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ThresholdManagement = typeof thresholdManagement.$inferSelect;
export type InsertThresholdManagement = z.infer<typeof insertThresholdManagementSchema>;

// Bank Orders table for banking instructions
export const bankOrders = pgTable("bank_orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(), // Mã lệnh bank tự động
  title: text("title").notNull(), // Tiêu đề lệnh bank
  selectedAccounts: jsonb("selected_accounts").$type<{
    accountId: string;
    accountName: string;
    tag: string;
    status: string;
    shareAmount: string;
    bankRecipient: string;
  }[]>().notNull(), // Danh sách TKQC đã chọn
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(), // Tổng tiền
  filterCriteria: jsonb("filter_criteria").$type<{
    tags: string[];
    statusEx: string[];
    month: number;
    year: number;
  }>().notNull(), // Bộ lọc đã áp dụng
  bankInfo: jsonb("bank_info").$type<{
    bankName: string;
    accountName: string;
    accountNumber: string;
  }>(), // Thông tin ngân hàng
  status: text("status").default("pending").notNull(), // pending, accounting_approved, operations_approved, completed, rejected
  accountingApproval: jsonb("accounting_approval").$type<{
    approved: boolean;
    approvedBy?: number;
    approvedAt?: string;
    notes?: string;
  }>().default({approved: false}), // Duyệt kế toán
  operationsApproval: jsonb("operations_approval").$type<{
    approved: boolean;
    approvedBy?: number;
    approvedAt?: string;
    notes?: string;
  }>().default({approved: false}), // Duyệt vận hành
  isBanked: boolean("is_banked").default(false), // Đã thực hiện bank hay chưa
  createdBy: integer("created_by").references(() => authUsers.id).notNull(),
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Data ownership
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Bank Order Relations
export const bankOrdersRelations = relations(bankOrders, ({ one }) => ({
  createdByUser: one(authUsers, {
    fields: [bankOrders.createdBy],
    references: [authUsers.id],
    relationName: "created_orders",
  }),
  ownerUser: one(authUsers, {
    fields: [bankOrders.userId],
    references: [authUsers.id],
    relationName: "owned_orders",
  }),
}));

// Bank Order Schemas
export const insertBankOrderSchema = createInsertSchema(bankOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BankOrder = typeof bankOrders.$inferSelect;
export type InsertBankOrder = z.infer<typeof insertBankOrderSchema>;

// Payment Management table for tracking customer payments
export const paymentManagement = pgTable("payment_management", {
  id: serial("id").primaryKey(),
  paymentDate: timestamp("payment_date").notNull(), // NGÀY
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // SỐ TIỀN
  currency: varchar("currency", { length: 10 }).default("VND"), // ĐƠN VỊ TIỀN TỆ
  customerCode: varchar("customer_code", { length: 100 }), // MÃ KHÁCH
  note: text("note"), // NOTE
  accountId: varchar("account_id", { length: 50 }), // NẠP TK
  accountName: varchar("account_name", { length: 255 }), // TÊN TK
  isChecked: boolean("is_checked").default(false), // ĐÃ CHECK/chưa check
  userId: integer("user_id").references(() => authUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment Management Relations
export const paymentManagementRelations = relations(paymentManagement, ({ one }) => ({
  user: one(authUsers, {
    fields: [paymentManagement.userId],
    references: [authUsers.id],
  }),
}));

// Payment Management Schemas
export const insertPaymentManagementSchema = createInsertSchema(paymentManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PaymentManagement = typeof paymentManagement.$inferSelect;
export type InsertPaymentManagement = z.infer<typeof insertPaymentManagementSchema>;

export const insertThresholdManagementSchema = createInsertSchema(thresholdManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Card Management Relations
export const cardManagementRelations = relations(cardManagement, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [cardManagement.userId],
    references: [authUsers.id],
  }),
  changes: many(cardManagementChanges),
}));

export const cardManagementChangesRelations = relations(cardManagementChanges, ({ one }) => ({
  card: one(cardManagement, {
    fields: [cardManagementChanges.cardId],
    references: [cardManagement.id],
  }),
  user: one(authUsers, {
    fields: [cardManagementChanges.userId],
    references: [authUsers.id],
  }),
}));

export type ViaManagement = typeof viaManagement.$inferSelect;
export type InsertViaManagement = z.infer<typeof insertViaManagementSchema>;

export type ViaManagementChange = typeof viaManagementChanges.$inferSelect;
export type InsertViaManagementChange = z.infer<typeof insertViaManagementChangeSchema>;

// ====================================================================
// TIME TRACKING & PAYROLL SYSTEM SCHEMAS
// ====================================================================

// Employee Attendance Table - Chấm công nhân viên
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên
  date: timestamp("date").notNull(), // Ngày chấm công
  clockIn: timestamp("clock_in"), // Giờ vào
  clockOut: timestamp("clock_out"), // Giờ ra
  totalHours: decimal("total_hours", { precision: 8, scale: 2 }).default("0"), // Tổng giờ làm
  breakTime: decimal("break_time", { precision: 8, scale: 2 }).default("0"), // Giờ nghỉ trưa
  overtimeHours: decimal("overtime_hours", { precision: 8, scale: 2 }).default("0"), // Giờ tăng ca
  lateMinutes: integer("late_minutes").default(0), // Phút đi muộn
  earlyLeaveMinutes: integer("early_leave_minutes").default(0), // Phút về sớm
  workType: varchar("work_type", { length: 50 }).default("normal"), // normal, overtime, holiday, weekend
  location: varchar("location", { length: 100 }), // Địa điểm làm việc
  ipAddress: varchar("ip_address", { length: 45 }), // IP chấm công
  deviceInfo: text("device_info"), // Thông tin thiết bị
  notes: text("notes"), // Ghi chú
  status: varchar("status", { length: 20 }).default("normal"), // normal, late, absent, holiday, sick
  approvedBy: integer("approved_by").references(() => authUsers.id), // Người duyệt
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payroll Table - Bảng lương với đầy đủ 20+ cột
export const payroll = pgTable("payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên
  month: integer("month").notNull(), // Tháng tính lương
  year: integer("year").notNull(), // Năm tính lương
  // Thông tin nhân viên
  stt: integer("stt"), // STT
  employeeCode: varchar("employee_code", { length: 50 }), // Mã NV
  fullName: varchar("full_name", { length: 100 }), // Họ và tên
  department: varchar("department", { length: 100 }), // Phòng ban
  position: varchar("position", { length: 100 }), // Chức vụ
  // Thời gian làm việc
  workDays: decimal("work_days", { precision: 5, scale: 2 }).default("0"), // Ngày làm việc
  actualWorkDays: decimal("actual_work_days", { precision: 5, scale: 2 }).default("0"), // Ngày làm thực tế
  overtimeHours: decimal("overtime_hours", { precision: 8, scale: 2 }).default("0"), // Giờ tăng ca
  leaveDays: decimal("leave_days", { precision: 5, scale: 2 }).default("0"), // Ngày nghỉ
  // Lương cơ bản
  basicSalary: decimal("basic_salary", { precision: 15, scale: 2 }).default("0"), // Lương cơ bản
  dailySalary: decimal("daily_salary", { precision: 15, scale: 2 }).default("0"), // Lương ngày
  actualSalary: decimal("actual_salary", { precision: 15, scale: 2 }).default("0"), // Lương thực tế
  // Các khoản thưởng
  overtimePay: decimal("overtime_pay", { precision: 15, scale: 2 }).default("0"), // Tiền tăng ca
  revenueBonus: decimal("revenue_bonus", { precision: 15, scale: 2 }).default("0"), // Thưởng doanh thu tổng
  clientServiceBonus: decimal("client_service_bonus", { precision: 15, scale: 2 }).default("0"), // Lương DV AGC
  performanceBonus: decimal("performance_bonus", { precision: 15, scale: 2 }).default("0"), // Thưởng hiệu suất
  otherBonuses: decimal("other_bonuses", { precision: 15, scale: 2 }).default("0"), // Thưởng khác
  // Các khoản khấu trừ
  socialInsurance: decimal("social_insurance", { precision: 15, scale: 2 }).default("0"), // BHXH
  healthInsurance: decimal("health_insurance", { precision: 15, scale: 2 }).default("0"), // BHYT
  unemploymentInsurance: decimal("unemployment_insurance", { precision: 15, scale: 2 }).default("0"), // BHTN
  personalIncomeTax: decimal("personal_income_tax", { precision: 15, scale: 2 }).default("0"), // Thuế TNCN
  otherDeductions: decimal("other_deductions", { precision: 15, scale: 2 }).default("0"), // Khấu trừ khác
  lateDeduction: decimal("late_deduction", { precision: 15, scale: 2 }).default("0"), // Trừ đi muộn
  // Tổng kết
  grossSalary: decimal("gross_salary", { precision: 15, scale: 2 }).default("0"), // Tổng lương
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }).default("0"), // Tổng khấu trừ
  netSalary: decimal("net_salary", { precision: 15, scale: 2 }).default("0"), // Lương thực lãnh
  // Thông tin ngân hàng
  bankName: varchar("bank_name", { length: 100 }), // Ngân hàng
  bankAccount: varchar("bank_account", { length: 50 }), // Số tài khoản
  bankHolder: varchar("bank_holder", { length: 100 }), // Chủ tài khoản
  // Trạng thái
  status: varchar("status", { length: 20 }).default("draft"), // draft, approved, paid
  approvedBy: integer("approved_by").references(() => authUsers.id), // Người duyệt
  approvedAt: timestamp("approved_at"), // Thời gian duyệt
  paidAt: timestamp("paid_at"), // Thời gian trả lương
  notes: text("notes"), // Ghi chú
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Leave Requests Table - Xin nghỉ phép
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên xin nghỉ
  leaveType: varchar("leave_type", { length: 50 }).notNull(), // annual, sick, personal, emergency, maternity
  startDate: timestamp("start_date").notNull(), // Ngày bắt đầu nghỉ
  endDate: timestamp("end_date").notNull(), // Ngày kết thúc nghỉ
  totalDays: decimal("total_days", { precision: 5, scale: 2 }).notNull(), // Tổng ngày nghỉ
  reason: text("reason").notNull(), // Lý do nghỉ
  documents: jsonb("documents").$type<string[]>(), // Tài liệu đính kèm
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected, cancelled
  approvedBy: integer("approved_by").references(() => authUsers.id), // Người duyệt
  approvedAt: timestamp("approved_at"), // Thời gian duyệt
  approvalNotes: text("approval_notes"), // Ghi chú duyệt
  remainingLeaveDays: decimal("remaining_leave_days", { precision: 5, scale: 2 }), // Số ngày nghỉ còn lại
  isEmergency: boolean("is_emergency").default(false), // Nghỉ khẩn cấp
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Performance Metrics Table - Thống kê hiệu suất
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên
  month: integer("month").notNull(), // Tháng
  year: integer("year").notNull(), // Năm
  workDays: decimal("work_days", { precision: 5, scale: 2 }).default("0"), // Ngày làm việc
  punctualityScore: decimal("punctuality_score", { precision: 5, scale: 2 }).default("100"), // Điểm chấm công (0-100)
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }).default("0"), // Điểm hiệu suất
  clientSatisfactionScore: decimal("client_satisfaction_score", { precision: 5, scale: 2 }).default("0"), // Điểm hài lòng KH
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).default("0"), // Doanh thu mang lại
  clientCount: integer("client_count").default(0), // Số khách hàng phụ trách
  completedTasks: integer("completed_tasks").default(0), // Task hoàn thành
  rank: integer("rank"), // Xếp hạng trong tháng
  rankingScore: decimal("ranking_score", { precision: 8, scale: 2 }).default("0"), // Điểm xếp hạng
  bonusEligible: boolean("bonus_eligible").default(true), // Đủ điều kiện thưởng
  notes: text("notes"), // Ghi chú đánh giá
  evaluatedBy: integer("evaluated_by").references(() => authUsers.id), // Người đánh giá
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Salary Bonuses Table - Các loại thưởng lương
export const salaryBonuses = pgTable("salary_bonuses", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên
  bonusType: varchar("bonus_type", { length: 50 }).notNull(), // revenue_total, revenue_client, performance, attendance, holiday
  month: integer("month").notNull(), // Tháng
  year: integer("year").notNull(), // Năm
  baseAmount: decimal("base_amount", { precision: 15, scale: 2 }).default("0"), // Số tiền gốc tính thưởng
  percentage: decimal("percentage", { precision: 5, scale: 2 }).default("0"), // Phần trăm thưởng
  bonusAmount: decimal("bonus_amount", { precision: 15, scale: 2 }).default("0"), // Tiền thưởng
  description: text("description"), // Mô tả thưởng
  // Doanh thu client riêng (Lương DV AGC)
  clientId: integer("client_id").references(() => clients.id), // Khách hàng cụ thể
  clientRevenue: decimal("client_revenue", { precision: 15, scale: 2 }).default("0"), // Doanh thu client
  // Thưởng doanh thu tổng
  totalCompanyRevenue: decimal("total_company_revenue", { precision: 15, scale: 2 }).default("0"), // Tổng doanh thu công ty
  revenueTarget: decimal("revenue_target", { precision: 15, scale: 2 }).default("0"), // Mục tiêu doanh thu
  achievementRate: decimal("achievement_rate", { precision: 5, scale: 2 }).default("0"), // Tỷ lệ đạt target
  status: varchar("status", { length: 20 }).default("calculated"), // calculated, approved, paid
  calculatedBy: integer("calculated_by").references(() => authUsers.id), // Người tính
  approvedBy: integer("approved_by").references(() => authUsers.id), // Người duyệt
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shift Schedules Table - Lịch trực ca
export const shiftSchedules = pgTable("shift_schedules", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => authUsers.id).notNull(), // Nhân viên
  shiftDate: timestamp("shift_date").notNull(), // Ngày trực
  shiftType: varchar("shift_type", { length: 50 }).notNull(), // morning, afternoon, night, full_day
  startTime: varchar("start_time", { length: 10 }).notNull(), // Giờ bắt đầu (HH:mm)
  endTime: varchar("end_time", { length: 10 }).notNull(), // Giờ kết thúc (HH:mm)
  location: varchar("location", { length: 100 }), // Địa điểm trực
  responsibilities: text("responsibilities"), // Nhiệm vụ trực
  status: varchar("status", { length: 20 }).default("scheduled"), // scheduled, completed, absent, swapped
  swappedWith: integer("swapped_with").references(() => authUsers.id), // Đổi ca với ai
  swapReason: text("swap_reason"), // Lý do đổi ca
  attendanceChecked: boolean("attendance_checked").default(false), // Đã check chấm công
  performanceRating: decimal("performance_rating", { precision: 3, scale: 1 }), // Đánh giá ca trực (1-5)
  notes: text("notes"), // Ghi chú ca trực
  createdBy: integer("created_by").references(() => authUsers.id), // Người tạo lịch
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Monthly Revenues Table - Doanh thu tháng cho tính thưởng
export const monthlyRevenues = pgTable("monthly_revenues", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(), // Tháng
  year: integer("year").notNull(), // Năm
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).notNull(), // Tổng doanh thu
  revenueTarget: decimal("revenue_target", { precision: 15, scale: 2 }).default("0"), // Mục tiêu doanh thu
  achievementRate: decimal("achievement_rate", { precision: 5, scale: 2 }).default("0"), // Tỷ lệ đạt được
  // Chi tiết doanh thu theo nguồn
  adAccountRevenue: decimal("ad_account_revenue", { precision: 15, scale: 2 }).default("0"), // DT từ TK QC
  serviceRevenue: decimal("service_revenue", { precision: 15, scale: 2 }).default("0"), // DT dịch vụ
  otherRevenue: decimal("other_revenue", { precision: 15, scale: 2 }).default("0"), // DT khác
  // Thông tin thưởng
  bonusPool: decimal("bonus_pool", { precision: 15, scale: 2 }).default("0"), // Quỹ thưởng
  bonusPercentage: decimal("bonus_percentage", { precision: 5, scale: 2 }).default("0"), // % chia thưởng
  distributedBonus: decimal("distributed_bonus", { precision: 15, scale: 2 }).default("0"), // Thưởng đã chia
  status: varchar("status", { length: 20 }).default("draft"), // draft, approved, distributed
  approvedBy: integer("approved_by").references(() => authUsers.id), // Người duyệt
  notes: text("notes"), // Ghi chú
  userId: integer("user_id").references(() => authUsers.id).notNull(), // Owner (director)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ====================================================================
// TIME TRACKING RELATIONS
// ====================================================================

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(authUsers, {
    fields: [attendance.employeeId],
    references: [authUsers.id],
    relationName: "employee_attendance",
  }),
  approver: one(authUsers, {
    fields: [attendance.approvedBy],
    references: [authUsers.id],
    relationName: "attendance_approver",
  }),
  owner: one(authUsers, {
    fields: [attendance.userId],
    references: [authUsers.id],
    relationName: "attendance_owner",
  }),
}));

export const payrollRelations = relations(payroll, ({ one }) => ({
  employee: one(authUsers, {
    fields: [payroll.employeeId],
    references: [authUsers.id],
    relationName: "employee_payroll",
  }),
  approver: one(authUsers, {
    fields: [payroll.approvedBy],
    references: [authUsers.id],
    relationName: "payroll_approver",
  }),
  owner: one(authUsers, {
    fields: [payroll.userId],
    references: [authUsers.id],
    relationName: "payroll_owner",
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(authUsers, {
    fields: [leaveRequests.employeeId],
    references: [authUsers.id],
    relationName: "employee_leave_requests",
  }),
  approver: one(authUsers, {
    fields: [leaveRequests.approvedBy],
    references: [authUsers.id],
    relationName: "leave_approver",
  }),
  owner: one(authUsers, {
    fields: [leaveRequests.userId],
    references: [authUsers.id],
    relationName: "leave_owner",
  }),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  employee: one(authUsers, {
    fields: [performanceMetrics.employeeId],
    references: [authUsers.id],
    relationName: "employee_performance",
  }),
  evaluator: one(authUsers, {
    fields: [performanceMetrics.evaluatedBy],
    references: [authUsers.id],
    relationName: "performance_evaluator",
  }),
  owner: one(authUsers, {
    fields: [performanceMetrics.userId],
    references: [authUsers.id],
    relationName: "performance_owner",
  }),
}));

export const salaryBonusesRelations = relations(salaryBonuses, ({ one }) => ({
  employee: one(authUsers, {
    fields: [salaryBonuses.employeeId],
    references: [authUsers.id],
    relationName: "employee_bonuses",
  }),
  client: one(clients, {
    fields: [salaryBonuses.clientId],
    references: [clients.id],
    relationName: "bonus_client",
  }),
  calculator: one(authUsers, {
    fields: [salaryBonuses.calculatedBy],
    references: [authUsers.id],
    relationName: "bonus_calculator",
  }),
  approver: one(authUsers, {
    fields: [salaryBonuses.approvedBy],
    references: [authUsers.id],
    relationName: "bonus_approver",
  }),
  owner: one(authUsers, {
    fields: [salaryBonuses.userId],
    references: [authUsers.id],
    relationName: "bonus_owner",
  }),
}));

export const shiftSchedulesRelations = relations(shiftSchedules, ({ one }) => ({
  employee: one(authUsers, {
    fields: [shiftSchedules.employeeId],
    references: [authUsers.id],
    relationName: "employee_shifts",
  }),
  swappedEmployee: one(authUsers, {
    fields: [shiftSchedules.swappedWith],
    references: [authUsers.id],
    relationName: "shift_swap_partner",
  }),
  creator: one(authUsers, {
    fields: [shiftSchedules.createdBy],
    references: [authUsers.id],
    relationName: "shift_creator",
  }),
  owner: one(authUsers, {
    fields: [shiftSchedules.userId],
    references: [authUsers.id],
    relationName: "shift_owner",
  }),
}));

export const monthlyRevenuesRelations = relations(monthlyRevenues, ({ one }) => ({
  approver: one(authUsers, {
    fields: [monthlyRevenues.approvedBy],
    references: [authUsers.id],
    relationName: "revenue_approver",
  }),
  owner: one(authUsers, {
    fields: [monthlyRevenues.userId],
    references: [authUsers.id],
    relationName: "revenue_owner",
  }),
}));

// ====================================================================
// TIME TRACKING INSERT SCHEMAS
// ====================================================================

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPayrollSchema = createInsertSchema(payroll).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalaryBonusSchema = createInsertSchema(salaryBonuses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftScheduleSchema = createInsertSchema(shiftSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyRevenueSchema = createInsertSchema(monthlyRevenues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ====================================================================
// TIME TRACKING TYPE EXPORTS
// ====================================================================

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type Payroll = typeof payroll.$inferSelect;
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;

export type SalaryBonus = typeof salaryBonuses.$inferSelect;
export type InsertSalaryBonus = z.infer<typeof insertSalaryBonusSchema>;

export type ShiftSchedule = typeof shiftSchedules.$inferSelect;
export type InsertShiftSchedule = z.infer<typeof insertShiftScheduleSchema>;

export type MonthlyRevenue = typeof monthlyRevenues.$inferSelect;
export type InsertMonthlyRevenue = z.infer<typeof insertMonthlyRevenueSchema>;


