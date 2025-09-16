import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAutoSave, type AutoSaveChange } from '@/hooks/useAutoSave';
import { AutoSaveStatus } from '@/components/ui/auto-save-status';
import { useAuth } from '@/hooks/useAuth';
import { nanoid } from 'nanoid';
import { EmployeeTagManagementDialog } from '@/components/EmployeeTagManagementDialog';

// Import Handsontable
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';

interface ViaManagement {
  id: number;
  tenNoiBo: string;
  idVia: string;
  pass: string;
  twoFA?: string;
  mail?: string;
  passMail?: string;
  mailKhoiPhuc?: string;
  passMailKhoiPhuc?: string;
  phanChoNV?: string;
  ghiChuNoiBo?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

const VIA_HEADERS = [
  'TÊN NỘI BỘ',
  'ID VIA', 
  'PASS',
  '2FA',
  'MAIL',
  'PASS MAIL',
  'MAIL Khôi phục',
  'PASS MAIL khôi phục',
  'phân cho NV',
  'Ghi Chú Nội Bộ'
];

const VIA_FIELD_MAPPING = [
  'tenNoiBo',
  'idVia',
  'pass',
  'twoFA',
  'mail',
  'passMail',
  'mailKhoiPhuc',
  'passMailKhoiPhuc',
  'phanChoNV',
  'ghiChuNoiBo'
];



export default function ViaManagementPage() {
  const [handsontableReady, setHandsontableReady] = useState(false);
  const [hotInstance, setHotInstance] = useState<Handsontable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Employee Tag Management Dialog state
  const [employeeTagDialogOpen, setEmployeeTagDialogOpen] = useState(false);
  const [selectedViaForTags, setSelectedViaForTags] = useState<{
    id: number;
    currentTags: string;
    rowIndex: number;
  } | null>(null);

  // Fetch via management data - always fetch, not conditional on handsontableReady
  const { data: viaData = [], isLoading, error } = useQuery<ViaManagement[]>({
    queryKey: ['/api/via-management'],
    enabled: true,
  });
  
  // Debug viaData changes
  useEffect(() => {
    console.log('🔍 viaData changed:', {
      length: viaData?.length,
      isLoading,
      firstItem: viaData?.[0],
      allIds: viaData?.map(v => v.id)
    });
  }, [viaData, isLoading]);

  // Convert via data to Handsontable format
  const convertViaToTableData = useCallback((vias: ViaManagement[]) => {
    const rows = vias.map(via => [
      via.tenNoiBo || '',
      via.idVia || '',
      via.pass || '',
      via.twoFA || '',
      via.mail || '',
      via.passMail || '',
      via.mailKhoiPhuc || '',
      via.passMailKhoiPhuc || '',
      via.phanChoNV || '',
      via.ghiChuNoiBo || ''
    ]);

    // Add empty rows to ensure minimum 10 rows
    const minRows = 10;
    while (rows.length < minRows) {
      rows.push(new Array(VIA_HEADERS.length).fill(''));
    }

    return rows;
  }, []);

  // Batch save mutation
  const batchSaveMutation = useMutation({
    mutationFn: async (changes: AutoSaveChange[]) => {
      console.log('📤 Sending batch save request with changes:', changes);
      const response = await apiRequest('POST', '/api/via-management/batch', {
        changes,
        sessionId: nanoid(),
        batchId: nanoid()
      });
      const result = await response.json();
      console.log('📥 Received batch save response:', result);
      return result;
    },
    onSuccess: (data) => {
      // Don't invalidate queries to prevent reload during editing
      console.log('✅ Via management batch save successful:', data);
      
      // Update local viaData state with the saved data
      if (data?.results) {
        data.results.forEach((result: any) => {
          if (result.success && result.data) {
            console.log('📝 Updating local state with saved via:', result.data);
          }
        });
      }
    },
    onError: (error) => {
      console.error('❌ Via management batch save failed:', error);
      console.error('❌ Error details:', error);
      throw error;
    }
  });

  // Initialize enhanced AutoSave system
  const { addChange, forceFlush, saveStatus, pendingCount } = useAutoSave(
    async (changes: AutoSaveChange[]) => {
      await batchSaveMutation.mutateAsync(changes);
    },
    {
      debounceDelay: 800,
      maxRetries: 3
    }
  );

  // Convert table row to via object
  const convertRowToVia = useCallback((rowData: any[], rowIndex: number) => {
    const via: any = {};
    VIA_FIELD_MAPPING.forEach((field, index) => {
      via[field] = rowData[index] || '';
    });
    
    // Find existing via for this row - debug this
    const existingVia = viaData && viaData[rowIndex];
    console.log(`🔍 convertRowToVia: row ${rowIndex}, viaData length: ${viaData?.length}, existingVia:`, existingVia);
    if (existingVia) {
      via.id = existingVia.id;
    }
    
    return via;
  }, [viaData]);

  // Fresh version for use in handleCellChange to avoid stale closure
  const convertRowToViaFresh = useCallback((rowData: any[], rowIndex: number, freshViaData: ViaManagement[]) => {
    const via: any = {};
    VIA_FIELD_MAPPING.forEach((field, index) => {
      via[field] = rowData[index] || '';
    });
    
    // Find existing via for this row using fresh data
    const existingVia = freshViaData[rowIndex];
    console.log(`🔍 convertRowToViaFresh: row ${rowIndex}, freshViaData length: ${freshViaData.length}, existingVia:`, existingVia);
    if (existingVia) {
      via.id = existingVia.id;
    }
    
    return via;
  }, []);

  // Enhanced cell change handler with intelligent auto-save
  const handleCellChange = useCallback((changes: any[] | null, source: string) => {
    if (!changes || source === 'loadData' || source === 'populateFromArray') {
      return;
    }

    console.log(`🔄 Processing ${changes.length} cell changes from source: ${source}`);
    console.log('🔍 Changes details:', changes);

    changes.forEach(([row, col, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      // Get fresh viaData from query cache to avoid stale closure
      const currentViaData = queryClient.getQueryData<ViaManagement[]>(['/api/via-management']) || [];
      console.log(`🔍 Fresh viaData length from cache: ${currentViaData.length}`);

      // Skip if no meaningful new value - but allow empty values for updates to clear fields
      if (!newValue || newValue.toString().trim() === '') {
        // Only skip for empty values if this would create a completely empty new record
        const isNewRow = row >= currentViaData.length;
        if (isNewRow) {
          console.log(`⚠️ Row ${row} col ${col}: No meaningful new value for new row, skipping save`);
          return;
        }
        console.log(`🔄 Row ${row} col ${col}: Clearing field value (empty update)`);
      }

      // Get fresh row data after the change
      setTimeout(() => {
        const rowData = hotInstance?.getDataAtRow(row) || [];
        console.log(`🔍 Row ${row} fresh data:`, rowData);
        
        // Use fresh viaData for conversion
        const viaObject = convertRowToViaFresh(rowData, row, currentViaData);
        console.log(`🔍 Converted via object:`, viaObject);
        
        // Also ensure we have the current cell's new value
        const fieldNames = ['tenNoiBo', 'idVia', 'pass', 'twoFA', 'mail', 'passMail', 'mailKhoiPhuc', 'passMailKhoiPhuc', 'phanChoNV', 'ghiChuNoiBo'];
        if (fieldNames[col]) {
          (viaObject as any)[fieldNames[col]] = newValue;
        }
        
        console.log(`🔍 Final via object with new value:`, viaObject);
      
        // Check if this row corresponds to an existing via using fresh data
        const existingVia = currentViaData[row];
        
        // Determine operation: only create if editing a completely new row beyond existing data
        const actualDataLength = currentViaData.length;
        const isNewRow = row >= actualDataLength;
        const operation = isNewRow ? 'create' : 'update';
        const id = existingVia?.id;
        
        console.log(`🔍 Operation decision: row=${row}, actualDataLength=${actualDataLength}, isNewRow=${isNewRow}, operation=${operation}, id=${id}`);
        
        // Skip creation of completely empty records
        if (operation === 'create') {
          const hasAnyMeaningfulData = Object.values(viaObject).some(value => 
            value && value.toString().trim() !== ''
          );
          if (!hasAnyMeaningfulData) {
            console.log(`⚠️ Row ${row}: Skipping creation of completely empty record`);
            return;
          }
        }
        
        console.log(`💾 Row ${row}: viaData.length=${viaData?.length}, isNewRow=${isNewRow}, operation=${operation}`);
        console.log(`💾 Existing via for row ${row}:`, existingVia);
        
        if (operation === 'update' && existingVia) {
          viaObject.id = existingVia.id;
          console.log(`🔄 Updating existing via with ID: ${existingVia.id}`);
        } else if (operation === 'create') {
          console.log(`➕ Creating new via for row ${row}`);
        }
        
        // Add to auto-save queue (remove force immediate save to prevent duplicates)
        console.log(`📤 Adding to auto-save queue: ${operation} for row ${row}`);
        addChange(row, col, viaObject, operation, id);
      }, 50); // Small delay to ensure data is set
    });
  }, [queryClient, hotInstance, addChange]);

  // Employee Tag Renderer - Click to open tag management dialog  
  const employeeTagRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string | number, value: any, cellProperties: any) => {
    // Clear any existing content
    td.innerHTML = '';
    
    // Set basic styling
    td.style.textAlign = 'left';
    td.style.paddingLeft = '8px';
    td.style.paddingRight = '8px';
    td.style.verticalAlign = 'middle';
    td.style.whiteSpace = 'nowrap';
    td.style.overflow = 'hidden';
    td.style.textOverflow = 'ellipsis';
    
    // Create main container
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.height = '100%';
    container.style.width = '100%';
    container.style.overflow = 'hidden';
    
    // Create clickable text
    const tagText = document.createElement('span');
    tagText.className = 'employee-tag-text cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-blue-600 font-medium';
    
    // Display format: "Gắn NV : Tên1, Tên2" or "Gắn NV"
    if (value && value.length > 0) {
      tagText.textContent = `Gắn NV : ${value}`;
    } else {
      tagText.textContent = 'Gắn NV';
    }
    
    // Add click handler if user can edit
    const canEdit = user?.role === 'director' || user?.role === 'manager';
    if (canEdit && row < viaData.length) {
      tagText.addEventListener('click', (e) => {
        e.stopPropagation();
        const via = viaData[row];
        const currentTags = value || '';
        
        if (via && via.id) {
          setSelectedViaForTags({
            id: via.id,
            currentTags: currentTags,
            rowIndex: row
          });
          setEmployeeTagDialogOpen(true);
        }
      });
    }
    
    container.appendChild(tagText);
    td.appendChild(container);
    
    return td;
  }, [user?.role, viaData]);

  // Handle employee tags update
  const handleEmployeeTagsUpdate = (newTags: string) => {
    if (selectedViaForTags && hotInstance) {
      // Update the cell value immediately in the table
      hotInstance.setDataAtCell(
        selectedViaForTags.rowIndex, 
        8, // phân cho NV column index
        newTags, 
        'external' // Use external source to prevent auto-save trigger
      );
      
      console.log(`✅ EMPLOYEE TAG UPDATE: Via ${selectedViaForTags.id} tags updated to: "${newTags}"`);
    }
  };

  // Handle employee tag dialog close
  const handleEmployeeTagDialogClose = () => {
    setEmployeeTagDialogOpen(false);
    setSelectedViaForTags(null);
  };

  // Initialize Handsontable
  useEffect(() => {
    if (!containerRef.current || hotInstance) return;

    const hot = new Handsontable(containerRef.current, {
      data: convertViaToTableData(viaData || []),
      colHeaders: VIA_HEADERS,
      columns: VIA_HEADERS.map((header, index) => ({
        data: index,
        type: 'text',
        className: index < 3 ? 'required-field' : '', // TÊN NỘI BỘ, ID VIA, PASS are required
        readOnly: false,
        renderer: index === 8 ? employeeTagRenderer : undefined // phân cho NV column uses tag renderer
      })),
      rowHeaders: true,
      contextMenu: true,
      manualRowResize: true,
      manualColumnResize: true,
      filters: true,
      dropdownMenu: true,
      columnSorting: true,
      minRows: 10,
      minCols: 10,
      rowHeights: 35,
      stretchH: 'all',
      licenseKey: 'non-commercial-and-evaluation',
      afterChange: handleCellChange,
      beforeKeyDown: (event) => {
        // Handle Ctrl+F for search
        if (event.ctrlKey && event.key === 'f') {
          event.preventDefault();
          // Could implement custom search here
        }
      }
    });

    setHotInstance(hot);
    console.log('✅ Via Management Handsontable initialized');
  }, [queryClient, handleCellChange, convertViaToTableData]);

  // Update table when data changes - with debug logs
  useEffect(() => {
    if (!hotInstance || !viaData) {
      console.log('🚫 Skipping loadData: hotInstance=', !!hotInstance, 'viaData=', !!viaData);
      return;
    }

    const tableData = convertViaToTableData(viaData);
    console.log(`📊 Loading data: viaData.length=${viaData.length}, tableData.length=${tableData.length}`);
    console.log(`📊 First via sample:`, viaData[0]);
    
    hotInstance.loadData(tableData);
    console.log(`📊 Loaded ${viaData.length} vias into table`);
  }, [hotInstance, viaData, convertViaToTableData]);

  // Set up Handsontable ready state
  useEffect(() => {
    setHandsontableReady(true);
    console.log('✅ Handsontable loaded successfully');
  }, []);

  // Enhanced cleanup with auto-save flush
  useEffect(() => {
    return () => {
      // Auto-save hook handles cleanup automatically
      if (hotInstance) {
        hotInstance.destroy();
      }
    };
  }, [hotInstance]);

  if (error) {
    return (
      <div className="h-screen w-full flex justify-center items-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-600">Lỗi tải dữ liệu</h3>
          <p className="text-sm text-gray-500 mt-2">Không thể tải dữ liệu Via management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden">
      <div 
        ref={containerRef}
        className="h-full w-full"
        style={{ 
          fontSize: '13px'
        }}
      />

      {/* Enhanced loading and save status indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex justify-center items-center bg-white/50">
          <div className="text-sm text-gray-500">Đang tải dữ liệu...</div>
        </div>
      )}

      {/* Enhanced auto-save status indicator */}
      <AutoSaveStatus status={saveStatus} pendingCount={pendingCount} />

      {/* Employee Tag Management Dialog */}
      {employeeTagDialogOpen && selectedViaForTags && (
        <EmployeeTagManagementDialog
          isOpen={employeeTagDialogOpen}
          onClose={handleEmployeeTagDialogClose}
          currentTags={selectedViaForTags.currentTags}
          recordType="via"
          recordId={selectedViaForTags.id}
          onTagsUpdate={handleEmployeeTagsUpdate}
        />
      )}

      <style>{`
        .required-field {
          background-color: #fef3cd !important;
        }
        .htInvalid {
          background-color: #f8d7da !important;
        }
        .employee-tag-text {
          display: inline-block;
          transition: all 0.2s ease;
        }
        .employee-tag-text:hover {
          background-color: #dbeafe !important;
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}