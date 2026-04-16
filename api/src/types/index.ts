import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

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
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & { prisma?: InstanceType<typeof PrismaClient> };
export const prisma: InstanceType<typeof PrismaClient> = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
