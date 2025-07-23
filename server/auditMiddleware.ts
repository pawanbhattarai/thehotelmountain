import { Request, Response, NextFunction } from 'express';
import { AuditLogger } from './auditLogger';

// Enhanced audit middleware that captures all operations
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  const startTime = Date.now();

  // Override res.send to capture response
  res.send = function(body: any) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    // Log the operation
    logOperation(req, res, body, success, duration);

    return originalSend.call(this, body);
  };

  next();
};

function logOperation(req: Request, res: Response, responseBody: any, success: boolean, duration: number) {
  const method = req.method;
  const path = req.path;
  const userId = (req as any).session?.user?.id;
  const branchId = (req as any).session?.user?.branchId;

  // Skip logging for certain paths
  const skipPaths = [
    '/api/notifications/vapid-key',
    '/api/auth/user',
    '/sw.js',
    '/favicon.ico',
    '/api/dashboard/metrics',
    '/api/notifications/unread-count'
  ];

  if (skipPaths.some(skipPath => path.includes(skipPath))) {
    return;
  }

  // Determine entity and action from path and method
  const { entity, action, entityId } = parseRequestInfo(method, path, req.body, req.params);

  if (entity && action && action !== '') {
    AuditLogger.log({
      action,
      entity,
      entityId,
      success,
      details: {
        method,
        path,
        duration,
        statusCode: res.statusCode,
        requestBody: sanitizeRequestBody(req.body),
        userAgent: req.headers['user-agent'],
      },
      errorMessage: success ? undefined : getErrorMessage(responseBody),
      req,
      userId,
      branchId,
    });
  }
}

function parseRequestInfo(method: string, path: string, body: any, params: any): {
  entity: string;
  action: string;
  entityId?: string;
} {
  // Remove /api prefix
  const cleanPath = path.replace('/api/', '');
  const pathParts = cleanPath.split('/');

  let entity = '';
  let action = '';
  let entityId = '';

  // PMS Operations
  if (pathParts[0] === 'reservations') {
    entity = 'reservation';
    entityId = pathParts[1] || body?.id || body?.reservation?.confirmationNumber;
    action = getActionFromMethod(method, pathParts);
  } else if (pathParts[0] === 'rooms') {
    entity = 'room';
    entityId = pathParts[1] || body?.id || body?.number;
    action = getActionFromMethod(method, pathParts);
  } else if (pathParts[0] === 'guests') {
    entity = 'guest';
    entityId = pathParts[1] || body?.id || body?.phone;
    action = getActionFromMethod(method, pathParts);
  } else if (pathParts[0] === 'room-types') {
    entity = 'room_type';
    entityId = pathParts[1] || body?.id || body?.name;
    action = getActionFromMethod(method, pathParts);
  } else if (pathParts[0] === 'branches') {
    entity = 'branch';
    entityId = pathParts[1] || body?.id || body?.name;
    action = getActionFromMethod(method, pathParts);
  } else if (pathParts[0] === 'users') {
    entity = 'user';
    entityId = pathParts[1] || body?.id || body?.email;
    action = getActionFromMethod(method, pathParts);
  }

  // RMS Operations
  else if (pathParts[0] === 'restaurant') {
    if (pathParts[1] === 'tables') {
      entity = 'restaurant_table';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'categories') {
      entity = 'menu_category';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'dishes') {
      entity = 'menu_dish';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'orders') {
      entity = 'restaurant_order';
      entityId = pathParts[2] || body?.order?.id || body?.id;
      action = getActionFromMethod(method, pathParts, 2);
      // Special handling for order status updates
      if (pathParts[3] === 'status') {
        action = 'UPDATE_STATUS';
        entityId = pathParts[2];
      } else if (pathParts[3] === 'kot') {
        action = 'GENERATE_KOT';
        entityId = pathParts[2];
      } else if (pathParts[3] === 'bot') {
        action = 'GENERATE_BOT';
        entityId = pathParts[2];
      }
    } else if (pathParts[1] === 'bills') {
      entity = 'restaurant_bill';
      entityId = pathParts[2] || body?.id || body?.billNumber;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'kot') {
      entity = 'kot_ticket';
      entityId = pathParts[2] || body?.id;
      action = getActionFromMethod(method, pathParts, 2);
      // Special handling for KOT status updates
      if (pathParts[3] === 'status') {
        action = 'UPDATE_KOT_STATUS';
        entityId = pathParts[2];
      } else if (pathParts[3] === 'print') {
        action = 'PRINT_KOT';
        entityId = pathParts[2];
      }
    }
  }

  // Inventory Operations
  else if (pathParts[0] === 'inventory') {
    if (pathParts[1] === 'stock-categories') {
      entity = 'stock_category';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'stock-items') {
      entity = 'stock_item';
      entityId = pathParts[2] || body?.id || body?.sku;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'measuring-units') {
      entity = 'measuring_unit';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'suppliers') {
      entity = 'supplier';
      entityId = pathParts[2] || body?.id || body?.name;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'consumption') {
      entity = 'stock_consumption';
      entityId = pathParts[2] || body?.id;
      action = getActionFromMethod(method, pathParts, 2);
    } else if (pathParts[1] === 'low-stock') {
      entity = 'inventory';
      action = 'CHECK_LOW_STOCK';
    }
  }

  // Tax Management
  else if (pathParts[0] === 'taxes' || pathParts[0] === 'tax-management') {
    entity = 'tax';
    entityId = pathParts[1] || body?.id || body?.taxName;
    action = getActionFromMethod(method, pathParts);
  }

  // Billing Operations
  else if (pathParts[0] === 'billing') {
    entity = 'billing';
    entityId = pathParts[1] || body?.reservationId;
    action = getActionFromMethod(method, pathParts);
  }

  // Analytics
  else if (pathParts[0] === 'analytics') {
    entity = 'analytics';
    action = 'VIEW_ANALYTICS';
    entityId = pathParts[1] || 'general';
  }

  // Dashboard - skip logging
  else if (pathParts[0] === 'dashboard') {
    return { entity: '', action: '', entityId: '' };
  }

  // Settings
  else if (pathParts[0] === 'hotel-settings') {
    entity = 'hotel_settings';
    entityId = pathParts[1] || body?.id;
    action = getActionFromMethod(method, pathParts);
  }

  // Roles
  else if (pathParts[0] === 'roles') {
    entity = 'role';
    entityId = pathParts[1] || body?.id || body?.name;
    action = getActionFromMethod(method, pathParts);
  }

  return { entity, action, entityId };
}

function getActionFromMethod(method: string, pathParts: string[], offset: number = 1): string {
  const hasId = pathParts[offset] && !isNaN(parseInt(pathParts[offset]));
  const hasSpecialAction = pathParts[offset + 1];

  switch (method) {
    case 'GET':
      // Skip logging all READ operations
      return '';
    case 'POST':
      if (hasSpecialAction) {
        return `CREATE_${pathParts[offset + 1].toUpperCase()}`;
      }
      return pathParts.includes('bulk') ? 'BULK_CREATE' : 'CREATE';
    case 'PUT':
    case 'PATCH':
      if (hasSpecialAction) {
        return `UPDATE_${pathParts[offset + 1].toUpperCase()}`;
      }
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'UNKNOWN';
  }
}

function sanitizeRequestBody(body: any): any {
  if (!body) return body;

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'auth', 'p256dh', 'endpoint'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

function getErrorMessage(responseBody: any): string | undefined {
  if (typeof responseBody === 'string') {
    try {
      const parsed = JSON.parse(responseBody);
      return parsed.message || parsed.error;
    } catch {
      return responseBody;
    }
  }

  if (responseBody && typeof responseBody === 'object') {
    return responseBody.message || responseBody.error;
  }

  return undefined;
}