import { TableDataProcessor } from '../types';

export class CardsProcessor implements TableDataProcessor {
  formatData(data: any[]): any[] {
    return data.map(card => ({
      ...card,
      // Format card number with masking
      cardNumber: this.formatCardNumber(card.cardNumber),
      // Format balance
      balance: this.formatVietnameseCurrency(card.balance),
      limit: this.formatVietnameseCurrency(card.limit),
      // Format status
      status: this.formatStatus(card.status),
      // Format dates
      expiryDate: this.formatExpiryDate(card.expiryDate),
      createdAt: this.formatDate(card.createdAt),
      updatedAt: this.formatDate(card.updatedAt)
    }));
  }

  validateData(data: any[]): boolean {
    return data.every(card => 
      card.bankName && 
      card.cardNumber && 
      card.cardholderName
    );
  }

  processChanges(changes: any[][]): any[] {
    return changes.map(([row, prop, oldValue, newValue]) => {
      let processedValue = newValue;
      
      // Process currency fields
      if (prop === 'balance' || prop === 'limit') {
        processedValue = this.parseVietnameseCurrency(newValue);
      }
      
      // Process card number
      if (prop === 'cardNumber') {
        processedValue = this.normalizeCardNumber(newValue);
      }
      
      // Process status
      if (prop === 'status') {
        processedValue = this.normalizeStatus(newValue);
      }

      return [row, prop, oldValue, processedValue];
    });
  }

  private formatCardNumber(cardNumber: string): string {
    if (!cardNumber) return '';
    // Mask middle digits: 1234-****-****-5678
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length >= 8) {
      const first4 = cleaned.substring(0, 4);
      const last4 = cleaned.substring(cleaned.length - 4);
      return `${first4}-****-****-${last4}`;
    }
    return cardNumber;
  }

  private normalizeCardNumber(cardNumber: string): string {
    // Remove all non-digits and spaces, keep original format
    return cardNumber.replace(/[^\d\s-]/g, '');
  }

  private formatVietnameseCurrency(value: number | string): string {
    if (!value || value === '0') return '0 VND';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[,.]/g, '')) : value;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(num);
  }

  private parseVietnameseCurrency(value: string): number {
    if (!value) return 0;
    // Remove currency symbols and Vietnamese formatting
    const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active': 'Hoạt động',
      'inactive': 'Không hoạt động', 
      'expired': 'Hết hạn',
      'blocked': 'Bị khóa',
      'pending': 'Chờ kích hoạt'
    };
    return statusMap[status] || status;
  }

  private normalizeStatus(status: string): string {
    const reverseStatusMap: Record<string, string> = {
      'Hoạt động': 'active',
      'Không hoạt động': 'inactive',
      'Hết hạn': 'expired',
      'Bị khóa': 'blocked',
      'Chờ kích hoạt': 'pending'
    };
    return reverseStatusMap[status] || status;
  }

  private formatExpiryDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }
}