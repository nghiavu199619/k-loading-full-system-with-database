/**
 * AI DevOps Agent Routes for K-Loading Financial Management System
 * Provides monitoring, control, and status endpoints for the AI Agent
 */

import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Helper function to simulate logger (will be replaced when utils/logger.js is available)
const tempLogger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.log(`[DEBUG] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || '')
};

// System health check
router.get('/healthz', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'unknown',
      aiAgent: {
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        daemonRunning: false, // TODO: Check actual daemon status
        lastActivity: new Date().toISOString()
      }
    };

    const responseTime = Date.now() - startTime;
    (checks as any).responseTime = responseTime;

    const isHealthy = !!process.env.GEMINI_API_KEY;
    
    tempLogger.info('Health check completed', { 
      healthy: isHealthy, 
      responseTime,
      checks: Object.keys(checks)
    });

    res.status(isHealthy ? 200 : 503).json({
      healthy: isHealthy,
      ...checks
    });

  } catch (error: any) {
    tempLogger.error('Health check failed', { error: error.message });
    res.status(503).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check for deployment
router.get('/readyz', async (req: Request, res: Response) => {
  try {
    const checks = [];

    // Check environment variables
    const requiredEnvs = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY'];
    const envCheck = requiredEnvs.every(env => process.env[env]);
    checks.push({ 
      name: 'environment', 
      ready: envCheck, 
      details: { required: requiredEnvs, missing: requiredEnvs.filter(env => !process.env[env]) }
    });

    // Check log directory
    const logDir = path.join(process.cwd(), 'logs');
    const logDirExists = fs.existsSync(logDir);
    checks.push({ 
      name: 'logging', 
      ready: logDirExists, 
      details: { path: logDir, exists: logDirExists } 
    });

    // Check AI capabilities
    const aiReady = !!process.env.GEMINI_API_KEY;
    checks.push({ 
      name: 'ai_agent', 
      ready: aiReady, 
      details: { geminiConfigured: aiReady }
    });

    const allReady = checks.every(check => check.ready);
    
    res.status(allReady ? 200 : 503).json({
      ready: allReady,
      checks,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    tempLogger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      },
      application: {
        name: process.env.AI_AGENT_NAME || 'K-Loading-AI-DevOps',
        version: '1.0.0',
        environment: process.env.NODE_ENV
      },
      aiAgent: {
        geminiAvailable: !!process.env.GEMINI_API_KEY,
        autoSelfUpdate: process.env.AUTO_SELF_UPDATE === 'true',
        safeMode: process.env.SAFE_MODE === 'true',
        auditInterval: parseInt(process.env.AI_AUDIT_INTERVAL || '15'),
        maxSelfUpdateLOC: parseInt(process.env.MAX_SELF_UPDATE_LOC || '500')
      }
    };

    tempLogger.debug('Metrics collected', { metricsKeys: Object.keys(metrics) });
    res.json(metrics);

  } catch (error: any) {
    tempLogger.error('Metrics collection failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI Agent specific status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const aiStatus = {
      timestamp: new Date().toISOString(),
      agent: {
        name: process.env.AI_AGENT_NAME || 'K-Loading-AI-DevOps',
        version: '1.0.0',
        uptime: process.uptime()
      },
      configuration: {
        autoSelfUpdate: process.env.AUTO_SELF_UPDATE === 'true',
        safeMode: process.env.SAFE_MODE === 'true',
        auditInterval: parseInt(process.env.AI_AUDIT_INTERVAL || '15'),
        maxSelfUpdateLOC: parseInt(process.env.MAX_SELF_UPDATE_LOC || '500')
      },
      capabilities: {
        geminiAvailable: !!process.env.GEMINI_API_KEY,
        databaseAccess: !!process.env.DATABASE_URL,
        selfHealing: true,
        autoMigration: true,
        codeModification: process.env.AI_CAN_MODIFY_CODE === 'true',
        bugFixes: process.env.AI_CAN_FIX_BUGS === 'true',
        dependencyUpdates: process.env.AI_CAN_UPDATE_DEPS === 'true'
      },
      permissions: {
        readFiles: true,
        writeFiles: process.env.AI_CAN_MODIFY_CODE === 'true',
        executeCommands: true,
        modifyConfig: process.env.AI_CAN_MODIFY_CODE === 'true',
        databaseAccess: true,
        securityAudit: true
      },
      lastActivities: getRecentActivities(),
      stats: {
        totalOperations: 0, // TODO: Implement from logs
        successfulHealing: 0, // TODO: Implement from logs
        systemAudits: 0, // TODO: Implement from logs
        errorRate: 0, // TODO: Calculate from logs
        lastActivity: new Date().toISOString()
      }
    };

    res.json(aiStatus);

  } catch (error: any) {
    tempLogger.error('AI status check failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI Agent logs endpoint
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { lines = 100, level = 'all', type = 'all' } = req.query;
    
    const logDir = path.join(process.cwd(), 'logs');
    const currentLogFile = path.join(logDir, 'current.log');
    
    if (!fs.existsSync(currentLogFile)) {
      return res.json({
        logs: [],
        message: 'No log file found'
      });
    }

    const content = fs.readFileSync(currentLogFile, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    
    let filteredLines = allLines;
    
    // Filter by log level
    if (level !== 'all') {
      filteredLines = filteredLines.filter(line => {
        try {
          const parsed = JSON.parse(line);
          return parsed.level === level;
        } catch {
          return false;
        }
      });
    }
    
    // Filter by AI-related logs
    if (type === 'ai') {
      filteredLines = filteredLines.filter(line => {
        try {
          const parsed = JSON.parse(line);
          return parsed.type && ['ai_action', 'self_heal', 'system_audit', 'agent_init'].includes(parsed.type);
        } catch {
          return false;
        }
      });
    }

    const recentLines = filteredLines.slice(-(parseInt(lines as string)));
    const parsedLogs = recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line, timestamp: new Date().toISOString() };
      }
    });

    res.json({
      logs: parsedLogs,
      total: recentLines.length,
      filtered: filteredLines.length,
      available: allLines.length
    });

  } catch (error: any) {
    tempLogger.error('Log retrieval failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI Agent control endpoints
router.post('/daemon/start', async (req: Request, res: Response) => {
  try {
    tempLogger.info('🤖 Starting AI DevOps daemon via API');
    
    // TODO: Implement actual daemon start logic
    res.json({
      success: true,
      message: 'AI DevOps daemon start requested',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    tempLogger.error('Failed to start daemon', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/daemon/stop', async (req: Request, res: Response) => {
  try {
    tempLogger.info('🛑 Stopping AI DevOps daemon via API');
    
    // TODO: Implement actual daemon stop logic
    res.json({
      success: true,
      message: 'AI DevOps daemon stop requested',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    tempLogger.error('Failed to stop daemon', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Trigger manual system audit
router.post('/audit', async (req: Request, res: Response) => {
  try {
    tempLogger.info('🔍 Manual system audit triggered via API');
    
    const auditResults = {
      timestamp: new Date().toISOString(),
      triggered: 'manual_api',
      status: 'initiated',
      // TODO: Implement actual audit logic
    };

    res.json(auditResults);

  } catch (error: any) {
    tempLogger.error('Manual audit failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Trigger self-improvement cycle
router.post('/self-improve', async (req: Request, res: Response) => {
  try {
    tempLogger.info('🧠 Self-improvement cycle triggered via API');
    
    const result = {
      timestamp: new Date().toISOString(),
      triggered: 'manual_api',
      status: 'initiated',
      // TODO: Implement actual self-improvement logic
    };

    res.json(result);

  } catch (error: any) {
    tempLogger.error('Self-improvement failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI configuration endpoint
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      aiAgent: {
        name: process.env.AI_AGENT_NAME || 'K-Loading-AI-DevOps',
        autoSelfUpdate: process.env.AUTO_SELF_UPDATE === 'true',
        safeMode: process.env.SAFE_MODE === 'true',
        auditInterval: parseInt(process.env.AI_AUDIT_INTERVAL || '15'),
        maxSelfUpdateLOC: parseInt(process.env.MAX_SELF_UPDATE_LOC || '500')
      },
      capabilities: {
        geminiAvailable: !!process.env.GEMINI_API_KEY,
        databaseAccess: !!process.env.DATABASE_URL,
        canModifyCode: process.env.AI_CAN_MODIFY_CODE === 'true',
        canFixBugs: process.env.AI_CAN_FIX_BUGS === 'true',
        canUpdateDeps: process.env.AI_CAN_UPDATE_DEPS === 'true',
        canOptimizeDB: process.env.AI_CAN_OPTIMIZE_DB === 'true',
        canImproveUI: process.env.AI_CAN_IMPROVE_UI === 'true'
      },
      restrictions: {
        noSelfDestruct: true,
        noProductionAccess: true,
        backupBeforeChanges: true,
        testBeforeApply: true
      }
    };

    res.json(config);

  } catch (error: any) {
    tempLogger.error('Config retrieval failed', { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
function getRecentActivities() {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const currentLogFile = path.join(logDir, 'current.log');
    
    if (!fs.existsSync(currentLogFile)) {
      return [];
    }

    const content = fs.readFileSync(currentLogFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim()).slice(-10);
    
    const activities: any[] = [];
    lines.forEach(line => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type && ['ai_action', 'self_heal', 'system_audit'].includes(parsed.type)) {
          activities.push({
            timestamp: parsed.timestamp,
            type: parsed.type,
            message: parsed.message,
            traceId: parsed.traceId
          });
        }
      } catch {}
    });

    return activities;
  } catch (error) {
    return [];
  }
}

export default router;