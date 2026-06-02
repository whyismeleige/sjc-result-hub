// src/lib/api.ts
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

// ─── Rate limiting (in-memory, per-IP) ─────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: limit - entry.count };
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

// ─── Response helpers ────────────────────────────────────────────────────────
export function ok<T>(data: T, meta?: object, status = 200) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

export function paginate(page: number, limit: number, total: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Zod parse helpers ───────────────────────────────────────────────────────
export function parseQuery<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return { error: err('Invalid query parameters', 400, result.error.flatten()) };
  }
  return { data: result.data };
}

// Common query schemas
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchSchema = paginationSchema.extend({
  q:         z.string().max(100).optional(),
  program:   z.string().max(100).optional(),
  semester:  z.string().max(50).optional(),
  sortBy:    z.enum(['student_name', 'hall_ticket', 'program']).default('student_name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const leaderboardSchema = paginationSchema.extend({
  program:       z.string().max(100).optional(),
  semester:      z.string().max(50).optional(),
  examMonthYear: z.string().max(50).optional(),
  type:          z.enum(['sgpa', 'semester', 'branch', 'batch']).default('sgpa'),
});

// ─── Admin auth middleware ───────────────────────────────────────────────────
export function requireAdmin(req: NextRequest): NextResponse | null {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return err('Unauthorized', 401);
  }
  return null;
}

// ─── Prisma pagination helpers ───────────────────────────────────────────────
export function getPrismaSkip(page: number, limit: number) {
  return (page - 1) * limit;
}