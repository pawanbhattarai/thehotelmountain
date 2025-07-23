import { Response, Request } from 'express';
import { EventEmitter } from 'events';

interface SSEClient {
  id: string;
  userId?: string;
  branchId?: string;
  response: Response;
  lastPing: number;
  isAlive: boolean;
}

interface SSEMessage {
  event: string;
  data: any;
  id?: string;
  retry?: number;
}

class SSEManager extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageCounter = 0;

  constructor() {
    super();
    this.startHeartbeat();
  }

  // Add a new SSE client
  addClient(req: Request, res: Response): string {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection message
    this.sendToClient(res, {
      event: 'connected',
      data: { clientId, timestamp: new Date().toISOString() },
      id: this.getNextMessageId()
    });

    // Create client object
    const client: SSEClient = {
      id: clientId,
      response: res,
      lastPing: Date.now(),
      isAlive: true
    };

    this.clients.set(clientId, client);

    // Handle client disconnect
    req.on('close', () => {
      this.removeClient(clientId);
    });

    req.on('error', () => {
      this.removeClient(clientId);
    });

    console.log(`📡 SSE Client connected: ${clientId} (Total: ${this.clients.size})`);
    return clientId;
  }

  // Remove a client
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors when closing connection
      }
      this.clients.delete(clientId);
      console.log(`📡 SSE Client disconnected: ${clientId} (Total: ${this.clients.size})`);
    }
  }

  // Send message to specific client
  sendToClient(res: Response, message: SSEMessage): void {
    try {
      const data = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);
      
      if (message.id) {
        res.write(`id: ${message.id}\n`);
      }
      if (message.retry) {
        res.write(`retry: ${message.retry}\n`);
      }
      res.write(`event: ${message.event}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error sending SSE message:', error);
    }
  }

  // Broadcast message to all clients
  broadcast(message: SSEMessage): void {
    const messageId = this.getNextMessageId();
    const finalMessage = { ...message, id: messageId };
    
    console.log(`📡 Broadcasting SSE message: ${message.event} to ${this.clients.size} clients`);
    
    for (const [clientId, client] of this.clients) {
      if (client.isAlive) {
        try {
          this.sendToClient(client.response, finalMessage);
        } catch (error) {
          console.error(`Error sending to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  // Broadcast to specific branch
  broadcastToBranch(branchId: string, message: SSEMessage): void {
    const messageId = this.getNextMessageId();
    const finalMessage = { ...message, id: messageId };
    
    console.log(`📡 Broadcasting SSE message to branch ${branchId}: ${message.event}`);
    
    for (const [clientId, client] of this.clients) {
      if (client.branchId === branchId && client.isAlive) {
        try {
          this.sendToClient(client.response, finalMessage);
        } catch (error) {
          console.error(`Error sending to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  // Broadcast to superadmins and specific branch users
  broadcastToSuperadminsAndBranch(branchId: string | undefined, message: SSEMessage): void {
    const messageId = this.getNextMessageId();
    const finalMessage = { ...message, id: messageId };
    
    console.log(`📡 Broadcasting SSE to superadmins and branch ${branchId || 'all'}: ${message.event}`);
    
    for (const [clientId, client] of this.clients) {
      if (client.isAlive) {
        // Send to superadmins (they see everything)
        // Send to branch users only if it's their branch or if branchId is undefined (global)
        const isRelevantForClient = 
          client.branchId === null || // superadmin
          client.branchId === undefined || // superadmin
          branchId === undefined || // global update
          client.branchId === branchId; // same branch
        
        if (isRelevantForClient) {
          try {
            this.sendToClient(client.response, finalMessage);
          } catch (error) {
            console.error(`Error sending to client ${clientId}:`, error);
            this.removeClient(clientId);
          }
        }
      }
    }
  }

  // Broadcast to specific user
  broadcastToUser(userId: string, message: SSEMessage): void {
    const messageId = this.getNextMessageId();
    const finalMessage = { ...message, id: messageId };
    
    console.log(`📡 Broadcasting SSE message to user ${userId}: ${message.event}`);
    
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId && client.isAlive) {
        try {
          this.sendToClient(client.response, finalMessage);
        } catch (error) {
          console.error(`Error sending to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  // Update client authentication info
  updateClientAuth(clientId: string, userId?: string, branchId?: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.userId = userId;
      client.branchId = branchId;
      console.log(`📡 Updated client ${clientId} auth: user=${userId}, branch=${branchId}`);
    }
  }

  // Send heartbeat to keep connections alive
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients) {
        // Send ping to client
        try {
          this.sendToClient(client.response, {
            event: 'ping',
            data: { timestamp: now }
          });
          
          // Check if client is still alive (within 60 seconds)
          if (now - client.lastPing > 60000) {
            console.log(`📡 Client ${clientId} timeout, removing...`);
            this.removeClient(clientId);
          }
        } catch (error) {
          console.log(`📡 Client ${clientId} error, removing...`);
          this.removeClient(clientId);
        }
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  // Get next message ID
  private getNextMessageId(): string {
    return `msg_${++this.messageCounter}_${Date.now()}`;
  }

  // Get client count
  getClientCount(): number {
    return this.clients.size;
  }

  // Clean up
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    for (const [clientId] of this.clients) {
      this.removeClient(clientId);
    }
  }
}

// Create singleton instance
export const sseManager = new SSEManager();

// Helper function to broadcast data updates
export function broadcastDataUpdate(type: string, data: any, branchId?: string): void {
  const message = {
    event: 'data_update',
    data: { type, data, timestamp: new Date().toISOString() }
  };

  console.log(`📡 SSE Broadcasting ${type} to ${branchId ? `branch ${branchId}` : 'all clients'}`);
  console.log(`📡 SSE Message data:`, message.data);

  // Use intelligent broadcasting: superadmins see everything, branch users see their branch only
  sseManager.broadcastToSuperadminsAndBranch(branchId, message);
}

// Helper function to broadcast user-specific updates
export function broadcastUserUpdate(userId: string, type: string, data: any): void {
  sseManager.broadcastToUser(userId, {
    event: 'user_update',
    data: { type, data, timestamp: new Date().toISOString() }
  });
}

// Helper function to broadcast system notifications
export function broadcastNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', branchId?: string): void {
  const notification = {
    event: 'notification',
    data: { message, type, timestamp: new Date().toISOString() }
  };

  if (branchId) {
    sseManager.broadcastToBranch(branchId, notification);
  } else {
    sseManager.broadcast(notification);
  }
}