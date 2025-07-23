import { db } from "./db";
import { auditLogs, InsertAuditLog } from "../shared/schema";
import { Request } from "express";

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  branchId?: number;
}

export class AuditLogger {
  private static getClientIP(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",").shift()?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      "unknown"
    );
  }

  private static extractContext(req?: Request, userId?: string): AuditContext {
    if (!req) {
      return { userId };
    }

    return {
      userId: userId || (req as any).session?.user?.id,
      sessionId: (req as any).session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers["user-agent"],
      branchId: (req as any).session?.user?.branchId,
    };
  }

  static async log(params: {
    action: string;
    entity: string;
    entityId?: string;
    details?: any;
    success?: boolean;
    errorMessage?: string;
    req?: Request;
    userId?: string;
    branchId?: number;
  }): Promise<void> {
    try {
      const context = this.extractContext(params.req, params.userId);

      const auditData: InsertAuditLog = {
        userId: context.userId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: params.details || {},
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        sessionId: context.sessionId || null,
        success: params.success ?? true,
        errorMessage: params.errorMessage || null,
        branchId: params.branchId || context.branchId || null,
      };

      console.log("🔍 Audit data before insert:", JSON.stringify(auditData, null, 2));

      await db.insert(auditLogs).values(auditData);

      console.log(
        `📋 AUDIT: ${params.action} ${params.entity}${params.entityId ? ` (${params.entityId})` : ""} by user ${context.userId || "anonymous"} - ${params.success !== false ? "SUCCESS" : "FAILED"}`,
      );
    } catch (error) {
      console.error("❌ Failed to log audit entry:", error);
      console.error("❌ Audit data that failed:", JSON.stringify({
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details
      }, null, 2));
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Convenience methods for common operations
  static async logLogin(params: {
    userId: string;
    success: boolean;
    errorMessage?: string;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "LOGIN",
      entity: "auth",
      entityId: params.userId,
      success: params.success,
      errorMessage: params.errorMessage,
      req: params.req,
    });
  }

  static async logLogout(params: {
    userId: string;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "LOGOUT",
      entity: "auth",
      entityId: params.userId,
      req: params.req,
    });
  }

  static async logCreate(params: {
    entity: string;
    entityId: string;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "CREATE",
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      req: params.req,
    });
  }

  static async logRead(params: {
    entity: string;
    entityId?: string;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "READ",
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      req: params.req,
    });
  }

  static async logUpdate(params: {
    entity: string;
    entityId: string;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "UPDATE",
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      req: params.req,
    });
  }

  static async logDelete(params: {
    entity: string;
    entityId: string;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "DELETE",
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      req: params.req,
    });
  }

  static async logPayment(params: {
    action: "CREATE_PAYMENT" | "UPDATE_PAYMENT_STATUS";
    paymentId: string;
    reservationId: string;
    amount: number;
    paymentType: string;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: params.action,
      entity: "payment",
      entityId: params.paymentId,
      details: {
        reservationId: params.reservationId,
        amount: params.amount,
        paymentType: params.paymentType,
      },
      req: params.req,
    });
  }

  static async logSystemEvent(params: {
    action: string;
    entity: string;
    details?: any;
    userId?: string;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.log({
      action: params.action,
      entity: params.entity,
      details: params.details,
      userId: params.userId,
      success: params.success,
      errorMessage: params.errorMessage,
    });
  }

  static async logSecurityEvent(params: {
    action: string;
    details: any;
    req: Request;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.log({
      action: params.action,
      entity: "security",
      details: params.details,
      success: params.success,
      errorMessage: params.errorMessage,
      req: params.req,
    });
  }

  // Enhanced logging methods for better audit coverage
  static async logError(params: {
    action: string;
    entity: string;
    entityId?: string;
    error: Error;
    req?: Request;
    userId?: string;
  }): Promise<void> {
    await this.log({
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      success: false,
      errorMessage: params.error.message,
      details: {
        stack: params.error.stack,
        name: params.error.name,
      },
      req: params.req,
      userId: params.userId,
    });
  }

  static async logWarning(params: {
    action: string;
    entity: string;
    entityId?: string;
    message: string;
    details?: any;
    req?: Request;
    userId?: string;
  }): Promise<void> {
    await this.log({
      action: `WARNING_${params.action}`,
      entity: params.entity,
      entityId: params.entityId,
      success: true,
      details: {
        warning: params.message,
        ...params.details,
      },
      req: params.req,
      userId: params.userId,
    });
  }

  static async logAccess(params: {
    entity: string;
    entityId?: string;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "ACCESS",
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      req: params.req,
    });
  }

  static async logUnauthorizedAccess(params: {
    entity: string;
    entityId?: string;
    reason: string;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: "UNAUTHORIZED_ACCESS",
      entity: params.entity,
      entityId: params.entityId,
      success: false,
      errorMessage: params.reason,
      details: {
        attemptedResource: params.entity,
        reason: params.reason,
      },
      req: params.req,
    });
  }

  static async logBulkOperation(params: {
    action: string;
    entity: string;
    count: number;
    details?: any;
    req: Request;
  }): Promise<void> {
    await this.log({
      action: `BULK_${params.action}`,
      entity: params.entity,
      details: {
        count: params.count,
        ...params.details,
      },
      req: params.req,
    });
  }
}