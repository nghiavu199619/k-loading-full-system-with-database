import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TagManagementDialog } from '@/components/TagManagementDialog';
// Server-side import for Handsontable
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
// WebSocket real-time system integrated directly in this component

// No longer need global window declaration with direct import

interface AdAccount {
  id: number;
  accountId: string;
  name: string;
  status: string;
  source: string;
  rentalPercentage: string;
  cardType: string;
  cardNote: string;
  vatPercentage: string;
  clientTag: string;
  accountPermission: string;
  description: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  statusOptions: string[];
  cardTypes: string[];
  permissions: string[];
  partners: string[];
  noteCards: string[];
  ttExOptions: string[];
  currencyOptions?: any[];
}

// ✅ COLUMN CONSTANTS - Fix inconsistent column indexing
const DB_ID_COL = 13;
const TEMP_ID_COL = 14;

// ✅ DEBUG LOGGER - Only show logs in development
const log = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

// ✅ COMMON RENDERERS - Reusable cell renderers
const createPercentRenderer = () => (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
  td.innerHTML = value ? `${value.toString().replace('%', '')}%` : '';
  td.style.textAlign = 'center';
  return td;
};

const createCenterRenderer = () => (instance: any, td: any, row: number, col: number, prop: any, value: any) => {
  td.innerHTML = value || '';
  td.style.textAlign = 'center';
  td.style.verticalAlign = 'middle';
  return td;
};

interface AccountHandsontableProps {
  canEdit?: boolean;
}

// ✅ UNIFIED WEBSOCKET UPDATE - Single function for all WebSocket updates
const updateGridById = (hotRef: any, accountId: number, updates: Record<string, any>) => {
  if (!hotRef.current) return;
  
  const totalRows = hotRef.current.countRows();
  let targetRow = -1;
  
  for (let i = 0; i < totalRows; i++) {
    const databaseId = hotRef.current.getDataAtCell(i, DB_ID_COL);
    if (databaseId === accountId) {
      targetRow = i;
      break;
    }
  }
  
  if (targetRow >= 0) {
    hotRef.current.batch(() => {
      Object.entries(updates).forEach(([field, value]) => {
        const fieldMap: Record<string, number> = {
          accountId: 1, name: 2, status: 3, source: 4,
          rentalPercentage: 5, cardType: 6, cardNote: 7,
          vatPercentage: 8, clientTag: 9, accountPermission: 10, description: 11
        };
        if (fieldMap[field] !== undefined) {
          hotRef.current.setDataAtCell(targetRow, fieldMap[field], value, 'external');
        }
      });
    });
  }
};

export function AccountHandsontable({ canEdit = true }: AccountHandsontableProps) {
  const hotRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHandsontableLoaded, setIsHandsontableLoaded] = useState(false);
  const [sessionId] = useState(`session_${Math.random().toString(36).slice(2, 11)}`);
  
  // ✅ SIMPLIFIED STATE - Removed duplicate states
  const hasInitialized = useRef(false);
  const hasInitializationStarted = useRef(false);
  const pendingChanges = useRef<Map<string, any>>(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tag Management Dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedAccountForTags, setSelectedAccountForTags] = useState<{
    id: number;
    currentTags: string;
    rowIndex: number;
  } | null>(null);

  // ✅ SEARCH POPUP STATE - Tích hợp search popup như expense tab
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Array<{row: number, col: number}>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle tag updates from dialog
  const handleTagsUpdate = (newTags: string) => {
    if (selectedAccountForTags && hotRef.current) {
      // Update the cell value immediately in the table
      hotRef.current.setDataAtCell(
        selectedAccountForTags.rowIndex, 
        9, // TAG KH column index
        newTags, 
        'external' // Use external source to prevent auto-save trigger
      );
      
      log(`✅ TAG UPDATE: Account ${selectedAccountForTags.id} tags updated to: "${newTags}"`);
    }
  };

  // Handle dialog close
  const handleTagDialogClose = () => {
    setTagDialogOpen(false);
    setSelectedAccountForTags(null);
  };

  // ✅ COLUMN WIDTH CUSTOMIZATION: State to manage customizable column widths
  const [customColWidths, setCustomColWidths] = useState<number[]>(() => {
    // Load saved column widths from localStorage
    const saved = localStorage.getItem('account-table-col-widths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 15) {
          return parsed;
        }
      } catch (e) {
        log('Failed to parse saved column widths');
      }
    }
    // Default widths for all columns: [ID, Account ID, Name, Status, Source, Fee TK, Card, Note Card, VAT, TAG KH, Currency, TT EX, Description, DB ID, Temp ID]
    return [70, 100, 120, 200, 80, 80, 100, 120, 80, 150, 120, 100, 200, 1, 1];
  });

  // ✅ SEARCH FUNCTIONALITY - Tích hợp từ expense tab
  const performSearch = (query: string, autoNavigate: boolean = false) => {
    if (!hotRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{row: number, col: number}> = [];
    const data = hotRef.current.getData();
    const searchLower = query.toLowerCase();

    data.forEach((row: any[], rowIndex: number) => {
      row.forEach((cell: any, colIndex: number) => {
        if (cell && cell.toString().toLowerCase().includes(searchLower)) {
          results.push({ row: rowIndex, col: colIndex });
        }
      });
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);

    // ✅ ONLY navigate if explicitly requested (Enter key or button click)
    if (autoNavigate && results.length > 0) {
      const firstResult = results[0];
      hotRef.current.selectCell(firstResult.row, firstResult.col);
      hotRef.current.scrollViewportTo(firstResult.row, firstResult.col);
    }
  };

  const navigateSearchResults = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    setCurrentSearchIndex(newIndex);
    const result = searchResults[newIndex];
    if (hotRef.current) {
      hotRef.current.selectCell(result.row, result.col);
      hotRef.current.scrollViewportTo(result.row, result.col);
    }
  };

  // ✅ KEYBOARD SHORTCUTS - Ctrl+F để mở search với debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('🔤 KEYDOWN EVENT:', { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey });
      
      // Try both Ctrl+F and Cmd+F for Mac users
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        console.log('🔍 SEARCH SHORTCUT DETECTED - Opening search popup');
        e.preventDefault();
        e.stopPropagation();
        setSearchVisible(true);
        console.log('✅ SEARCH VISIBLE SET TO TRUE');
        setTimeout(() => {
          searchInputRef.current?.focus();
          console.log('🎯 SEARCH INPUT FOCUSED');
        }, 100);
      }
      if (e.key === 'Escape' && searchVisible) {
        console.log('❌ ESC PRESSED - Closing search');
        setSearchVisible(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    console.log('🔌 ADDING KEYDOWN LISTENER');
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      console.log('🗑️ REMOVING KEYDOWN LISTENER');
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [searchVisible]);

  const createTempIds = (count: number, baseTimestamp: number = Date.now()): string[] => {
    return Array.from({ length: count }, (_, i) => 
      `temp-${baseTimestamp}-${i}-${Math.random().toString(36).substring(2, 11)}`
    );
  };




  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch ad accounts data - optimized to prevent reload after changes
  const { data: adAccounts = [], isLoading } = useQuery<AdAccount[]>({
    queryKey: ['/api/ad-accounts'],
    staleTime: 0, // ✅ NO CACHE - Always fetch fresh data when tab switching
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnMount: false // Don't refetch when component remounts
  });

  // ✅ TAB SWITCHING DATA REFRESH: Invalidate cache when component first mounts
  useEffect(() => {
    log('🔄 ACCOUNT HANDSONTABLE MOUNTED - Invalidating all cached data');
    queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    queryClient.invalidateQueries({ queryKey: ['/api/account-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
  }, [queryClient]);

  // Store accounts data globally for Activity Logs to access
  useEffect(() => {
    if (adAccounts && adAccounts.length > 0) {
      (window as any).accountsData = adAccounts;
      log('🌐 STORED ACCOUNTS DATA GLOBALLY:', adAccounts.length, 'accounts');
    }
  }, [adAccounts]);

  // Fetch settings for dropdown options
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings']
  });

  // Fetch current user info for owner_id
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me']
  });

  // Bulk row creation mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (data: { count: number; temps: string[]; defaultValues: any }) => {
      const response = await apiRequest('POST', '/api/ad-accounts/bulk', data);
      return response.json(); // Parse the JSON response
    },
    onSuccess: (response: any) => {
      log('🆕 BULK CREATE SUCCESS:', response);
      log('🔍 Response type:', typeof response);
      log('🔍 Response.rows:', response.rows);
      log('🔍 Response.rows length:', response.rows?.length);
      
      // Map temp IDs to real database IDs using batch for performance
      if (hotRef.current && response.rows) {
        log('🔄 MAPPING TEMP IDs TO REAL IDs');
        
        hotRef.current.batch(() => {
          response.rows.forEach((row: any) => {
            log(`🎯 Mapping temp ${row.temp} to real ID ${row.id}, localId ${row.localId}`);
            
            // Map temp row to real database ID
            
            // Find temp row by searching for temp ID in column 13 (hiddenTempId)
            const currentData = hotRef.current.getData();
            const tempRowIndex = currentData.findIndex((dataRow: any) => 
              dataRow[13] === row.temp // tempId is in column 13
            );
            
            if (tempRowIndex >= 0) {
              log(`✅ Found temp row at index ${tempRowIndex}, updating with real data`);
              
              // ✅ CRITICAL ROW ID SEQUENCING FIX: Use actual row position instead of database localId
              const correctDisplayId = `${tempRowIndex + 1}-${row.ownerId}`;
              log(`🔧 ROW ID FIX: Row ${tempRowIndex} → Display ID: ${correctDisplayId} (ignoring server: ${row.displayId})`);
              
              // ✅ IMMEDIATE ID UPDATE: Update display ID immediately without waiting
              hotRef.current.setDataAtCell(tempRowIndex, 0, correctDisplayId, 'silent');
              hotRef.current.setDataAtCell(tempRowIndex, 12, row.id, 'silent'); 
              hotRef.current.setDataAtCell(tempRowIndex, 13, '', 'silent');
              
              // ✅ CHECK IF USER HAS ENTERED DATA: Check if row has user data before clearing tempId
              const currentRowData = currentData[tempRowIndex];
              const hasUserData = currentRowData && (
                (currentRowData[1] && currentRowData[1].trim()) || // accountId
                (currentRowData[2] && currentRowData[2].trim() && currentRowData[2] !== 'Test Account' && currentRowData[2] !== 'ROW ID SEQUENCING TEST') || // name (not default)
                (currentRowData[4] && currentRowData[4].trim()) || // source
                (currentRowData[5] && currentRowData[5] !== '0') || // rentalPercentage
                (currentRowData[6] && currentRowData[6].trim()) || // cardType
                (currentRowData[7] && currentRowData[7].trim()) || // cardNote
                (currentRowData[8] && currentRowData[8] !== '0') || // vatPercentage
                (currentRowData[9] && currentRowData[9].trim()) || // clientTag
                (currentRowData[10] && currentRowData[10].trim()) || // accountPermission
                (currentRowData[11] && currentRowData[11].trim()) // description
              );
              
              console.log(`🔍 USER DATA CHECK: Row ${tempRowIndex} hasUserData=${hasUserData}`, {
                accountId: currentRowData?.[1],
                name: currentRowData?.[2],
                source: currentRowData?.[4]
              });
              
              // ID already updated above - no need to update again
              
              // ✅ CRITICAL UX FIX: Auto-save user data if they entered anything before server response
              if (hasUserData) {
                console.log(`💾 AUTO-SAVE: User has entered data on row ${tempRowIndex}, scheduling auto-save after ID update`);
                
                // Delay save to avoid conflict with table updates
                setTimeout(() => {
                  const updatedRowData = hotRef.current.getDataAtRow(tempRowIndex);
                  console.log(`💾 EXECUTING AUTO-SAVE: Saving user data for row ${tempRowIndex} with ID ${row.id}`);
                  
                  // Create change object for auto-save
                  const changeData = {
                    id: row.id,
                    accountId: updatedRowData[1] || '',
                    name: updatedRowData[2] || '',
                    status: updatedRowData[3] || '', // ✅ REMOVED "Hoạt động" default - empty by default
                    source: updatedRowData[4] || '',
                    rentalPercentage: updatedRowData[5] || '0',
                    cardType: updatedRowData[6] || '',
                    cardNote: updatedRowData[7] || '',
                    vatPercentage: updatedRowData[8] || '0',
                    clientTag: updatedRowData[9] || '',
                    accountPermission: updatedRowData[10] || '',
                    description: updatedRowData[11] || ''
                  };
                  
                  // Save to server using correct API format
                  console.log('💾 CALLING AUTO-SAVE API:', changeData);
                  
                  // Use direct API call instead of bulk save mutation
                  apiRequest('PATCH', `/api/ad-accounts/${row.id}`, changeData)
                    .then(() => {
                      console.log(`✅ AUTO-SAVE SUCCESS: Saved user data for account ${row.id}`);
                    })
                    .catch((error) => {
                      console.error(`❌ AUTO-SAVE FAILED for account ${row.id}:`, error);
                    });
                  
                }, 300); // 300ms delay to ensure table update is complete
              }
              
              // Simplified - no complex temp cache needed
              
              // Temp row successfully mapped
              
              // Remove from pendingTempRows if it exists (for hybrid compatibility)
              if (pendingTempRows.current.has(row.temp)) {
                pendingTempRows.current.delete(row.temp);
              }
              
              console.log(`✅ Successfully mapped temp row ${tempRowIndex} to real database ID ${row.id}${hasUserData ? ' + scheduled auto-save' : ''}`);
            } else {
              console.warn(`❌ MAPPING ERROR: Cannot find temp row with tempId ${row.temp} for database ID ${row.id}`);
            }
          });
        });
        
        // NO render() - let Handsontable update naturally to preserve focus
      }
      
      // ✅ NO REACT QUERY CACHE UPDATE - prevents component reload
      // Optimistic UI handles everything through direct Handsontable manipulation
      
      toast({
        title: "Tạo dòng thành công",
        description: `Đã tạo ${response.rows?.length || 0} dòng mới`,
      });
      
      // Simplified completion - no complex batch publishing needed
    },
    onError: (error: any) => {
      console.error('❌ BULK CREATE ERROR:', error);
      console.error('❌ ERROR DETAILS:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack
      });
      
      toast({
        title: "Lỗi tạo dòng",
        description: `Không thể tạo dòng mới. Chi tiết: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  // Enhanced bulk save mutation for change queue
  const bulkSaveMutation = useMutation({
    mutationFn: async (changes: any[]) => {
      return apiRequest('PUT', '/api/ad-accounts/bulk', { changes, sessionId });
    },
    onSuccess: () => {
      console.log('✅ BULK SAVE SUCCESS');
    },
    onError: (error: any) => {
      console.error('❌ BULK SAVE ERROR:', error);
    }
  });

  // Simplified state management for temp rows
  const pendingTempRows = useRef<Map<string, any>>(new Map());
  
  // ✅ DISABLED: WEBSOCKET CONNECTION - Using HTTP polling only per user request
  // const { isConnected, subscribe } = useWebSocket();

  // ✅ REMOVED: Duplicate useWebSocket call - moved above unified system

  // Create single new row (optimistic) - Google Sheets style with debounced sync
  const createSingleRowOptimistic = () => {
    if (!hotRef.current || !(currentUser as any)?.id) return;
    
    console.log(`🆕 CREATING SINGLE TEMP ROW`);
    
    // Generate temp ID
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    // Get current row count
    const currentRowCount = hotRef.current.countRows();
    
    // Create temp row data WITHOUT status in main data - keep it clean
    const tempRowData = [
      `NEW-${currentRowCount + 1}`, // Display ID placeholder (simple, no status)
      '', // accountId
      '', // name  
      '', // status - ✅ REMOVED "Hoạt động" default - empty by default
      '', // source
      '0', // rentalPercentage
      '', // cardType
      '', // cardNote
      '0', // vatPercentage
      '', // clientTag
      '', // accountPermission
      '', // description
      '', // hidden userId
      tempId // hidden temp ID
    ];
    
    // Add to pending map for tracking
    pendingTempRows.current.set(tempId, {
      status: 'pending',
      data: tempRowData,
      rowIndex: currentRowCount,
      needsSync: false,
      retryCount: 0 // Track retry attempts for cleanup
    });
    
    // ✅ GOOGLE SHEETS PATTERN: Track status separately to avoid re-render
    // Simplified status tracking
    
    // Add row to UI immediately
    hotRef.current.batch(() => {
      hotRef.current.alter('insert_row_below', currentRowCount - 1, 1);
      tempRowData.forEach((cellValue, colIndex) => {
        hotRef.current.setDataAtCell(currentRowCount, colIndex, cellValue, 'optimistic');
      });
    });
    
    // NO render() - let Handsontable handle naturally to preserve focus
    console.log(`✅ Created temp row with ID: ${tempId}`);
    
    // ❌ DISABLED: Don't schedule temp sync when using legacy buttons (causes conflicts)
    // scheduleTempRowSync(tempId);
    
    // ❌ DISABLED: Instant batch processing to prevent conflicts with legacy button workflow
    // Simplified status tracking
    
    return tempId;
  };

  // ❌ DISABLED: Process sync queue function removed for optimization

  // ❌ DISABLED: Schedule temp row sync function removed for optimization

  // Batch sync multiple temp rows to server for better performance
  const syncTempRowsBatch = async (tempIds: string[]) => {
    console.log(`🚀 PASTE SYNC: Processing ${tempIds.length} temp rows from beforePaste`);
    
    // Scan table directly for temp rows (no pendingTempRows dependency)
    const accountsToCreate: any[] = [];
    
    for (const tempId of tempIds) {
      const totalRows = hotRef.current.countRows();
      for (let i = 0; i < totalRows; i++) {
        const cellTempId = hotRef.current.getDataAtCell(i, TEMP_ID_COL); // Column 14 is temp ID
        if (cellTempId === tempId) {
          // Get current row data
          const rowData = hotRef.current.getDataAtRow(i);
          accountsToCreate.push({
            accountId: rowData[1] || `TK-${Date.now().toString().slice(-4)}-${i}`,
            name: rowData[2] || `Account ${i + 1}`,
            status: rowData[3] || '',
            source: rowData[4] || '',
            rentalPercentage: rowData[5] || '0',
            cardType: rowData[6] || '',
            cardNote: rowData[7] || '',
            vatPercentage: rowData[8] || '0',
            clientTag: rowData[9] || '',
            accountPermission: rowData[10] || '',
            description: rowData[11] || '',
            tempId: tempId,
            tempRowIndex: i
          });
          
          // Update UI to show syncing
          hotRef.current.setDataAtCell(i, 0, '🔄 Syncing...', 'silent');
          console.log(`✅ FOUND PASTE ROW: ${i}, TempID: ${tempId}, Data: ${rowData[1]}, ${rowData[2]}`);
          break;
        }
      }
    }
    
    if (accountsToCreate.length === 0) {
      console.log('❌ No temp rows found in table for sync');
      return;
    }
    
    console.log(`📤 Creating ${accountsToCreate.length} accounts from paste data`);
    console.log(`🔧 DEBUG: accountsToCreate before cleaning:`, accountsToCreate);
    
    if (accountsToCreate.length === 0) {
      console.error('❌ CRITICAL: No accounts to create - tempIds may be invalid');
      return;
    }
    
    try {
      // ✅ CRITICAL FIX: Remove tempId and tempRowIndex from accounts data before sending to server
      const cleanAccountsData = accountsToCreate.map(({ tempId, tempRowIndex, ...accountData }) => accountData);
      
      console.log('🔧 DEBUG: Clean accounts data being sent:', cleanAccountsData);
      
      if (cleanAccountsData.length === 0 || !cleanAccountsData[0]) {
        console.error('❌ CRITICAL: Clean accounts data is empty or invalid');
        return;
      }
      
      const apiResponse = await apiRequest('POST', '/api/ad-accounts/bulk', {
        accounts: cleanAccountsData,
        count: cleanAccountsData.length,
        defaultValues: cleanAccountsData,
        sessionId: `paste-${Date.now()}`
      });
      
      // ✅ CRITICAL FIX: apiRequest returns Response object, need to parse JSON
      const response = await apiResponse.json();
      
      console.log('🔧 DEBUG: Server response structure:', JSON.stringify(response, null, 2));
      console.log('🔧 DEBUG: Response type:', typeof response);
      console.log('🔧 DEBUG: Response success:', response?.success);
      console.log('🔧 DEBUG: Response rows:', response?.rows?.length);
      
      if (response && response.success && response.rows) {
        const createdAccounts = response.rows;
        console.log(`✅ PASTE SYNC SUCCESS: ${createdAccounts.length} accounts created`);
        
        // Map temp rows to real accounts with auto-save
        createdAccounts.forEach((newAccount: any, idx: number) => {
          const originalTempData = accountsToCreate[idx];
          if (!originalTempData) return;
          
          const rowIndex = originalTempData.tempRowIndex;
          console.log(`🔄 MAPPING: Row ${rowIndex}, TempID ${originalTempData.tempId} → Real ID ${newAccount.id}`);
          // Update row with real database data using batch for better performance
          hotRef.current.batch(() => {
            hotRef.current.setDataAtCell(rowIndex, DB_ID_COL, newAccount.id, 'system'); // Set real DB ID
            hotRef.current.setDataAtCell(rowIndex, 0, `${newAccount.localId}-${newAccount.ownerId}`, 'system'); // Set display ID
            hotRef.current.setDataAtCell(rowIndex, TEMP_ID_COL, '', 'system'); // Clear temp ID
          });
          
          // ✅ DISABLED AUTO-SAVE: Causing userId=undefined errors and duplicate saves
          // Server already has the paste data from bulk creation, no need for additional PATCH
          console.log(`🚫 AUTO-SAVE DISABLED: Row ${rowIndex}, ID ${newAccount.id} - data already in server from bulk create`)
        });
        
        // ✅ CRITICAL FIX: Force immediate data refresh instead of manual cache update
        console.log('🔄 FORCING IMMEDIATE DATA REFRESH to sync all clients');
        queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
        
        // ✅ DISABLED AGGRESSIVE CLEANUP: Causing issues with phantom row removal
        // Let real-time sync handle data consistency instead of manual cleanup
        console.log('🚫 CLEANUP DISABLED: Avoiding phantom row issues, letting real-time sync handle consistency');
        
        console.log(`✅ GOOGLE SHEETS PASTE COMPLETE: ${createdAccounts.length} rows converted to real accounts`);
      } else {
        console.error('❌ SERVER RESPONSE ERROR: Invalid response format');
        console.error('🔧 Expected: {success: true, rows: [...]}');
        console.error('🔧 Received:', response);
        console.error('🔧 Response keys:', response ? Object.keys(response) : 'null/undefined');
        
        // ✅ FALLBACK: Try to handle different response formats
        if (response && Array.isArray(response)) {
          console.log('🔄 FALLBACK: Response is array format, treating as rows');
          const createdAccounts = response;
          // Process accounts array...
        } else if (response && response.rows && Array.isArray(response.rows)) {
          console.log('🔄 FALLBACK: Response has rows property');
          const createdAccounts = response.rows;
          // Process rows...
        } else {
          console.error('❌ CANNOT PROCESS: Unrecognized response format');
        }
      }
      
    } catch (error) {
      console.error('❌ PASTE SYNC FAILED:', error);
      
      // Reset failed rows
      accountsToCreate.forEach(item => {
        hotRef.current.setDataAtCell(item.tempRowIndex, 0, '❌ Failed', 'silent');
      });
    }
  };

  // ✅ PHANTOM ROW PREVENTION: Cleanup any temp rows from previous sessions
  const cleanupPhantomTempRows = () => {
    if (!hotRef.current) return;
    
    console.log('🧹 CLEANUP: Scanning for phantom temp rows from previous sessions');
    const totalRows = hotRef.current.countRows();
    const rowsToRemove: number[] = [];
    
    // Scan all rows for temp IDs (should not exist on page load)
    for (let i = totalRows - 1; i >= 0; i--) {
      const tempId = hotRef.current.getDataAtCell(i, 13); // Column 13 is temp ID
      if (tempId && typeof tempId === 'string' && String(tempId).startsWith('temp-')) {
        console.warn(`🗑️ PHANTOM ROW DETECTED: Row ${i} has temp ID ${tempId} - marking for removal`);
        rowsToRemove.push(i);
      }
    }
    
    // Remove phantom temp rows
    if (rowsToRemove.length > 0) {
      console.log(`🧹 REMOVING ${rowsToRemove.length} phantom temp rows: ${rowsToRemove}`);
      rowsToRemove.forEach(rowIndex => {
        hotRef.current.alter('remove_row', rowIndex, 1, 'cleanup');
      });
      
      // Clear all temp row tracking
      pendingTempRows.current.clear();
      // Simplified status tracking
      
      console.log(`✅ CLEANUP COMPLETE: Removed ${rowsToRemove.length} phantom rows`);
    } else {
      console.log('✅ CLEANUP: No phantom temp rows found');
    }
  };

  // ✅ LOCAL PHANTOM ROW CLEANUP: Remove phantom rows only from local session (Machine A)
  const cleanupLocalPhantomRows = (creationSessionId: string) => {
    if (!hotRef.current) return;
    
    console.log(`🧹 LOCAL CLEANUP: Scanning for phantom rows created by session ${creationSessionId}`);
    const totalRows = hotRef.current.countRows();
    const rowsToRemove: number[] = [];
    
    // Scan all rows for phantom indicators from this session only
    for (let i = totalRows - 1; i >= 0; i--) {
      const displayId = hotRef.current.getDataAtCell(i, 0);
      const tempId = hotRef.current.getDataAtCell(i, 13); // Column 13 is temp ID
      const dbId = hotRef.current.getDataAtCell(i, 12); // Column 12 is database ID
      const name = hotRef.current.getDataAtCell(i, 2); // Name column
      
      // Mark for removal if:
      // 1. Has temp ID from current session but failed to map to real ID
      // 2. Still showing loading indicator from current session  
      // 3. Empty row gaps that break sequential numbering
      const isPhantomRow = (
        (tempId && typeof tempId === 'string' && String(tempId).startsWith('temp-')) ||
        (displayId && typeof displayId === 'string' && displayId.includes('⏳ Loading')) ||
        (tempId && !dbId) ||
        (!name && !dbId && !tempId) // Empty gap rows
      );
      
      if (isPhantomRow) {
        // Double check - only remove if this creates ID sequence gaps
        const currentDisplayId = hotRef.current.getDataAtCell(i, 0);
        const nextDisplayId = i < totalRows - 1 ? hotRef.current.getDataAtCell(i + 1, 0) : null;
        
        console.warn(`🗑️ LOCAL PHANTOM: Row ${i} - display: ${currentDisplayId}, temp: ${tempId}, db: ${dbId}, name: ${name}`);
        rowsToRemove.push(i);
      }
    }
    
    // Remove phantom rows and fix numbering
    if (rowsToRemove.length > 0) {
      console.log(`🧹 LOCAL CLEANUP: Removing ${rowsToRemove.length} phantom rows from session ${creationSessionId}`);
      
      hotRef.current.batch(() => {
        rowsToRemove.forEach(rowIndex => {
          hotRef.current.alter('remove_row', rowIndex, 1, 'local-cleanup');
        });
      });
      
      // Clear only local session tracking
      pendingTempRows.current.clear();
      
      console.log(`✅ LOCAL CLEANUP COMPLETE: Removed ${rowsToRemove.length} phantom rows, preserving real-time data`);
    } else {
      console.log(`✅ NO LOCAL PHANTOMS: Session ${creationSessionId} clean from phantom rows`);
    }
  };

  // Function to cleanup duplicate rows created by UI operations
  const cleanupDuplicateRows = () => {
    if (!hotRef.current) return;
    
    console.log('🧹 SCANNING: Looking for duplicate rows after paste operation');
    const totalRows = hotRef.current.countRows();
    const seenAccountIds = new Map(); // Store first occurrence row index
    const duplicateRows: number[] = [];
    
    // Scan all rows and find duplicates by accountId AND name combination
    for (let i = 0; i < totalRows; i++) {
      const accountId = hotRef.current.getDataAtCell(i, 1); // Column 1 is accountId
      const name = hotRef.current.getDataAtCell(i, 2); // Column 2 is name
      const dbId = hotRef.current.getDataAtCell(i, DB_ID_COL); // Column 13 is database ID
      
      // Skip empty rows and temp rows
      if (!accountId || accountId === '' || String(accountId).includes('temp-')) {
        continue;
      }
      
      // Create unique key from accountId + name for better duplicate detection
      const uniqueKey = `${accountId}|${name}`;
      
      if (seenAccountIds.has(uniqueKey)) {
        // This is a duplicate - mark for removal
        duplicateRows.push(i);
        const firstOccurrence = seenAccountIds.get(uniqueKey);
        console.log(`🔍 DUPLICATE FOUND: Row ${i} (duplicate of row ${firstOccurrence})`);
        console.log(`   📝 AccountID: ${accountId}, Name: ${name}, DBID: ${dbId}`);
      } else {
        seenAccountIds.set(uniqueKey, i);
      }
    }
    
    // Remove duplicate rows (from bottom to top to maintain indices)
    if (duplicateRows.length > 0) {
      console.log(`🗑️ REMOVING ${duplicateRows.length} duplicate rows: ${duplicateRows}`);
      hotRef.current.batch(() => {
        duplicateRows.reverse().forEach(rowIndex => {
          console.log(`   🗑️ Removing duplicate row ${rowIndex}`);
          hotRef.current.alter('remove_row', rowIndex, 1);
        });
      });
      console.log(`✅ CLEANUP COMPLETE: Removed ${duplicateRows.length} duplicate rows`);
      
      // Fix row IDs after cleanup
      setTimeout(() => {
        console.log('🔧 FIXING ROW IDs after duplicate cleanup');
        fixAllRowIDsAfterRefresh();
      }, 200);
    } else {
      console.log('✅ NO DUPLICATES: All rows are unique');
    }
  };

  // Google Sheets-like row creation functions (legacy bulk creation)
  const createNewRowsOptimistic = (count: number) => {
    if (!hotRef.current || !(currentUser as any)?.id) {
      console.warn('⚠️ Cannot create rows - missing hotRef or user');
      return;
    }
    
    // ✅ KIỂM TRA DÒNG TRỐNG: Chỉ tạo nếu thực sự thiếu dòng
    const emptyRows = countEmptyRowsAtEnd();
    if (emptyRows >= count) {
      console.log(`✅ Đã có đủ ${emptyRows} dòng trống, không thêm mới (cần ${count})`);
      return;
    }
    
    const rowsToAdd = count - emptyRows;
    console.log(`➕ Thêm ${rowsToAdd} dòng (đủ để paste ${count} dòng, đã có ${emptyRows} dòng trống)`);
    
    try {
      console.log(`🆕 OPTIMISTIC: Adding ${rowsToAdd} temporary rows with enhanced error handling`);
      
      // Generate temp IDs with unique timestamps for only needed rows
      const temps = Array.from({ length: rowsToAdd }, (_, i) => `temp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`);
      
      // Get current row count safely
      const currentRowCount = hotRef.current.countRows();
      console.log(`📊 CURRENT STATE: ${currentRowCount} total rows before adding ${rowsToAdd} new rows`);
    
    console.log(`🔢 Current row count: ${currentRowCount}, adding ${rowsToAdd} temp rows`);
    
    // Create optimistic row data for only needed rows
    const newRows = Array.from({ length: rowsToAdd }, (_, index) => [
      '⏳ Loading...', // Display ID placeholder with pending status icon
      '', // accountId
      '', // name  
      '', // status - ✅ REMOVED "Hoạt động" default - empty by default
      '', // source
      '0', // rentalPercentage
      '', // cardType
      '', // cardNote
      '0', // vatPercentage
      '', // clientTag
      '', // accountPermission
      '', // description
      '', // hidden userId
      temps[index] // hidden temp ID
    ]);
    
    // Use batch for performance and atomicity
    hotRef.current.batch(() => {
      // Insert rows at the end
      hotRef.current.alter('insert_row_below', currentRowCount - 1, rowsToAdd, 'optimistic');
      
      // Set data for each new row
      newRows.forEach((rowData, index) => {
        const rowIndex = currentRowCount + index;
        console.log(`🎯 Setting temp data at row ${rowIndex} with tempId: ${temps[index]}`);
        
        rowData.forEach((cellValue, colIndex) => {
          hotRef.current.setDataAtCell(rowIndex, colIndex, cellValue, 'optimistic');
        });
      });
    });
    
    // ✅ GOOGLE SHEETS PATTERN: Set all temp rows to pending status without UI re-render
    const statusUpdates: Record<string, 'pending'> = {};
    temps.forEach(tempId => {
      statusUpdates[tempId] = 'pending';
    });
    // Simplified status tracking
    
    // NO render() - let Handsontable handle naturally to preserve focus
    
      // Call server bulk create with session tracking for cleanup
      bulkCreateMutation.mutate({
        count: rowsToAdd, // Only create needed rows
        temps,
        defaultValues: {
          status: '', // ✅ REMOVED "Hoạt động" default - empty by default
          rentalPercentage: '0',
          vatPercentage: '0',
          sessionId: sessionId, // Track which session created these rows for cleanup
          isLocalCreation: true // Mark as local creation for phantom cleanup
        }
      });
      
    } catch (error) {
      console.error('❌ createNewRowsOptimistic error:', error);
      toast({
        title: "Lỗi tạo dòng",
        description: `Không thể tạo ${rowsToAdd} dòng mới. Chi tiết: ${error}`,
        variant: "destructive",
      });
    }
  };

  // ✅ DISABLED: Check if more rows are needed (scroll or paste detection) - DISABLED PER USER REQUEST
  const checkRowsNeeded = () => {
    // USER REQUEST: Disabled automatic empty row creation at end and auto-grow for paste operations
    console.log('⏸️ AUTO ROW CREATION DISABLED: Per user request - no automatic empty rows created');
    return;
  };

  // Count empty rows at the end
  const countEmptyRowsAtEnd = (): number => {
    if (!hotRef.current) return 0;
    
    try {
      // ✅ FIX: Use direct row access instead of getData() for consistency
      const totalRows = hotRef.current.countRows();
      let emptyCount = 0;
      
      // Scan from bottom up using direct cell access for accuracy
      for (let i = totalRows - 1; i >= 0; i--) {
        const accountId = hotRef.current.getDataAtCell(i, 1); // Column 1: ID TKQC
        const accountName = hotRef.current.getDataAtCell(i, 2); // Column 2: TÊN TK
        
        // ✅ CONSISTENT: Check if row is truly empty (no accountId AND no name)
        const isEmpty = (!accountId || accountId === '' || accountId === 'null') && 
                       (!accountName || accountName === '' || accountName === 'null');
        
        if (isEmpty) {
          emptyCount++;
        } else {
          break; // Stop at first non-empty row from bottom
        }
      }
      
      console.log(`📊 EMPTY ROW COUNT: ${emptyCount} empty rows found at end (total rows: ${totalRows})`);
      return emptyCount;
      
    } catch (error) {
      console.error('❌ countEmptyRowsAtEnd error:', error);
      return 0; // Safe fallback
    }
  };

  // ✅ ENABLED: Enhanced paste handling - creates rows for paste operations (per user request)
  const handlePasteAutoGrow = (changes: any[]) => {
    if (!changes || !hotRef.current) return;
    
    console.log(`📋 PASTE AUTO-GROW: Safety net check after paste with ${changes.length} changes`);
    
    // Post-paste safety net - chỉ tạo thêm dòng nếu beforePaste bị miss hoặc có lỗi
    const maxRow = Math.max(...changes.map(([row]: any) => row));
    const currentRowCount = hotRef.current.countRows();
    const emptyRows = countEmptyRowsAtEnd();
    
    console.log(`📋 POST-PASTE CHECK: MaxRow=${maxRow}, CurrentRows=${currentRowCount}, EmptyAtEnd=${emptyRows}`);
    
    // Safety net rất nhỏ - chỉ tạo thêm nếu thực sự thiếu dòng
    if (maxRow >= currentRowCount - 1 && emptyRows < 3) {
      const needRows = Math.min(3, 5); // Chỉ tạo tối đa 5 dòng safety
      console.log(`🚨 POST-PASTE SAFETY NET: Creating ${needRows} safety rows`);
      createNewRowsOptimistic(needRows);
    } else {
      console.log(`✅ POST-PASTE: beforePaste worked correctly - no safety rows needed`);
    }
  };

  // Initialize Handsontable (imported directly from server-side)
  useEffect(() => {
    if (hasInitializationStarted.current) {
      console.log('🔒 HANDSONTABLE INITIALIZATION ALREADY IN PROGRESS');
      return;
    }
    
    hasInitializationStarted.current = true;
    console.log('✅ HANDSONTABLE SERVER-SIDE IMPORT READY - Setting loaded state');
    // Reset initialization flag to allow table creation
    hasInitialized.current = false;
    setIsHandsontableLoaded(true);
    
  }, []);

  // Convert account data to spreadsheet format - ONLY REAL DATABASE ROWS
  const convertAccountsToData = (accounts: AdAccount[]) => {
    // ✅ SAFETY CHECK: Ensure accounts is array
    if (!Array.isArray(accounts)) {
      console.warn('⚠️ convertAccountsToData: accounts is not an array:', accounts);
      return [];
    }
    
    // Get effective owner_id - employees should show director's ID
    const user = (currentUser as any)?.user;
    let ownerId = user?.id || 'X';
    
    // For employees, use director's ID for display
    if (user?.role === 'employee' && user?.createdBy) {
      ownerId = user.createdBy;
    }
    
    // Convert existing accounts to grid data with LOCAL_ID - OWNER_ID format
    const accountData = accounts.map((account, index) => {
      // Use database local_id for consistent numbering (1, 2, 3...) 
      const localId = (account as any).localId || (index + 1);
      const displayId = `${localId}-${ownerId}`;
      
      return [
        displayId,              // ✅ DISPLAY LOCAL_ID - OWNER_ID (1-2, 2-2, 3-2, etc.)
        account.accountId || '', // ID TKQC - convert null to empty string
        account.name || '',      // TÊN TK - convert null to empty string
        account.status || '',    // Trạng thái - convert null to empty string
        account.source || '',    // Nguồn - convert null to empty string
        (account as any).rentalPercentage || '', // Fee TK - convert null to empty string  
        account.cardType || '',  // THẺ - convert null to empty string
        account.cardNote || '',  // Note thẻ - convert null to empty string
        account.vatPercentage || '', // VAT % - convert null to empty string
        account.clientTag || '', // TAG KH - convert null to empty string
        account.accountPermission || '', // QUYỀN TK - convert null to empty string
        (account as any).ttEx || '', // TT EX - convert null to empty string
        account.description || '',   // MÔ TẢ - convert null to empty string
        account.id,             // ✅ HIDDEN DATABASE ID for auto-save (column 13)
        ''                      // ✅ HIDDEN TEMP ID (column 14) - empty for real accounts
      ];
    });

    console.log(`📊 Created grid with ${accountData.length} real database accounts with LOCAL_ID-OWNER_ID format`);
    console.log(`👤 Owner ID: ${ownerId}, displaying IDs like: 1-${ownerId}, 2-${ownerId}, 3-${ownerId}, etc.`);
    
    return accountData; // ✅ ONLY RETURN REAL DATABASE ROWS
  };

  // ✅ CRITICAL ID CONSISTENCY FIX: Ensure ALL rows display sequential IDs after any operation
  const fixAllRowIDsAfterRefresh = () => {
    if (!hotRef.current) return;
    
    const totalRows = hotRef.current.countRows();
    const user = (currentUser as any)?.user;
    let ownerId = user?.id || 'X';
    
    // For employees, use director's ID for display
    if (user?.role === 'employee' && user?.createdBy) {
      ownerId = user.createdBy;
    }
    
    console.log(`🔧 FIXING ALL ROW IDs: Ensuring ${totalRows} rows show database local_id format (1-${ownerId}, 2-${ownerId}, etc.)`);
    
    // Use batch operation to update all ID cells based on database local_id
    hotRef.current.batch(() => {
      for (let row = 0; row < totalRows; row++) {
        const databaseId = hotRef.current.getDataAtCell(row, 13); // Hidden database ID
        
        // Find account in adAccounts array to get local_id
        const account = adAccounts?.find(acc => acc.id === databaseId);
        if (account && (account as any).localId) {
          const correctDisplayId = `${(account as any).localId}-${ownerId}`;
          const currentDisplayId = hotRef.current.getDataAtCell(row, 0);
          
          // Only update if the ID is incorrect
          if (currentDisplayId !== correctDisplayId) {
            console.log(`🔧 FIXING ROW ${row}: "${currentDisplayId}" → "${correctDisplayId}" (localId: ${(account as any).localId})`);
            hotRef.current.setDataAtCell(row, 0, correctDisplayId, 'silent');
          }
        }
      }
    });
    
    console.log(`✅ ID CONSISTENCY FIX COMPLETE: All ${totalRows} rows now show LOCAL_ID-OWNER_ID format`);
  };

  // ✅ REMOVED: processRobustRealTimeChanges - replaced by unified real-time system

  // ✅ WEBSOCKET REAL-TIME - Disable HTTP polling per user request
  const { isConnected, subscribe } = useWebSocket();
  
  // WebSocket listener for real-time updates
  useEffect(() => {
    if (!isConnected) {
      console.log('🔌 WEBSOCKET: Not connected yet');
      return;
    }
    
    console.log('🔌 WEBSOCKET: Setting up real-time listener');
    console.log('🔌 WEBSOCKET: Current sessionId =', sessionId);
    console.log('🔌 WEBSOCKET: Connection status =', isConnected);
    
    const unsubscribe = subscribe((data: any) => {
      console.log('🔔 WEBSOCKET CALLBACK TRIGGERED!'); // This should always appear
      
      if (!data) {
        console.log('❌ WEBSOCKET: No data received');
        return;
      }
      
      if (!hotRef.current) {
        console.log('❌ WEBSOCKET: hotRef not ready, skipping update');
        return;
      }
      
      console.log('📡 WEBSOCKET DATA RECEIVED:', data);
      console.log('🔍 SESSION CHECK: data.sessionId =', data.sessionId, 'current sessionId =', sessionId);
      
      // ✅ DISABLED ROW_INSERT HANDLER: Preventing duplicate row creation - use data refresh instead
      if (data.type === 'ROW_INSERT' && data.data && Array.isArray(data.data)) {
        console.log(`🚫 ROW_INSERT DISABLED: ${data.data.length} new rows received but handler disabled to prevent duplicates`);
        console.log('🔄 TRIGGERING DATA REFRESH: Will refresh entire table data instead of adding UI rows');
        
        // Skip own session
        const broadcastSessionId = data.sessionId;
        if (broadcastSessionId === sessionId) {
          console.log('🚫 SKIPPING ROW_INSERT: Own session broadcast');
          return;
        }
        
        // ✅ ENHANCED ROW_INSERT FALLBACK: Apply same visibility fixes as DATA_REFRESH
        console.log('🔄 REFRESHING TABLE DATA: Instead of creating duplicate UI rows');
        
        // Trigger data refresh with enhanced error handling
        setTimeout(async () => {
          console.log('🔄 EXECUTING DATA REFRESH: Fetching fresh data from server');
          try {
            queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
            
            // Apply same enhanced reload logic as DATA_REFRESH
            const result = await queryClient.fetchQuery({ 
              queryKey: ['/api/ad-accounts'],
              staleTime: 0,
              gcTime: 0
            });
            
            if (hotRef.current && result && Array.isArray(result)) {
              const tableData = convertAccountsToData(result as AdAccount[]);
              
              // ✅ APPLY VISIBILITY FIX
              if (containerRef.current) {
                containerRef.current.style.display = 'block';
                containerRef.current.style.visibility = 'visible';
                containerRef.current.style.opacity = '1';
              }
              
              hotRef.current.loadData(tableData);
              hotRef.current.render();
              setTimeout(() => hotRef.current.render(), 50);
              setTimeout(() => hotRef.current.render(), 200);
            }
          } catch (fallbackError) {
            console.error('❌ ROW_INSERT FALLBACK ERROR:', fallbackError);
            window.location.reload();
          }
        }, 1000);
        
        return; // Skip UI row creation completely
      }
      
      // ✅ HANDLE DATA_REFRESH EVENTS: Refresh table data when new accounts created by other sessions
      if (data.type === 'DATA_REFRESH') {
        console.log(`🔄 DATA_REFRESH RECEIVED: ${data.message} (${data.accountCount} accounts)`);
        console.log('🔧 DEBUG: DATA_REFRESH sessionId check:', data.sessionId, 'vs current:', sessionId);
        console.log('🔧 DEBUG: Full DATA_REFRESH payload:', JSON.stringify(data, null, 2));
        
        // ✅ IMMEDIATE FIX: Skip own session to prevent double refresh  
        if (data.sessionId && (data.sessionId.includes(sessionId) || data.sessionId === sessionId)) {
          console.log('🚫 SKIPPING DATA_REFRESH: Own session - already have latest data');
          return;
        }
        
        // ✅ ADDITIONAL CHECK: Make sure we're not Machine A (the creating machine)
        if (data.sessionId && data.sessionId.startsWith('paste-')) {
          console.log('✅ DATA_REFRESH FROM PASTE OPERATION: Processing for Machine B real-time sync');
        }
        
        // ✅ CRITICAL FIX: Process DATA_REFRESH for Machine B real-time sync
        console.log('🔄 FORCING IMMEDIATE DATA REFRESH: New rows created, refreshing ALL clients');
        
        // ✅ CRITICAL FIX: Force refetch and update table data immediately
        queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
        
        // ✅ CRITICAL FIX: Force immediate data refresh using React Query refetch
        setTimeout(async () => {
          console.log('🔄 FORCE REFETCH: Getting fresh data after invalidation');
          try {
            // ✅ USE REACT QUERY REFETCH: More reliable than direct API call
            const result = await queryClient.fetchQuery({ 
              queryKey: ['/api/ad-accounts'],
              staleTime: 0,
              gcTime: 0 // Force fresh fetch
            });
            
            console.log('🔄 FRESH DATA RECEIVED:', result ? `${(result as any[]).length} accounts` : 'no data');
            console.log('🔄 RESPONSE TYPE:', typeof result, 'Array?', Array.isArray(result));
            
            // ✅ ENHANCED DATA_REFRESH: Force table to reload with container visibility fix
            if (hotRef.current && result && Array.isArray(result)) {
              console.log('🔄 FORCING TABLE UPDATE with fresh data');
              const tableData = convertAccountsToData(result as AdAccount[]);
              console.log('🔄 TABLE DATA PREPARED:', tableData.length, 'rows');
              
              try {
                // ✅ CRITICAL FIX: Ensure container visibility before reload
                if (containerRef.current) {
                  containerRef.current.style.display = 'block';
                  containerRef.current.style.visibility = 'visible';
                  containerRef.current.style.opacity = '1';
                }
                
                // Force complete table reload
                hotRef.current.loadData(tableData);
                
                // ✅ ENHANCED RENDER: Multiple render attempts for reliability
                hotRef.current.render();
                setTimeout(() => hotRef.current.render(), 50);
                setTimeout(() => hotRef.current.render(), 200);
                
                // Fix row IDs after reload
                setTimeout(() => {
                  fixAllRowIDsAfterRefresh();
                  console.log('✅ TABLE RELOADED AND IDs FIXED - Machine B should now see new rows');
                }, 100);
                
              } catch (reloadError) {
                console.error('❌ TABLE RELOAD ERROR:', reloadError);
                // Fallback: Force page reload
                window.location.reload();
              }
            } else {
              console.error('❌ INVALID RESPONSE FOR FORCE RELOAD:', {
                hasHotRef: !!hotRef.current,
                hasResponse: !!result,
                isArray: Array.isArray(result),
                responseType: typeof result,
                resultLength: (result as any)?.length || 'N/A'
              });
            }
          } catch (error) {
            console.error('❌ FORCE REFETCH ERROR:', error);
            
            // ✅ FINAL FALLBACK: Force page reload as last resort
            console.log('🔄 FINAL FALLBACK: Reloading page...');
            window.location.reload();
          }
        }, 1000); // Increased delay to 1000ms
        
        return;
      }
      
      // ✅ CROSS-TAB SYNC: Handle updates from "Chi phí tài khoản" tab
      if (data.type === 'STATUS_UPDATED') {
        console.log('📡 CROSS-TAB STATUS UPDATE FROM EXPENSE TAB:', data);
        if (data.sessionId !== sessionId && hotRef.current) {
          // Find account by ID and update status
          const totalRows = hotRef.current.countRows();
          for (let i = 0; i < totalRows; i++) {
            const dbId = hotRef.current.getDataAtCell(i, DB_ID_COL); // Column 13 database ID
            if (dbId === data.accountId) {
              hotRef.current.setDataAtCell(i, 3, data.status, 'external'); // Column 3 is status
              console.log(`✅ CROSS-TAB STATUS UPDATED: Row ${i}, Status: ${data.status}`);
              break;
            }
          }
        }
        return;
      }

      // Skip own session changes for other event types
      if (data.sessionId === sessionId) {
        console.log('🚫 SKIPPING: Own session change');
        return;
      } else {
        console.log('✅ PROCESSING: External session change');
      }
      
      // Handle different WebSocket event types with batching optimization
      if (data.type === 'DATA_UPDATE' && data.accountId && data.field) {
        const totalRows = hotRef.current.countRows();
        
        // ✅ ENHANCED: Multiple search methods for finding rows (including new rows)
        let targetRow = -1;
        
        // Method 1: Search by database ID in hidden column 12
        for (let i = 0; i < totalRows; i++) {
          const dbId = hotRef.current.getDataAtCell(i, 12); // Hidden database ID column
          if (dbId === data.accountId) {
            targetRow = i;
            console.log(`🎯 FOUND ROW by Database ID: Row ${targetRow} matches accountId ${data.accountId}`);
            break;
          }
        }
        
        // Method 2: If not found by DB ID, try to find by account code in column 1 (ID TKQC)
        if (targetRow === -1) {
          for (let i = 0; i < totalRows; i++) {
            const accountCode = hotRef.current.getDataAtCell(i, 1); // ID TKQC column
            if (accountCode && accountCode.toString().includes(data.accountId.toString())) {
              targetRow = i;
              console.log(`🎯 FOUND ROW by Account Code: Row ${targetRow} matches accountId ${data.accountId}`);
              break;
            }
          }
        }
        
        // Method 3: If still not found, search by display ID pattern
        if (targetRow === -1) {
          for (let i = 0; i < totalRows; i++) {
            const displayId = hotRef.current.getDataAtCell(i, 0); // Display ID column
            if (displayId && displayId.toString().includes(`${data.accountId}-`)) {
              targetRow = i;
              console.log(`🎯 FOUND ROW by Display ID pattern: Row ${targetRow} matches accountId ${data.accountId}`);
              break;
            }
          }
        }
        
        if (targetRow >= 0) {
          // Map field to column
          const fieldToColumn: Record<string, number> = {
            accountId: 1, name: 2, status: 3, source: 4, rentalPercentage: 5,
            cardType: 6, cardNote: 7, vatPercentage: 8, clientTag: 9, accountPermission: 10, ttEx: 11, description: 12
          };
          
          const column = fieldToColumn[data.field];
          if (column !== undefined) {
            console.log(`🔄 WEBSOCKET UPDATE: Row ${targetRow}, Col ${column} = "${data.newValue}"`);
            
            // Use batch operation for better performance
            hotRef.current.batch(() => {
              hotRef.current.setDataAtCell(targetRow, column, data.newValue, 'external');
            });
            
            console.log('✅ WEBSOCKET UPDATE APPLIED');
          } else {
            console.log('❌ WEBSOCKET: Column mapping not found for field:', data.field);
          }
        } else {
          console.log('❌ WEBSOCKET: Row not found for account ID:', data.accountId, 'in', totalRows, 'total rows');
          console.log('🔍 DEBUG: Searching for accountId', data.accountId, 'in table with', totalRows, 'rows');
          
          // Debug: Log some sample database IDs for troubleshooting
          for (let i = 0; i < Math.min(5, totalRows); i++) {
            const dbId = hotRef.current.getDataAtCell(i, 13);
            const accountCode = hotRef.current.getDataAtCell(i, 1);
            const displayId = hotRef.current.getDataAtCell(i, 0);
            console.log(`  🔍 Row ${i}: DB_ID=${dbId}, Account_Code=${accountCode}, Display_ID=${displayId}`);
          }
          
          // ✅ CRITICAL FIX: Trigger full data refresh when row not found
          console.log('🔄 ROW NOT FOUND: Triggering full data refresh to sync missing accounts');
          queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
          
          // ✅ FORCE TABLE RELOAD: Same logic as DATA_REFRESH handler
          setTimeout(async () => {
            console.log('🔄 FORCE RELOAD: Missing account data detected');
            try {
              const result = await queryClient.fetchQuery({ 
                queryKey: ['/api/ad-accounts'],
                staleTime: 0,
                gcTime: 0
              });
              
              if (hotRef.current && result && Array.isArray(result)) {
                console.log('🔄 RELOADING TABLE: Found', result.length, 'accounts');
                const tableData = convertAccountsToData(result as AdAccount[]);
                hotRef.current.loadData(tableData);
                hotRef.current.render();
                
                // Fix row IDs and re-apply the pending update
                setTimeout(() => {
                  fixAllRowIDsAfterRefresh();
                  
                  // ✅ RETRY UPDATE: Try to apply the pending change again
                  const newTargetRow = hotRef.current.getData().findIndex((row: any) => 
                    row[13] === data.accountId // DB_ID_COL = 13
                  );
                  
                  if (newTargetRow !== -1) {
                    console.log(`✅ RETRY SUCCESS: Found account ${data.accountId} at row ${newTargetRow}`);
                    const fieldToColumn: Record<string, number> = {
                      accountId: 1, name: 2, status: 3, source: 4, rentalPercentage: 5,
                      cardType: 6, cardNote: 7, vatPercentage: 8, clientTag: 9, accountPermission: 10, ttEx: 11, description: 12
                    };
                    const fieldIndex = fieldToColumn[data.field];
                    if (fieldIndex !== undefined) {
                      hotRef.current.setDataAtCell(newTargetRow, fieldIndex, data.newValue, 'external');
                      console.log(`✅ APPLIED PENDING UPDATE: ${data.field} = "${data.newValue}"`);
                    }
                  } else {
                    console.log(`❌ RETRY FAILED: Account ${data.accountId} still not found after refresh`);
                  }
                }, 100);
              }
            } catch (error) {
              console.error('❌ FORCE RELOAD ERROR:', error);
            }
          }, 500);
        }
      }
      

      
      // ✅ NEW: Handle BATCH_UPDATE for multiple changes at once (ALWAYS process for demo)
      else if (data.type === 'BATCH_UPDATE' && data.changes && Array.isArray(data.changes)) {
        console.log(`🔄 WEBSOCKET BATCH UPDATE: Processing ${data.changes.length} changes`);
        
        const fieldToColumn: Record<string, number> = {
          accountId: 1, name: 2, status: 3, source: 4, rentalPercentage: 5,
          cardType: 6, cardNote: 7, vatPercentage: 8, clientTag: 9, accountPermission: 10, ttEx: 11, description: 12
        };
        
        const totalRows = hotRef.current.countRows();
        
        // ✅ ENHANCED: Use enhanced row finding for batch updates 
        hotRef.current.batch(() => {
          for (let changeIndex = 0; changeIndex < data.changes.length; changeIndex++) {
            const change = data.changes[changeIndex];
            
            // ✅ ENHANCED: Multiple search methods for finding rows (including new rows)
            let targetRow = -1;
            
            // Method 1: Search by database ID in hidden column 13
            for (let i = 0; i < totalRows; i++) {
              const dbId = hotRef.current.getDataAtCell(i, 13);
              if (dbId === change.accountId) {
                targetRow = i;
                console.log(`  🎯 BATCH ${changeIndex + 1}/${data.changes.length}: Found by DB_ID - Row ${targetRow} = ${change.accountId}`);
                break;
              }
            }
            
            // Method 2: If not found by DB ID, try to find by account code in column 1 (ID TKQC)
            if (targetRow === -1) {
              for (let i = 0; i < totalRows; i++) {
                const accountCode = hotRef.current.getDataAtCell(i, 1); // ID TKQC column
                if (accountCode && accountCode.toString().includes(change.accountId.toString())) {
                  targetRow = i;
                  console.log(`  🎯 BATCH ${changeIndex + 1}/${data.changes.length}: Found by Account_Code - Row ${targetRow} = ${change.accountId}`);
                  break;
                }
              }
            }
            
            // Method 3: If still not found, search by display ID pattern
            if (targetRow === -1) {
              for (let i = 0; i < totalRows; i++) {
                const displayId = hotRef.current.getDataAtCell(i, 0); // Display ID column
                if (displayId && displayId.toString().includes(`${change.accountId}-`)) {
                  targetRow = i;
                  console.log(`  🎯 BATCH ${changeIndex + 1}/${data.changes.length}: Found by Display_ID - Row ${targetRow} = ${change.accountId}`);
                  break;
                }
              }
            }
            
            if (targetRow >= 0) {
              const column = fieldToColumn[change.field];
              if (column !== undefined) {
                hotRef.current.setDataAtCell(targetRow, column, change.newValue, 'external');
                console.log(`  ✅ BATCH ${changeIndex + 1}/${data.changes.length}: Row ${targetRow}, ${change.field} = "${change.newValue}"`);
              }
            } else {
              console.log(`❌ BATCH: Row not found for account ID: ${change.accountId} (tried 3 search methods)`);
              console.log(`🔍 DEBUG: Looking for accountId ${change.accountId} in table with ${totalRows} rows`);
            }
          }
        });
        
        console.log(`✅ WEBSOCKET BATCH UPDATE COMPLETED: ${data.changes.length} changes applied`);
        return; // Early return to avoid session filtering for batch updates
      }
      
      // Handle AD_ACCOUNT_UPDATED events from chunked paste
      else if (data.type === 'AD_ACCOUNT_UPDATED' && data.data) {
        const accountData = data.data;
        const totalRows = hotRef.current.countRows();
        
        // ✅ ENHANCED: Multiple search methods for AD_ACCOUNT_UPDATED
        let targetRow = -1;
        
        // Method 1: Search by database ID in hidden column 12
        for (let i = 0; i < totalRows; i++) {
          const dbId = hotRef.current.getDataAtCell(i, 13); // Hidden database ID column
          if (dbId === accountData.id) {
            targetRow = i;
            console.log(`🎯 AD_ACCOUNT_UPDATED: Found by DB_ID - Row ${targetRow} = ${accountData.id}`);
            break;
          }
        }
        
        // Method 2: If not found by DB ID, try to find by account code
        if (targetRow === -1 && accountData.accountId) {
          for (let i = 0; i < totalRows; i++) {
            const accountCode = hotRef.current.getDataAtCell(i, 1); // ID TKQC column
            if (accountCode && accountCode.toString().includes(accountData.accountId.toString())) {
              targetRow = i;
              console.log(`🎯 AD_ACCOUNT_UPDATED: Found by Account_Code - Row ${targetRow} = ${accountData.accountId}`);
              break;
            }
          }
        }
        
        if (targetRow >= 0) {
          console.log(`🔄 WEBSOCKET FULL UPDATE: Row ${targetRow} with account data`);
          // Update all columns with account data
          hotRef.current.setDataAtCell(targetRow, 1, accountData.accountId || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 2, accountData.name || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 3, accountData.status || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 4, accountData.source || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 5, accountData.rentalPercentage || '0', 'external');
          hotRef.current.setDataAtCell(targetRow, 6, accountData.cardType || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 7, accountData.cardNote || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 8, accountData.vatPercentage || '0', 'external');
          hotRef.current.setDataAtCell(targetRow, 9, accountData.clientTag || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 10, accountData.accountPermission || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 11, accountData.ttEx || '', 'external');
          hotRef.current.setDataAtCell(targetRow, 12, accountData.description || '', 'external');
          console.log('✅ WEBSOCKET FULL UPDATE APPLIED');
        } else {
          console.log('❌ WEBSOCKET: Row not found for account ID:', accountData.id);
        }
      }
    });
    
    return () => {
      console.log('🧹 WEBSOCKET: Cleaning up listener');
      unsubscribe();
    };
  }, [isConnected, sessionId]); // Remove subscribe from dependencies to prevent infinite re-renders

  // ✅ OPTIMIZED AUTO-SAVE - Single timeout and change tracking
  const autoSave = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef<boolean>(false);
  
  // ✅ SIMPLIFIED TEMP ROW MANAGEMENT
  const tempRowTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [isEditingTempRow, setIsEditingTempRow] = useState(false);
  
  // ✅ OPTIMIZED DEBOUNCED AUTO-SAVE
  const debouncedSave = (changes: any[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (changes.length > 0 && !isSaving.current) {
        isSaving.current = true;
        bulkSaveMutation.mutate(changes, {
          onSettled: () => {
            isSaving.current = false;
            pendingChanges.current.clear();
          }
        });
      }
    }, 800); // 800ms debounce
  };

  




  const scheduleAutoSave = (row: number, prop: any, newValue: any, oldValue: any) => {
    // Skip first column (display ID) and last column (hidden database ID) - read only
    if (prop === 0 || prop === 13 || prop === 14) return;
    
    // Get the database ID from the last hidden column
    const hotInstance = hotRef.current;
    if (!hotInstance) return;
    
    const databaseId = hotInstance.getDataAtCell(row, 13); // Get database ID from hidden last column
    
    // ✅ CRITICAL FIX: Handle both real database IDs and temp row IDs
    if (!databaseId) {
      // For new rows created by paste, check if there's actual data worth saving
      const accountId = hotInstance.getDataAtCell(row, 1);
      const accountName = hotInstance.getDataAtCell(row, 2);
      
      if (accountId || accountName) {
        console.log(`🆕 TẠO HÀNG MỚI: Row ${row + 1}, Account: ${accountId}, Name: ${accountName}`);
        // Create temp ID for this new row to allow processing (employee creates under director's ownership)
        const tempId = `temp-${Date.now()}-${row}`;
        hotInstance.setDataAtCell(row, 13, tempId, 'system');
        
        // Continue processing with temp ID
        scheduleAutoSave(row, prop, newValue, oldValue);
        return;
      } else {
        console.log(`⏭️ Bỏ qua hàng ${row + 1} - không có ID và không có dữ liệu`);
        return;
      }
    }
    
    // Check if this is a temp row (string starting with "temp-") or real database ID (number)
    const isTempRow = typeof databaseId === 'string' && databaseId.toString().startsWith('temp-');
    const isPasteRow = typeof databaseId === 'string' && databaseId.toString().startsWith('temp-paste-');
    const isRealAccount = typeof databaseId === 'number';
    
    // ✅ HANDLE TEMP PASTE ROWS: Create database entry when user pastes data
    if (isPasteRow) {
      console.log(`📋 PASTE ROW WITH DATA: Row ${row + 1}, Temp ID ${databaseId}, Col ${prop} = "${newValue}"`);
      
      // Get essential data to create database entry
      const accountId = hotInstance.getDataAtCell(row, 1) || '';
      const name = hotInstance.getDataAtCell(row, 2) || '';
      
      if (accountId.trim() || name.trim()) {
        console.log(`📋 CREATING DB ENTRY FOR PASTE ROW: ${accountId} / ${name}`);
        
        // Create database entry using bulk API - always under director's ownership
        const rowData = {
          accountId: accountId,
          name: name,
          status: hotInstance.getDataAtCell(row, 3) || 'Active',
          source: hotInstance.getDataAtCell(row, 4) || '',
          rentalPercentage: hotInstance.getDataAtCell(row, 5) || '0',
          cardType: hotInstance.getDataAtCell(row, 6) || '',
          cardNote: hotInstance.getDataAtCell(row, 7) || '',
          vatPercentage: hotInstance.getDataAtCell(row, 8) || '0',
          clientTag: hotInstance.getDataAtCell(row, 9) || '',
          accountPermission: hotInstance.getDataAtCell(row, 10) || '',
          description: hotInstance.getDataAtCell(row, 11) || ''
        };
        
        // Use apiRequest to create database entry
        apiRequest('POST', '/api/ad-accounts/bulk', { accounts: [rowData] })
          .then((response: any) => {
            if (response?.[0]) {
              const newAccount = response[0];
              console.log(`✅ PASTE ROW CREATED: DB ID ${newAccount.id}`);
              
              // Update row with real database data
              hotInstance.setDataAtCell(row, 13, newAccount.id, 'system'); // Set real DB ID
              hotInstance.setDataAtCell(row, 0, `${newAccount.localId}-${newAccount.ownerId}`, 'system'); // Set display ID
              
              // Clear temp ID to mark as real row
              setTimeout(() => {
                hotInstance.setDataAtCell(row, 14, '', 'system'); // Clear temp ID column
              }, 100);
            }
          })
          .catch((error: any) => {
            console.error('❌ FAILED TO CREATE PASTE ROW:', error);
          });
      }
      return; // Don't continue with regular auto-save logic
    }
    
    if (isTempRow) {
      // Other temp rows (non-paste)
      console.log(`💾 TEMP ROW: Row ${row + 1}, Temp ID ${databaseId}, Col ${prop} = "${newValue}"`);
      return; // Skip auto-save for temp rows until they become real rows
    }
    
    if (!isRealAccount) {
      console.log(`⏭️ Bỏ qua hàng ${row + 1} - ID không hợp lệ: ${databaseId}`);
      return;
    }
    
    // ✅ CRITICAL FIX: Use database ID directly instead of searching in adAccounts array
    // This fixes issue where newly created rows aren't found in the cached array
    console.log(`💾 AUTO-SAVE READY: Row ${row + 1}, Database ID ${databaseId} (Type: ${typeof databaseId})`);
    
    // Field mapping for columns (0=displayID, 1=accountId, 2=name, etc., 13=hiddenDatabaseId, 14=hiddenTempId)
    const fieldMapping = ['displayId', 'accountId', 'name', 'status', 'source', 'rentalPercentage', 'cardType', 'cardNote', 'vatPercentage', 'clientTag', 'accountPermission', 'ttEx', 'description', 'hiddenId', 'hiddenTempId'];
    const fieldName = fieldMapping[prop];
    
    if (!fieldName || fieldName === 'displayId' || fieldName === 'hiddenId' || fieldName === 'hiddenTempId') {
      console.log(`⏭️ Bỏ qua field ${fieldName} - read only hoặc invalid`);
      return;
    }
    
    console.log(`💾 SCHEDULING AUTO-SAVE: Row ${row + 1}, Database ID ${databaseId}, Field ${fieldName}, Old: "${oldValue}", New: "${newValue}"`);
    
    const changeData = {
      id: databaseId, // ✅ Use database ID directly - works for all real accounts
      field: fieldName,
      oldValue: oldValue || '',
      newValue: newValue || '',
      sessionId: sessionId
    };
    
    // Add to pending changes
    const changeKey = `${databaseId}_${fieldName}`;
    pendingChanges.current.set(changeKey, changeData);
    
    // Debounced save (1 second)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      performBatchSave();
    }, 1000);
  };




  
  const performBatchSave = async () => {
    if (isSaving.current) {
      console.log(`⏭️ Bỏ qua save - đang trong quá trình saving`);
      return;
    }
    
    if (pendingChanges.current.size === 0) {
      console.log(`⏭️ Bỏ qua save - không có thay đổi nào pending`);
      return;
    }
    
    // ✅ SMOOTH UX: Skip auto-save when user is editing temp rows to prevent conflicts
    if (isEditingTempRow) {
      console.log('⏸️ AUTO-SAVE PAUSED - user editing temp row');
      return;
    }
    
    isSaving.current = true;
    const changesToSave = Array.from(pendingChanges.current.values());
    console.log(`💾 STARTING BATCH SAVE - ${changesToSave.length} changes to save:`, changesToSave);
    pendingChanges.current.clear();
    
    // Prepare batch save for performance
    
    try {
      // Format changes for server API with null handling
      const formattedChanges = changesToSave.map(change => {
        let processedNewValue = change.newValue;
        
        // Handle percentage fields specifically
        if (change.field === 'rentalPercentage' || change.field === 'vatPercentage') {
          if (processedNewValue === null || processedNewValue === '' || processedNewValue === 'null') {
            processedNewValue = '0'; // Use '0' instead of null/empty for database constraints
          } else if (typeof processedNewValue === 'string') {
            // Remove % symbol if present
            processedNewValue = processedNewValue.replace('%', '');
          }
        }
        
        return {
          id: change.id,
          field: change.field,
          oldValue: change.oldValue,
          newValue: processedNewValue,
          sessionId
        };
      }).filter(change => change.field && change.id);

      if (formattedChanges.length === 0) {
        isSaving.current = false;
        return;
      }

      // ✅ ENHANCED AUTO-SAVE: Send batch update with detailed logging for debugging newly created rows
      console.log(`🚀 SENDING AUTO-SAVE REQUEST: ${formattedChanges.length} changes`);
      formattedChanges.forEach((change, index) => {
        console.log(`  📝 Change ${index + 1}: ID ${change.id} (${typeof change.id}), field ${change.field}: "${change.oldValue}" → "${change.newValue}"`);
      });

      const response = await fetch('/api/ad-accounts/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token') || localStorage.getItem('auth_token') || localStorage.getItem('employee_token')}`
        },
        body: JSON.stringify(formattedChanges)
      });

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Lưu thất bại: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Response data:', responseData);

      console.log(`✅ Đã lưu thành công ${formattedChanges.length} thay đổi`);

    } catch (error) {
      console.error('❌ AUTO-SAVE ERROR:', error);
      console.error('❌ Failed changes:', changesToSave);
      
      // ✅ ENHANCED ERROR HANDLING: Retry for individual changes if batch fails
      console.log('🔄 ATTEMPTING INDIVIDUAL SAVES as fallback...');
      
      for (const change of changesToSave) {
        try {
          console.log(`🔄 Individual save attempt: ID ${change.id}, field ${change.field}`);
          const individualResponse = await fetch(`/api/ad-accounts/${change.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('k_loading_token') || localStorage.getItem('auth_token') || localStorage.getItem('employee_token')}`
            },
            body: JSON.stringify({
              [change.field]: change.newValue
            })
          });
          
          if (individualResponse.ok) {
            console.log(`✅ Individual save SUCCESS: ID ${change.id}, field ${change.field}`);
          } else {
            console.error(`❌ Individual save FAILED: ID ${change.id}, status ${individualResponse.status}`);
          }
        } catch (individualError) {
          console.error(`❌ Individual save ERROR for ID ${change.id}:`, individualError);
        }
      }
      
      toast({
        title: "Lỗi lưu dữ liệu",
        description: "Đang thử lưu từng thay đổi riêng lẻ",
        variant: "destructive"
      });
    } finally {
      isSaving.current = false;
    }
  };

  // ✅ REMOVED: Old polling system - replaced by unified real-time system

  // ✅ REMOVED: Old WebSocket listener - replaced by unified real-time system

  // ✅ MAIN USEEFFECT: Initialize Handsontable with proper guard
  useEffect(() => {
    if (!isHandsontableLoaded || !adAccounts || !containerRef.current) {
      log('⏳ WAITING FOR DEPENDENCIES:', { 
        isHandsontableLoaded, 
        hasAccounts: !!adAccounts?.length, 
        hasContainer: !!containerRef.current 
      });
      return;
    }
    
    if (hasInitialized.current) {
      log('🚫 PREVENTING DUPLICATE INITIALIZATION - Already initialized');
      return;
    }
    
    log('✅ ALL DEPENDENCIES READY - Starting Handsontable initialization');
    log('🔄 INITIALIZING HANDSONTABLE TABLE');
    hasInitialized.current = true;
    
    log(`📊 Created grid with ${adAccounts.length} real database accounts with LOCAL_ID-OWNER_ID format`);
    const user = (currentUser as any)?.user;
    
    // For employees, display director's Owner ID, not employee ID
    let displayOwnerId = user?.id;
    if (user?.role === 'employee' && user?.createdBy) {
      displayOwnerId = user.createdBy;
      console.log(`👷 Employee ${user.id} displaying Director ${displayOwnerId}'s accounts with IDs like: 1-${displayOwnerId}, 2-${displayOwnerId}, etc.`);
    } else {
      console.log(`👤 Director ${user?.id} displaying own accounts with IDs like: 1-${user?.id}, 2-${user?.id}, 3-${user?.id}, etc.`);
    }
    
    const data = convertAccountsToData(adAccounts);
    
    console.log(`🔧 INITIALIZING HANDSONTABLE with data length:`, data.length);
    
    // Destroy existing instance
    if (hotRef.current) {
      hotRef.current.destroy();
    }

    const statusOptions = settings?.statusOptions || ['Hoạt động', 'Tạm dừng', 'Disable', 'Lỗi PTT'];
    const noteCards = settings?.noteCards || ['THẺ KAG', 'THẺ BACKUP', 'THẺ DEV']; // ✅ FIXED: Liên kết với Note Cards thay vì cardTypes
    // Helper function to get currency symbol
    const getCurrencySymbol = (currencyCode: string): string => {
      const currencySymbols: Record<string, string> = {
        'VND': '₫',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'CNY': '¥',
        'KRW': '₩',
        'THB': '฿',
        'SGD': 'S$',
        'HKD': 'HK$',
        'CAD': 'C$',
        'AUD': 'A$',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NOK': 'kr'
      };
      return currencySymbols[currencyCode] || currencyCode;
    };

    // ✅ CURRENCY OPTIONS FROM "TIỀN TỐT" SETTINGS: Use currency codes from settings
    const currencyOptions = settings?.currencyOptions || [];
    
    // Build currency dropdown values from "Tiền Tốt" tab - use only currency codes
    const currencyCodes = currencyOptions
      .filter((option: any) => option && option.code) // Filter valid options with code
      .map((option: any) => option.code); // Extract just the currency codes
    
    // Fallback if no currency options
    const finalCurrencyOptions = currencyCodes.length > 0 ? currencyCodes : ['VND', 'USD', 'EUR', 'JPY'];
    const sources = settings?.partners || ['Facebook', 'Google', 'TikTok', 'HDG'];
    const ttExOptions = settings?.ttExOptions || ['Đang dùng', 'Đã Chốt']; // ✅ TT EX từ settings

    hotRef.current = new Handsontable(containerRef.current, {
      data: data,
      colHeaders: [
        'ID', 'ID TKQC', 'TÊN TK', 'Trạng thái', 'Nguồn', 
        'Fee TK', 'THẺ', 'Note thẻ', 'VAT %', 'TAG KH', 'Tiền Tốt', 'TT EX', 'MÔ TẢ'
      ],
      // ✅ DEFAULT ROW HEIGHT: Use Handsontable default instead of fixed height
      rowHeights: undefined, // Let Handsontable use default height
      columns: [
        { 
          readOnly: true, 
          width: customColWidths[0] || 100,
          // ✅ GOOGLE SHEETS PATTERN: Custom renderer for ID column with status indicators
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            const tempId = instance.getDataAtCell(row, 14); // Get temp ID from hidden column
            const status = (tempId && typeof tempId === 'string' && tempId.toString().startsWith('temp-'))
              ? 'pending' 
              : null;
            
            // Clean ID without status text
            const displayValue = value || '';
            
            // Add status indicator if temp row
            let statusIcon = '';
            if (status === 'pending') statusIcon = '⏳ ';
            else if (status === 'syncing') statusIcon = '🔄 ';
            else if (status === 'done') statusIcon = '✅ ';
            
            td.innerHTML = statusIcon + displayValue;
            td.className = cellProperties.className || '';
            
            return td;
          }
        }, // ID (LOCAL_ID-OWNER_ID format) with status indicator
        { 
          width: customColWidths[1] || 120,
          className: 'htLeft', // Căn trái cho ID TKQC
          readOnly: !canEdit,
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            td.innerHTML = value || '';
            td.style.textAlign = 'left';
            td.style.paddingLeft = '8px';
            return td;
          }
        }, // ID TKQC
        { 
          width: customColWidths[2] || 200, 
          type: 'text',
          className: 'htLeft', // Căn trái cho TÊN TK
          readOnly: !canEdit,
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            td.innerHTML = value || '';
            td.style.textAlign = 'left';
            td.style.paddingLeft = '8px';
            return td;
          }
        }, // TÊN TK - Text input, not dropdown
        { 
          type: 'dropdown', 
          source: statusOptions, 
          width: customColWidths[3] || 80,
          // ✅ DROPDOWN CONFIGURATION: Hiển thị đầy đủ chiều cao
          visibleRows: 10, // Hiển thị tối đa 10 hàng
          trimDropdown: false, // Không cắt ngắn dropdown
          allowEmpty: true,
          readOnly: !canEdit,
          // ✅ COLORFUL STATUS RENDERER: Background colored cells for easy identification
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            // Always log for debugging
            console.log(`🎨 STATUS RENDERER CALLED: Row ${row}, Col ${col}, Value: "${value}"`);
            
            // Set text content
            td.innerHTML = value || '';
            
            // ✅ CSS-BASED RENDERING: Use CSS classes instead of inline styles
            td.className = 'status-cell';
            
            // Set data attribute for CSS targeting
            const normalizedValue = (value || '').toString().toLowerCase().trim();
            td.setAttribute('data-status', normalizedValue);
            
            return td;
          }
        }, // Trạng thái with colored background
        { 
          type: 'dropdown', 
          source: sources, 
          width: customColWidths[4] || 100,
          visibleRows: 10,
          trimDropdown: false,
          allowEmpty: true,
          readOnly: !canEdit
        }, // Nguồn
        { 
          width: customColWidths[5] || 80,
          readOnly: !canEdit,
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            // ✅ PERCENTAGE RENDERER: Auto format Fee TK as percentage
            let displayValue = value || '';
            if (displayValue && displayValue !== '' && displayValue !== '0') {
              // Add % if not present
              displayValue = displayValue.toString().includes('%') ? displayValue : displayValue + '%';
            }
            td.innerHTML = displayValue;
            td.style.textAlign = 'center';
            return td;
          }
        }, // Fee TK - with percentage formatting
        { 
          type: 'dropdown', 
          source: noteCards, // ✅ FIXED: Sử dụng noteCards thay vì cardTypes
          width: customColWidths[6] || 100,
          visibleRows: 10,
          trimDropdown: false,
          allowEmpty: true,
          readOnly: !canEdit
        }, // THẺ
        { width: customColWidths[7] || 120, readOnly: !canEdit }, // Note thẻ
        { 
          width: customColWidths[8] || 80,
          readOnly: !canEdit,
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            // ✅ PERCENTAGE RENDERER: Auto format VAT as percentage
            let displayValue = value || '';
            if (displayValue && displayValue !== '' && displayValue !== '0') {
              // Add % if not present
              displayValue = displayValue.toString().includes('%') ? displayValue : displayValue + '%';
            }
            td.innerHTML = displayValue;
            td.style.textAlign = 'center';
            return td;
          }
        }, // VAT % - with percentage formatting
        { 
          width: customColWidths[9] || 150, // TAG KH - Tăng chiều rộng để hiển thị đầy đủ
          className: 'htLeft', // Căn trái
          renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
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
            tagText.className = 'tag-text'; // Sử dụng CSS class
            
            // Display format: "Gắn Tag : KH1, KH2, KH3"
            if (value && value.length > 0) {
              tagText.textContent = `Gắn Tag : ${value}`;
            } else {
              tagText.textContent = 'Gắn Tag';
            }
            
            // Add click handler only if user can edit
            if (canEdit) {
              tagText.addEventListener('click', (e) => {
                e.stopPropagation();
                const databaseId = instance.getDataAtCell(row, 13); // Hidden database ID
                const currentTags = value || '';
                
                if (databaseId && typeof databaseId === 'number') {
                  // Only open dialog for real accounts (not temp rows)
                  setSelectedAccountForTags({
                    id: databaseId,
                    currentTags: currentTags,
                    rowIndex: row
                  });
                  setTagDialogOpen(true);
                }
              });
            }
            
            container.appendChild(tagText);
            td.appendChild(container);
            
            return td;
          }
        }, // TAG KH with left-aligned format
        { 
          type: 'dropdown', 
          source: finalCurrencyOptions, 
          width: customColWidths[10] || 120,
          visibleRows: 10,
          trimDropdown: false,
          allowEmpty: true,
          readOnly: !canEdit
        }, // Tiền Tốt - Connected to "Tiền Tốt" settings tab
        { 
          type: 'dropdown', 
          source: ttExOptions, 
          width: customColWidths[11] || 100,
          visibleRows: 10,
          trimDropdown: false,
          allowEmpty: true,
          readOnly: !canEdit
        }, // TT EX
        { width: customColWidths[12] || 200, readOnly: !canEdit }, // MÔ TẢ
        { readOnly: true, width: 1, className: 'htHidden' }, // Hidden Database ID
        { readOnly: true, width: 1, className: 'htHidden' }  // Hidden Temp ID
      ],
      hiddenColumns: {
        columns: [0, DB_ID_COL, TEMP_ID_COL], // Hide ID column, database ID and temp ID columns
        indicators: false
      },
      rowHeaders: true,
      contextMenu: canEdit,
      filters: true, // ✅ Filter system enabled
      dropdownMenu: [
        'filter_by_condition',
        'filter_by_value',
        'filter_action_bar'
      ], // ✅ SIMPLIFIED DROPDOWN - Chỉ giữ filter cần thiết
      columnSorting: true, // ✅ Column sorting restored per user request
      // sortIndicator: true, // Show sort indicators - REMOVED: Property doesn't exist in type
      manualColumnResize: true,
      manualRowResize: true,
      
      // ✅ COLUMN RESIZE: Save custom widths when user resizes columns
      afterColumnResize: (newSize: number, column: number, isDoubleClick: boolean) => {
        log('🔧 Column resized:', { column, newSize, isDoubleClick });
        
        // Update our custom widths state
        setCustomColWidths(prev => {
          const updated = [...prev];
          // Ensure we have enough elements (15 columns total)
          while (updated.length <= column) {
            updated.push(120); // Default width for new columns
          }
          updated[column] = newSize;
          
          // Save to localStorage
          try {
            localStorage.setItem('account-table-col-widths', JSON.stringify(updated));
            log('✅ Saved account column widths to localStorage:', updated);
          } catch (e) {
            console.error('Failed to save account column widths:', e);
          }
          
          return updated;
        });
      },
      stretchH: 'all',
      width: '100%',
      height: 'calc(100vh - 60px)',
      licenseKey: 'non-commercial-and-evaluation',
      minSpareRows: 0, // ✅ NO SPARE ROWS - only show database rows
      // ✅ NO MAX ROWS LIMIT - allow optimistic UI to add temp rows
      


      // ✅ CELLS RENDERER: Apply colors to status column + vertical centering for all cells
      cells: function(row: number, col: number) {
        const cellProperties: any = {};
        
        // ✅ VERTICAL CENTERING: Add CSS classes for all cells
        cellProperties.className = 'htMiddle htCenter';
        
        // Apply status column renderer with colors
        if (col === 3) { // Status column (Trạng thái)
          cellProperties.renderer = function(instance: any, td: any, row: number, col: number, prop: any, value: any, cellProperties: any) {
            // ✅ STATUS COLOR RENDERER: Logging disabled for performance
            
            // Set text content
            td.innerHTML = value || '';
            
            // Clear existing styles and force override
            td.style.cssText = '';
            td.className = '';
            td.removeAttribute('style');
            
            // Apply base styles
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            td.style.fontWeight = '600';
            td.style.padding = '6px 12px';
            td.style.border = '1px solid #ddd';
            
            // Apply soft, gentle colors that are easy on the eyes
            const applyStyle = (bgColor: string, textColor: string, statusName: string) => {
              td.style.setProperty('background-color', bgColor, 'important');
              td.style.setProperty('color', textColor, 'important');
              td.style.setProperty('border-radius', '6px', 'important');
              td.style.setProperty('font-size', '12px', 'important');
              td.style.setProperty('font-weight', '500', 'important');
              td.style.setProperty('text-align', 'center', 'important');
              td.style.setProperty('vertical-align', 'middle', 'important');
              td.style.setProperty('padding', '6px 12px', 'important');
              
              // Force re-apply with timeout to override Handsontable
              setTimeout(() => {
                td.style.setProperty('background-color', bgColor, 'important');
                td.style.setProperty('color', textColor, 'important');
              }, 10);
              
              // Status color applied (logging disabled for performance)
            };
            
            if (value === 'Active' || value === 'Hoạt động') {
              applyStyle('#dcfce7', '#166534', '✅ SOFT GREEN'); // Light green bg, dark green text
            } else if (value === 'Paused' || value === 'Tạm dừng') {
              applyStyle('#fef3c7', '#92400e', '🟡 SOFT ORANGE'); // Light amber bg, dark amber text
            } else if (value === 'Disabled' || value === 'Disable') {
              applyStyle('#fee2e2', '#dc2626', '🔴 SOFT RED'); // Light red bg, dark red text
            } else if (value === 'Error' || value === 'Lỗi PTT') {
              applyStyle('#fecaca', '#b91c1c', '❌ SOFT ERROR'); // Light red bg, darker red text
            } else if (value && value.trim() !== '') {
              applyStyle('#f3f4f6', '#374151', '⚪ SOFT GRAY'); // Light gray bg, dark gray text
            }
            
            return td;
          };
        }
        
        return cellProperties;
      },

      // ✅ ENHANCED AFTER LOAD DATA: Fix white screen issues with forced visibility
      afterLoadData: function() {
        log(`🎨 AFTER LOAD DATA: Forcing status column render`);
        
        // ✅ CRITICAL FIX: Force container visibility immediately
        if (containerRef.current) {
          containerRef.current.style.display = 'block';
          containerRef.current.style.visibility = 'visible';
          containerRef.current.style.opacity = '1';
          log('🔄 AFTERLOADDATA: Container visibility forced');
        }
        
        // ✅ OPTIMIZED RENDER: Single render with requestAnimationFrame
        if (hotRef.current) {
          hotRef.current.render();
          requestAnimationFrame(() => {
            if (hotRef.current) hotRef.current.render();
          });
          log(`🔄 FORCED TABLE RENDER for status colors`);
        }
      },



      afterChange: (changes: any[] | null, source: string) => {
        if (!changes) return;
        if (changes && source !== 'external' && source !== 'loadData' && source !== 'updateData' && source !== 'sync') {
          // Process changes efficiently
          changes.forEach(([row, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
              // Check if this is a temp row (check hidden temp ID column)
              const tempId = hotRef.current.getDataAtCell(row, TEMP_ID_COL); // Column 14 is temp ID
              
              if (tempId && typeof tempId === 'string' && String(tempId).startsWith('temp-')) {
                console.log(`📝 TEMP ROW EDIT: Row ${row}, TempID ${tempId}, Field ${prop}, Value: ${newValue}`);
                
                // Update temp row data with current changes - using useRef for immediate sync
                const tempRow = pendingTempRows.current.get(tempId);
                if (tempRow) {
                  // Get current row data from Handsontable
                  const currentRowData = hotRef.current.getData()[row];
                  
                  // Update both data and sync status
                  tempRow.data = currentRowData;
                  tempRow.needsSync = true;
                  tempRow.rowIndex = row; // Update row index in case it changed
                  
                  console.log(`🔄 Updated temp row ${tempId} data:`, tempRow.data);
                  pendingTempRows.current.set(tempId, tempRow);
                } else {
                  console.log(`⚠️ Temp row ${tempId} not found in pendingTempRows, creating new entry`);
                  // Create new temp row entry if missing
                  const currentRowData = hotRef.current.getData()[row];
                  pendingTempRows.current.set(tempId, {
                    status: 'pending',
                    data: currentRowData,
                    rowIndex: row,
                    needsSync: true
                  });
                }
                
                // Schedule debounced sync for this temp row
                // scheduleTempRowSync(tempId); // Function removed in optimization
              } else {
                // Regular database row - use existing auto-save
                scheduleAutoSave(row, prop, newValue, oldValue);
              }
            }
          });
          
          // ✅ PASTE EVENT DETECTION - AUTO-TRIGGER SYNC WHEN beforePaste MISSES
          if (source === 'paste') {
            console.log('📋 AFTERCHANGE PASTE DETECTED:', { changes: changes.length, source });
            console.log('🚨 FALLBACK PASTE SYNC: beforePaste may have missed, scanning for temp rows');
            
            // Fallback: Create temp rows for paste data when beforePaste misses
            setTimeout(() => {
              console.log('🔍 FALLBACK: Scanning table for paste data without temp rows');
              
              const tempRows = [];
              const totalRows = hotRef.current?.countRows() || 0;
              let foundPasteData = false;
              
              // First scan for existing temp rows
              for (let i = 0; i < totalRows; i++) {
                const tempId = hotRef.current?.getDataAtCell(i, TEMP_ID_COL); // Column 14 is temp ID
                if (tempId && typeof tempId === 'string' && tempId.startsWith('temp-paste-')) {
                  tempRows.push(tempId);
                }
              }
              
              // If no temp rows but paste detected, create them for pasted data
              if (tempRows.length === 0) {
                log('🚨 CREATING TEMP ROWS: beforePaste missed, creating temp rows for paste data');
                
                // Find rows with data but no database ID (newly pasted)
                for (let i = 0; i < totalRows; i++) {
                  const databaseId = hotRef.current?.getDataAtCell(i, DB_ID_COL); // Column 13 is database ID
                  const accountId = hotRef.current?.getDataAtCell(i, 1); // Column 1 is account ID
                  const name = hotRef.current?.getDataAtCell(i, 2); // Column 2 is name
                  
                  if (!databaseId && (accountId || name)) {
                    const tempId = `temp-paste-${Date.now()}-${i}`;
                    hotRef.current?.setDataAtCell(i, TEMP_ID_COL, tempId, 'system'); // Set temp ID
                    tempRows.push(tempId);
                    foundPasteData = true;
                    log(`🏷️ CREATED TEMP ROW: Row ${i}, TempID ${tempId}, Data: ${accountId}, ${name}`);
                  }
                }
              }
              
              if (tempRows.length > 0) {
                log(`🚀 FALLBACK SYNC: Found/Created ${tempRows.length} temp rows, triggering sync`);
                syncTempRowsBatch(tempRows);
              } else {
                log('ℹ️ FALLBACK SYNC: No paste data found needing sync');
              }
            }, 500);
          }
        }
      },
      
      // ✅ REMOVED afterSetDataAtCell to prevent double auto-save trigger

      // ✅ SMOOTH UX: Enhanced editing state tracking for temp rows
      beforeBeginEditing: (row: number, column: number) => {
        setIsUserEditing(true);
        
        // Check if this is a temp row
        const tempId = hotRef.current?.getDataAtCell(row, TEMP_ID_COL); // Column 14 is temp ID
        const isTempRow = tempId && typeof tempId === 'string' && String(tempId).startsWith('temp-');
        
        if (isTempRow) {
          setIsEditingTempRow(true);
          log('✏️ EDITING TEMP ROW - pausing all background operations');
        } else {
          log('✏️ EDITING REAL ROW - preventing auto row creation only');
        }
        
        // Clear existing timeout
        if (editingTimeoutRef.current) {
          clearTimeout(editingTimeoutRef.current);
        }
      },



      beforeKeyDown: (event: KeyboardEvent) => {
        // Detect typing to maintain editing state
        if (event.key && event.key.length === 1) { // Regular character typing
          setIsUserEditing(true);
          
          // Reset timeout to extend editing period
          if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current);
          }
          
          // Mark as not editing after 3 seconds of inactivity
          editingTimeoutRef.current = setTimeout(() => {
            setIsUserEditing(false);
            log('⏹️ EDITING TIMEOUT - auto row creation re-enabled');
          }, 3000);
        }
      },

      afterDeselect: () => {
        // User finished editing, allow auto-creation after short delay
        if (editingTimeoutRef.current) {
          clearTimeout(editingTimeoutRef.current);
        }
        
        editingTimeoutRef.current = setTimeout(() => {
          setIsUserEditing(false);
          setIsEditingTempRow(false);
          console.log('⏹️ USER FINISHED EDITING - all operations re-enabled');
        }, 800); // Reduced delay for better responsiveness
      },

      // ✅ DISABLED: Auto row creation event handlers - DISABLED PER USER REQUEST
      afterScrollVertically: () => {
        console.log('⏸️ AUTO ROW CREATION ON SCROLL: Disabled per user request');
      },

      afterSelectionEnd: (row: number, column: number, row2: number, column2: number) => {
        console.log('⏸️ AUTO ROW CREATION ON SELECTION: Disabled per user request');
      },

      beforePaste: (data: any, coords: any) => {
        console.log('🔥 BEFORE PASTE HOOK CALLED!', { dataLength: data?.length, coords, hasHotRef: !!hotRef.current });
        
        if (!data || !coords || !hotRef.current) {
          console.warn('❌ BEFORE PASTE EARLY RETURN:', { hasData: !!data, hasCoords: !!coords, hasHotRef: !!hotRef.current });
          return;
        }

        console.log(`📋 PASTE DETECTED: ${data.length} rows`);
        
        const startRow = coords[0].startRow || coords[0].row || 0;
        const currentRowCount = hotRef.current.countRows();
        const endRowNeeded = startRow + data.length - 1;
        const tableEndRow = currentRowCount - 1;

        // Nếu paste vượt dòng cuối → thêm đủ dòng
        if (endRowNeeded > tableEndRow) {
          const missingRows = endRowNeeded - tableEndRow;
          console.log(`➕ PASTE OVERFLOW: Adding ${missingRows} rows`);

          // Tạo temp rows trước khi paste (Google Sheets style)
          const temps = Array.from({ length: missingRows }, (_, i) => `temp-paste-${Date.now()}-${i}`);
          const newRows = temps.map(tempId => [
            '⏳ Loading...', '', '', '', '', '0', '', '', '0', '', '', '', '', '', tempId
          ]);

          // Thêm ngay vào UI
          hotRef.current.batch(() => {
            hotRef.current.alter('insert_row_below', tableEndRow, missingRows, 'paste-overflow');
            newRows.forEach((rowData, idx) => {
              const rowIndex = currentRowCount + idx;
              rowData.forEach((cellValue, colIdx) => {
                hotRef.current.setDataAtCell(rowIndex, colIdx, cellValue, 'paste-overflow');
              });
            });
          });

          // Gửi temp rows lên server → mapping ID thật
          setTimeout(() => {
            const tempRows = [];
            const totalRows = hotRef.current.countRows();
            for (let i = 0; i < totalRows; i++) {
              const tempId = hotRef.current.getDataAtCell(i, 14); // hidden temp col
              if (tempId && tempId.startsWith('temp-paste')) {
                tempRows.push(tempId);
              }
            }
            if (tempRows.length > 0) {
              console.log(`🚀 Auto-sync ${tempRows.length} temp rows after paste`);
              syncTempRowsBatch(tempRows);
            }
          }, 300);
        } else {
          console.log("✅ Paste trong bảng, không cần thêm dòng");
        }
      }
    });

    console.log('✅ HANDSONTABLE FULLY INITIALIZED - Using unified real-time system');
    console.log('🔍 TABLE CONTAINER DEBUG:', containerRef.current?.style?.display, containerRef.current?.style?.visibility);
    
    // ✅ CRITICAL: Force table visibility after initialization
    if (containerRef.current) {
      containerRef.current.style.display = 'block';
      containerRef.current.style.visibility = 'visible';
      containerRef.current.style.opacity = '1';
      log('✅ FORCED TABLE VISIBILITY - Container should now be visible');
    }
    
    // ✅ PHANTOM ROW PREVENTION: Clean up any temp rows from previous sessions
    setTimeout(() => {
      cleanupPhantomTempRows();
    }, 100);
    
    // ✅ SIMPLE HTTP POLLING: Start Google Sheets-like real-time updates
    
    // ✅ CRITICAL FIX: Ensure all IDs display correctly after table initialization
    setTimeout(() => {
      fixAllRowIDsAfterRefresh();
    }, 200); // Ensure table is fully rendered before fixing IDs
    
    // ✅ ENHANCED: Multiple render attempts to fix initial visibility issue
    setTimeout(() => {
      if (hotRef.current && containerRef.current) {
        log('🔄 FIRST RENDER ATTEMPT after 500ms - Fixing initial visibility issue');
        hotRef.current.render();
        containerRef.current.style.display = 'block';
        containerRef.current.style.visibility = 'visible';
        containerRef.current.style.opacity = '1';
      }
    }, 500);

    // ✅ OPTIMIZED RENDER - Single render with requestAnimationFrame
    if (hotRef.current) {
      hotRef.current.render();
      requestAnimationFrame(() => {
        if (hotRef.current) hotRef.current.render();
      });
    }
    
    // Reset data refresh flag after successful initialization
    setTimeout(() => {
      log(`🔄 REBUILD COMPLETE`);
    }, 1000);

    return () => {
      // ✅ OPTIMIZED CLEANUP - Only essential cleanup
      if (autoSave.current) {
        clearTimeout(autoSave.current);
      }
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
      }
    };
  }, [isHandsontableLoaded, settings]); // ✅ CRITICAL FIX: Remove adAccounts from dependency to prevent continuous reload

  // ✅ DISABLED: Custom renderer refresh to prevent table reload issues
  // The status tracking will work but visual updates will happen naturally through data changes
  // useEffect(() => {
  //   // Temporarily disabled to prevent table reload
  // }, [rowStatusMap]);

  // TEMPORARY FIX: Block the problematic reload by using ref instead of reactive adAccounts
  const stableAdAccounts = useRef(adAccounts);
  useEffect(() => {
    if (adAccounts && adAccounts.length > 0) {
      stableAdAccounts.current = adAccounts;
    }
  }, [adAccounts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu tài khoản...</p>
        </div>
      </div>
    );
  }

  if (!isHandsontableLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải bảng tính...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics from adAccounts data
  const totalAccounts = adAccounts.length;
  const activeAccounts = adAccounts.filter(acc => acc.status === 'Hoạt động').length;
  const pausedAccounts = adAccounts.filter(acc => acc.status === 'Tạm dừng').length;
  const disabledAccounts = adAccounts.filter(acc => acc.status === 'Disable').length;
  const errorAccounts = adAccounts.filter(acc => acc.status === 'Lỗi PTT').length;
  const emptyAccounts = adAccounts.filter(acc => !acc.name || acc.name.trim() === '').length;
  const completedAccounts = adAccounts.filter(acc => acc.name && acc.name.trim() !== '' && acc.status === 'Hoạt động').length;

  return (
    <div className="account-table-wrapper w-full h-screen flex flex-col">
      {/* Compact Statistics Cards Row */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b">
        <div className="flex flex-wrap gap-2 justify-center">
          <div className="stat-card bg-blue-50 border-blue-200">
            <span className="text-blue-600">📊</span>
            <span className="font-semibold text-blue-700">{totalAccounts}</span>
            <span className="text-blue-600">Tổng TK</span>
          </div>
          
          <div className="stat-card bg-green-50 border-green-200">
            <span className="text-green-600">🟢</span>
            <span className="font-semibold text-green-700">{activeAccounts}</span>
            <span className="text-green-600">Hoạt động</span>
          </div>
          
          <div className="stat-card bg-red-50 border-red-200">
            <span className="text-red-600">🔴</span>
            <span className="font-semibold text-red-700">{pausedAccounts}</span>
            <span className="text-red-600">Tạm dừng</span>
          </div>
          
          <div className="stat-card bg-orange-50 border-orange-200">
            <span className="text-orange-600">⏸️</span>
            <span className="font-semibold text-orange-700">{disabledAccounts}</span>
            <span className="text-orange-600">Chờ</span>
          </div>
          
          <div className="stat-card bg-purple-50 border-purple-200">
            <span className="text-purple-600">👥</span>
            <span className="font-semibold text-purple-700">{errorAccounts}</span>
            <span className="text-purple-600">Khách hàng</span>
          </div>
          
          <div className="stat-card bg-gray-50 border-gray-200">
            <span className="text-gray-600">💰</span>
            <span className="font-semibold text-gray-700">{completedAccounts}</span>
            <span className="text-gray-600">Cổi</span>
          </div>
          
          <div className="stat-card bg-cyan-50 border-cyan-200">
            <span className="text-cyan-600">🏢</span>
            <span className="font-semibold text-cyan-700">{totalAccounts}</span>
            <span className="text-cyan-600">Đông</span>
          </div>
          
          <div className="stat-card bg-pink-50 border-pink-200">
            <span className="text-pink-600">⭕</span>
            <span className="font-semibold text-pink-700">{emptyAccounts}</span>
            <span className="text-pink-600">Ơ</span>
          </div>
          
          {/* Test Button for Empty Status Verification */}
          <button
            onClick={() => {
              log('🧪 TEST: Creating new row - status should be EMPTY');
              const tempId = createSingleRowOptimistic();
              log(`🧪 TEST: Created temp row ${tempId} - check if status column is empty`);
            }}
            className="stat-card bg-yellow-50 border-yellow-200 hover:bg-yellow-100 cursor-pointer transition-colors"
            title="Test tạo hàng mới - status phải trống"
          >
            <span className="text-yellow-600">🧪</span>
            <span className="font-semibold text-yellow-700">TEST</span>
            <span className="text-yellow-600">Status Trống</span>
          </button>

          {/* Test Search Popup Button */}
          <button
            onClick={() => {
              console.log('🔍 TEST BUTTON: Opening search popup manually');
              setSearchVisible(true);
              setTimeout(() => {
                searchInputRef.current?.focus();
                console.log('🎯 TEST: Search input focused');
              }, 100);
            }}
            className="stat-card bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors"
            title="Test search popup - Ctrl+F should work"
          >
            <span className="text-blue-600">🔍</span>
            <span className="font-semibold text-blue-700">TEST</span>
            <span className="text-blue-600">Search</span>
          </button>
        </div>
      </div>
      
      {/* Handsontable Container */}
      <div 
        ref={containerRef}
        className="handsontable-container border-l border-r border-b bg-white dark:bg-gray-800 flex-1 block visible"
        style={{ minHeight: '500px', height: 'calc(100vh - 80px)' }}
      />

      {/* Tag Management Dialog */}
      {selectedAccountForTags && (
        <TagManagementDialog
          isOpen={tagDialogOpen}
          onClose={handleTagDialogClose}
          currentTags={selectedAccountForTags.currentTags}
          accountId={selectedAccountForTags.id}
          onTagsUpdate={handleTagsUpdate}
        />
      )}

      {/* ✅ COMPACT SEARCH BAR - Giống hệt expense tab */}
      {searchVisible && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            right: '20px',
            background: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            minWidth: '300px',
            overflow: 'hidden'
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm trong trang tính"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // ✅ AUTO SEARCH: Tự động tìm NHƯNG KHÔNG navigate để không làm mất focus
              if (e.target.value.trim()) {
                performSearch(e.target.value, false); // false = không auto navigate
              } else {
                setSearchResults([]);
                setCurrentSearchIndex(0);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchQuery.trim()) {
                  performSearch(searchQuery, true); // true = auto navigate khi nhấn Enter
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setSearchVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              } else if (e.key === 'ArrowUp' && searchResults.length > 0) {
                e.preventDefault();
                navigateSearchResults('prev');
              } else if (e.key === 'ArrowDown' && searchResults.length > 0) {
                e.preventDefault();
                navigateSearchResults('next');
              }
            }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#374151'
            }}
            className="dark:bg-gray-800 dark:text-white"
            autoFocus
          />
          
          {/* Navigation arrows when results exist */}
          {searchResults.length > 0 && (
            <>
              <div 
                style={{
                  padding: '0 8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  borderLeft: '1px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb'
                }}
                className="dark:border-gray-600 dark:text-gray-400"
              >
                {currentSearchIndex + 1}/{searchResults.length}
              </div>
              <button
                onClick={() => navigateSearchResults('prev')}
                style={{
                  padding: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center'
                }}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
              >
                ▲
              </button>
              <button
                onClick={() => navigateSearchResults('next')}
                style={{
                  padding: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center'
                }}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
              >
                ▼
              </button>
            </>
          )}
          
          <button
            onClick={() => {
              setSearchVisible(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
            style={{
              padding: '8px 12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#6b7280',
              borderLeft: '1px solid #e5e7eb'
            }}
            className="hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* ✅ CSS STYLING - Dropdown menu và filter styling */}
      <style>{`
        /* Clean dropdown styling - simplified array-based approach */
        .htDropdownMenu {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          padding: 8px 0 !important;
        }
        
        .htDropdownMenu .htUIMenu .htUIMenuItem {
          padding: 8px 16px !important;
          font-size: 14px !important;
          color: #374151 !important;
          text-align: left !important;
          line-height: 1.4 !important;
          display: flex !important;
          align-items: center !important;
        }
        
        .htDropdownMenu .htUIMenu .htUIMenuItem:hover {
          background-color: #f3f4f6 !important;
          color: #1f2937 !important;
        }
        
        /* Style filter sections */
        .htDropdownMenu .htUIMultipleSelectHot {
          height: 300px !important;
          max-height: 300px !important;
          min-width: 220px !important;
        }
        
        .htDropdownMenu .htUIMultipleSelectHot .wtHolder {
          height: 280px !important;
          max-height: 280px !important;
        }
        
        /* Left-align all filter text */
        .htDropdownMenu .htUIMultipleSelectHot .ht_master tbody td {
          text-align: left !important;
          padding-left: 8px !important;
          font-size: 13px !important;
          color: #374151 !important;
        }
        
        /* Checkbox alignment */
        .htDropdownMenu .htUIMultipleSelectHot .ht_master tbody td input[type="checkbox"] {
          margin-right: 8px !important;
          vertical-align: middle !important;
        }
        
        /* Search input styling */
        .htDropdownMenu .htUIMultipleSelectHot .htUIMultipleSelectSearch input {
          padding: 8px !important;
          font-size: 13px !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          margin: 8px !important;
          width: calc(100% - 16px) !important;
        }
        
        /* Button styling */
        .htDropdownMenu .htUIButton {
          background: #f9fafb !important;
          border: 1px solid #d1d5db !important;
          color: #374151 !important;
          font-size: 13px !important;
          padding: 6px 12px !important;
          margin: 4px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
        }
        
        .htDropdownMenu .htUIButton:hover {
          background: #f3f4f6 !important;
          border-color: #9ca3af !important;
        }
        
        /* Filter action bar styling */
        .htDropdownMenu .htUISelectAllNone {
          padding: 8px 16px !important;
          border-bottom: 1px solid #e5e7eb !important;
          background: #f9fafb !important;
        }
        
        .htDropdownMenu .htUISelectAllNone .htUIButton {
          background: transparent !important;
          border: none !important;
          color: #2563eb !important;
          text-decoration: underline !important;
          padding: 0 !important;
          margin: 0 8px 0 0 !important;
          font-size: 13px !important;
        }
        
        .htDropdownMenu .htUISelectAllNone .htUIButton:hover {
          color: #1d4ed8 !important;
          background: transparent !important;
        }
        
        /* Overall container improvements */
        .htDropdownMenu .htUIMultipleSelectSearch {
          border-bottom: 1px solid #e5e7eb !important;
          padding-bottom: 8px !important;
          margin-bottom: 8px !important;
        }
        
        /* Result highlighting in search */
        .htDropdownMenu .htUIMultipleSelectHot .ht_master .highlighted {
          background-color: #fef3c7 !important;
          color: #92400e !important;
        }

        /* ✅ MAXIMUM SPECIFICITY: Override all Handsontable default styles for status cells */
        .handsontable .htCore tbody tr td.status-cell,
        .handsontable tbody tr td.status-cell,
        .htCore tbody tr td.status-cell,
        tbody tr td.status-cell,
        td.status-cell {
          text-align: center !important;
          vertical-align: middle !important;
          font-weight: 500 !important;
          padding: 6px 12px !important;
          border: 1px solid #e5e5e5 !important;
          border-radius: 6px !important;
          font-size: 13px !important;
        }
        
        /* Active status - Green */
        .handsontable .htCore tbody tr td.status-cell[data-status="active"], 
        .handsontable .htCore tbody tr td.status-cell[data-status="hoạt động"],
        .handsontable tbody tr td.status-cell[data-status="active"], 
        .handsontable tbody tr td.status-cell[data-status="hoạt động"],
        .htCore tbody tr td.status-cell[data-status="active"], 
        .htCore tbody tr td.status-cell[data-status="hoạt động"],
        tbody tr td.status-cell[data-status="active"], 
        tbody tr td.status-cell[data-status="hoạt động"],
        td.status-cell[data-status="active"], 
        td.status-cell[data-status="hoạt động"] {
          background-color: #d4edda !important;
          color: #155724 !important;
        }
        
        /* Paused status - Orange */
        .handsontable .htCore tbody tr td.status-cell[data-status="paused"], 
        .handsontable .htCore tbody tr td.status-cell[data-status="tạm dừng"],
        .handsontable tbody tr td.status-cell[data-status="paused"], 
        .handsontable tbody tr td.status-cell[data-status="tạm dừng"],
        .htCore tbody tr td.status-cell[data-status="paused"], 
        .htCore tbody tr td.status-cell[data-status="tạm dừng"],
        tbody tr td.status-cell[data-status="paused"], 
        tbody tr td.status-cell[data-status="tạm dừng"],
        td.status-cell[data-status="paused"], 
        td.status-cell[data-status="tạm dừng"] {
          background-color: #fff3cd !important;
          color: #856404 !important;
        }
        
        /* Disabled status - Red */
        .handsontable .htCore tbody tr td.status-cell[data-status="disabled"], 
        .handsontable .htCore tbody tr td.status-cell[data-status="disable"],
        .handsontable tbody tr td.status-cell[data-status="disabled"], 
        .handsontable tbody tr td.status-cell[data-status="disable"],
        .htCore tbody tr td.status-cell[data-status="disabled"], 
        .htCore tbody tr td.status-cell[data-status="disable"],
        tbody tr td.status-cell[data-status="disabled"], 
        tbody tr td.status-cell[data-status="disable"],
        td.status-cell[data-status="disabled"], 
        td.status-cell[data-status="disable"] {
          background-color: #f8d7da !important;
          color: #721c24 !important;
        }
        
        /* DH và Lỗi PTT - Yellow Light (màu vàng nhạt) */
        .handsontable .htCore tbody tr td.status-cell[data-status="dh"],
        .handsontable .htCore tbody tr td.status-cell[data-status="error"], 
        .handsontable .htCore tbody tr td.status-cell[data-status="lỗi ptt"],
        .handsontable tbody tr td.status-cell[data-status="dh"],
        .handsontable tbody tr td.status-cell[data-status="error"], 
        .handsontable tbody tr td.status-cell[data-status="lỗi ptt"],
        .htCore tbody tr td.status-cell[data-status="dh"],
        .htCore tbody tr td.status-cell[data-status="error"], 
        .htCore tbody tr td.status-cell[data-status="lỗi ptt"],
        tbody tr td.status-cell[data-status="dh"],
        tbody tr td.status-cell[data-status="error"], 
        tbody tr td.status-cell[data-status="lỗi ptt"],
        td.status-cell[data-status="dh"],
        td.status-cell[data-status="error"], 
        td.status-cell[data-status="lỗi ptt"] {
          background-color: #fff9c4 !important;
          color: #8b6914 !important;
        }
        
        /* Empty status */
        .handsontable .htCore tbody tr td.status-cell[data-status=""]:empty,
        .handsontable tbody tr td.status-cell[data-status=""]:empty,
        .htCore tbody tr td.status-cell[data-status=""]:empty,
        tbody tr td.status-cell[data-status=""]:empty,
        td.status-cell[data-status=""]:empty {
          background-color: #f8f9fa !important;
          color: #6c757d !important;
        }
        
        /* Other status values */
        .handsontable .htCore tbody tr td.status-cell:not([data-status=""]):not([data-status="active"]):not([data-status="hoạt động"]):not([data-status="paused"]):not([data-status="tạm dừng"]):not([data-status="disabled"]):not([data-status="disable"]):not([data-status="error"]):not([data-status="lỗi ptt"]):not([data-status="dh"]),
        .handsontable tbody tr td.status-cell:not([data-status=""]):not([data-status="active"]):not([data-status="hoạt động"]):not([data-status="paused"]):not([data-status="tạm dừng"]):not([data-status="disabled"]):not([data-status="disable"]):not([data-status="error"]):not([data-status="lỗi ptt"]):not([data-status="dh"]),
        .htCore tbody tr td.status-cell:not([data-status=""]):not([data-status="active"]):not([data-status="hoạt động"]):not([data-status="paused"]):not([data-status="tạm dừng"]):not([data-status="disabled"]):not([data-status="disable"]):not([data-status="error"]):not([data-status="lỗi ptt"]):not([data-status="dh"]),
        tbody tr td.status-cell:not([data-status=""]):not([data-status="active"]):not([data-status="hoạt động"]):not([data-status="paused"]):not([data-status="tạm dừng"]):not([data-status="disabled"]):not([data-status="disable"]):not([data-status="error"]):not([data-status="lỗi ptt"]):not([data-status="dh"]),
        td.status-cell:not([data-status=""]):not([data-status="active"]):not([data-status="hoạt động"]):not([data-status="paused"]):not([data-status="tạm dừng"]):not([data-status="disabled"]):not([data-status="disable"]):not([data-status="error"]):not([data-status="lỗi ptt"]):not([data-status="dh"]) {
          background-color: #e2e3e5 !important;
          color: #383d41 !important;
        }
      `}</style>
    </div>
  );
}