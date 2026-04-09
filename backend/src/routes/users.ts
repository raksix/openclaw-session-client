import { Elysia, t } from "elysia";
import {
  createUser,
  getAllUsers,
  findUserById,
  updateUser,
  deleteUser,
} from "../services/auth.service";
import {
  getAllSessions,
  assignSessionToUser,
  unassignSessionFromUser,
} from "../services/session.service";
import { ObjectId } from "mongodb";

export const userRoutes = new Elysia({ prefix: "/api/users" })
  // Get all users (admin only)
  .get("/", async ({ user, set }) => {
    if (!user || user.role !== "admin") {
      set.status = 403;
      return { success: false, error: "Admin access required" };
    }
    
    const users = await getAllUsers();
    
    return users.map((u) => {
      const { passwordHash, ...userWithoutPassword } = u;
      return { ...userWithoutPassword, _id: u._id!.toString() };
    });
  })
  
  // Create new user (admin only)
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return { success: false, error: "Admin access required" };
      }
      
      const data = body as {
        username: string;
        email: string;
        password: string;
        role?: "admin" | "user";
        permissions?: {
          canCreateSession?: boolean;
          canDeleteSession?: boolean;
          canManageUsers?: boolean;
          assignedSessions?: string[];
        };
      };
      
      try {
        const newUser = await createUser({
          username: data.username,
          email: data.email,
          password: data.password,
          role: data.role || "user",
          permissions: data.permissions,
        });
        
        const { passwordHash, ...userWithoutPassword } = newUser;
        
        return {
          success: true,
          user: { ...userWithoutPassword, _id: newUser._id!.toString() },
        };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create user",
        };
      }
    },
    {
      body: t.Object({
        username: t.String(),
        email: t.String(),
        password: t.String({ minLength: 8 }),
        role: t.Optional(t.Union([t.Literal("admin"), t.Literal("user")])),
        permissions: t.Optional(t.Object({
          canCreateSession: t.Optional(t.Boolean()),
          canDeleteSession: t.Optional(t.Boolean()),
          canManageUsers: t.Optional(t.Boolean()),
          assignedSessions: t.Optional(t.Array(t.String())),
        })),
      }),
    }
  )
  
  // Get user by ID
  .get("/:id", async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    // Users can only view their own profile unless admin
    if (user.role !== "admin" && user._id?.toString() !== params.id) {
      set.status = 403;
      return { success: false, error: "Access denied" };
    }
    
    const foundUser = await findUserById(params.id);
    
    if (!foundUser) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }
    
    const { passwordHash, ...userWithoutPassword } = foundUser;
    
    return { ...userWithoutPassword, _id: foundUser._id!.toString() };
  })
  
  // Update user
  .put(
    "/:id",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Not authenticated" };
      }
      
      // Users can only update their own profile unless admin
      if (user.role !== "admin" && user._id?.toString() !== params.id) {
        set.status = 403;
        return { success: false, error: "Access denied" };
      }
      
      const data = body as {
        username?: string;
        email?: string;
        password?: string;
        role?: "admin" | "user";
        permissions?: {
          canCreateSession?: boolean;
          canDeleteSession?: boolean;
          canManageUsers?: boolean;
          assignedSessions?: string[];
        };
      };
      
      const updates: Record<string, unknown> = {};
      
      if (data.username) updates.username = data.username;
      if (data.email) updates.email = data.email;
      if (data.role && user.role === "admin") updates.role = data.role;
      
      if (data.permissions) {
        // Only admin can update permissions
        if (user.role === "admin") {
          if (data.permissions.canCreateSession !== undefined) {
            updates["permissions.canCreateSession"] = data.permissions.canCreateSession;
          }
          if (data.permissions.canDeleteSession !== undefined) {
            updates["permissions.canDeleteSession"] = data.permissions.canDeleteSession;
          }
          if (data.permissions.canManageUsers !== undefined) {
            updates["permissions.canManageUsers"] = data.permissions.canManageUsers;
          }
          if (data.permissions.assignedSessions !== undefined) {
            updates["permissions.assignedSessions"] = data.permissions.assignedSessions;
          }
        }
      }
      
      try {
        const updatedUser = await updateUser(params.id, updates);
        
        if (!updatedUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }
        
        const { passwordHash, ...userWithoutPassword } = updatedUser;
        
        return {
          success: true,
          user: { ...userWithoutPassword, _id: updatedUser._id!.toString() },
        };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update user",
        };
      }
    },
    {
      body: t.Object({
        username: t.Optional(t.String()),
        email: t.Optional(t.String()),
        password: t.Optional(t.String()),
        role: t.Optional(t.Union([t.Literal("admin"), t.Literal("user")])),
        permissions: t.Optional(t.Object({
          canCreateSession: t.Optional(t.Boolean()),
          canDeleteSession: t.Optional(t.Boolean()),
          canManageUsers: t.Optional(t.Boolean()),
          assignedSessions: t.Optional(t.Array(t.String())),
        })),
      }),
    }
  )
  
  // Delete user
  .delete("/:id", async ({ params, user, set }) => {
    if (!user || user.role !== "admin") {
      set.status = 403;
      return { success: false, error: "Admin access required" };
    }
    
    // Prevent deleting yourself
    if (user._id?.toString() === params.id) {
      set.status = 400;
      return { success: false, error: "Cannot delete yourself" };
    }
    
    const success = await deleteUser(params.id);
    
    if (!success) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }
    
    return { success: true, message: "User deleted successfully" };
  })
  
  // Assign sessions to user
  .post(
    "/:id/sessions",
    async ({ params, body, user, set }) => {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return { success: false, error: "Admin access required" };
      }
      
      const { sessionIds } = body as { sessionIds: string[] };
      
      try {
        for (const sessionId of sessionIds) {
          await assignSessionToUser(sessionId, params.id);
        }
        
        return { success: true, message: "Sessions assigned successfully" };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to assign sessions",
        };
      }
    },
    {
      body: t.Object({
        sessionIds: t.Array(t.String()),
      }),
    }
  )
  
  // Remove session from user
  .delete(
    "/:id/sessions/:sessionId",
    async ({ params, user, set }) => {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return { success: false, error: "Admin access required" };
      }
      
      const success = await unassignSessionFromUser(params.sessionId, params.id);
      
      if (!success) {
        set.status = 404;
        return { success: false, error: "Assignment not found" };
      }
      
      return { success: true, message: "Session unassigned successfully" };
    }
  );
