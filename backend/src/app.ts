import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { cookie } from "@elysiajs/cookie";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { sessionRoutes } from "./routes/sessions";
import { logRoutes } from "./routes/logs";
import { chatRoutes } from "./routes/chat";
import { wsRoutes } from "./routes/websocket";
import { verifyToken, findUserById } from "./services/auth.service";

console.log("[App] Creating Elysia app...");

// Auth derive function - SIMPLIFIED FOR TESTING
const authDerive = async (ctx: { cookie?: any; request?: Request }) => {
  console.log("[Auth derive] called!");
  
  let token: string | null = null;
  
  // Try cookie first
  const cookieObj = ctx.cookie as any;
  if (cookieObj?.access_token?.value) {
    token = cookieObj.access_token.value;
    console.log("[Auth derive] Token from cookie:", token?.substring(0, 30));
  }
  
  // Try Authorization header
  if (!token && ctx.request) {
    const authHeader = ctx.request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
      console.log("[Auth derive] Token from header");
    }
  }
  
  if (!token) {
    console.log("[Auth derive] No token");
    return { user: null, userId: null };
  }
  
  const payload = await verifyToken(token);
  
  if (!payload || !payload.userId) {
    console.log("[Auth derive] Invalid payload");
    return { user: null, userId: null };
  }
  
  const user = await findUserById(payload.userId);
  console.log("[Auth derive] User:", user?.username);
  
  return { 
    user, 
    userId: user?._id?.toString() || null 
  };
};

export function createApp() {
  return new Elysia()
    .use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }))
    .use(cookie())
    .derive(authDerive) // Auth derive FIRST
    .use(swagger({
      documentation: {
        info: {
          title: "OpenClaw Session Manager API",
          description: "API documentation for the OpenClaw Session Manager",
          version: "0.1.0",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Users", description: "User management endpoints" },
          { name: "Sessions", description: "Session management endpoints" },
          { name: "Logs", description: "Log management endpoints" },
        ],
      },
    }))
    .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
    .use(authRoutes)
    .use(userRoutes)
    .use(sessionRoutes)
    .use(logRoutes)
    .use(chatRoutes)
    .use(wsRoutes)
    .onError(({ code, error, set }) => {
      console.error(`[ERROR] ${code}:`, error);
      
      switch (code) {
        case "NOT_FOUND":
          set.status = 404;
          return { success: false, error: "Resource not found" };
        case "VALIDATION":
          set.status = 400;
          return { success: false, error: "Invalid request data" };
        case "INTERNAL_SERVER_ERROR":
          set.status = 500;
          return { success: false, error: "Internal server error" };
        default:
          set.status = 500;
          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    });
}
