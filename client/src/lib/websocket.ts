// ✅ DISABLED WebSocket Manager - Using HTTP polling only
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private listenerMap: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for bulk operations
  private reconnectDelay = 1000; // Faster reconnect for bulk paste
  private isConnecting = false;

  connect() {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Don't reconnect if already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      
      // Validate host before creating WebSocket URL
      if (!host || host === 'undefined' || host === 'null' || host.includes('undefined')) {
        console.log('❌ Invalid host detected:', host, 'aborting WebSocket connection');
        this.isConnecting = false;
        return;
      }
      
      const wsUrl = `${protocol}//${host}/ws`;
      // WebSocket URL setup
      
      // Validate URL format
      try {
        new URL(wsUrl.replace('ws:', 'http:').replace('wss:', 'https:'));
      } catch (urlError) {
        this.isConnecting = false;
        return;
      }
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.broadcast('connection', { status: 'connected' });
        this.emit('statusChange');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // ✅ OPTIMIZED: Server sends complete object, not {type, data} format  
          this.broadcast(message.type, message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error, 'Raw data:', event.data);
        }
      };
      
      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.broadcast('connection', { status: 'disconnected' });
        this.emit('statusChange');
        
        // Prevent infinite reconnection loops if there's a fundamental URL issue
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.connect();
          }, 1000); // Reasonable reconnect delay
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.broadcast('connection', { status: 'error', error });
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnecting) {
      const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 5000);
      setTimeout(() => {
        if (!this.isConnecting) {
          this.reconnectAttempts++;
          this.connect();
        }
      }, delay);
    }
  }

  // Add missing emit method for compatibility
  private emit(eventType: string, data?: any) {
    const listeners = this.listenerMap.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(data || { type: eventType }));
    }
  }

  private broadcast(type: string, data: any) {
    // Broadcast to specific type listeners
    const listeners = this.listenerMap.get(type);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data); // Send original data, not wrapped in {type, data}
        } catch (error) {
          console.error('WebSocket listener error:', error);
        }
      });
    }
    
    // Broadcast to all listeners (*)
    const allListeners = this.listenerMap.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(data); // Send original data, not wrapped in {type, data}
        } catch (error) {
          console.error('WebSocket listener error:', error);
        }
      });
    }
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listenerMap.has(eventType)) {
      this.listenerMap.set(eventType, new Set());
    }
    this.listenerMap.get(eventType)!.add(callback);
    
    return () => {
      const listeners = this.listenerMap.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listenerMap.delete(eventType);
        }
      }
    };
  }

  // Make listeners accessible for debugging
  get listeners() {
    return this.listenerMap;
  }

  // ✅ ADD: Send method for WebSocket auto-save
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        this.ws.send(message);
        // Message sent successfully
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message:', data);
    }
  }

  disconnect() {
    this.isConnecting = false;
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close();
    }
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(eventType: string, callback: (data: any) => void) {
    return this.subscribe(eventType, callback);
  }

  off(eventType: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }
}

export const wsManager = new WebSocketManager();
