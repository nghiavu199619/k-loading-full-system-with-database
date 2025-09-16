# @org/data-center

Vietnamese data normalization and validation package for K-Loading Financial Management System.

## Overview

This package provides centralized data processing, validation, and formatting utilities specifically designed for Vietnamese financial data handling.

## Features

- **Vietnamese Number Formatting**: Convert between UI display and database storage formats
- **Data Validation**: Comprehensive Zod schemas for all data types
- **Status Normalization**: Standardize status values across Vietnamese and English variants
- **Currency Handling**: Support for VND, USD, EUR, JPY with proper formatting
- **Type Safety**: Full TypeScript support with exported types

## Core Components

### Formatters (`formatters.ts`)

```typescript
import { rawToUI, uiToRaw } from '@org/data-center';

// Convert database value to UI display
const displayValue = rawToUI(1000000, { type: 'currency', showSymbol: true });
// Output: "1,000,000 ₫"

// Convert UI input to database format  
const dbValue = uiToRaw("1,000,000 ₫", { type: 'integer' });
// Output: 1000000
```

### Validator (`validator.ts`)

```typescript
import { schemas } from '@org/data-center';

// Validate expense data
const result = schemas.expense.parse(expenseData);

// Validate Vietnamese number format
const isValid = schemas.vietnameseNumber.parse("1.234.567,89");
```

### DataCenter Class (`DataCenter.ts`)

```typescript
import { DataCenter } from '@org/data-center';

const dataCenter = new DataCenter({
  decimalPlaces: 0,
  currency: 'VND',
  strictValidation: true
});

// Normalize expense data
const normalizedExpense = dataCenter.normalizeExpense(rawExpenseData);

// Normalize status values
const status = dataCenter.normalizeStatus('hoạt động'); // Returns: 'Active'
```

## Usage Patterns

### Client Side (UI Components)
```typescript
import { rawToUI, uiToRaw } from '@org/data-center';

// Display formatting
const displayAmount = rawToUI(expense.amount, { type: 'currency' });

// Input processing
const rawAmount = uiToRaw(userInput, { type: 'integer' });
```

### Server Side (API Layer)
```typescript
import { DataCenter, schemas } from '@org/data-center';

// In server/api.ts
const dataCenter = new DataCenter();

// Validate and normalize
const normalizedData = dataCenter.normalizeExpense(requestData);
const validation = schemas.expense.parse(normalizedData);
```

## Supported Formats

### Number Formats
- Vietnamese: `1.234.567,89`
- International: `1,234,567.89`

### Status Values
- English: `Active`, `Disable`, `Paused`, `Error`
- Vietnamese: `Hoạt động`, `Tạm dừng`, `Lỗi PTT`, `DH`

### Currencies
- VND (₫), USD ($), EUR (€), JPY (¥), KAG (BEM)

## Build & Development

```bash
# Build the package
npm run build

# Watch mode for development
npm run dev
```

## Architecture Integration

This package is designed to be used in the data flow:

1. **Client Input** → `uiToRaw()` → **Server API**
2. **Server API** → `DataCenter.normalize()` → **Database**
3. **Database** → `rawToUI()` → **Client Display**

All HTTP/WebSocket requests should flow through `server/api.ts` which uses DataCenter for validation and normalization before database operations.