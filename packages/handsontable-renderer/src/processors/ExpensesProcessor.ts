import { TableDataProcessor } from '../types';

export class ExpensesProcessor implements TableDataProcessor {
  formatData(data: any[]): any[] {
    return data.map(expense => ({
      ...expense,
      // Format Vietnamese currency
      amount: this.formatVietnameseCurrency(expense.amount),
      // Format account display
      accountDisplay: this.formatAccountDisplay(expense.localId, expense.ownerId, expense.accountName),
      // Format client display
      clientDisplay: this.formatClientDisplay(expense.clientName, expense.clientCode),
      // Format dates
      createdAt: this.formatDate(expense.createdAt),
      updatedAt: this.formatDate(expense.updatedAt)
    }));
  }

  validateData(data: any[]): boolean {
    return data.every(expense => 
      expense.accountId && 
      expense.clientId && 
      expense.amount !== undefined
    );
  }

  processChanges(changes: any[][]): any[] {
    return changes.map(([row, prop, oldValue, newValue]) => {
      let processedValue = newValue;
      
      // Process Vietnamese currency format
      if (prop === 'amount') {
        processedValue = this.parseVietnameseCurrency(newValue);
      }

      return [row, prop, oldValue, processedValue];
    });
  }

  private formatVietnameseCurrency(value: number | string): string {
    if (!value || value === '0') return '0';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[,.]/g, '')) : value;
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  }

  private parseVietnameseCurrency(value: string): number {
    if (!value) return 0;
    // Handle Vietnamese decimal format (comma as decimal separator)
    const normalized = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  private formatAccountDisplay(localId: number, ownerId: number, accountName?: string): string {
    const baseDisplay = `${localId}-${ownerId}`;
    return accountName ? `${baseDisplay} (${accountName})` : baseDisplay;
  }

  private formatClientDisplay(clientName?: string, clientCode?: string): string {
    if (!clientName && !clientCode) return '';
    if (clientCode) return `${clientName} (${clientCode})`;
    return clientName || '';
  }

  private formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}