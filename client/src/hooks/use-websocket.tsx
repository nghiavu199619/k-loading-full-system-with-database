import { useEffect, useState, useCallback } from 'react';
import { wsManager } from '@/lib/websocket';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = () => {
      wsManager.connect();
      setIsConnected(wsManager.isConnected());
    };

    connect();

    const handleStatusChange = () => {
      setIsConnected(wsManager.isConnected());
    };

    wsManager.on('statusChange', handleStatusChange);

    return () => {
      wsManager.off('statusChange', handleStatusChange);
    };
  }, []);

  const subscribe = useCallback((callback: (data: any) => void) => {
    const unsubscribe = wsManager.subscribe('*', callback);
    return unsubscribe;
  }, []);

  return {
    isConnected,
    subscribe
  };
}
