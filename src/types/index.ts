// User types
export type UserRole = "admin" | "user";

export interface UserPermissions {
  canCreateSession: boolean;
  canDeleteSession: boolean;
  canManageUsers: boolean;
  allowedSessions: string[];
  assignedSessions: string[];
}

export interface User {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Session types
export type SessionStatus = "online" | "idle" | "offline" | "error";

export interface Bookmark {
  _id: string;
  title: string;
  url: string;
}

export interface Session {
  _id: string;
  name: string;
  sessionKey: string;
  ownerId: string;
  status: SessionStatus;
  metadata: {
    agentType?: string;
    lastCommand?: string;
  };
  bookmarks: Bookmark[];
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

// Message types
export type MessageRole = "user" | "assistant" | "system";

export interface Attachment {
  type: "image" | "file";
  url: string;
  name: string;
}

export interface Message {
  _id: string;
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  attachments: Attachment[];
  createdAt: Date;
}

// Log types
export type LogSource = "backend" | "frontend" | "pm2";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  _id: string;
  sessionId: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  permissions?: Partial<UserPermissions>;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: UserRole;
  permissions?: Partial<UserPermissions>;
}

// WebSocket message types
export interface WSMessage {
  type: "message" | "status" | "log" | "error";
  payload: unknown;
}

export interface ChatWSMessage {
  type: "chat";
  sessionId: string;
  content: string;
  role: MessageRole;
}

export interface StatusWSMessage {
  type: "status";
  sessionId: string;
  status: SessionStatus;
}

export interface LogWSMessage {
  type: "log";
  sessionId: string;
  entry: LogEntry;
}
