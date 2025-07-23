
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface UseWebSocketOptions {
  onMessage?: (message: string) => void;
}

export function useWebSocket(options?: UseWebSocketOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    // Skip WebSocket in development mode to avoid Vite conflicts
    if (import.meta.env.DEV) {
      console.log('WebSocket disabled in development mode - using polling for real-time updates');
      return;
    }
    
    console.log('WebSocket connecting for real-time updates');

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Use a specific WebSocket path to avoid conflicts with Vite HMR
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }, 10000);

      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected');
        
        // Send authentication info with error handling
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'auth',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          // Silently handle auth send errors
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.event === 'data_update') {
            // Invalidate specific queries based on update type
            switch (message.data.type) {
              case 'reservations':
                queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/super-admin-metrics'] });
                break;
              case 'rooms':
                queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/rooms'] });
                break;
              case 'guests':
                queryClient.invalidateQueries({ queryKey: ['/api/guests'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/guests'] });
                break;
              case 'analytics':
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/revenue'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/occupancy'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/guests'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/rooms'] });
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/operations'] });
                break;
              case 'restaurant-orders':
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/orders'] });
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/metrics'] });
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/today-orders'] });
                break;
              case 'restaurant-kot':
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/kot'] });
                break;
              case 'restaurant-bills':
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/bills'] });
                break;
              case 'restaurant-dashboard':
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/metrics'] });
                queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/today-orders'] });
                break;
              default:
                // Invalidate all queries for unknown updates
                queryClient.invalidateQueries();
            }
          }
        } catch (error) {
          // Silently handle message parse errors
        }
      };

      wsRef.current.onclose = (event) => {
        clearTimeout(connectionTimeout);
        // Only attempt reconnect for unexpected closures
        if (event.code !== 1000 && event.code !== 1001) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        clearTimeout(connectionTimeout);
        // Silently handle WebSocket errors to prevent console spam
      };
    } catch (error) {
      // Retry connection after delay for setup errors
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
