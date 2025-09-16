/**
 * @org/data-center - Vietnamese Data Normalization Package
 * 
 * Central package for data processing, validation, and formatting
 * for K-Loading Financial Management System
 */

// Core formatters - main exports for client usage
export { rawToUI, uiToRaw, smartParseVietnamese, isValidVietnameseNumber, convertToVietnameseFormat } from './formatters';

// Validation schemas and types
export { schemas } from './validator';
export type {
  AccountData,
  InsertAccountData,
  ClientData,
  InsertClientData,
  ExpenseData,
  InsertExpenseData,
  BulkAccountUpdate,
  BulkExpenseUpdate,
  WebSocketEvent,
  SystemSettings,
} from './validator';

// DataCenter class for server-side processing
export { DataCenter, dataCenter } from './DataCenter';
export type { NormalizationOptions } from './DataCenter';

// Import formatters for re-export
import { rawToUI, uiToRaw, smartParseVietnamese, convertToVietnameseFormat, isValidVietnameseNumber } from './formatters';
import { DataCenter, dataCenter } from './DataCenter';
import { schemas } from './validator';

// Convenience functions for quick access
export const formatters = {
  rawToUI,
  uiToRaw,
  smartParseVietnamese,
  convertToVietnameseFormat,
  isValidVietnameseNumber,
};

// Version info
export const version = '1.0.0';
export const description = 'Vietnamese data normalization and validation for K-Loading Financial';

// Default export for convenience
export default {
  rawToUI,
  uiToRaw,
  DataCenter,
  dataCenter,
  schemas,
  formatters,
  version,
  description,
};