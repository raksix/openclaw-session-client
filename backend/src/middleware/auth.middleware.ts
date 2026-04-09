import { Elysia, t } from "elysia";
import { verifyToken, findUserById } from "../services/auth.service";
import { User } from "../db/schemas";

// Context type
export interface AuthContext {
  user: User | null;
  userId: string | null;
}

export const authMiddleware = new Elysia()
  .derive(async ({ cookie }): Promise<AuthContext> => {
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

// Admin-only middleware - just returns, actual check done in routes
export const adminMiddleware = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    return { isAdmin: user?.role === "admin" };
  });

// Optional auth - doesn't fail if no token
export const optionalAuthMiddleware = new Elysia()
  .derive(async ({ cookie }): Promise<AuthContext> => {
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
