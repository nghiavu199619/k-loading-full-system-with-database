/**
 * Zod Validation Schemas for K-Loading Financial System (optimized)
 */

import { z } from 'zod';
import { uiToRaw, isValidVietnameseNumber } from './formatters';

/** ---------------------------
 *  Helper builders
 *  ---------------------------
 */

// Parse VN/US/mixed → number. Chấp nhận string hoặc number.
// Hạn chế 12 chữ số thập phân để tránh Infinity/NaN do input lỗi.
export const makeVnAmountSchema = (opts?: {
  maxDecimals?: number;
  min?: number;
  max?: number;
  allowShorthand?: boolean;
  allowScientific?: boolean;
}) =>
  z.union([z.string(), z.number()]).transform((val, ctx) => {
    // empty -> 0 (tùy nghiệp vụ, có thể đổi thành ctx.addIssue + Zod.NEVER)
    if (val === '' || val === null || val === undefined) return 0;

    // Nếu là number hợp lệ thì dùng luôn
    if (typeof val === 'number' && Number.isFinite(val)) {
      return clampDecimals(val, opts?.maxDecimals ?? 12);
    }

    const parsed = uiToRaw(val as string, {
      returnNumber: true,
      maxDecimals: opts?.maxDecimals ?? 12,
      allowShorthand: opts?.allowShorthand ?? true,
      allowScientific: opts?.allowScientific ?? true,
    });

    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Số tiền không hợp lệ (định dạng VN/US).',
      });
      return z.NEVER;
    }

    let n = clampDecimals(parsed, opts?.maxDecimals ?? 12);

    if (typeof opts?.min === 'number' && n < opts.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        type: 'number',
        minimum: opts.min,
        inclusive: true,
        message: `Giá trị phải ≥ ${opts.min}.`,
      });
      return z.NEVER;
    }
    if (typeof opts?.max === 'number' && n > opts.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: 'number',
        maximum: opts.max,
        inclusive: true,
        message: `Giá trị phải ≤ ${opts.max}.`,
      });
      return z.NEVER;
    }

    return n;
  });

const clampDecimals = (n: number, d: number) =>
  Number.isInteger(n) ? n : Number(Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d);

// %: chấp nhận "10", "10%", "0,36", "49,36", "0.36" → number trong [0,100]
export const percentageNumberSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    if (val === '' || val === null || val === undefined) return 0;

    if (typeof val === 'number' && Number.isFinite(val)) {
      return inRange0to100(val, ctx);
    }

    const s = String(val).trim().replace(/%/g, '');
    // dùng uiToRaw để giữ đúng thập phân VN/US
    const parsed = uiToRaw(s, { returnNumber: true, maxDecimals: 6 });
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phần trăm không hợp lệ.' });
      return z.NEVER;
    }
    return inRange0to100(parsed, ctx);
  });

const inRange0to100 = (n: number, ctx: z.RefinementCtx) => {
  if (n < 0 || n > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Giá trị phần trăm phải trong khoảng 0–100.',
    });
    return z.NEVER;
  }
  return n;
};

// Mã tiền tệ: chuẩn hoá uppercase, cho phép 3–4 ký tự (e.g., VND, USD, USDT...)
// Bạn có thể thay bằng enum settings nếu muốn cứng.
export const currencyCodeSchema = z
  .string()
  .min(1)
  .transform((s) => s.trim().toUpperCase())
  .refine((code) => /^[A-Z]{3,4}$/.test(code), {
    message: 'Mã tiền tệ không hợp lệ (3–4 chữ cái).',
  });

// Số VN (string) – GIỮ để validate thô trên input raw, nhưng ưu tiên dùng makeVnAmountSchema ở model.
export const vietnameseNumberStringSchema = z
  .string()
  .refine((val) => {
    if (!val || val.trim() === '') return true; // cho phép trống
    return isValidVietnameseNumber(val);
  }, { message: 'Định dạng số VN/US không hợp lệ.' });

/** ---------------------------
 *  Status normalization
 *  ---------------------------
 */

const STATUS_CANONICAL = ['Active', 'Disable', 'Paused', 'Error', 'DH', 'Lỗi PTT'] as const;
export const statusSchema = z
  .string()
  .transform((s) => (s ?? '').toString().trim())
  .transform((s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
  .transform((ascii) => {
    const map: Record<string, (typeof STATUS_CANONICAL)[number]> = {
      'active': 'Active',
      'hoat dong': 'Active',
      'disable': 'Disable',
      'disabled': 'Disable',
      'tam dung': 'Paused',
      'paused': 'Paused',
      'error': 'Error',
      'dh': 'DH',
      'loi ptt': 'Lỗi PTT',
      // cho phép nhập đúng chuẩn cũng pass qua
      'active ': 'Active',
      'disable ': 'Disable',
      'paused ': 'Paused',
      'error ': 'Error',
    };
    return map[ascii] ?? 'Active'; // Default to Active instead of empty string
  })

/** ---------------------------
 *  Core entity schemas
 *  ---------------------------
 */

// Account
export const accountSchema = z.object({
  id: z.number().int().positive().optional(),
  localId: z.number().int().nonnegative(),
  ownerId: z.number().int().nonnegative(),
  accountId: z.string().min(1, 'ID TKQC là bắt buộc').trim(),
  accountName: z.string().min(1, 'Tên tài khoản là bắt buộc').trim(),
  status: statusSchema.optional(), // để DataCenter chuẩn hoá lần nữa nếu muốn
  currency: currencyCodeSchema.default('VND'),
  balance: makeVnAmountSchema().optional(),      // number
  dailyBudget: makeVnAmountSchema().optional(),  // number
  totalSpent: makeVnAmountSchema().optional(),   // number
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).strict();

export const insertAccountSchema = accountSchema.omit({
  id: true, createdAt: true, updatedAt: true,
});

// Client
export const clientSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, 'Client name is required').trim(),
  code: z.string().min(1, 'Client code is required').trim(),
  systemCode: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
  status: statusSchema.optional(),
  userId: z.number().int().nonnegative(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).strict();

export const insertClientSchema = clientSchema.omit({
  id: true, createdAt: true, updatedAt: true,
});

// Expense
export const expenseSchema = z.object({
  id: z.number().int().positive().optional(),
  accountId: z.number().int().nonnegative(),
  clientId: z.number().int().nonnegative(),
  amount: makeVnAmountSchema(), // ↩ number đã parse
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  currency: currencyCodeSchema.default('VND'),
  notes: z.string().optional(),
  status: statusSchema.optional(),
  userId: z.number().int().nonnegative(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).superRefine((val, ctx) => {
  // Ví dụ rule liên trường: amount không âm nếu status là 'Paid' (nếu sau này có)
  // if (val.status === 'Paid' && val.amount < 0) {
  //   ctx.addIssue({ code: 'custom', message: 'Số tiền không thể âm khi đã thanh toán.' });
  // }
});

// Create base schema without superRefine for omit
const baseExpenseSchema = z.object({
  id: z.number().int().positive().optional(),
  accountId: z.number().int().nonnegative(),
  clientId: z.number().int().nonnegative(),
  amount: makeVnAmountSchema(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  currency: currencyCodeSchema.default('VND'),
  notes: z.string().optional(),
  status: statusSchema.optional(),
  userId: z.number().int().nonnegative(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const insertExpenseSchema = baseExpenseSchema.omit({
  id: true, createdAt: true, updatedAt: true,
});

/** ---------------------------
 *  Bulk & Events
 *  ---------------------------
 */

export const bulkAccountUpdateSchema = z.object({
  accounts: z.array(z.object({
    id: z.number().int().positive(),
    changes: z.record(z.string(), z.any()),
  })).min(1, 'Danh sách accounts rỗng'),
  sessionId: z.string().min(1),
  userId: z.number().int().nonnegative(),
}).strict();

export const bulkExpenseUpdateSchema = z.object({
  expenses: z.array(z.object({
    accountId: z.number().int().nonnegative(),
    clientId: z.number().int().nonnegative(),
    amount: makeVnAmountSchema(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2030),
  })).min(1, 'Danh sách expenses rỗng'),
  userId: z.number().int().nonnegative(),
}).strict();

export const websocketEventSchema = z.object({
  type: z.enum(['account_update', 'expense_update', 'client_update', 'status_change']),
  data: z.any(),
  userId: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  timestamp: z.coerce.date().default(() => new Date()),
}).strict();

/** ---------------------------
 *  System settings
 *  ---------------------------
 */

export const systemSettingsSchema = z.object({
  id: z.number().optional(),
  userId: z.number().int().nonnegative(),
  statusOptions: z.array(z.string()).default(['Active', 'Disable', 'Paused', 'Error']),
  currencyOptions: z.array(z.object({
    code: currencyCodeSchema,
    symbol: z.string().min(1),
  })).default([{ code: 'VND', symbol: '₫' }, { code: 'USD', symbol: '$' }]),
  decimalPlaces: z.number().int().min(0).max(6).default(0),
  thousandSeparator: z.enum([',', '.', ' ']).default('.'),
  decimalSeparator: z.enum([',', '.']).default(','), // vi-VN mặc định dấu thập phân ','
  defaultCurrency: currencyCodeSchema.default('VND'),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).strict();

/** ---------------------------
 *  Export collection & types
 *  ---------------------------
 */

export const schemas = {
  account: accountSchema,
  insertAccount: insertAccountSchema,
  client: clientSchema,
  insertClient: insertClientSchema,
  expense: expenseSchema,
  insertExpense: insertExpenseSchema,
  bulkAccountUpdate: bulkAccountUpdateSchema,
  bulkExpenseUpdate: bulkExpenseUpdateSchema,
  websocketEvent: websocketEventSchema,
  systemSettings: systemSettingsSchema,
  // primitives
  vietnameseNumber: vietnameseNumberStringSchema,
  currencyCode: currencyCodeSchema,
  percentageNumber: percentageNumberSchema,
  vnAmount: makeVnAmountSchema, // builder
};

export type AccountData = z.infer<typeof accountSchema>;
export type InsertAccountData = z.infer<typeof insertAccountSchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type InsertClientData = z.infer<typeof insertClientSchema>;
export type ExpenseData = z.infer<typeof expenseSchema>;
export type InsertExpenseData = z.infer<typeof insertExpenseSchema>;
export type BulkAccountUpdate = z.infer<typeof bulkAccountUpdateSchema>;
export type BulkExpenseUpdate = z.infer<typeof bulkExpenseUpdateSchema>;
export type WebSocketEvent = z.infer<typeof websocketEventSchema>;
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

// Legacy exports for backward compatibility
export const vietnameseNumberSchema = makeVnAmountSchema();