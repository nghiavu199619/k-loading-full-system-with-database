/**
 * DataCenter Class - Central data processing and normalization
 * Handles all data transformations, validation, and business logic
 */

import { z } from 'zod';
import { rawToUI, uiToRaw } from './formatters';
import { schemas, type AccountData, type ExpenseData, type ClientData } from './validator';

export interface NormalizationOptions {
  decimalPlaces?: number;
  currency?: string;
  strictValidation?: boolean;
  userSettings?: any;
}

export class DataCenter {
  private defaultOptions: NormalizationOptions = {
    decimalPlaces: 0,
    currency: 'VND',
    strictValidation: true,
  };

  constructor(private options: NormalizationOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Normalize expense data for database storage
   */
  normalizeExpense(data: any): ExpenseData {
    const normalized = {
      ...data,
      amount: this.normalizeAmount(data.amount),
      status: this.normalizeStatus(data.status),
      month: this.normalizeMonth(data.month),
      year: this.normalizeYear(data.year),
      currency: data.currency || this.options.currency || 'VND',
    };

    // Validate using Zod schema
    if (this.options.strictValidation) {
      return schemas.expense.parse(normalized);
    }

    return normalized as ExpenseData;
  }

  /**
   * Normalize account data for database storage
   */
  normalizeAccount(data: any): AccountData {
    const normalized = {
      ...data,
      status: this.normalizeStatus(data.status),
      balance: data.balance ? this.normalizeAmount(data.balance) : undefined,
      dailyBudget: data.dailyBudget ? this.normalizeAmount(data.dailyBudget) : undefined,
      totalSpent: data.totalSpent ? this.normalizeAmount(data.totalSpent) : undefined,
      currency: data.currency || this.options.currency || 'VND',
    };

    // Validate using Zod schema
    if (this.options.strictValidation) {
      return schemas.account.parse(normalized);
    }

    return normalized as AccountData;
  }

  /**
   * Normalize client data for database storage
   */
  normalizeClient(data: any): ClientData {
    const normalized = {
      ...data,
      name: this.normalizeString(data.name),
      code: this.normalizeString(data.code),
      status: this.normalizeStatus(data.status),
      email: data.email ? this.normalizeEmail(data.email) : undefined,
      phone: data.phone ? this.normalizePhone(data.phone) : undefined,
    };

    // Validate using Zod schema
    if (this.options.strictValidation) {
      return schemas.client.parse(normalized);
    }

    return normalized as ClientData;
  }

  /**
   * Normalize status values to standardized format
   */
  normalizeStatus(status: string | number | null | undefined): string {
    if (typeof status === 'number') {
      const numericStatusMap: Record<number, string> = {
        0: 'Active', 1: 'Active', 2: 'Disable', 33: 'DH', 99: 'Error'
      };
      if (status in numericStatusMap) return numericStatusMap[status];
    }

    const s = (status ?? '').toString().trim();
    if (!s) return 'Active'; // Default fallback

    const ascii = s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu
      .toLowerCase();

    const statusMap: Record<string, string> = {
      'active': 'Active',
      'hoat dong': 'Active',
      'disable': 'Disable',
      'disabled': 'Disable',
      'tam dung': 'Paused',
      'paused': 'Paused',
      'dh': 'DH',
      'loi ptt': 'Lỗi PTT',
      'error': 'Error',
      // Direct mappings
      'Active': 'Active',
      'Disable': 'Disable',
      'Paused': 'Paused',
      'Error': 'Error',
      'DH': 'DH',
      'Lỗi PTT': 'Lỗi PTT',
    };

    return statusMap[ascii] ?? statusMap[s] ?? 'Active'; // fallback to Active if unknown
  }

  /**
   * Normalize monetary amounts
   */
  private normalizeAmount(amount: string | number | null | undefined): string {
    if (amount === null || amount === undefined || amount === '') return '0';
    const v = uiToRaw(amount, { returnNumber: true }) as number;
    return Number.isFinite(v) ? String(v) : '0';
  }

  /**
   * Normalize string fields (trim, clean)
   */
  private normalizeString(value: string | null | undefined): string {
    if (!value) return '';
    return value.toString().trim();
  }

  /**
   * Normalize email addresses
   */
  private normalizeEmail(email: string | null | undefined): string | undefined {
    if (!email) return undefined;
    return email.toString().toLowerCase().trim();
  }

  /**
   * Normalize phone numbers
   */
  private normalizePhone(phone: string | null | undefined): string | undefined {
    if (!phone) return undefined;
    // Remove spaces, dashes, and parentheses
    return phone.toString().replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Normalize month values
   */
  private normalizeMonth(month: string | number | null | undefined): number {
    if (!month) return new Date().getMonth() + 1;
    const num = typeof month === 'string' ? parseInt(month) : month;
    return Math.max(1, Math.min(12, num));
  }

  /**
   * Normalize year values
   */
  private normalizeYear(year: string | number | null | undefined): number {
    if (!year) return new Date().getFullYear();
    const num = typeof year === 'string' ? parseInt(year) : year;
    return Math.max(2020, Math.min(2030, num));
  }

  /**
   * Batch normalize multiple records
   */
  normalizeExpenses(expenses: any[]): ExpenseData[] {
    return expenses.map(expense => this.normalizeExpense(expense));
  }

  normalizeAccounts(accounts: any[]): AccountData[] {
    return accounts.map(account => this.normalizeAccount(account));
  }

  normalizeClients(clients: any[]): ClientData[] {
    return clients.map(client => this.normalizeClient(client));
  }

  /**
   * Validate data without normalization
   */
  validateExpense(data: any): { valid: boolean; errors?: any } {
    try {
      schemas.expense.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error.errors };
      }
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  validateAccount(data: any): { valid: boolean; errors?: any } {
    try {
      schemas.account.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error.errors };
      }
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      options: this.options,
      supportedCurrencies: ['VND', 'USD', 'EUR', 'JPY'],
      supportedStatuses: ['Active', 'Disable', 'Paused', 'Error', 'DH', 'Lỗi PTT'],
      version: '1.0.0',
    };
  }
}

// Export singleton instance
export const dataCenter = new DataCenter();