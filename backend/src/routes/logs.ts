import { Elysia, t } from "elysia";
import { createLog, getLogsBySessionId, getLogCount } from "../services/log.service";
import { getSessionById } from "../services/session.service";
export const logRoutes = new Elysia({ prefix: "/api/logs" })
  // Create log entry
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      const data = body as {
        sessionId: string;
        source?: "backend" | "frontend" | "pm2";
        level?: "debug" | "info" | "warn" | "error";
        message: string;
        metadata?: Record<string, unknown>;
      };
      
      try {
        const log = await createLog({
          sessionId: data.sessionId,
          source: data.source || "frontend",
          level: data.level || "info",
          message: data.message,
          metadata: data.metadata,
        });
        
        return { ...log, _id: log._id!.toString() };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create log",
        };
      }
    },
    {
      body: t.Object({
        sessionId: t.String(),
        source: t.Optional(t.Union([
          t.Literal("backend"),
          t.Literal("frontend"),
          t.Literal("pm2"),
        ])),
        level: t.Optional(t.Union([
          t.Literal("debug"),
          t.Literal("info"),
          t.Literal("warn"),
          t.Literal("error"),
        ])),
        message: t.String(),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }
  );
