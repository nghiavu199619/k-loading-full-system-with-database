import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupWebSocket } from "../middleware/websocket";
import { setupDashboardRoutes } from "./dashboard";
import { setupClientRoutes } from "./clients";
import { setupAdAccountRoutes } from "./ad-accounts";
import { setupAdAccountsBulkRoutes } from "./ad-accounts-bulk";
import { setupAccountExpensesRoutes } from "./account-expenses";
import { setupExpenseVisibleAccountsRoutes } from "./expense-visible-accounts";


import { setupEmployeeRoutes } from "./employees";
import { setupSettingsRoutes } from "./settings";
import { setupActivityLogRoutes } from "./activity-logs";
import { setupUniversalRoutes } from "./universal";
import { setupSystemLogRoutes } from "./system-logs";
import { setupAdminRoutes } from "./admin";
import { setupUserManagementRoutes } from "./user-management";
import authRoutes from "./auth";
import feeChangesRoutes from "./fee-changes";
import aiDevOpsRoutes from "./ai-devops";


export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup WebSocket for real-time communication
  const wsManager = setupWebSocket(app, httpServer);

  // Removed unused test routes for cleaner production code

  // Auth routes - New authentication system
  app.use('/api/auth', authRoutes);
  app.use('/api/fee-changes', feeChangesRoutes);
  
  // AI DevOps Agent routes - Monitoring and control
  app.use('/api/ai', aiDevOpsRoutes);
  app.use('/api/ai', (await import('./ai-live-demo')).default);

  // Setup all route modules
  setupDashboardRoutes(app);
  setupClientRoutes(app);
  setupAdAccountRoutes(app, wsManager);
  
  // ✅ CRITICAL: Register bulk routes for WebSocket NEW_ROW_CREATED broadcasts
  app.use('/api/ad-accounts', setupAdAccountsBulkRoutes(wsManager));
  
  setupAccountExpensesRoutes(app, wsManager);
  setupExpenseVisibleAccountsRoutes(app, wsManager);
  
  // Card management routes with WebSocket support
  app.use('/api/card-management', (await import('./card-management')).default);
  
  // Via management routes with WebSocket support
  app.use('/api/via-management', (await import('./via-management')).default(wsManager));
  
  // Threshold management routes
  app.use('/api/threshold-management', (await import('./threshold-management')).default);
  
  // Bank orders routes
  app.use('/api/bank-orders', (await import('./bank-orders')).bankOrdersRouter);
  
  // Payment management routes
  app.use('/api/payment-management', (await import('./payment-management')).default);
  
  // Time tracking routes
  app.use('/api/time-tracking', (await import('./time-tracking')).default);
  
  // Email management routes
  app.use('/api/email-management', (await import('./email-management')).default);
  
  setupEmployeeRoutes(app);
  setupSettingsRoutes(app);
  setupActivityLogRoutes(app);
  setupUniversalRoutes(app, wsManager);
  setupSystemLogRoutes(app);
  setupAdminRoutes(app);
  setupUserManagementRoutes(app); // Admin routes for system management

  return httpServer;
}