import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/useSSE';

export function useRealtimeSync(user: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected, reconnect } = useSSE();

  // Manual sync function for immediate updates
  const syncNow = () => {
    // Invalidate all queries immediately
    queryClient.invalidateQueries();

    // Show success notification
    toast({
      title: "Data Synchronized",
      description: "All data has been updated with the latest information.",
    });

    // If SSE is not connected, try to reconnect
    if (!isConnected) {
      reconnect();
      toast({
        title: "Reconnecting...",
        description: "Attempting to restore real-time updates.",
      });
    }
  };

  return { syncNow, isConnected };
}