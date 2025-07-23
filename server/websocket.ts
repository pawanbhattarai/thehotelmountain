import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface Client {
  ws: WebSocket;
  userId?: string;
  branchId?: string;
  isAlive: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<Client> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  init(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: false,
      maxPayload: 16 * 1024,
      skipUTF8Validation: true, // Skip UTF8 validation for performance
      handleProtocols: () => false, // Don't handle subprotocols
      verifyClient: (info) => {
        // Basic verification to prevent malformed requests
        return info.req.headers.upgrade === 'websocket';
      }
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      const client: Client = { ws, isAlive: true };
      this.clients.add(client);

      // Enhanced error handling for the WebSocket
      ws.on('message', (message: Buffer) => {
        try {
          // Ensure we're dealing with valid UTF-8 data
          const messageStr = message.toString('utf8');
          const data = JSON.parse(messageStr);

          if (data.type === 'auth') {
            client.userId = data.userId;
            client.branchId = data.branchId;
          }
        } catch (error) {
          // Silently ignore parse errors to prevent spam
        }
      });

      ws.on('ping', () => {
        client.isAlive = true;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.pong();
          }
        } catch (error) {
          // Ignore pong errors
        }
      });

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('close', (code, reason) => {
        this.clients.delete(client);
      });

      ws.on('error', (error) => {
        // Clean up silently without logging every error
        this.clients.delete(client);
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.terminate();
          }
        } catch (closeError) {
          // Ignore termination errors
        }
      });
    });

    // Set up heartbeat to clean dead connections
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          this.clients.delete(client);
          try {
            client.ws.terminate();
          } catch (error) {
            // Ignore termination errors
          }
          return;
        }

        client.isAlive = false;
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        } catch (error) {
          this.clients.delete(client);
        }
      });
    }, 30000);

    this.wss.on('error', (error) => {
      // Only log server-level errors, not connection errors
      if (error.message.includes('listen') || error.message.includes('bind')) {
        console.error('WebSocket Server error:', error.message);
      }
    });
  }

  broadcast(event: string, data: any, branchId?: string) {
    if (!this.wss || this.clients.size === 0) return;

    try {
      const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      const deadClients: Client[] = [];

      this.clients.forEach(client => {
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            // If branchId is specified, only send to clients in that branch
            if (!branchId || client.branchId === branchId) {
              client.ws.send(message);
            }
          } else {
            // Mark for removal
            deadClients.push(client);
          }
        } catch (error) {
          // Mark for removal on send error
          deadClients.push(client);
        }
      });

      // Clean up dead connections
      deadClients.forEach(client => {
        this.clients.delete(client);
        try {
          client.ws.terminate();
        } catch (error) {
          // Ignore termination errors
        }
      });
    } catch (error) {
      // Silently handle broadcast errors
    }
  }

  broadcastDataUpdate(type: string, branchId?: string) {
    this.broadcast('data_update', { type }, branchId);
  }

  // Clean shutdown method
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach(client => {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        // Ignore close errors
      }
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }
  }
}

export const wsManager = new WebSocketManager();