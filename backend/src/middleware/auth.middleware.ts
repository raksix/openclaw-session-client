import { Elysia, t } from "elysia";
import { verifyToken, findUserById } from "../services/auth.service";
import { getSessionsForUser } from "../services/session.service";
import { User } from "../db/schemas";

declare global {
  namespace Elysia {
    interface DeriveContext {
      user: User | null;
      userId: string | null;
    }
  }
}

export const authMiddleware = new Elysia()
  .derive(async ({ cookie }) => {
    const token = cookie?.access_token?.value;
    
    if (!token) {
      return { user: null, userId: null };
    }
    
    const payload = await verifyToken(token);
    
    if (!payload || !payload.userId) {
      return { user: null, userId: null };
    }
    
    const user = await findUserById(payload.userId);
    
    return { user, userId: user?._id?.toString() || null };
  });

// Admin-only middleware
export const adminMiddleware = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }
    return {};
  });

// Optional auth - doesn't fail if no token
export const optionalAuthMiddleware = new Elysia()
  .derive(async ({ cookie }) => {
    const token = cookie?.access_token?.value;
    
    if (!token) {
      return { user: null, userId: null };
    }
    
    const payload = await verifyToken(token);
    
    if (!payload || !payload.userId) {
      return { user: null, userId: null };
    }
    
    const user = await findUserById(payload.userId);
    
    return { user, userId: user?._id?.toString() || null };
  });
