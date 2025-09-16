// Components
export { TabContainer } from './components/TabContainer';
export { HandsontableWrapper } from './components/HandsontableWrapper';

// Data Processors
export { AccountsProcessor } from './processors/AccountsProcessor';
export { ExpensesProcessor } from './processors/ExpensesProcessor';
export { CardsProcessor } from './processors/CardsProcessor';

// Types
export type {
  TableConfig,
  ColumnConfig,
  TabConfig,
  HandsontableRendererProps,
  TableType,
  TableDataProcessor
} from './types';

// Utility functions
export const createTableConfig = (
  type: 'accounts' | 'expenses' | 'cards',
  data: any[],
  settings?: any
) => {
  const baseConfig = {
    columns: [] as any[],
    data,
    settings: {
      licenseKey: 'non-commercial-and-evaluation',
      stretchH: 'all',
      ...settings
    }
  };

  switch (type) {
    case 'accounts':
      baseConfig.columns = [
        { data: 'localId', title: 'ID', type: 'numeric', readOnly: true, width: 60 },
        { data: 'name', title: 'Tên tài khoản', type: 'text', width: 200 },
        { data: 'accountId', title: 'Account ID', type: 'text', width: 120 },
        { data: 'status', title: 'Trạng thái', type: 'dropdown', source: ['Hoạt động', 'Tạm dừng', 'Chờ duyệt', 'Bị khóa'], width: 120 },
        { data: 'budget', title: 'Ngân sách', type: 'text', width: 120 },
        { data: 'spent', title: 'Đã chi', type: 'text', readOnly: true, width: 120 },
        { data: 'updatedAt', title: 'Cập nhật', type: 'text', readOnly: true, width: 120 }
      ];
      break;
      
    case 'expenses':
      baseConfig.columns = [
        { data: 'accountDisplay', title: 'Tài khoản', type: 'text', readOnly: true, width: 120 },
        { data: 'clientDisplay', title: 'Khách hàng', type: 'text', readOnly: true, width: 150 },
        { data: 'amount', title: 'Số tiền', type: 'text', width: 100 },
        { data: 'updatedAt', title: 'Cập nhật', type: 'text', readOnly: true, width: 140 }
      ];
      break;
      
    case 'cards':
      baseConfig.columns = [
        { data: 'id', title: 'ID', type: 'numeric', readOnly: true, width: 60 },
        { data: 'bankName', title: 'Ngân hàng', type: 'dropdown', source: ['Vietcombank', 'Techcombank', 'BIDV', 'VietinBank', 'Agribank', 'MB Bank', 'ACB', 'TPBank', 'HDBank', 'SHB'], width: 120 },
        { data: 'cardNumber', title: 'Số thẻ', type: 'text', width: 150 },
        { data: 'cardholderName', title: 'Chủ thẻ', type: 'text', width: 150 },
        { data: 'balance', title: 'Số dư', type: 'text', width: 120 },
        { data: 'limit', title: 'Hạn mức', type: 'text', width: 120 },
        { data: 'status', title: 'Trạng thái', type: 'dropdown', source: ['Hoạt động', 'Không hoạt động', 'Hết hạn', 'Bị khóa', 'Chờ kích hoạt'], width: 120 },
        { data: 'expiryDate', title: 'Ngày hết hạn', type: 'text', width: 100 }
      ];
      break;
  }

  return baseConfig;
};

// Default export for convenience - using types only to avoid circular imports
export default {
  createTableConfig
};