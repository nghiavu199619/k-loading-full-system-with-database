import { useRef, useEffect, useState } from 'react';
import { nanoid } from 'nanoid';

export interface AutoSaveOptions {
  debounceDelay?: number;
  maxRetries?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: any) => void;
}

export interface AutoSaveChange {
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  rowIndex: number;
  colIndex: number;
  id?: number;
}

class AutoSaveManager {
  private pendingChanges = new Map<string, AutoSaveChange>();
  private saveTimeoutRef: NodeJS.Timeout | null = null;
  private batchSaveCallback: (changes: AutoSaveChange[]) => Promise<void>;
  private _sessionId = nanoid();
  private saveInProgress = false;
  private retryCount = 0;
  private options: Required<AutoSaveOptions>;
  
  constructor(
    saveCallback: (changes: AutoSaveChange[]) => Promise<void>,
    options: AutoSaveOptions = {}
  ) {
    this.batchSaveCallback = saveCallback;
    this.options = {
      debounceDelay: 800,
      maxRetries: 3,
      onSaveStart: () => {},
      onSaveSuccess: () => {},
      onSaveError: () => {},
      ...options
    };
    
    console.log('🔧 AutoSaveManager initialized with session:', this._sessionId);
  }

  addChange(
    rowIndex: number, 
    colIndex: number, 
    data: any, 
    operation: 'create' | 'update' | 'delete' = 'create',
    id?: number
  ) {
    const changeKey = `${rowIndex}-${colIndex}`;
    const existingChange = this.pendingChanges.get(changeKey);
    
    const changeEntry: AutoSaveChange = {
      operation,
      data,
      timestamp: Date.now(),
      rowIndex,
      colIndex,
      id,
      ...existingChange
    };
    
    this.pendingChanges.set(changeKey, changeEntry);
    console.log(`💾 Added ${operation} change for ${changeKey}`);
    
    this.debouncedSave();
  }

  private debouncedSave() {
    if (this.saveTimeoutRef) {
      clearTimeout(this.saveTimeoutRef);
    }

    this.saveTimeoutRef = setTimeout(() => {
      this.executeBatchSave();
    }, this.options.debounceDelay);
  }

  private async executeBatchSave() {
    if (this.saveInProgress || this.pendingChanges.size === 0) return;
    
    this.saveInProgress = true;
    this.options.onSaveStart();
    
    const changes = Array.from(this.pendingChanges.values());
    const changesCopy = [...changes];
    
    console.log(`🚀 Executing batch save: ${changes.length} changes`);
    console.log('🔍 Changes to save:', changesCopy);
    
    try {
      const result = await this.batchSaveCallback(changesCopy);
      console.log('🔍 Batch save result:', result);
      
      // Clear saved changes
      this.pendingChanges.clear();
      this.retryCount = 0;
      this.options.onSaveSuccess();
      console.log('✅ Batch save successful');
      
    } catch (error) {
      console.error('❌ Batch save failed:', error);
      console.error('❌ Error details:', error);
      this.options.onSaveError(error);
      
      // Retry mechanism with exponential backoff
      this.retryCount++;
      if (this.retryCount < this.options.maxRetries) {
        console.log(`🔄 Retrying save (${this.retryCount}/${this.options.maxRetries})`);
        setTimeout(() => {
          this.saveInProgress = false;
          this.debouncedSave();
        }, 2000 * this.retryCount);
      } else {
        console.error('❌ Max retries reached, giving up on save');
        this.retryCount = 0;
      }
    } finally {
      this.saveInProgress = false;
    }
  }

  forceFlush() {
    if (this.saveTimeoutRef) {
      clearTimeout(this.saveTimeoutRef);
    }
    return this.executeBatchSave();
  }

  destroy() {
    if (this.saveTimeoutRef) {
      clearTimeout(this.saveTimeoutRef);
    }
    this.forceFlush();
  }

  get pendingCount() {
    return this.pendingChanges.size;
  }

  get isSaving() {
    return this.saveInProgress;
  }

  getSessionId() {
    return this._sessionId;
  }
}

export function useAutoSave(
  saveCallback: (changes: AutoSaveChange[]) => Promise<void>,
  options: AutoSaveOptions = {}
) {
  const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const enhancedOptions: AutoSaveOptions = {
      ...options,
      onSaveStart: () => {
        setSaveStatus('saving');
        options.onSaveStart?.();
      },
      onSaveSuccess: () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        options.onSaveSuccess?.();
      },
      onSaveError: (error) => {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        options.onSaveError?.(error);
      }
    };

    autoSaveManagerRef.current = new AutoSaveManager(saveCallback, enhancedOptions);
    
    return () => {
      if (autoSaveManagerRef.current) {
        autoSaveManagerRef.current.destroy();
      }
    };
  }, [saveCallback]);

  const addChange = (
    rowIndex: number,
    colIndex: number,
    data: any,
    operation: 'create' | 'update' | 'delete' = 'create',
    id?: number
  ) => {
    autoSaveManagerRef.current?.addChange(rowIndex, colIndex, data, operation, id);
  };

  const forceFlush = () => {
    return autoSaveManagerRef.current?.forceFlush();
  };

  const pendingCount = autoSaveManagerRef.current?.pendingCount || 0;
  const isSaving = autoSaveManagerRef.current?.isSaving || false;

  return {
    addChange,
    forceFlush,
    saveStatus,
    pendingCount,
    isSaving
  };
}