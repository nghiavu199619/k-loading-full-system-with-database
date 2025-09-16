// Handsontable types definition
declare global {
  namespace Handsontable {
    interface GridSettings {
      licenseKey?: string;
      stretchH?: string;
      autoWrapRow?: boolean;
      autoWrapCol?: boolean;
      rowHeaders?: boolean;  
      colHeaders?: boolean;
      contextMenu?: boolean;
      manualRowResize?: boolean;
      manualColumnResize?: boolean;
      filters?: boolean;
      dropdownMenu?: boolean;
      [key: string]: any;
    }
  }
}

export interface TableConfig {
  columns: ColumnConfig[];
  data: any[];
  settings?: Partial<Handsontable.GridSettings>;
  onCellChange?: (changes: any[][]) => void;
  onAfterLoadData?: () => void;
  onAfterInit?: () => void;
}

export interface ColumnConfig {
  data: string;
  title: string;
  type?: 'text' | 'numeric' | 'dropdown' | 'checkbox' | 'date';
  source?: string[] | (() => string[]);
  validator?: (value: any, callback: (valid: boolean) => void) => void;
  renderer?: string | ((instance: any, td: HTMLElement, row: number, col: number, prop: string, value: any, cellProperties: any) => void);
  readOnly?: boolean;
  width?: number;
  className?: string;
}

export interface TabConfig {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  props?: any;
}

export interface HandsontableRendererProps {
  tabs: TabConfig[];
  defaultTab?: string;
  className?: string;
}

export type TableType = 'accounts' | 'expenses' | 'cards';

export interface TableDataProcessor {
  formatData: (data: any[]) => any[];
  validateData: (data: any[]) => boolean;
  processChanges: (changes: any[][]) => any[];
}