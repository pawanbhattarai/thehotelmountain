import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface SSEMessage {
  event: string;
  data: any;
  id?: string;
  retry?: number;
}

export function useSSE() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const lastAuthTime = useRef(0);
  const authDebounceMs = 10000; // Prevent auth calls more than once per 10 seconds
  const formActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFormActive = useRef(false);
  const [bandwidthMode, setBandwidthMode] = useState<'normal' | 'low' | 'ultra-low'>('normal');

  const connect = () => {
    console.log('📡 Connecting to SSE...');
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      // Create new EventSource connection
      eventSourceRef.current = new EventSource('/api/sse', {
        withCredentials: true
      });

      // Handle connection open
      eventSourceRef.current.onopen = () => {
        console.log('📡 SSE Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Authenticate the SSE connection if user is logged in
        if (user && clientId) {
          authenticateSSE(clientId);
        }
      };

      // Handle connection events
      eventSourceRef.current.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Client registered:', data.clientId);
        setClientId(data.clientId);
        
        // Authenticate immediately if user is logged in
        if (user) {
          authenticateSSE(data.clientId);
        }
      });

      // Handle data updates
      eventSourceRef.current.addEventListener('data_update', (event) => {
        try {
          const updateData = JSON.parse(event.data);
          console.log('📡 SSE Data update:', updateData.type);
          
          handleDataUpdate(updateData.type, updateData.data);
        } catch (error) {
          console.error('Error parsing SSE data update:', error);
        }
      });

      // Handle user-specific updates
      eventSourceRef.current.addEventListener('user_update', (event) => {
        try {
          const updateData = JSON.parse(event.data);
          console.log('📡 SSE User update:', updateData.type);
          
          handleDataUpdate(updateData.type, updateData.data);
        } catch (error) {
          console.error('Error parsing SSE user update:', error);
        }
      });

      // Handle notifications
      eventSourceRef.current.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data);
          console.log('📡 SSE Notification:', notification.message);
          
          toast({
            title: notification.type === 'error' ? 'Error' : 'Notification',
            description: notification.message,
            variant: notification.type === 'error' ? 'destructive' : 'default'
          });
        } catch (error) {
          console.error('Error parsing SSE notification:', error);
        }
      });

      // Handle ping (heartbeat)
      eventSourceRef.current.addEventListener('ping', (event) => {
        // Just acknowledge the ping - connection is alive
        console.log('📡 SSE Ping received');
      });

      // Handle message events (fallback)
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 SSE Generic message:', data);
        } catch (error) {
          console.log('📡 SSE Raw message:', event.data);
        }
      };

      // Handle errors
      eventSourceRef.current.onerror = (event) => {
        console.error('📡 SSE Error:', event);
        setIsConnected(false);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`📡 SSE Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('📡 SSE Max reconnection attempts reached');
          toast({
            title: 'Connection Error',
            description: 'Real-time updates are temporarily unavailable. Please refresh the page.',
            variant: 'destructive'
          });
        }
      };

    } catch (error) {
      console.error('📡 SSE Connection error:', error);
      setIsConnected(false);
    }
  };

  // Authenticate SSE connection with debouncing
  const authenticateSSE = async (clientId: string) => {
    const now = Date.now();
    if (now - lastAuthTime.current < authDebounceMs) {
      console.log('📡 SSE Authentication skipped (debounced)');
      return;
    }
    
    try {
      lastAuthTime.current = now;
      await fetch('/api/sse/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
        credentials: 'include'
      });
      console.log('📡 SSE Authentication updated');
    } catch (error) {
      console.error('📡 SSE Authentication error:', error);
    }
  };

  // Handle different types of data updates
  const handleDataUpdate = (type: string, data: any) => {
    console.log(`📡 Handling data update: ${type} (bandwidth: ${bandwidthMode})`);
    
    // Bandwidth-aware invalidation strategies
    const getInvalidationStrategy = () => {
      switch (bandwidthMode) {
        case 'ultra-low':
          return { staleTime: 30000, delayTime: 15000, skipNonCritical: true };
        case 'low':
          return { staleTime: 15000, delayTime: 8000, skipNonCritical: false };
        default:
          return { staleTime: 5000, delayTime: 3000, skipNonCritical: false };
      }
    };
    
    const strategy = getInvalidationStrategy();
    
    // Use more targeted invalidation with stale time to avoid interrupting form inputs
    const invalidateWithStaleTime = (queryKey: string[], staleTime = strategy.staleTime, isCritical = false) => {
      // Skip invalidation if user is actively typing in forms
      if (isFormActive.current) {
        console.log('📡 Query invalidation skipped (form active) for:', queryKey);
        return;
      }
      
      // Skip non-critical updates in ultra-low bandwidth mode
      if (strategy.skipNonCritical && !isCritical) {
        console.log('📡 Query invalidation skipped (ultra-low bandwidth, non-critical) for:', queryKey);
        return;
      }
      
      console.log('📡 Invalidating queries for:', queryKey);
      queryClient.invalidateQueries({ 
        queryKey, 
        exact: false,
        refetchType: 'none' // Don't refetch immediately, just mark as stale
      });
      
      // Set a longer stale time to avoid frequent refetches
      setTimeout(() => {
        if (!isFormActive.current) {
          console.log('📡 Delayed query refresh for:', queryKey);
          queryClient.invalidateQueries({ queryKey, exact: false });
        } else {
          console.log('📡 Delayed query refresh skipped (form still active) for:', queryKey);
        }
      }, strategy.delayTime);
    };
    
    // If user is actively typing, skip ALL query invalidation
    if (isFormActive.current) {
      console.log('📡 All query invalidation skipped (form active) for:', type);
      return;
    }

    // Invalidate relevant queries based on update type
    switch (type) {
      // Branch operations
      case 'branches_created':
      case 'branches_updated':
      case 'branches_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
        break;

      // User operations
      case 'users_created':
      case 'users_updated':
      case 'users_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        break;

      // Room operations
      case 'rooms_created':
      case 'rooms_updated':
      case 'rooms_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/super-admin-metrics'] });
        break;

      // Room type operations
      case 'room-types_created':
      case 'room-types_updated':
      case 'room-types_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/room-types'] });
        break;

      // Guest operations
      case 'guests_created':
      case 'guests_updated':
      case 'guests_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/guests'] });
        break;

      // Reservation operations - use gentle invalidation to avoid interrupting forms
      case 'reservations_created':
      case 'reservations_updated':
      case 'reservations_deleted':
        invalidateWithStaleTime(['/api/reservations'], strategy.staleTime, true); // Critical
        invalidateWithStaleTime(['/api/rooms'], strategy.staleTime, true); // Critical - room status changes
        invalidateWithStaleTime(['/api/rooms/availability'], strategy.staleTime, true); // Critical - availability changes
        invalidateWithStaleTime(['/api/dashboard/metrics'], strategy.staleTime * 2, false);
        invalidateWithStaleTime(['/api/dashboard/super-admin-metrics'], strategy.staleTime * 2, false);
        invalidateWithStaleTime(['/api/analytics/revenue'], strategy.staleTime * 4, false);
        invalidateWithStaleTime(['/api/analytics/occupancy'], strategy.staleTime * 4, false);
        break;

      // Payment operations
      case 'payments_created':
      case 'payments_updated':
        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
        break;

      // Restaurant operations
      case 'restaurant-orders':
        queryClient.invalidateQueries({ queryKey: ['/api/restaurant/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/metrics'] });
        queryClient.invalidateQueries({ queryKey: ['/api/restaurant/dashboard/today-orders'] });
        break;

      // Room order operations - invalidate billing and room order queries
      case 'restaurant-orders_created':
      case 'restaurant-orders_updated':
      case 'restaurant-orders_deleted':
        invalidateWithStaleTime(['/api/restaurant/orders/room'], strategy.staleTime, true); // Critical
        invalidateWithStaleTime(['/api/room-orders'], strategy.staleTime, true); // Critical
        invalidateWithStaleTime(['/api/reservations'], strategy.staleTime, true); // Critical - for billing totals
        // Invalidate specific reservation room orders if we have the reservation ID
        if (data && data.reservationId) {
          invalidateWithStaleTime([`/api/reservations/${data.reservationId}/room-orders`], strategy.staleTime, true);
        }
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

      case 'restaurant-bot':
        queryClient.invalidateQueries({ queryKey: ['/api/restaurant/bot'] });
        break;

      case 'inventory-consumption':
        queryClient.invalidateQueries({ queryKey: ['/api/inventory/consumption'] });
        queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock-items'] });
        break;

      // Role operations
      case 'roles_created':
      case 'roles_updated':
        queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
        break;

      default:
        console.log(`📡 Unknown data update type: ${type}`);
        // For unknown types, invalidate all queries as a fallback
        queryClient.invalidateQueries();
    }
  };

  // Form activity tracking
  const trackFormActivity = () => {
    isFormActive.current = true;
    console.log('📡 Form activity detected - protecting queries');
    
    // Clear existing timeout
    if (formActivityTimeoutRef.current) {
      clearTimeout(formActivityTimeoutRef.current);
    }
    
    // Mark form as inactive after 5 seconds of no activity
    formActivityTimeoutRef.current = setTimeout(() => {
      isFormActive.current = false;
      console.log('📡 Form activity ended - queries can resume');
    }, 5000);
  };

  // Global form activity listeners
  useEffect(() => {
    const handleFormActivity = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        trackFormActivity();
      }
    };

    // Add event listeners for form activity with passive option for better performance
    document.addEventListener('input', handleFormActivity, { passive: true });
    document.addEventListener('focusin', handleFormActivity, { passive: true });
    document.addEventListener('keydown', handleFormActivity, { passive: true });

    return () => {
      document.removeEventListener('input', handleFormActivity);
      document.removeEventListener('focusin', handleFormActivity);
      document.removeEventListener('keydown', handleFormActivity);
      
      if (formActivityTimeoutRef.current) {
        clearTimeout(formActivityTimeoutRef.current);
      }
    };
  }, []);

  // Detect bandwidth and adjust behavior
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const updateBandwidthMode = () => {
        const effectiveType = connection.effectiveType;
        const downlink = connection.downlink;
        
        if (effectiveType === 'slow-2g' || downlink < 0.15) {
          setBandwidthMode('ultra-low');
          console.log('📡 Ultra-low bandwidth detected - minimal updates mode');
        } else if (effectiveType === '2g' || downlink < 0.5) {
          setBandwidthMode('low');
          console.log('📡 Low bandwidth detected - reduced updates mode');
        } else {
          setBandwidthMode('normal');
          console.log('📡 Normal bandwidth detected - full updates mode');
        }
      };
      
      updateBandwidthMode();
      connection.addEventListener('change', updateBandwidthMode);
      
      return () => connection.removeEventListener('change', updateBandwidthMode);
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Update authentication when user changes, but only if connection is stable
  useEffect(() => {
    if (user && clientId && isConnected) {
      authenticateSSE(clientId);
    }
  }, [user?.id, clientId, isConnected]); // Only depend on user ID to avoid frequent changes

  return {
    isConnected,
    clientId,
    reconnect: connect,
    trackFormActivity,
    bandwidthMode
  };
}