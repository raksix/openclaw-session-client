import { getDb, COLLECTIONS } from "../db/mongodb";
import { Message, MessageRole } from "../db/schemas";
import { ObjectId } from "mongodb";
import { updateLastActivity } from "./session.service";

export interface CreateMessageData {
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  attachments?: Message["attachments"];
}

export async function createMessage(data: CreateMessageData): Promise<Message> {
  const db = getDb();
  const now = new Date();
  
  const message: Message = {
    sessionId: data.sessionId,
    userId: data.userId,
    role: data.role,
    content: data.content,
    attachments: data.attachments || [],
    createdAt: now,
  };
  
  const result = await db.collection(COLLECTIONS.MESSAGES).insertOne(message);
  
  // Update session last activity
  await updateLastActivity(data.sessionId);
  
  return { ...message, _id: result.insertedId };
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  const db = getDb();
  
  try {
    const message = await db.collection(COLLECTIONS.MESSAGES).findOne({
      _id: new ObjectId(messageId),
    });
    return message;
  } catch {
    return null;
  }
}

export async function getMessagesBySessionId(
  sessionId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  const db = getDb();
  
  const query: Record<string, unknown> = { sessionId };
  
  if (before) {
    try {
      const beforeDate = await getMessageById(before);
      if (beforeDate) {
        query.createdAt = { $lt: beforeDate.createdAt };
      }
    } catch {
      // Ignore invalid beforeId
    }
  }
  
  return db.collection(COLLECTIONS.MESSAGES)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.MESSAGES).deleteOne({
    _id: new ObjectId(messageId),
  });
  
  return result.deletedCount > 0;
}

export async function deleteMessagesBySessionId(sessionId: string): Promise<number> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.MESSAGES).deleteMany({ sessionId });
  
  return result.deletedCount;
}
