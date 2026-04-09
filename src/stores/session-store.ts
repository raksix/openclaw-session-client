import { create } from "zustand";
import type { Session, Message, LogEntry } from "@/types";

interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  messages: Record<string, Message[]>; // sessionId -> messages
  logs: Record<string, LogEntry[]>; // sessionId -> logs
  isLoading: boolean;
  error: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (session: Session | null) => void;

  // Messages
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;

  // Logs
  setLogs: (sessionId: string, logs: LogEntry[]) => void;
  addLog: (sessionId: string, log: LogEntry) => void;
  clearLogs: (sessionId: string) => void;

  // Status
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  messages: {},
  logs: {},
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
    })),

  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s._id === sessionId ? { ...s, ...updates } : s
      ),
      activeSession:
        state.activeSession?._id === sessionId
          ? { ...state.activeSession, ...updates }
          : state.activeSession,
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s._id !== sessionId),
      activeSession:
        state.activeSession?._id === sessionId ? null : state.activeSession,
    })),

  setActiveSession: (session) => set({ activeSession: session }),

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
    })),

  addMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message],
      },
    })),

  setLogs: (sessionId, logs) =>
    set((state) => ({
      logs: { ...state.logs, [sessionId]: logs },
    })),

  addLog: (sessionId, log) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [sessionId]: [...(state.logs[sessionId] || []), log],
      },
    })),

  clearLogs: (sessionId) =>
    set((state) => ({
      logs: { ...state.logs, [sessionId]: [] },
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
