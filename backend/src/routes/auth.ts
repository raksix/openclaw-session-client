import { Elysia, t } from "elysia";
import {
  findUserByUsername,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  updateLastLogin,
} from "../services/auth.service";
export const authRoutes = new Elysia({ prefix: "/api/auth" })
  // Login
  .post(
    "/login",
    async ({ body, cookie, set }) => {
      const { username, password } = body as { username: string; password: string };
      
      const user = await findUserByUsername(username);
      
      if (!user) {
        set.status = 401;
        return { success: false, error: "Invalid credentials" };
      }
      
      const isValid = await verifyPassword(password, user.passwordHash);
      
      if (!isValid) {
        set.status = 401;
        return { success: false, error: "Invalid credentials" };
      }
      
      const accessToken = await createAccessToken(user._id!.toString(), user.role);
      const refreshToken = await createRefreshToken(user._id!.toString());
      
      // Update last login
      await updateLastLogin(user._id!.toString());
      
      // Set cookies
      cookie.access_token.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });
      
      cookie.refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: "/",
      });
      
      // Return user without password
      const { passwordHash, ...userWithoutPassword } = user;
      
      return {
        success: true,
        user: { ...userWithoutPassword, _id: user._id!.toString() },
        accessToken,
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    }
  )
  
  // Logout
  .post("/logout", async ({ cookie, set }) => {
    cookie.access_token.set({
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    
    cookie.refresh_token.set({
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    
    return { success: true, message: "Logged out successfully" };
  })
  
  // Get current user
  .get("/me", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Not authenticated" };
    }
    
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      success: true,
      user: { ...userWithoutPassword, _id: user._id!.toString() },
    };
  })
  
  // Refresh token
  .post("/refresh", async ({ cookie, set }) => {
    const refreshToken = cookie.refresh_token?.value;
    
    if (!refreshToken) {
      set.status = 401;
      return { success: false, error: "No refresh token" };
    }
    
    // For simplicity, just recreate tokens
    // In production, you'd verify the refresh token and check if it's blacklisted
    const { verifyToken, findUserById } = await import("../services/auth.service");
    
    const payload = await verifyToken(refreshToken);
    
    if (!payload || !payload.userId) {
      set.status = 401;
      return { success: false, error: "Invalid refresh token" };
    }
    
    const user = await findUserById(payload.userId);
    
    if (!user) {
      set.status = 401;
      return { success: false, error: "User not found" };
    }
    
    const newAccessToken = await createAccessToken(user._id!.toString(), user.role);
    const newRefreshToken = await createRefreshToken(user._id!.toString());
    
    cookie.access_token.set({
      value: newAccessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });
    
    cookie.refresh_token.set({
      value: newRefreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    
    return { success: true };
  });
