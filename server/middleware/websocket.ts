
import { wsManager } from '../websocket';

export function broadcastChange(type: string, branchId?: string) {
  return (req: any, res: any, next: any) => {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        wsManager.broadcastDataUpdate(type, branchId);
      }
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        wsManager.broadcastDataUpdate(type, branchId);
      }
      return originalJson.call(this, data);
    };

    next();
  };
}
