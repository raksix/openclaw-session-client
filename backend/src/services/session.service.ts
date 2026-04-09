import { getDb, COLLECTIONS } from "../db/mongodb";
import { Session, SessionStatus, Bookmark, createDefaultPermissions } from "../db/schemas";
import { ObjectId } from "mongodb";
import { findUserById } from "./auth.service";

function generateSessionKey(): string {
  return `sess_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
}

export interface CreateSessionData {
  name: string;
  ownerId: string;
}

export async function createSession(data: CreateSessionData): Promise<Session> {
  const db = getDb();
  const now = new Date();
  
  const session: Session = {
    name: data.name,
    sessionKey: generateSessionKey(),
    ownerId: data.ownerId,
    status: "online", // Default to online for demo
    metadata: {},
    bookmarks: [],
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };
  
  const result = await db.collection(COLLECTIONS.SESSIONS).insertOne(session);
  
  return { ...session, _id: result.insertedId };
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const db = getDb();
  
  try {
    const session = await db.collection(COLLECTIONS.SESSIONS).findOne({
      _id: new ObjectId(sessionId),
    });
    return session;
  } catch {
    return null;
  }
}

export async function getSessionByKey(sessionKey: string): Promise<Session | null> {
  const db = getDb();
  return db.collection(COLLECTIONS.SESSIONS).findOne({ sessionKey });
}

export async function getSessionsByOwnerId(ownerId: string): Promise<Session[]> {
  const db = getDb();
  return db.collection(COLLECTIONS.SESSIONS)
    .find({ ownerId })
    .sort({ lastActivityAt: -1 })
    .toArray();
}

export async function getSessionsForUser(userId: string): Promise<Session[]> {
  const db = getDb();
  
  const user = await findUserById(userId);
  if (!user) return [];
  
  // Admin users can see all sessions
  if (user.role === "admin" || user.permissions.allowedSessions.length === 0) {
    return db.collection(COLLECTIONS.SESSIONS)
      .find({})
      .sort({ lastActivityAt: -1 })
      .toArray();
  }
  
  // Regular users see only assigned sessions or their own
  const sessionIds = user.permissions.assignedSessions.map(id => {
    try {
      return new ObjectId(id);
    } catch {
      return null;
    }
  }).filter(Boolean);
  
  return db.collection(COLLECTIONS.SESSIONS)
    .find({
      $or: [
        { ownerId: userId },
        { _id: { $in: sessionIds } },
      ],
    })
    .sort({ lastActivityAt: -1 })
    .toArray();
}

export async function getAllSessions(): Promise<Session[]> {
  const db = getDb();
  return db.collection(COLLECTIONS.SESSIONS)
    .find({})
    .sort({ lastActivityAt: -1 })
    .toArray();
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Session>
): Promise<Session | null> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.SESSIONS).findOneAndUpdate(
    { _id: new ObjectId(sessionId) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  
  return result;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
): Promise<Session | null> {
  return updateSession(sessionId, { status });
}

export async function updateLastActivity(sessionId: string): Promise<void> {
  const db = getDb();
  
  await db.collection(COLLECTIONS.SESSIONS).updateOne(
    { _id: new ObjectId(sessionId) },
    { $set: { lastActivityAt: new Date() } }
  );
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.SESSIONS).deleteOne({
    _id: new ObjectId(sessionId),
  });
  
  // Also delete associated messages and logs
  if (result.deletedCount > 0) {
    await db.collection(COLLECTIONS.MESSAGES).deleteMany({ sessionId });
    await db.collection(COLLECTIONS.LOGS).deleteMany({ sessionId });
  }
  
  return result.deletedCount > 0;
}

export async function addBookmark(
  sessionId: string,
  bookmark: Omit<Bookmark, "_id">
): Promise<Bookmark | null> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.SESSIONS).findOneAndUpdate(
    { _id: new ObjectId(sessionId) },
    {
      $push: { bookmarks: { $each: [{ ...bookmark }], $position: 0 } },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  
  if (result && result.bookmarks.length > 0) {
    return result.bookmarks[0];
  }
  return null;
}

export async function removeBookmark(
  sessionId: string,
  bookmarkId: string
): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.SESSIONS).updateOne(
    { _id: new ObjectId(sessionId) },
    {
      $pull: { bookmarks: { _id: new ObjectId(bookmarkId) } },
      $set: { updatedAt: new Date() },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function assignSessionToUser(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.USERS).updateOne(
    { _id: new ObjectId(userId) },
    {
      $addToSet: { "permissions.assignedSessions": sessionId },
      $set: { updatedAt: new Date() },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function unassignSessionFromUser(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.USERS).updateOne(
    { _id: new ObjectId(userId) },
    {
      $pull: { "permissions.assignedSessions": sessionId },
      $set: { updatedAt: new Date() },
    }
  );
  
  return result.modifiedCount > 0;
}
