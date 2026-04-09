import { getDb, COLLECTIONS } from "../db/mongodb";
import { LogEntry, LogSource, LogLevel } from "../db/schemas";
import { ObjectId } from "mongodb";

export interface CreateLogData {
  sessionId: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function createLog(data: CreateLogData): Promise<LogEntry> {
  const db = getDb();
  const now = new Date();
  
  const log: LogEntry = {
    sessionId: data.sessionId,
    source: data.source,
    level: data.level,
    message: data.message,
    metadata: data.metadata,
    createdAt: now,
  };
  
  const result = await db.collection(COLLECTIONS.LOGS).insertOne(log);
  
  return { ...log, _id: result.insertedId };
}

export async function getLogById(logId: string): Promise<LogEntry | null> {
  const db = getDb();
  
  try {
    const log = await db.collection(COLLECTIONS.LOGS).findOne({
      _id: new ObjectId(logId),
    });
    return log;
  } catch {
    return null;
  }
}

export async function getLogsBySessionId(
  sessionId: string,
  limit = 100,
  offset = 0,
  level?: LogLevel,
  source?: LogSource
): Promise<LogEntry[]> {
  const db = getDb();
  
  const query: Record<string, unknown> = { sessionId };
  
  if (level) {
    query.level = level;
  }
  
  if (source) {
    query.source = source;
  }
  
  return db.collection(COLLECTIONS.LOGS)
    .find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
}

export async function getLogCount(
  sessionId: string,
  level?: LogLevel,
  source?: LogSource
): Promise<number> {
  const db = getDb();
  
  const query: Record<string, unknown> = { sessionId };
  
  if (level) {
    query.level = level;
  }
  
  if (source) {
    query.source = source;
  }
  
  return db.collection(COLLECTIONS.LOGS).countDocuments(query);
}

export async function deleteLog(logId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.LOGS).deleteOne({
    _id: new ObjectId(logId),
  });
  
  return result.deletedCount > 0;
}

export async function deleteLogsBySessionId(sessionId: string): Promise<number> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.LOGS).deleteMany({ sessionId });
  
  return result.deletedCount;
}

export async function clearOldLogs(sessionId: string, keepCount = 1000): Promise<number> {
  const db = getDb();
  
  // Get the IDs of logs to keep
  const logsToKeep = await db.collection(COLLECTIONS.LOGS)
    .find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(keepCount)
    .project({ _id: 1 })
    .toArray();
  
  const idsToKeep = logsToKeep.map(log => log._id);
  
  // Delete all other logs for this session
  const result = await db.collection(COLLECTIONS.LOGS).deleteMany({
    sessionId,
    _id: { $nin: idsToKeep },
  });
  
  return result.deletedCount;
}

// Helper to log with different levels
export async function logInfo(sessionId: string, message: string, metadata?: Record<string, unknown>): Promise<LogEntry> {
  return createLog({ sessionId, source: "backend", level: "info", message, metadata });
}

export async function logWarn(sessionId: string, message: string, metadata?: Record<string, unknown>): Promise<LogEntry> {
  return createLog({ sessionId, source: "backend", level: "warn", message, metadata });
}

export async function logError(sessionId: string, message: string, metadata?: Record<string, unknown>): Promise<LogEntry> {
  return createLog({ sessionId, source: "backend", level: "error", message, metadata });
}

export async function logDebug(sessionId: string, message: string, metadata?: Record<string, unknown>): Promise<LogEntry> {
  return createLog({ sessionId, source: "backend", level: "debug", message, metadata });
}
