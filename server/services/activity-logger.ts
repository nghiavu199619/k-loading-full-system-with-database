import { db } from "../db";
import { logsKloading, activityLogs } from "@shared/schema";

interface LogData {
  tableName: string;
  recordId: number;
  actionType: 'create' | 'update' | 'delete' | 'login' | 'logout';
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
  userId?: number;
  userSession?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ActivityLogData {
  userId: number;
  action: string;
  description: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityLogger {
  /**
   * Log detailed field-level changes to logsKloading table
   */
  static async logFieldChange(data: LogData): Promise<void> {
    try {
      // Fix IP address format - PostgreSQL inet type doesn't support comma-separated IPs
      let cleanIpAddress = data.ipAddress;
      if (cleanIpAddress && cleanIpAddress.includes(',')) {
        cleanIpAddress = cleanIpAddress.split(',')[0].trim();
      }
      
      await db.insert(logsKloading).values({
        tableName: data.tableName,
        recordId: data.recordId,
        fieldName: data.fieldName || 'record',
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        userId: data.userId,
        userSession: data.userSession || 'anonymous',
        userName: data.userName || 'Unknown',
        actionType: data.actionType,
        ipAddress: cleanIpAddress,
        userAgent: data.userAgent,
      });
      
      console.log(`📝 Logged ${data.actionType} on ${data.tableName}#${data.recordId} by user ${data.userId}`);
    } catch (error) {
      console.error('❌ Failed to log field change:', error);
    }
  }

  // Simplified logging - all operations use logFieldChange to prevent duplicates

  /**
   * Get display name for table
   */
  private static getTableDisplayName(tableName: string): string {
    const tableNames: { [key: string]: string } = {
      'clients': 'Khách hàng',
      'ad_accounts': 'Tài khoản quảng cáo',
      'client_accounts': 'Gán tài khoản',
      'auth_users': 'Nhân viên',
      'fee_changes': 'Thay đổi phí',
      'account_expenses': 'Chi phí tài khoản',
      'companies': 'Công ty',
      'budgets': 'Ngân sách',
      'transactions': 'Giao dịch',
      'reconciliations': 'Đối soát',
    };
    return tableNames[tableName] || tableName;
  }

  /**
   * Middleware helper to extract request context
   */
  static getRequestContext(req: any): { ipAddress?: string; userAgent?: string; userSession?: string; userName?: string } {
    return {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userSession: req.user?.sessionToken,
      userName: req.user?.fullName || req.user?.username,
    };
  }
}

export default ActivityLogger;