import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Re-export Prisma types
export type { User, Post, Topic, Comment, Like, Follow, Notification, Bookmark, RefreshToken, UserPreference, Hashtag, Report } from '@prisma/client';

// ─── Auth user (attached to request) ──────────────────────────────────────────
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  avatar_url: string;
}

export type AuthRequest = Request & { user?: AuthUser };

// ─── Prisma Client ────────────────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
