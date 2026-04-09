import { ObjectId } from "mongodb";

// User permissions schema
export interface UserPermissions {
  canCreateSession: boolean;
  canDeleteSession: boolean;
  canManageUsers: boolean;
  allowedSessions: string[];
  assignedSessions: string[];
}

// User schema
export interface User {
  _id?: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  permissions: UserPermissions;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Bookmark schema
export interface Bookmark {
  _id?: ObjectId;
  title: string;
  url: string;
}

// Session status
export type SessionStatus = "online" | "idle" | "offline" | "error";

// Session schema
export interface Session {
  _id?: ObjectId;
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

// Message role
export type MessageRole = "user" | "assistant" | "system";

// Attachment schema
export interface Attachment {
  type: "image" | "file";
  url: string;
  name: string;
}

// Message schema
export interface Message {
  _id?: ObjectId;
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  attachments: Attachment[];
  createdAt: Date;
}

// Log source
export type LogSource = "backend" | "frontend" | "pm2";

// Log level
export type LogLevel = "debug" | "info" | "warn" | "error";

// Log entry schema
export interface LogEntry {
  _id?: ObjectId;
  sessionId: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Default permissions factory
export function createDefaultPermissions(): UserPermissions {
  return {
    canCreateSession: true,
    canDeleteSession: true,
    canManageUsers: false,
    allowedSessions: [],
    assignedSessions: [],
  };
}

// Admin permissions factory
export function createAdminPermissions(): UserPermissions {
  return {
    canCreateSession: true,
    canDeleteSession: true,
    canManageUsers: true,
    allowedSessions: [],
    assignedSessions: [],
  };
}
