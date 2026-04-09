import { Elysia } from "elysia";
import { verifyToken, findUserById } from "../services/auth.service";
import { User } from "../db/schemas";

console.log("[Auth] Module loading...");

export interface AuthContext {
  user: User | null;
  userId: string | null;
}

// Use onRequest + store to pass user to route handlers
export const authMiddleware = new Elysia()
  .state("auth.user", null as User | null)
  .state("auth.userId", null as string | null)
  .onRequest(async ({ cookie, request, store }) => {
    let token: string | null = null;
    
    // Try cookie first
    const cookieObj = cookie as Record<string, { value?: string } | undefined>;
    if (cookieObj?.access_token?.value) {
      token = cookieObj.access_token.value;
    }
    
    // Try Authorization header as fallback
    if (!token && request) {
      const headersObj = request.headers;
      const authHeader = headersObj.get("authorization") || headersObj.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }
    
    if (!token) {
      return;
    }
    
    const payload = await verifyToken(token);
    
    if (!payload || !payload.userId) {
      return;
    }
    
    const user = await findUserById(payload.userId);
    
    (store as any).authUser = user;
    (store as any).authUserId = user?._id?.toString() || null;
  });

// Helper to get user from store in route handlers
export function getAuthUser(ctx: { store: any }): { user: User | null; userId: string | null } {
  return {
    user: ctx.store.authUser || null,
    userId: ctx.store.authUserId || null,
  };
}

console.log("[Auth] Module loaded");
