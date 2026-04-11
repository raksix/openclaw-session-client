import { Elysia, t } from "elysia";
import { exec } from "child_process";
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
import { gatewayService } from "../services/gateway-paired";

export const sessionRoutes = new Elysia({ prefix: "/api/sessions" })
  // Get all accessible sessions
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    // MongoDB'den sessionları getir
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

      const { name, agentId, channel, channelPeer, channelContext } = body as {
        name: string;
        agentId?: string;
        channel?: string;
        channelPeer?: string;
        channelContext?: string;
      };

      let sessionKey: string | null = null;

      // Try to create session in OpenClaw gateway if params provided
      if (agentId && channel && channelPeer && channelContext) {
        try {
          await gatewayService.ensureAuthenticated();
          sessionKey = await gatewayService.createSession({
            agentId,
            channel,
            channelPeer,
            channelContext,
          });
          console.log("[Gateway] Created session:", sessionKey);
        } catch (err) {
          console.error("[Gateway] Failed to create session:", err);
          // Continue without gateway session - will be local only
        }
      }

      try {
        const session = await createSession({
          name,
          ownerId: user._id!.toString(),
        });

        // Update with gateway sessionKey if available
        if (sessionKey) {
          await updateSession(session._id!.toString(), {
            metadata: { sessionKey, agentId, channel, channelPeer, channelContext },
          });
          session.metadata = { sessionKey, agentId, channel, channelPeer, channelContext };
        }

        // Log session creation
        await createLog({
          sessionId: session._id!.toString(),
          source: "backend",
          level: "info",
          message: `Session created by ${user.username}${sessionKey ? " (gateway)" : ""}`,
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
        agentId: t.Optional(t.String()),
        channel: t.Optional(t.String()),
        channelPeer: t.Optional(t.String()),
        channelContext: t.Optional(t.String()),
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

      const { content, attachments } = body as { content: string; attachments?: string[] };

      try {
        // Get the MongoDB session to find the OpenClaw sessionKey
        const session = await getSessionById(params.id);

        if (!session) {
          set.status = 404;
          return { success: false, error: "Session not found" };
        }

        // Save user's message
        const message = await createMessage({
          sessionId: params.id,
          userId: user._id!.toString(),
          role: "user",
          content,
          attachments: attachments || [],
        });

        // Log message
        await createLog({
          sessionId: params.id,
          source: "backend",
          level: "info",
          message: `Message from ${user.username}`,
        });

        // Send via openclaw agent (exec fallback)
        try {
          const sessionArg = session.metadata?.sessionKey ? `--session-id ${session.metadata.sessionKey}` : "";
          const safeContent = content.replace(/"/g, '\\"');
          const cmd = `openclaw agent --agent ${session.metadata?.agentId || "main"} --message "${safeContent}" --json ${sessionArg}`.trim();
          
          console.log("[Sessions] Running:", cmd);
          
          const result = await new Promise<{stdout: string, stderr: string, error: any}>((resolve) => {
            exec(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
              resolve({ stdout, stderr, error });
            });
          });

          if (result.error) {
            console.error("[Sessions] exec error:", result.error.message);
            throw new Error(result.error.message);
          }

          // Parse JSON response
          const jsonMatch = result.stdout.match(/\{[\s\S]*"status"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const responseText = parsed.result?.payloads?.[0]?.text || parsed.result?.text || "No response";
            
            const assistantMessage = await createMessage({
              sessionId: params.id,
              userId: "assistant",
              role: "assistant",
              content: responseText,
            });

            await createLog({
              sessionId: params.id,
              source: "agent",
              level: "info",
              message: `Agent response received`,
            });

            return { ...assistantMessage, _id: assistantMessage._id!.toString() };
          } else {
            throw new Error("Invalid response format");
          }
        } catch (execErr) {
          console.error("[Sessions] exec failed:", execErr);
          const echoContent = `[Exec Error] ${execErr instanceof Error ? execErr.message : "Execution failed"}`;
          const assistantMessage = await createMessage({
            sessionId: params.id,
            userId: "assistant",
            role: "assistant",
            content: echoContent,
          });
          return { ...assistantMessage, _id: assistantMessage._id!.toString() };
        }

        const assistantMessage = await createMessage({
          sessionId: params.id,
          userId: "assistant",
          role: "assistant",
          content: echoContent,
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
        attachments: t.Optional(t.Array(t.String())),
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
  })

  // List OpenClaw gateway sessions (admin only)
  .get(
    "/gateway/list",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }

      if (user.role !== "admin") {
        set.status = 403;
        return { success: false, error: "Admin access required" };
      }

      try {
        await gatewayService.ensureAuthenticated();
        const sessions = await gatewayService.listSessions();
        return { success: true, sessions };
      } catch (err) {
        console.error("[Gateway] Failed to list sessions:", err);
        set.status = 500;
        return {
          success: false,
          error: err instanceof Error ? err.message : "Gateway error",
        };
      }
    }
  )

  // Send message via gateway to a specific OpenClaw session
  .post(
    "/gateway/send",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }

      const { sessionKey, content } = body as { sessionKey: string; content: string };

      if (!sessionKey || !content) {
        set.status = 400;
        return { success: false, error: "sessionKey and content required" };
      }

      try {
        await gatewayService.ensureAuthenticated();
        const response = await gatewayService.sendMessage(sessionKey, content);
        return { success: true, response };
      } catch (err) {
        console.error("[Gateway] Failed to send message:", err);
        set.status = 500;
        return {
          success: false,
          error: err instanceof Error ? err.message : "Gateway error",
        };
      }
    },
    {
      body: t.Object({
        sessionKey: t.String(),
        content: t.String({ minLength: 1 }),
      }),
    }
  )

  // Create a new OpenClaw gateway session
  .post(
    "/gateway/create",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }

      const { agentId, channel, channelPeer, channelContext } = body as {
        agentId: string;
        channel: string;
        channelPeer: string;
        channelContext: string;
      };

      if (!agentId || !channel || !channelPeer || !channelContext) {
        set.status = 400;
        return {
          success: false,
          error: "agentId, channel, channelPeer, channelContext required",
        };
      }

      try {
        await gatewayService.ensureAuthenticated();
        const sessionKey = await gatewayService.createSession({
          agentId,
          channel,
          channelPeer,
          channelContext,
        });
        return { success: true, sessionKey };
      } catch (err) {
        console.error("[Gateway] Failed to create session:", err);
        set.status = 500;
        return {
          success: false,
          error: err instanceof Error ? err.message : "Gateway error",
        };
      }
    },
    {
      body: t.Object({
        agentId: t.String(),
        channel: t.String(),
        channelPeer: t.String(),
        channelContext: t.String(),
      }),
    }
  );
