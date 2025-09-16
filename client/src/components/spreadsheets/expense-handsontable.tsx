import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
// Import data-center for Vietnamese data normalization
import { rawToUI, uiToRaw, dataCenter } from "../../../../packages/data-center/src/index";
// ✅ SERVER-SIDE HANDSONTABLE IMPORT: Direct import instead of CDN
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
// 🔥 5. OPTIMIZATION: ErrorBoundary để tránh crash toàn bộ app
import { ErrorBoundary } from "@/components/ui/error-boundary";

// DEBUG flag to control console logging
const DEBUG = false;

// Default status options constant
const DEFAULT_STATUS = ["Active", "Disable", "DH", "Lỗi PTT"];

interface ExpenseHandsontableProps {
  accounts: any[];
  clients: any[];
  expenseData: any[];
  month: number;
  year: number;
  settings?: any; // Settings from database for status options
  canEdit?: boolean; // Permission to edit data
}

// ✅ NO GLOBAL WINDOW DECLARATION NEEDED - Using direct import

// 5) Vietnamese Editor class defined outside to avoid recreation
let VietnameseEditor: any = null;

const createVietnameseEditor = () => {
  if (!VietnameseEditor && Handsontable) {
    VietnameseEditor = class extends Handsontable.editors.TextEditor {
      setValue(value: any) {
        // When setting value for editing, convert to raw Vietnamese format
        if (typeof value === "string" && value.trim()) {
          const rawValue = uiToRaw(value, { returnNumber: true });
          const rawStringValue = rawValue.toString().replace(".", ",");
          super.setValue(rawStringValue);
        } else {
          super.setValue(value);
        }
      }

      getValue() {
        // When getting value from editor, keep Vietnamese format
        return super.getValue();
      }
    };
  }
  return VietnameseEditor;
};

function ExpenseHandsontableCore({
  accounts,
  clients,
  expenseData,
  month,
  year,
  settings,
  canEdit = true,
}: ExpenseHandsontableProps) {
  // 1) DEBUG control
  if (DEBUG) {
    console.log("🔧 ExpenseHandsontable props:", {
      month,
      year,
      selectedMonth: month,
      selectedYear: year,
    });
  }

  // ✅ REFS ONLY (no state for non-UI impacting values)
  const containerRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<any>(null);
  const isFirstMount = useRef(true);
  const autoSave = useRef<NodeJS.Timeout | null>(null);
  const pendingChanges = useRef<Map<string, any>>(new Map());
  const isSaving = useRef<boolean>(false);
  const backupSave = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tempRowTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fast lookup maps for O(1) WebSocket updates
  const rowByAccountId = useRef<Map<number, number>>(new Map());
  const colByClientId = useRef<Map<number, number>>(new Map());

  // Get current user from auth context  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // ✅ MINIMAL STATE: Only UI-impacting values
  const [isHandsontableLoaded, setIsHandsontableLoaded] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);
  // ✅ PERFORMANCE: tableData as ref to avoid re-renders (không dùng trong JSX)
  const tableDataRef = useRef<any[][]>([]);
  const [sessionId] = useState(
    `expense_session_${Math.random().toString(36).slice(2, 11)}`,
  );
  // ✅ CUSTOM SEARCH POPUP STATE
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{row: number, col: number}[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // 🔑 INIT CONTROL: Ensure init runs only once when ready
  const initedRef = useRef(false);

  // CDN + container + data ready check
  const ready =
    isHandsontableLoaded &&
    !!containerRef.current &&
    accounts.length > 0 &&
    clients.length > 0;

  // Query client for cache management (stable reference)
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // WebSocket for real-time updates (stable reference)
  const { isConnected, subscribe } = useWebSocket();

  // ✅ Fetch settings for dropdown options (CRITICAL - was missing!)
  const { data: apiSettings } = useQuery({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // ✅ PERFORMANCE: Remove unused expenseDataQuery (using expenseData from props)
  // Removed currentUser query (not used in component core)

  // 3) Column headers & status options with proper memoization
  const statusOptions = useMemo(() => {
    if (!apiSettings || typeof apiSettings !== "object") {
      return DEFAULT_STATUS;
    }
    const settings = apiSettings as { statusOptions?: string[] };
    return settings.statusOptions || DEFAULT_STATUS;
  }, [apiSettings]);

  const columnHeaders = useMemo(() => {
    const headers = ["Trạng thái", "Tài khoản"];
    clients.forEach((client: any) => {
      headers.push(`${client.name} (${client.code})`);
    });
    headers.push("ID"); // Hidden column
    return headers;
  }, [clients]);

  // ✅ COLUMN WIDTH CUSTOMIZATION: State to manage customizable column widths
  const [customColWidths, setCustomColWidths] = useState<number[]>(() => {
    // Load saved column widths from localStorage
    const saved = localStorage.getItem('expense-table-col-widths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed;
        }
      } catch (e) {
        if (DEBUG) console.log('Failed to parse saved column widths');
      }
    }
    // Default widths: [Status, Account, ...Clients, ID]
    const defaultWidths = [80, 200, ...clients.map(() => 120), 1];
    return defaultWidths;
  });

  // ✅ PERFORMANCE: Update column widths when clients change
  const colWidths = useMemo(() => {
    // Ensure we have the right number of columns
    const baseWidths = [
      customColWidths[0] || 80,    // Status column
      customColWidths[1] || 200,   // Account column
    ];
    
    // Add client columns (use saved width or default 120)
    clients.forEach((_, index) => {
      baseWidths.push(customColWidths[index + 2] || 120);
    });
    
    // Add hidden ID column
    baseWidths.push(1);
    
    return baseWidths;
  }, [clients.length, customColWidths]);

  // ✅ PERFORMANCE: Memoize hidden columns configuration 
  const hiddenColumns = useMemo(() => ({
    columns: [clients.length + 2], // Hide last column
    indicators: false,
  }), [clients.length]);

  // ✅ SERVER-SIDE HANDSONTABLE: No CDN loading needed, set loaded immediately
  useEffect(() => {
    if (DEBUG) console.log('✅ HANDSONTABLE SERVER-SIDE IMPORT READY - Setting loaded state');
    setIsHandsontableLoaded(true);
  }, []);

  // ✅ CUSTOM SEARCH: Handle Ctrl+F to open custom search popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+F (or Cmd+F on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setShowSearchPopup(true);
        return false;
      } else if (e.key === 'Escape') {
        setShowSearchPopup(false);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(0);
      }
    };

    // Add event listener with capture: true to intercept before browser
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  // ✅ SEARCH FUNCTION: Find cells containing search query (NO AUTO NAVIGATION)
  const performSearch = (query: string, autoNavigate: boolean = false) => {
    if (!hotRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: {row: number, col: number}[] = [];
    const data = hotRef.current.getData();
    
    data.forEach((rowData: any[], row: number) => {
      rowData.forEach((cellValue: any, col: number) => {
        if (cellValue && cellValue.toString().toLowerCase().includes(query.toLowerCase())) {
          results.push({ row, col });
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

  // ✅ NAVIGATE SEARCH RESULTS
  const navigateToResult = (index: number) => {
    if (searchResults.length === 0) return;
    
    const result = searchResults[index];
    hotRef.current.selectCell(result.row, result.col);
    hotRef.current.scrollViewportTo(result.row, result.col);
    setCurrentSearchIndex(index);
  };

  // 🔑 PERFORMANCE OPTIMIZATION: Index expenses for O(1) lookup instead of O(n) find
  const expenseIndex = useMemo(() => {
    const map = new Map<string, any>();
    for (const expense of expenseData) {
      const key = `${expense.accountId}|${expense.clientId}|${expense.month}|${expense.year}`;
      map.set(key, expense);
    }
    return map;
  }, [expenseData]);

  // Prepare table data with data-center normalization and O(1) expense lookup
  const prepareTableData = useCallback(() => {
    if (!accounts.length || !clients.length) return [];

    const data: any[][] = [];
    // ✅ PERFORMANCE: Cache formatted numbers within render cycle
    const amountCache = new Map<number, string>();

    accounts.forEach((account, accountIndex) => {
      const row: any[] = [];

      // ✅ USE DATA-CENTER FOR ALL STATUS NORMALIZATION
      const normalizedStatus = dataCenter.normalizeStatus(account.status);
      row.push(normalizedStatus);

      // Second column: NAME | ACCOUNT_ID (readonly) - DIRECT FROM DB
      const accountName = account.name || 'Unknown';
      const accountId = account.accountId || '';
      row.push(`${accountName} | ${accountId}`);

      // Following columns: One for each client (editable expense amounts)
      clients.forEach((client) => {
        // 🔑 O(1) LOOKUP: Use expense index instead of find()
        const existingExpense = expenseIndex.get(`${account.id}|${client.id}|${month}|${year}`);

        // ✅ PRESERVE DB FORMAT: Keep exact format as stored in DB
        const dbAmount = existingExpense ? existingExpense.amount : null;

        if (dbAmount !== null && dbAmount !== undefined) {
          if (typeof dbAmount === "string" && dbAmount !== "0") {
            // DB returned Vietnamese formatted string - keep as is
            row.push(dbAmount);
          } else if (typeof dbAmount === "number" && dbAmount !== 0) {
            // ✅ PERFORMANCE: Use cache for number formatting
            let display = amountCache.get(dbAmount);
            if (!display) {
              const vn = rawToUI(dbAmount, { decimals: 2 });
              display = dbAmount % 1 === 0 ? vn.replace(/,00$/, "") : vn;
              amountCache.set(dbAmount, display);
            }
            row.push(display);
          } else {
            // Zero or empty - store as number for renderer
            row.push(0);
          }
        } else {
          // No expense data - store as number for renderer
          row.push(0);
        }
      });

      // ✅ Hidden column: Account database ID for status updates
      row.push(account.id);

      data.push(row);
    });

    return data;
  }, [accounts, clients, expenseIndex, month, year]);

  // ✅ ENHANCED EXPENSE UPDATE MUTATION with proper error handling
  const expenseUpdateMutation = useMutation({
    mutationFn: async (changes: any[]) => {
      // Validate changes before processing
      if (!changes || changes.length === 0) {
        throw new Error("No changes to save");
      }

      // Normalize all changes through data-center before sending
      const normalizedChanges = changes.map((change, index) => {
        try {
          const normalizedChange = { ...change };

          // Validate required fields
          if (!change.accountId || !change.clientId) {
            throw new Error(
              `Invalid change at index ${index}: missing accountId or clientId`,
            );
          }

          // Normalize amount using uiToRaw - handle Vietnamese formatted input
          if (change.field && change.field.startsWith("client_")) {
            normalizedChange.amount = uiToRaw(change.newValue, {
              returnNumber: true,
            });
            normalizedChange.newValue = normalizedChange.amount;
          } else if (change.amount !== undefined) {
            // Direct amount field
            normalizedChange.amount =
              typeof change.amount === "number"
                ? change.amount
                : uiToRaw(change.amount, { returnNumber: true });
          }

          // Normalize status
          if (change.field === "status") {
            normalizedChange.newValue = dataCenter.normalizeStatus(
              change.newValue,
            );
          }

          return normalizedChange;
        } catch (error) {
          throw error;
        }
      });

      return apiRequest("PUT", `/api/account-expenses/bulk`, {
        changes: normalizedChanges,
        month,
        year,
        sessionId,
      });
    },
    onSuccess: (result) => {
      // ✅ NO CACHE INVALIDATION: Keep data stable to prevent reload during editing
    },
    onError: (error: any) => {
      console.error("❌ EXPENSE BULK SAVE ERROR:", error);
    },
  });

  // Status update mutation for accounts
  const statusUpdateMutation = useMutation({
    mutationFn: async ({
      accountId,
      status,
    }: {
      accountId: number;
      status: string;
    }) => {
      // Normalize status via data-center
      const normalizedStatus = dataCenter.normalizeStatus(status);
      return apiRequest("PATCH", `/api/ad-accounts/${accountId}`, {
        status: normalizedStatus,
      });
    },
    onSuccess: () => {
      // ✅ NO CACHE INVALIDATION: Keep data stable to prevent reload during editing
    },
    onError: (error: any) => {},
  });

  // 6) Auto-save with proper cleanup
  const scheduleAutoSave = useCallback((
    row: number,
    col: number,
    newValue: any,
    oldValue: any,
  ) => {
    console.log("🔧 SCHEDULE AUTO-SAVE called:", {
      row,
      col,
      newValue,
      oldValue,
      clientsLength: clients.length,
      canEdit,
    });

    // Skip if user doesn't have edit permission
    if (!canEdit) {
      console.log("❌ User doesn't have edit permission, skipping auto-save");
      return;
    }

    // Skip first column (account name) and hidden columns
    if (col === 0 || col === 1 || col >= clients.length + 2) {
      console.log("🔧 Skipping column:", col);
      return;
    }

    const hotInstance = hotRef.current;
    if (!hotInstance) {
      if (DEBUG) console.log("❌ No hot instance");
      return;
    }

    // Get account ID from hidden column
    const accountId = hotInstance.getDataAtCell(row, clients.length + 2); // Account ID in last column
    if (DEBUG) console.log("🔧 Account ID:", accountId);

    if (!accountId) {
      if (DEBUG) console.log("❌ No account ID");
      return;
    }

    // Get client ID from column index
    const clientIndex = col - 2; // First 2 columns are status and account name
    const clientId = clients[clientIndex]?.id;
    if (DEBUG) console.log("🔧 Client Index:", clientIndex, "Client ID:", clientId);

    if (!clientId) {
      if (DEBUG) console.log("❌ No client ID");
      return;
    }

    // Create unique key for this change
    const changeKey = `${accountId}-${clientId}`;

    const normalizedAmount =
      typeof newValue === "number"
        ? newValue
        : uiToRaw(newValue, { returnNumber: true });
    // 🔥 7. OPTIMIZATION: Wrap console.log trong DEBUG flag
    if (DEBUG) {
      console.log("🔧 Creating change:", {
        changeKey,
        accountId,
        clientId,
        normalizedAmount,
        newValue,
      });
    }

    // Add to pending changes map
    pendingChanges.current.set(changeKey, {
      accountId,
      clientId,
      amount: normalizedAmount,
      oldValue,
      newValue,
      month,
      year,
      sessionId,
      timestamp: Date.now(),
    });

    if (DEBUG) console.log("🔧 Pending changes size:", pendingChanges.current.size);

    // Clear existing timeout
    if (autoSave.current) {
      clearTimeout(autoSave.current);
      if (DEBUG) console.log("🔧 Cleared existing timeout");
    }

    // Set user editing state
    setIsUserEditing(true);

    // ✅ PERFORMANCE: Safer auto-save with error recovery
    autoSave.current = setTimeout(() => {
      if (DEBUG) {
        console.log(
          "🔧 AUTO-SAVE TIMEOUT triggered, pending changes:",
          pendingChanges.current.size,
        );
      }

      if (pendingChanges.current.size === 0) {
        if (DEBUG) console.log("❌ No pending changes to save");
        return;
      }

      const changes = Array.from(pendingChanges.current.values());
      if (DEBUG) console.log("🔧 Saving changes:", changes);
      isSaving.current = true;

      // ✅ PERFORMANCE: Don't clear changes until success
      expenseUpdateMutation.mutate(changes, {
        onSuccess: () => {
          if (DEBUG) console.log("✅ Auto-save SUCCESS");
          pendingChanges.current.clear(); // Clear only on success
          isSaving.current = false;
          setIsUserEditing(false);
        },
        onError: (error) => {
          console.error("❌ Auto-save ERROR:", error);
          // ✅ PERFORMANCE: Keep changes for retry, optional backoff
          setTimeout(() => {
            if (pendingChanges.current.size > 0) {
              // Retry pending changes after delay
            }
          }, 1000);
          isSaving.current = false;
          setIsUserEditing(false);
        },
      });
    }, 800); // 800ms delay same as account management
  }, [clients, month, year, expenseUpdateMutation]);

  // ✅ PERFORMANCE: Update tableDataRef without re-render, lightweight compare
  useEffect(() => {
    const newData = prepareTableData();
    // ✅ PERFORMANCE: Lightweight compare instead of expensive JSON.stringify
    const prevData = tableDataRef.current;
    if (prevData.length !== newData.length || prevData[0]?.length !== newData[0]?.length) {
      tableDataRef.current = newData;
    } else {
      // Quick hash check for deeper changes
      const prevHash = prevData.length + (prevData[0]?.length || 0);
      const newHash = newData.length + (newData[0]?.length || 0);
      if (prevHash !== newHash) {
        tableDataRef.current = newData;
      }
    }
  }, [prepareTableData]); // ✅ STABLE: useCallback dependency

  // 🔑 INIT HANDSONTABLE: Only once when ready = true
  useEffect(() => {
    if (!ready || initedRef.current) return;

    // 🔥 2. OPTIMIZATION: Delay init 1 frame để tránh trắng trang khi F5
    requestAnimationFrame(() => {
      // Data initialization (not dependent on tableData state)
      const freshData = prepareTableData();

    // Don't block init when freshData is temporarily empty - let HOT get instance first,
    // then we loadData via update effect below.

    const colHeaders = [
      "Trạng thái",
      "Tài khoản",
      ...clients.map((c: any) => c.name || `Client ${c.id}`),
    ];

    const hotSettings: any = {
      data: freshData,
      colHeaders,
      columns: [
        // ✅ STATUS COLUMN: Same color scheme as account management
        {
          type: "dropdown",
          source: statusOptions,
          width: 80,
          className: "htCenter htMiddle",
          visibleRows: 10,
          trimDropdown: false,
          allowEmpty: true,
          readOnly: !canEdit,
          // ✅ PERFORMANCE: Optimized renderer using CSS classes
          renderer: (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any) => {
            td.textContent = value || "";
            td.className = 'status-cell';
            td.dataset.status = (value || '').toString().toLowerCase();
            return td;
          },
        },
        // ✅ PERFORMANCE: Simplified account name column without per-cell click handlers
        {
          readOnly: true,
          width: 200,
          className: "htLeft account-name-column",
          renderer: function(instance: any, td: HTMLElement, row: number, col: number, prop: any, value: any) {
            td.textContent = value || '';
            td.className = 'account-name-cell';
            td.style.cursor = 'pointer';
            td.style.textAlign = 'left';
            return td;
          },
        },
        // 7) Client expense columns with optimized Vietnamese editor
        ...clients.map(() => ({
          type: "text",
          className: "htCenter htMiddle",
          width: 120,
          editor: canEdit ? createVietnameseEditor() : false,
          validator: (value: any, callback: any) => {
            // Always return true for performance
            callback(true);
          },
          allowInvalid: false,
          readOnly: !canEdit,

          renderer: (
            instance: any,
            td: HTMLElement,
            row: number,
            col: number,
            prop: any,
            value: any,
          ) => {
            td.className = "htCenter htMiddle expense-cell";
            td.style.color = "#000";
            td.style.textAlign = "center";

            // Parse Vietnamese/US format and convert to display format
            let numValue: number;
            if (typeof value === "number") {
              numValue = value;
            } else if (typeof value === "string" && value.trim() !== "") {
              numValue = uiToRaw(value, { returnNumber: true }) as number;
            } else {
              numValue = 0;
            }

            if (Number.isFinite(numValue) && numValue !== 0) {
              const displayText = rawToUI(numValue, { decimals: 2 });
              td.textContent =
                numValue % 1 === 0
                  ? displayText.replace(/,00$/, "")
                  : displayText;
              if (numValue < 0) td.style.color = "#ef4444";
            } else {
              td.textContent = "";
            }
            return td;
          },
        })),
        // ✅ Hidden column: Account database ID  
        {
          readOnly: true,
          width: 1,
          className: "hidden-column",
          renderer: (instance: any, td: HTMLElement) => {
            td.style.display = "none";
            return td;
          },
        },
      ],
      // ✅ PERFORMANCE: Use memoized values to prevent recreation
      autoColumnSize: false,
      colWidths,
      renderAllRows: false,
      viewportRowRenderingOffset: 30,
      hiddenColumns,
      rowHeaders: true,
      width: "100%",
      height: "calc(100vh - 80px)",
      licenseKey: "non-commercial-and-evaluation",
      stretchH: "all",
      // ✅ ENABLE COLUMN RESIZE: Allow users to customize column widths
      manualColumnResize: true,
      contextMenu: canEdit ? false : false,        // Keep disabled for performance
      // ✅ ENABLE FILTERS: Handsontable default filter functionality  
      filters: true,
      dropdownMenu: ['filter_by_condition', 'filter_by_value', 'filter_action_bar'],
      // ✅ ENABLE COLUMN SORTING: Click column headers to sort with arrows
      columnSorting: true,
      // ✅ DISABLE DEFAULT SEARCH: We'll create custom search popup
      search: false,
      fillHandle: {
        direction: "vertical",
        autoInsertRow: false,
      },

      // ✅ PERFORMANCE: Event delegation for account name click-to-copy
      afterOnCellMouseDown: (event: any, coords: any) => {
        const { row, col } = coords;
        if (col === 1) { // Account name column
          const val = hotRef.current.getDataAtCell(row, col) as string;
          const accountId = val?.split(' | ')[1]?.trim();
          if (accountId) {
            navigator.clipboard.writeText(accountId)
              .then(() => toast({ title: "Đã copy", description: `Account ID: ${accountId}` }))
              .catch(console.error);
          }
        }
      },

      // ✅ PERFORMANCE: Safer auto-save with validation
      afterChange: (changes: any[], source: string) => {
        console.log("🔧 EXPENSE AFTERCHANGE:", { changes, source, canEdit });
        if (!changes || ["loadData", "external", "system"].includes(source)) return;
        
        // Skip if user doesn't have edit permission
        if (!canEdit) {
          console.log("❌ User doesn't have edit permission, skipping auto-save");
          return;
        }
        
        changes.forEach(([row, col, oldValue, newValue]) => {
          if (oldValue === newValue) return;
          if (col === 0) {
            const accountData = hotRef.current.getDataAtRow(row);
            const accountId = accountData[accountData.length - 1];
            console.log("🔧 STATUS UPDATE:", { accountId, status: newValue });
            statusUpdateMutation.mutate({ accountId, status: newValue });
          } else if (col >= 2 && col < clients.length + 2) {
            // ✅ PERFORMANCE: Validate numeric values before save
            const normalizedAmount = typeof newValue === "number" ? newValue : uiToRaw(newValue, { returnNumber: true });
            console.log("🔧 EXPENSE UPDATE:", { row, col, oldValue, newValue, normalizedAmount });
            if (Number.isFinite(normalizedAmount)) {
              scheduleAutoSave(row, col, newValue, oldValue);
            }
          }
        });
      },

      // ✅ COLUMN RESIZE: Save custom widths when user resizes columns
      afterColumnResize: (newSize: number, column: number, isDoubleClick: boolean) => {
        if (DEBUG) console.log('🔧 Column resized:', { column, newSize, isDoubleClick });
        
        // Update our custom widths state
        setCustomColWidths(prev => {
          const updated = [...prev];
          // Ensure we have enough elements
          while (updated.length <= column) {
            updated.push(120); // Default width for new columns
          }
          updated[column] = newSize;
          
          // Save to localStorage
          try {
            localStorage.setItem('expense-table-col-widths', JSON.stringify(updated));
            if (DEBUG) console.log('✅ Saved column widths to localStorage:', updated);
          } catch (e) {
            console.error('Failed to save column widths:', e);
          }
          
          return updated;
        });
      },

      // 🔑 Ensure container shows immediately after init
      afterInit() {
        if (containerRef.current) {
          Object.assign(containerRef.current.style, {
            display: "block",
            visibility: "visible",
            opacity: "1",
            height: "calc(100vh - 80px)",
            minHeight: "600px",
          });
        }
        // Single render is enough
        this.render?.();
      },
    };

      if (hotRef.current?.destroy) hotRef.current.destroy();
      hotRef.current = new Handsontable(containerRef.current!, hotSettings);

      initedRef.current = true;
    }); // End requestAnimationFrame

    return () => {
      if (hotRef.current?.destroy) {
        hotRef.current.destroy();
        hotRef.current = null;
      }
    };
  }, [ready]); // 🔑 Only runs when ready changes to true → exactly once

  // 🔑 FORCE CONTAINER VISIBILITY: Prevent white screen when changing months
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Immediate visibility fix
    containerRef.current.style.visibility = "visible";
    containerRef.current.style.opacity = "1";
    containerRef.current.style.display = "block";
    
    // Additional safety check after a short delay
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.visibility = "visible";
        containerRef.current.style.opacity = "1";
        containerRef.current.style.display = "block";
      }
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [month, year]);

  // 🔄 Update data after instance is initialized (without destroying instance)
  useEffect(() => {
    if (!initedRef.current || !hotRef.current) return;

    const freshData = prepareTableData();
    
    // 🔥 3. OPTIMIZATION: Giảm số lần render sau khi load data - 1 pass đủ
    if (hotRef.current) {
      hotRef.current.batch(() => {
        // Force container visibility before loading data
        if (containerRef.current) {
          containerRef.current.style.visibility = "visible";
          containerRef.current.style.opacity = "1";
          containerRef.current.style.display = "block";
        }
        
        // Load fresh data
        if (hotRef.current) {
          hotRef.current.loadData(freshData);
        }
      });
    }
    
    // 🔑 SINGLE RENDER: 1 pass đủ thay vì 2 lần requestAnimationFrame
    if (hotRef.current) {
      hotRef.current.render();
    }
    
    // 🔑 REBUILD LOOKUP MAPS: Update WebSocket lookups after data change
    rebuildLookupMaps();
  }, [prepareTableData, accounts.length, clients.length, month, year]);

  // 🔑 REBUILD WEBSOCKET LOOKUP MAPS: For O(1) real-time updates
  const rebuildLookupMaps = useCallback(() => {
    if (!hotRef.current) return;
    
    rowByAccountId.current.clear();
    colByClientId.current.clear();
    
    const rows = hotRef.current.countRows();
    for (let r = 0; r < rows; r++) {
      const rowData = hotRef.current.getDataAtRow(r);
      const accountId = rowData[rowData.length - 1];
      if (accountId) {
        rowByAccountId.current.set(accountId, r);
      }
    }
    
    clients.forEach((client, index) => {
      colByClientId.current.set(client.id, index + 2); // +2 for status and account columns
    });

    const sampleAccounts = Array.from(rowByAccountId.current.entries()).slice(0, 3);
    const clientIds = clients.map(c => c.id);
    console.log("🔧 REBUILT LOOKUP MAPS:", { 
      accounts: rowByAccountId.current.size, 
      clients: colByClientId.current.size,
      clientIds,
      accountSample: sampleAccounts
    });
  }, [clients]);

  // 9) Enhanced WebSocket with O(1) lookups and batch processing  
  useEffect(() => {
    console.log("🔌 WEBSOCKET EFFECT:", { isConnected, hotRefCurrent: !!hotRef.current, sessionId });
    if (!isConnected) {
      return;
    }

    // Update lookup maps when data changes
    const updateLookupMaps = () => {
      if (!hotRef.current) {
        console.log("⚠️ Cannot update lookup maps: hotRef is null");
        return;
      }
      
      rowByAccountId.current.clear();
      colByClientId.current.clear();
      
      const totalRows = hotRef.current.countRows();
      for (let row = 0; row < totalRows; row++) {
        const rowData = hotRef.current.getDataAtRow(row);
        const accountId = rowData[rowData.length - 1];
        if (accountId) {
          rowByAccountId.current.set(accountId, row);
        }
      }
      
      clients.forEach((client, index) => {
        colByClientId.current.set(client.id, index + 2); // +2 for status and account columns
      });
    };

    updateLookupMaps();

    console.log("🔌 SUBSCRIBING to WebSocket with callback");
    console.log("🔌 SUBSCRIBE FUNCTION:", !!subscribe);
    const unsubscribe = subscribe((data: any) => {
      console.log("🔌 WEBSOCKET RECEIVED:", data);
      if (!data) {
        console.log("❌ No data:", { data });
        return;
      }
      
      // Wait for Handsontable to be ready before processing updates
      if (!hotRef.current) {
        console.log("⏳ Handsontable not ready, queuing update");
        setTimeout(() => {
          if (hotRef.current) {
            console.log("🔄 Processing queued update");
            // Re-process the data when ready
            processWebSocketData(data);
          }
        }, 100);
        return;
      }
      
      function processWebSocketData(data: any) {

      console.log("🔌 WEBSOCKET DATA TYPE:", data.type, "SESSION ID:", data.sessionId, "OUR SESSION:", sessionId);

      // Handle EXPENSE_UPDATE events
      if (
        data.type === "EXPENSE_UPDATE" ||
        data.type === "EXPENSE_UPDATED" ||
        data.type === "expense_update" ||
        data.type === "BATCH_UPDATE" ||
        data === "expense-batch-update"
      ) {
        console.log("🔌 PROCESSING EXPENSE EVENT:", data.type);
        // Handle simple string message
        if (data === "expense-batch-update") {
          return;
        }

        // Skip own session to prevent double updates
        if (
          data.sessionId &&
          (data.sessionId.includes(sessionId) || data.sessionId === sessionId)
        ) {
          console.log("🔌 SKIPPING OWN SESSION:", { dataSessionId: data.sessionId, ourSessionId: sessionId });
          return;
        }

        // ✅ O(1) BATCH UPDATES using lookup maps
        if (data.type === "BATCH_UPDATE" && data.changes) {
          const updates: Array<[number, number, any]> = [];

          data.changes.forEach((change: any) => {
            const { accountId, clientId, amount } = change;

            // O(1) lookups
            const targetRow = rowByAccountId.current.get(accountId);
            const targetCol = colByClientId.current.get(clientId);

            if (targetRow === undefined || targetCol === undefined) {
              console.log(
                "⚠️ WebSocket: Account/Client not found",
                { accountId, clientId, targetRow, targetCol, totalAccounts: rowByAccountId.current.size, totalClients: colByClientId.current.size }
              );
              return;
            }

            console.log("✅ WebSocket: Found target cell:", { accountId, clientId, targetRow, targetCol });

            // Convert amount to proper Vietnamese format for display
            let displayValue: any;
            if (typeof amount === "number" && amount !== 0) {
              const formatted = rawToUI(amount, { decimals: 2 });
              displayValue =
                amount % 1 === 0 ? formatted.replace(/,00$/, "") : formatted;
            } else if (typeof amount === "string" && amount !== "0") {
              displayValue = amount;
            } else {
              displayValue = 0;
            }

            updates.push([targetRow, targetCol, displayValue]);
          });

          // Apply all updates at once (chunked for large datasets)
          if (updates.length > 0) {
            console.log(
              `🔄 WebSocket: Applying ${updates.length} batch updates`,
              updates
            );
            
            // Chunk updates to prevent main thread blocking
            const chunkSize = 1000;
            const chunks: Array<Array<[number, number, any]>> = [];
            for (let i = 0; i < updates.length; i += chunkSize) {
              chunks.push(updates.slice(i, i + chunkSize));
            }
            
            // ✅ PERFORMANCE: Use requestAnimationFrame for smooth UI updates
            let currentChunkIndex = 0;
            const processNextChunk = () => {
              if (currentChunkIndex < chunks.length && hotRef.current) {
                const chunk = chunks[currentChunkIndex];
                hotRef.current.batch(() => {
                  chunk.forEach(([row, col, value]: [number, number, any]) => {
                    if (hotRef.current) {
                      hotRef.current.setDataAtCell(row, col, value, "external");
                    }
                  });
                });
                currentChunkIndex++;
                if (currentChunkIndex < chunks.length) {
                  requestAnimationFrame(processNextChunk);
                }
              }
            };
            requestAnimationFrame(processNextChunk);
          }
          return;
        }

        // Single update - use O(1) lookup 
        const updateData = data.data || data;
        const { accountId, clientId, amount } = updateData;

        const targetRow = rowByAccountId.current.get(accountId);
        const targetCol = colByClientId.current.get(clientId);

        if (targetRow !== undefined && targetCol !== undefined && hotRef.current) {
          // Convert amount to proper Vietnamese format for display
          let displayValue: any;
          if (typeof amount === "number" && amount !== 0) {
            const formatted = rawToUI(amount, { decimals: 2 });
            displayValue =
              amount % 1 === 0 ? formatted.replace(/,00$/, "") : formatted;
          } else if (typeof amount === "string" && amount !== "0") {
            displayValue = amount;
          } else {
            displayValue = 0;
          }

          hotRef.current.batch(() => {
            hotRef.current.setDataAtCell(targetRow, targetCol, displayValue, "external");
          });
        }
      }

      // Handle STATUS_UPDATE events
      else if (
        data.type === "STATUS_UPDATED" ||
        (data.type === "DATA_UPDATE" && data.field === "status")
      ) {
        // Skip own session to prevent double updates
        if (
          data.sessionId &&
          (data.sessionId.includes(sessionId) || data.sessionId === sessionId)
        ) {
          console.log("🔌 SKIPPING OWN SESSION:", { dataSessionId: data.sessionId, ourSessionId: sessionId });
          return;
        }

        // Find row with matching account ID using cached accounts array
        const targetRow = accounts.findIndex(
          (account) => account.id === data.accountId,
        );
        if (targetRow !== -1 && hotRef.current) {
          // Update status column (column 0) with data-center normalization
          const normalizedStatus = dataCenter.normalizeStatus(
            data.newValue || data.status,
          );
          hotRef.current.setDataAtCell(
            targetRow,
            0,
            normalizedStatus,
            "external",
          );
        }
      }

      // Handle DATA_REFRESH events
      else if (data.type === "DATA_REFRESH") {
        // Skip own session to prevent double refresh
        if (
          data.sessionId &&
          (data.sessionId.includes(sessionId) || data.sessionId === sessionId)
        ) {
          return;
        }

        // ✅ NO DATA REFRESH: Keep table stable during editing to prevent interruption
      }

      // ✅ OPTIMIZED BATCH_UPDATE: Removed duplicate handling as it's already handled above
      else if (
        data.type === "BATCH_UPDATE" &&
        data.changes &&
        Array.isArray(data.changes)
      ) {
        // This case is already handled by the optimized batch update above
        // No need to duplicate the logic
      }

      // ✅ REAL-TIME VISIBLE ACCOUNTS: Handle account add/remove events
      else if (data.type === "VISIBLE_ACCOUNTS_ADDED") {
        if (DEBUG) console.log(`📡 RECEIVED VISIBLE ACCOUNTS ADDED:`, data.data);

        // Invalidate both visible accounts and ad-accounts cache to refetch all data
        queryClient.invalidateQueries({
          queryKey: ["/api/expense-visible-accounts"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/ad-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/account-expenses"] });

        toast({
          title: "Tài khoản đã được thêm",
          description: `Đã thêm ${data.data.added} tài khoản vào tháng ${data.data.month}/${data.data.year}`,
        });
      } else if (data.type === "VISIBLE_ACCOUNTS_REMOVED") {
        if (DEBUG) console.log(`📡 RECEIVED VISIBLE ACCOUNTS REMOVED:`, data.data);

        // Invalidate both visible accounts and ad-accounts cache to refetch all data
        queryClient.invalidateQueries({
          queryKey: ["/api/expense-visible-accounts"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/ad-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/account-expenses"] });

        toast({
          title: "Tài khoản đã được xóa",
          description: `Đã xóa ${data.data.removed} tài khoản không hoạt động`,
        });
      }

      // ✅ REAL-TIME VISIBLE ACCOUNTS: Handle manual account selection changes
      else if (data.type === "VISIBLE_ACCOUNTS_CHANGED") {
        if (DEBUG) console.log(`📡 RECEIVED VISIBLE ACCOUNTS CHANGED:`, data.data);

        // Invalidate all related caches to ensure complete data refresh
        queryClient.invalidateQueries({
          queryKey: ["/api/expense-visible-accounts"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/ad-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/account-expenses"] });

        toast({
          title: "Danh sách tài khoản đã thay đổi",
          description: `Đã cập nhật ${data.data.saved} tài khoản cho tháng ${data.data.month}/${data.data.year}`,
        });
      }
      }
      
      // Call the processing function
      processWebSocketData(data);
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, sessionId]);

  // ✅ CLEANUP: Clear autosave timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Loading state
  if (!isHandsontableLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải bảng tính...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!accounts.length || !clients.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Chưa có dữ liệu để hiển thị</p>
          <p className="text-sm text-gray-500">
            {!accounts.length && "Chưa có tài khoản quảng cáo"}
            {!accounts.length && !clients.length && " và "}
            {!clients.length && "Chưa có khách hàng"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CSS for hidden column and dropdown styling */}
      <style>{`
        .hidden-column {
          width: 0 !important;
          max-width: 0 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          display: none !important;
        }
        
        /* ✅ CUSTOMIZE DROPDOWN MENU */
        .htDropdownMenu {
          min-width: 250px !important;
          max-width: 350px !important;
          font-size: 14px !important;
        }
        
        .htDropdownMenu .htCore td {
          padding: 8px 12px !important;
          line-height: 1.4 !important;
        }
        
        .htDropdownMenu .htItemWrapper {
          padding: 6px 0 !important;
        }
        
        /* Clean dropdown styling - no hiding needed since we control items array */
        
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
        
        /* Left align filter items text */
        .htDropdownMenu .htUIMultipleSelectHot .htCore td {
          text-align: left !important;
          padding-left: 8px !important;
        }
        
        /* ✅ MAXIMUM SPECIFICITY: Override all Handsontable default styles */
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
        
        .htDropdownMenu .htUIMultipleSelectHot .ht_clone_top .htCore td,
        .htDropdownMenu .htUIMultipleSelectHot .ht_clone_left .htCore td,
        .htDropdownMenu .htUIMultipleSelectHot .ht_master .htCore td {
          text-align: left !important;
          padding-left: 8px !important;
        }
        
        /* Filter checkboxes alignment */
        .htDropdownMenu .htUIMultipleSelectHot input[type="checkbox"] {
          margin-right: 8px !important;
          vertical-align: middle !important;
        }
        
        /* Filter search input styling */
        .htDropdownMenu .htUIMultipleSelectSearch {
          width: 100% !important;
          padding: 8px !important;
          margin-bottom: 8px !important;
          border: 1px solid #ddd !important;
          border-radius: 4px !important;
        }
        
        /* Filter buttons styling */
        .htDropdownMenu .htUIButton {
          padding: 6px 12px !important;
          margin: 4px !important;
          border-radius: 4px !important;
          font-size: 13px !important;
        }
        
        .htDropdownMenu .htUIButtonOK {
          background-color: #28a745 !important;
          color: white !important;
          border: none !important;
        }
        
        .htDropdownMenu .htUIButtonCancel {
          background-color: #6c757d !important;
          color: white !important;
          border: none !important;
        }
      `}</style>

      {/* Info Status */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Tháng {month}/{year} • {accounts.length} tài khoản × {clients.length}{" "}
          khách hàng
        </div>
      </div>

      {/* Handsontable Container - Hoàn toàn dãn ra sát 2 mép */}
      <div
        ref={containerRef}
        className="expense-handsontable-container"
        style={{
          margin: "0",
          padding: "0",
          width: "100%",
          height: "100%",
          position: "absolute",
          left: "0",
          right: "0",
          top: "0",
          bottom: "0",
          // 🔑 NO VISIBILITY HIDDEN: Always keep container visible to prevent white screen
        }}
      />

      {/* ✅ COMPACT SEARCH BAR */}
      {showSearchPopup && (
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
                setShowSearchPopup(false);
                setSearchQuery('');
                setSearchResults([]);
                setCurrentSearchIndex(0);
              } else if (e.key === 'ArrowUp' && searchResults.length > 0) {
                e.preventDefault();
                const prevIndex = currentSearchIndex === 0 
                  ? searchResults.length - 1 
                  : currentSearchIndex - 1;
                navigateToResult(prevIndex);
              } else if (e.key === 'ArrowDown' && searchResults.length > 0) {
                e.preventDefault();
                const nextIndex = (currentSearchIndex + 1) % searchResults.length;
                navigateToResult(nextIndex);
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
            autoFocus
          />
          
          {/* Navigation arrows when results exist */}
          {searchResults.length > 0 && (
            <>
              <div style={{
                padding: '0 8px',
                fontSize: '12px',
                color: '#6b7280',
                borderLeft: '1px solid #e5e7eb',
                borderRight: '1px solid #e5e7eb'
              }}>
                {currentSearchIndex + 1}/{searchResults.length}
              </div>
              <button
                onClick={() => {
                  const prevIndex = currentSearchIndex === 0 
                    ? searchResults.length - 1 
                    : currentSearchIndex - 1;
                  navigateToResult(prevIndex);
                }}
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
                onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
                onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
              >
                ▲
              </button>
              <button
                onClick={() => {
                  const nextIndex = (currentSearchIndex + 1) % searchResults.length;
                  navigateToResult(nextIndex);
                }}
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
                onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
                onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
              >
                ▼
              </button>
            </>
          )}
          
          <button
            onClick={() => {
              setShowSearchPopup(false);
              setSearchQuery('');
              setSearchResults([]);
              setCurrentSearchIndex(0);
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
            onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
            onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="mb-1">
          💡 <strong>Hướng dẫn sử dụng:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Cột "Trạng thái": Thay đổi trạng thái tài khoản và tự động đồng bộ
            với database
          </li>
          <li>Cột "Tài khoản": Chỉ đọc, hiển thị thông tin tài khoản</li>
          <li>
            Các cột khách hàng: Click để nhập chi phí quảng cáo (định dạng
            Vietnamese)
          </li>
          <li>
            Dữ liệu tự động lưu sau 1 giây không hoạt động với data-center
            normalization
          </li>
          <li>Real-time sync: Thay đổi từ user khác hiển thị ngay lập tức</li>
          <li>Sử dụng phím mũi tên, Tab, Enter để di chuyển giữa các ô</li>
        </ul>
      </div>
    </div>
  );
}

// 🔥 5. OPTIMIZATION: Bọc toàn bộ component trong ErrorBoundary để tránh crash
export function ExpenseHandsontable(props: ExpenseHandsontableProps) {
  return (
    <ErrorBoundary>
      <ExpenseHandsontableCore {...props} />
    </ErrorBoundary>
  );
}
