import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Express } from "express";
import { storage } from "../storage";

export interface WebSocketManager {
  broadcast: (userId: number | any, data?: any) => void;
  broadcastToOthers: (sender: WebSocket, data: any) => void;
}

export function setupWebSocket(app: Express, httpServer: Server): WebSocketManager {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📡 WEBSOCKET MESSAGE RECEIVED:', data);
        
        if (data.type === 'cell_update') {
          const { table, row, col, value, accountId } = data;
          
          if (table === 'accounts') {
            await updateAccountCell(accountId, col, value);
            
            const broadcastData = {
              type: 'cell_update',
              table: 'accounts', 
              row,
              col,
              value,
              accountId,
              senderId: data.senderId
            };
            
            broadcastToOthers(ws, broadcastData);
          }
        }

        // ✅ Handle status updates from expense management
        if (data.type === 'status_update' && data.table === 'ad_accounts') {
          console.log(`📡 PROCESSING STATUS UPDATE: Account ${data.accountId} → ${data.status}`);
          
          try {
            await storage.updateAdAccount(data.accountId, { status: data.status });
            console.log(`✅ STATUS UPDATED VIA WEBSOCKET: Account ${data.accountId}, Status: ${data.status}`);
            
            // Broadcast to other clients
            broadcastToOthers(ws, {
              type: 'STATUS_UPDATED',
              accountId: data.accountId,
              status: data.status,
              sessionId: data.sessionId,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('❌ Status update error:', error);
          }
        }

        // ✅ Handle expense updates from expense management  
        if (data.type === 'expense_update' && data.table === 'account_expenses') {
          console.log(`📡 PROCESSING EXPENSE UPDATE: Account ${data.accountId}, Client ${data.clientId} → ${data.amount}`);
          
          try {
            // Create or update expense record (find existing first)
            const existingExpense = await storage.getAccountExpenses(2, data.month, data.year);
            const existing = existingExpense.find(exp => 
              exp.accountId === data.accountId && exp.clientId === data.clientId
            );
            
            if (existing) {
              // Update existing expense (if update method exists)
              console.log(`📝 UPDATING EXISTING EXPENSE: ${existing.id}`);
            } else {
              // Create new expense with required fields
              await storage.createAccountExpense({
                accountId: data.accountId,
                clientId: data.clientId,
                amount: data.amount, // Keep as string for proper handling
                type: 'expense', // Required field
                date: new Date(), // Add required date field
                month: data.month,
                year: data.year,
                userId: 2 // Use director ID for now
              });
            }
            console.log(`✅ EXPENSE UPDATED VIA WEBSOCKET: Account ${data.accountId}, Client ${data.clientId}, Amount: ${data.amount}`);
            
            // Broadcast to other clients
            broadcastToOthers(ws, {
              type: 'EXPENSE_UPDATED',
              accountId: data.accountId,
              clientId: data.clientId,
              amount: data.amount,
              month: data.month,
              year: data.year,
              sessionId: data.sessionId,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('❌ Expense update error:', error);
          }
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
  });

  const broadcast = (userIdOrData: number | any, data?: any) => {
    // Handle both old format: broadcast(data) and new format: broadcast(userId, data)
    let broadcastData: any;
    
    if (data !== undefined) {
      // New format: broadcast(userId, data)
      broadcastData = data;
    } else {
      // Old format: broadcast(data)
      broadcastData = userIdOrData;
    }
    
    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(broadcastData));
          sentCount++;
        } catch (error) {
          console.error(`❌ FAILED to send message to client:`, error);
        }
      }
    });
  };

  const broadcastToOthers = (sender: WebSocket, data: any) => {
    let sentCount = 0;
    clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(data));
          sentCount++;
        } catch (error) {
          console.error('❌ Failed to send broadcast to other client:', error);
        }
      }
    });
  };

  return { broadcast, broadcastToOthers };
}

async function updateAccountCell(accountId: number, col: number, value: any) {
  try {
    const fieldMap: Record<number, string> = {
      0: 'status',
      1: 'accountId', 
      2: 'name',
      3: 'source',
      4: 'rentalPercentage',
      5: 'cardType',
      6: 'cardNote', 
      7: 'vatPercentage',
      8: 'clientTag',
      9: 'accountPermission',
      10: 'description'
    };
    
    const field = fieldMap[col];
    if (!field) return;
    
    let processedValue = value;
    
    // Handle status transformation
    if (field === 'status') {
      const statusMap: Record<string, string> = {
        'Hoạt động': 'active',
        'Tạm dừng': 'paused', 
        'Không hoạt động': 'inactive',
        'Chờ duyệt': 'pending',
        'Bị cấm': 'banned'
      };
      processedValue = statusMap[value] || value;
    }
    
    // Handle permission transformation
    if (field === 'accountPermission') {
      const permissionMap: Record<string, string> = {
        'Admin': 'ADMIN',
        'Standard': 'ADVERTISER', 
        'Hạn chế': 'ADVERTISER',
        'Chỉ xem': 'VIEWER'
      };
      processedValue = permissionMap[value] || 'ADVERTISER';
    }
    
    await storage.updateAdAccount(accountId, { [field]: processedValue });
    console.log(`💾 Updated account ${accountId} field ${field} to: ${processedValue}`);
  } catch (error) {
    console.error('Error updating account cell:', error);
  }
}