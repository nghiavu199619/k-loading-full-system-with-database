import React, { useRef, useEffect, useState } from 'react';
import { TableConfig } from '../types';

interface HandsontableWrapperProps extends TableConfig {
  className?: string;
  loadingMessage?: string;
}

export const HandsontableWrapper: React.FC<HandsontableWrapperProps> = ({
  columns,
  data,
  settings = {},
  onCellChange,
  onAfterLoadData,
  onAfterInit,
  className = '',
  loadingMessage = 'Đang tải Handsontable...'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hotInstance, setHotInstance] = useState<any>(null);

  useEffect(() => {
    const initHandsontable = async () => {
      try {
        // Load Handsontable dynamically
        const Handsontable = (window as any).Handsontable;
        
        if (Handsontable && containerRef.current) {
          const defaultSettings: any = {
            licenseKey: 'non-commercial-and-evaluation',
            data: data,
            columns: columns,
            stretchH: 'all',
            autoWrapRow: true,
            autoWrapCol: true,
            rowHeaders: true,
            colHeaders: true,
            contextMenu: true,
            manualRowResize: true,
            manualColumnResize: true,
            filters: true,
            dropdownMenu: true,
            ...settings,
            afterChange: (changes: any[][]) => {
              if (changes && onCellChange) {
                onCellChange(changes);
              }
            },
            afterLoadData: () => {
              console.log('🔄 HANDSONTABLE: Data loaded successfully');
              if (onAfterLoadData) {
                onAfterLoadData();
              }
            },
            afterInit: () => {
              console.log('✅ HANDSONTABLE: Initialized successfully');
              if (onAfterInit) {
                onAfterInit();
              }
            }
          };

          const hot = new Handsontable(containerRef.current, defaultSettings);
          setHotInstance(hot);
          setIsLoading(false);
        } else {
          console.error('Handsontable not found in window object');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize Handsontable:', error);
        setIsLoading(false);
      }
    };

    // Check if Handsontable is already loaded
    if ((window as any).Handsontable) {
      initHandsontable();
    } else {
      // Load Handsontable CSS and JS
      const loadHandsontableScript = () => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/handsontable@latest/dist/handsontable.full.min.js';
        script.onload = () => initHandsontable();
        document.head.appendChild(script);
      };

      const loadHandsontableCSS = () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/handsontable@latest/dist/handsontable.full.min.css';
        document.head.appendChild(link);
        loadHandsontableScript();
      };

      loadHandsontableCSS();
    }

    return () => {
      if (hotInstance) {
        hotInstance.destroy();
      }
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (hotInstance && data) {
      hotInstance.loadData(data);
    }
  }, [data, hotInstance]);

  if (isLoading) {
    return (
      <div className={`handsontable-loading flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`handsontable-wrapper ${className}`}>
      <div ref={containerRef} style={{ width: '100%', height: '600px' }} />
    </div>
  );
};