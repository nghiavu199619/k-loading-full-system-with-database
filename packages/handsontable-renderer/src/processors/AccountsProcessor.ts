import { TableDataProcessor } from '../types';

export class AccountsProcessor implements TableDataProcessor {
  formatData(data: any[]): any[] {
    return data.map(account => ({
      ...account,
      // Format Vietnamese numbers
      budget: this.formatVietnameseNumber(account.budget),
      spent: this.formatVietnameseNumber(account.spent),
      // Format status
      status: this.formatStatus(account.status),
      // Format dates
      createdAt: this.formatDate(account.createdAt),
      updatedAt: this.formatDate(account.updatedAt)
    }));
  }

  validateData(data: any[]): boolean {
    return data.every(account => 
      account.name && 
      account.accountId && 
      typeof account.budget === 'number'
    );
  }

  processChanges(changes: any[][]): any[] {
    return changes.map(([row, prop, oldValue, newValue]) => {
      let processedValue = newValue;
      
      // Process Vietnamese number format
      if (prop === 'budget' || prop === 'spent') {
        processedValue = this.parseVietnameseNumber(newValue);
      }
      
      // Process status
      if (prop === 'status') {
        processedValue = this.normalizeStatus(newValue);
      }

      return [row, prop, oldValue, processedValue];
    });
  }

  private formatVietnameseNumber(value: number | string): string {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[,.]/g, '')) : value;
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  private parseVietnameseNumber(value: string): number {
    if (!value) return 0;
    return parseFloat(value.replace(/[,.]/g, '').replace(',', '.'));
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active': 'Hoạt động',
      'inactive': 'Tạm dừng',
      'pending': 'Chờ duyệt',
      'suspended': 'Bị khóa'
    };
    return statusMap[status] || status;
  }

  private normalizeStatus(status: string): string {
    const reverseStatusMap: Record<string, string> = {
      'Hoạt động': 'active',
      'Tạm dừng': 'inactive',
      'Chờ duyệt': 'pending',
      'Bị khóa': 'suspended'
    };
    return reverseStatusMap[status] || status;
  }

  private formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }
}