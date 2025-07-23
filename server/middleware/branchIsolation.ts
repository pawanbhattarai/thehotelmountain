import type { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    branchId: number | null;
  };
}

// Middleware to enforce branch data isolation
export function enforceBranchIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { role, branchId } = req.user;

  // Super admins can access all data
  if (role === "superadmin") {
    return next();
  }

  // For non-superadmin users, ensure they have a branch assignment
  if (!branchId) {
    return res.status(403).json({ message: "Access denied: No branch assignment" });
  }

  // Add branch filter to query parameters for GET requests
  if (req.method === "GET") {
    req.query.branchId = branchId.toString();
  }

  // For POST/PUT requests, ensure branchId is set in the body
  if (req.method === "POST" || req.method === "PUT") {
    if (req.body && typeof req.body === "object") {
      req.body.branchId = branchId;
    }
  }

  next();
}

// Helper function to get branch filter for database queries
export function getBranchFilter(user: { role: string; branchId: number | null }) {
  if (user.role === "superadmin") {
    return {}; // No filter for superadmins
  }
  
  if (!user.branchId) {
    throw new Error("User has no branch assignment");
  }
  
  return { branchId: user.branchId };
}

// Check if user can access specific branch data
export function canAccessBranch(user: { role: string; branchId: number | null }, targetBranchId: number): boolean {
  if (user.role === "superadmin") {
    return true;
  }
  
  return user.branchId === targetBranchId;
}