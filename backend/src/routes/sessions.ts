import { Elysia, t } from "elysia";
import {
  createSession,
  getSessionById,
  getSessionsForUser,
  getAllSessions,
  updateSession,
  deleteSession,
  addBookmark,
  removeBookmark,
} from "../services/session.service";
import {
  getMessagesBySessionId,
  createMessage,
  deleteMessage,
} from "../services/message.service";
import { getLogsBySessionId, createLog, deleteLogsBySessionId } from "../services/log.service";
import { authMiddleware } from "../middleware/auth.middleware";

export const sessionRoutes = new Elysia({ prefix: "/api/sessions" })
  .use(authMiddleware)
  
  // Get all accessible sessions
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const sessions = await getSessionsForUser(user._id!.toString());
    
    return sessions.map((s) => ({ ...s, _id: s._id!.toString() }));
  })
  
  // Create new session
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      // Check permission
      if (!user.permissions.canCreateSession) {
        set.status = 403;
        return { success: false, error: "Permission denied" };
      }
      
      const { name } = body as { name: string };
      
      try {
        const session = await createSession({
          name,
          ownerId: user._id!.toString(),
        });
        
        // Log session creation
        await createLog({
          sessionId: session._id!.toString(),
          source: "backend",
          level: "info",
          message: `Session created by ${user.username}`,
        });
        
        return { ...session, _id: session._id!.toString() };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create session",
        };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    }
  )
  
  // Get session by ID
  .get("/:id", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const session = await getSessionById(params.id);
    
    if (!session) {
      set.status = 404;
      return { success: false, error: "Session not found" };
    }
    
    // Check access
    const sessions = await getSessionsForUser(user._id!.toString());
    const hasAccess = sessions.some((s) => s._id?.toString() === params.id);
    
    if (!hasAccess && user.role !== "admin") {
      set.status = 403;
      return { success: false, error: "Access denied" };
    }
    
    return { ...session, _id: session._id!.toString() };
  })
  
  // Update session
  .put(
    "/:id",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      const session = await getSessionById(params.id);
      
      if (!session) {
        set.status = 404;
        return { success: false, error: "Session not found" };
      }
      
      // Check ownership or admin
      if (session.ownerId !== user._id?.toString() && user.role !== "admin") {
        set.status = 403;
        return { success: false, error: "Access denied" };
      }
      
      const data = body as {
        name?: string;
        status?: "online" | "idle" | "offline" | "error";
      };
      
      try {
        const updatedSession = await updateSession(params.id, data);
        
        if (!updatedSession) {
          set.status = 404;
          return { success: false, error: "Session not found" };
        }
        
        return { ...updatedSession, _id: updatedSession._id!.toString() };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update session",
        };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        status: t.Optional(t.Union([
          t.Literal("online"),
          t.Literal("idle"),
          t.Literal("offline"),
          t.Literal("error"),
        ])),
      }),
    }
  )
  
  // Delete session
  .delete("/:id", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const session = await getSessionById(params.id);
    
    if (!session) {
      set.status = 404;
      return { success: false, error: "Session not found" };
    }
    
    // Check ownership or admin, and permission
    const isOwner = session.ownerId === user._id?.toString();
    const isAdmin = user.role === "admin";
    const canDelete = user.permissions.canDeleteSession || isAdmin;
    
    if (!isOwner && !isAdmin) {
      set.status = 403;
      return { success: false, error: "Access denied" };
    }
    
    if (!canDelete && !isOwner) {
      set.status = 403;
      return { success: false, error: "Permission denied" };
    }
    
    const success = await deleteSession(params.id);
    
    if (!success) {
      set.status = 404;
      return { success: false, error: "Session not found" };
    }
    
    return { success: true, message: "Session deleted successfully" };
  })
  
  // Get session messages
  .get("/:id/messages", async ({ params, query, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const limit = parseInt(query.limit as string) || 50;
    const before = query.before as string | undefined;
    
    const messages = await getMessagesBySessionId(params.id, limit, before);
    
    return messages.map((m) => ({ ...m, _id: m._id!.toString() }));
  })
  
  // Send message
  .post(
    "/:id/messages",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      const { content } = body as { content: string };
      
      try {
        const message = await createMessage({
          sessionId: params.id,
          userId: user._id!.toString(),
          role: "user",
          content,
        });
        
        // Log message
        await createLog({
          sessionId: params.id,
          source: "backend",
          level: "info",
          message: `Message from ${user.username}`,
        });
        
        // For now, return a mock assistant response
        // In production, this would communicate with OpenClaw
        const assistantMessage = await createMessage({
          sessionId: params.id,
          userId: "assistant",
          role: "assistant",
          content: `Echo: ${content}`,
        });
        
        return { ...assistantMessage, _id: assistantMessage._id!.toString() };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send message",
        };
      }
    },
    {
      body: t.Object({
        content: t.String({ minLength: 1 }),
      }),
    }
  )
  
  // Delete message
  .delete("/:id/messages/:messageId", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const success = await deleteMessage(params.messageId);
    
    if (!success) {
      set.status = 404;
      return { success: false, error: "Message not found" };
    }
    
    return { success: true, message: "Message deleted successfully" };
  })
  
  // Get session bookmarks
  .get("/:id/bookmarks", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const session = await getSessionById(params.id);
    
    if (!session) {
      set.status = 404;
      return { success: false, error: "Session not found" };
    }
    
    return session.bookmarks.map((b) => ({ ...b, _id: b._id!.toString() }));
  })
  
  // Add bookmark
  .post(
    "/:id/bookmarks",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      const { url, title } = body as { url: string; title?: string };
      
      try {
        const bookmark = await addBookmark(params.id, {
          url,
          title: title || url,
        });
        
        if (!bookmark) {
          set.status = 404;
          return { success: false, error: "Session not found" };
        }
        
        return { ...bookmark, _id: bookmark._id!.toString() };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add bookmark",
        };
      }
    },
    {
      body: t.Object({
        url: t.String(),
        title: t.Optional(t.String()),
      }),
    }
  )
  
  // Remove bookmark
  .delete("/:id/bookmarks/:bookmarkId", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const success = await removeBookmark(params.id, params.bookmarkId);
    
    if (!success) {
      set.status = 404;
      return { success: false, error: "Bookmark not found" };
    }
    
    return { success: true, message: "Bookmark removed successfully" };
  })
  
  // Get session logs
  .get("/:id/logs", async ({ params, query, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const limit = parseInt(query.limit as string) || 100;
    const level = query.level as "debug" | "info" | "warn" | "error" | undefined;
    const source = query.source as "backend" | "frontend" | "pm2" | undefined;
    
    const logs = await getLogsBySessionId(params.id, limit, 0, level, source);
    
    return logs.map((l) => ({ ...l, _id: l._id!.toString() }));
  });
