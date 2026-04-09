import { getDb, COLLECTIONS } from "../db/mongodb";
import { User, createDefaultPermissions, createAdminPermissions } from "../db/schemas";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
const JWT_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

// Simple JWT implementation using jose
async function createToken(payload: Record<string, unknown>, expiresIn: string): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
  
  return token;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAccessToken(userId: string, role: string): Promise<string> {
  return createToken({ userId, role }, JWT_EXPIRES_IN);
}

export async function createRefreshToken(userId: string): Promise<string> {
  return createToken({ userId, type: "refresh" }, REFRESH_TOKEN_EXPIRES_IN);
}

export async function verifyToken(token: string): Promise<{ userId: string; role?: string } | null> {
  try {
    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; role?: string };
  } catch {
    return null;
  }
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "user";
  permissions?: Partial<User["permissions"]>;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const db = getDb();
  
  // Check if user already exists
  const existingUser = await db.collection(COLLECTIONS.USERS).findOne({
    $or: [{ username: data.username }, { email: data.email }],
  });
  
  if (existingUser) {
    throw new Error("User with this username or email already exists");
  }
  
  const passwordHash = await hashPassword(data.password);
  const now = new Date();
  
  const userPermissions = data.role === "admin" 
    ? createAdminPermissions() 
    : { ...createDefaultPermissions(), ...data.permissions };
  
  const user: User = {
    username: data.username,
    email: data.email,
    passwordHash,
    role: data.role || "user",
    permissions: userPermissions,
    createdAt: now,
    updatedAt: now,
  };
  
  const result = await db.collection(COLLECTIONS.USERS).insertOne(user);
  
  return { ...user, _id: result.insertedId };
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  
  try {
    const user = await db.collection(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(userId),
    });
    return user;
  } catch {
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  return db.collection(COLLECTIONS.USERS).findOne({ username });
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.USERS).findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  
  return result;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.collection(COLLECTIONS.USERS).deleteOne({
    _id: new ObjectId(userId),
  });
  
  return result.deletedCount > 0;
}

export async function getAllUsers(): Promise<User[]> {
  const db = getDb();
  return db.collection(COLLECTIONS.USERS).find({}).toArray();
}

export async function updateLastLogin(userId: string): Promise<void> {
  const db = getDb();
  
  await db.collection(COLLECTIONS.USERS).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { lastLoginAt: new Date() } }
  );
}
