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

interface CardManagement {
  id: number;
  cardId?: string;        // ID CARD
  bank: string;          // BANK
  name: string;          // Name
  cardNumber: string;    // So The
  expiryDate: string;    // Date
  cvv: string;          // Cvv
  topupAccount?: string; // STK
  addAmount?: number;    // SL đã ADD
  assignedEmployee?: string; // Phân cho NV
  note?: string;         // Note
  userId: number;
  createdAt: string;
  updatedAt: string;
}

const CARD_HEADERS = [
  'ID CARD',
  'BANK',
  'Name',
  'So The',
  'Date',
  'Cvv',
  'STK',
  'SL đã ADD',
  'Phân cho NV',
  'Note'
];

const CARD_FIELD_MAPPING = [
  'id',              // ID CARD
  'bank',            // BANK  
  'name',            // Name
  'cardNumber',      // So The
  'expiryDate',      // Date
  'cvv',             // Cvv
  'topupAccount',    // STK
  'addAmount',       // SL đã ADD
  'assignedEmployee', // Phân cho NV
  'note'             // Note
];

export default function CardHandsontable() {
  const [handsontableReady, setHandsontableReady] = useState(false);
  const [hotInstance, setHotInstance] = useState<Handsontable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Employee Tag Management Dialog state
  const [employeeTagDialogOpen, setEmployeeTagDialogOpen] = useState(false);
  const [selectedCardForTags, setSelectedCardForTags] = useState<{
    id: number;
    currentTags: string;
    rowIndex: number;
  } | null>(null);

  // Fetch card management data
  const { data: cardData = [], isLoading, error } = useQuery<CardManagement[]>({
    queryKey: ['/api/card-management'],
    enabled: true,
  });
  
  // Debug cardData changes
  useEffect(() => {
    console.log('🔍 cardData changed:', {
      length: cardData?.length,
      isLoading,
      firstItem: cardData?.[0],
      allIds: cardData?.map(c => c.id)
    });
  }, [cardData, isLoading]);

  // Convert card data to Handsontable format
  const convertCardToTableData = useCallback((cards: CardManagement[]) => {
    const rows = cards.map(card => [
      card.cardId || card.id,     // ID CARD
      card.bank || '',            // BANK
      card.name || '',            // Name 
      card.cardNumber || '',      // So The
      card.expiryDate || '',      // Date
      card.cvv || '',             // Cvv
      card.topupAccount || '',    // STK
      card.addAmount || 0,        // SL đã ADD
      card.assignedEmployee || '',// Phân cho NV
      card.note || ''             // Note
    ]);

    console.log(`📊 Converted ${cards.length} cards to table data:`, rows.slice(0, 2));
    return rows;
  }, []);

  // CVV Security Renderer - Hide CVV with *** for non-admin users
  const cvvRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string | number, value: any, cellProperties: any) => {
    const isAdmin = user?.role === 'director' || user?.role === 'admin';
    const isCvvColumn = col === 5; // CVV column index (Cvv)
    
    if (isCvvColumn && !isAdmin) {
      // For non-admin users, always show ***
      td.innerHTML = '***';
      td.style.color = '#999';
      td.style.fontStyle = 'italic';
      cellProperties.readOnly = true;
    } else if (isCvvColumn && isAdmin) {
      // For admin users, show actual value but mask when not editing
      if (cellProperties.isBeingEdited) {
        td.innerHTML = value || '';
        td.style.color = '#000';
        td.style.fontStyle = 'normal';
      } else {
        td.innerHTML = '***';
        td.style.color = '#666';
        td.style.fontStyle = 'italic';
      }
    } else {
      // Regular rendering for other columns
      td.innerHTML = value || '';
    }
  }, [user?.role]);

  // CCV Security Editor - Show real value only for admin users
  const ccvEditor = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string | number, value: any, cellProperties: any) => {
    const isAdmin = user?.role === 'director' || user?.role === 'admin';
    const isCcvColumn = col === 6;
    
    if (isCcvColumn && !isAdmin) {
      // Non-admin users cannot edit CCV
      return false;
    }
    
    if (isCcvColumn && isAdmin) {
      // Admin users can edit CCV with real value
      cellProperties.isBeingEdited = true;
      return value;
    }
    
    return value;
  }, [user?.role]);

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
    if (canEdit && row < cardData.length) {
      tagText.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = cardData[row];
        const currentTags = value || '';
        
        if (card && card.id) {
          setSelectedCardForTags({
            id: card.id,
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
  }, [user?.role, cardData]);

  // Handle employee tags update from dialog
  const handleEmployeeTagsUpdate = (newTags: string) => {
    if (selectedCardForTags && hotInstance) {
      // Update the cell value immediately in the table
      hotInstance.setDataAtCell(
        selectedCardForTags.rowIndex, 
        8, // Phân cho NV column index
        newTags, 
        'external' // Use external source to prevent auto-save trigger
      );
      
      console.log(`✅ EMPLOYEE TAG UPDATE: Card ${selectedCardForTags.id} tags updated to: "${newTags}"`);
    }
  };

  // Handle employee tag dialog close
  const handleEmployeeTagDialogClose = () => {
    setEmployeeTagDialogOpen(false);
    setSelectedCardForTags(null);
  };

  // Update mutation for auto-save
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<CardManagement> }) => {
      return apiRequest('PATCH', `/api/card-management/${id}`, updates);
    },
    onSuccess: () => {
      console.log('✅ Card update successful');
      queryClient.invalidateQueries({ queryKey: ['/api/card-management'] });
    },
    onError: (error) => {
      console.error('❌ Card update failed:', error);
    },
  });

  // Auto-save hook
  const autoSaveManager = useAutoSave(async (changes: AutoSaveChange[]) => {
    console.log('💾 Auto-saving card changes:', changes);
    
    for (const change of changes) {
      if (change.id && change.data) {
        const updates = change.data;
        await updateMutation.mutateAsync({ 
          id: change.id, 
          updates 
        });
      }
    }
  }, { debounceDelay: 800 });

  // Initialize Handsontable with robust error handling
  const initializeHandsontable = useCallback(() => {
    if (!containerRef.current || cardData.length === 0) {
      console.log('⏳ Waiting for dependencies:', {
        container: !!containerRef.current,
        ready: handsontableReady,
        hasData: cardData.length > 0,
        hotInstance: !!hotInstance
      });
      return;
    }

    // Don't re-initialize if already exists
    if (hotInstance) {
      console.log('⚠️ Handsontable already initialized, skipping');
      return;
    }

    // Ensure container is visible and has dimensions
    if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
      console.log('⚠️ Container has no dimensions, waiting...');
      setTimeout(() => initializeHandsontable(), 100);
      return;
    }

    const tableData = convertCardToTableData(cardData);
    console.log('🔄 Initializing Handsontable with data:', tableData.length, 'rows');

    try {
      const hot = new Handsontable(containerRef.current, {
      data: tableData,
      colHeaders: CARD_HEADERS,
      rowHeaders: true,
      width: '100%',
      height: 600,
      licenseKey: 'non-commercial-and-evaluation',
      stretchH: 'all',
      autoWrapRow: true,
      autoWrapCol: true,
      columnSorting: true,

      manualRowResize: true,
      manualColumnResize: true,
      contextMenu: true,
      dropdownMenu: true,
      filters: true,
      manualRowMove: true,
      outsideClickDeselects: false,
      fillHandle: {
        direction: 'vertical',
        autoInsertRow: false
      },
      columns: [
        { data: 0, readOnly: true }, // ID CARD
        { data: 1, type: 'dropdown', source: ['Visa', 'Mastercard', 'American Express', 'Discover'] }, // BANK
        { data: 2 }, // Name
        { data: 3 }, // So The
        { data: 4 }, // Date
        { data: 5, renderer: cvvRenderer }, // Cvv with security
        { data: 6 }, // STK
        { data: 7 }, // SL đã ADD
        { data: 8, renderer: employeeTagRenderer, readOnly: true }, // Phân cho NV with employee tag management
        { data: 9 } // Note
      ],
      afterChange: (changes, source) => {
        if (!changes || source === 'loadData') return;

        console.log('📝 Card data changed:', changes, 'source:', source);
        
        changes.forEach(([row, col, oldValue, newValue]) => {
          if (oldValue !== newValue && row < cardData.length) {
            const card = cardData[row];
            const fieldName = CARD_FIELD_MAPPING[col as number];
            
            if (card && fieldName) {
              // Skip saving if value is undefined/null for CVV field
              if (fieldName === 'cvv' && (newValue === undefined || newValue === null || newValue === '')) {
                console.log(`⚠️ Skipping CVV save - invalid value: ${newValue}`);
                return;
              }
              
              console.log(`💾 Queueing change for card ${card.id}: ${fieldName} = ${newValue}`);
              autoSaveManager.addChange(
                row, 
                col as number, 
                { [fieldName]: newValue }, 
                'update',
                card.id
              );
            }
          }
        });
      },

      afterBeginEditing: (row: number, col: number) => {
        // When editing CVV, show real value for admin
        if (col === 5 && (user?.role === 'director' || user?.role === 'admin')) {
          const card = cardData[row];
          if (card && hot) {
            // Use loadData to avoid triggering afterChange
            hot.setDataAtCell(row, col, card.cvv || '', 'loadData');
          }
        }
      }
    });

      setHotInstance(hot);
      console.log('✅ Handsontable initialized with', tableData.length, 'cards');
    } catch (error) {
      console.error('❌ Failed to initialize Handsontable:', error);
      // Retry after a short delay
      setTimeout(() => initializeHandsontable(), 500);
    }
  }, [cardData, convertCardToTableData, autoSaveManager]);

  // Set up Handsontable ready state with force load after delay
  useEffect(() => {
    setHandsontableReady(true);
    console.log('✅ Handsontable ready state set');
    
    // Force initialization after 2 seconds if not initialized
    const forceInitTimeout = setTimeout(() => {
      if (!hotInstance && cardData.length > 0 && containerRef.current) {
        console.log('🔧 FORCE INITIALIZING Handsontable after delay');
        initializeHandsontable();
      }
    }, 2000);
    
    return () => clearTimeout(forceInitTimeout);
  }, [cardData.length, hotInstance, initializeHandsontable]);

  // Initialize table when data is available - with retry mechanism
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    const tryInitialize = () => {
      if (cardData.length > 0 && containerRef.current && !hotInstance) {
        console.log('🚀 Initializing Handsontable with conditions met:', {
          dataLength: cardData.length, 
          hasContainer: !!containerRef.current,
          hasInstance: !!hotInstance
        });
        try {
          initializeHandsontable();
        } catch (error) {
          console.error('❌ Failed to initialize Handsontable, retrying in 500ms:', error);
          retryTimeout = setTimeout(tryInitialize, 500);
        }
      } else if (cardData.length > 0 && containerRef.current && !hotInstance) {
        // Retry after container is ready
        console.log('⏳ Container not ready, retrying in 100ms');
        retryTimeout = setTimeout(tryInitialize, 100);
      }
    };

    tryInitialize();
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [cardData.length, hotInstance, initializeHandsontable]);

  // Update data when cardData changes (without re-initialization)
  useEffect(() => {
    if (hotInstance && cardData.length > 0) {
      const tableData = convertCardToTableData(cardData);
      console.log('🔄 Updating Handsontable data without re-init');
      hotInstance.loadData(tableData);
    }
  }, [cardData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hotInstance) {
        console.log('🧹 Cleaning up Handsontable instance');
        try {
          hotInstance.destroy();
        } catch (e) {
          console.log('⚠️ Error during cleanup:', e);
        }
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải dữ liệu thẻ...</div>
      </div>
    );
  }

  // Force display container even if no data to ensure Handsontable loads
  if (cardData.length === 0 && !isLoading) {
    return (
      <div className="h-full">
        <div className="flex justify-end mb-1">
          <AutoSaveStatus 
            status={autoSaveManager.saveStatus}
            pendingCount={autoSaveManager.pendingCount}
          />
        </div>
        
        <div 
          ref={containerRef} 
          className="w-full border border-border rounded-lg overflow-hidden"
          style={{ 
            minHeight: '600px',
            width: '100%',
            height: '600px'
          }}
        />
        
        <div className="text-center py-8">
          <p className="text-muted-foreground">Chưa có dữ liệu thẻ nào</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Lỗi tải dữ liệu: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Auto-save status positioned at top-right */}
      <div className="flex justify-end mb-1">
        <AutoSaveStatus 
          status={autoSaveManager.saveStatus}
          pendingCount={autoSaveManager.pendingCount}
        />
      </div>
      
      {/* Handsontable container - positioned close to sidebar */}
      <div 
        ref={containerRef} 
        className="w-full border border-border rounded-lg overflow-hidden"
        style={{ 
          minHeight: '600px',
          width: '100%',
          height: '600px'
        }}
      />
      
      {cardData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Chưa có dữ liệu thẻ nào</p>
        </div>
      )}

      {/* Employee Tag Management Dialog */}
      <EmployeeTagManagementDialog
        isOpen={employeeTagDialogOpen}
        onClose={handleEmployeeTagDialogClose}
        currentTags={selectedCardForTags?.currentTags || ''}
        recordId={selectedCardForTags?.id || 0}
        recordType="card"
        onTagsUpdate={handleEmployeeTagsUpdate}
      />
    </div>
  );
}