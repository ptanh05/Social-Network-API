import { Request } from 'express';
import { Pool } from 'pg';

// PrismaClient types via generated .prisma/client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientType = any;

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
function createPrismaClient(): PrismaClientType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };
export const prisma: PrismaClientType = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
