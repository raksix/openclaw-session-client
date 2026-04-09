import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { cookie } from "@elysiajs/cookie";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { sessionRoutes } from "./routes/sessions";
import { logRoutes } from "./routes/logs";

export function createApp() {
  return new Elysia()
    .use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }))
    .use(cookie())
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
