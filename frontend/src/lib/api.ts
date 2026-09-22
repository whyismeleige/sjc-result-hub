// src/lib/api.ts
//
// Shared helpers for API routes: Prisma-backed rate limiting, request IP
// extraction, response shaping, Zod query parsing, and Decimal normalization.
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import prisma from './prisma';

// ─── Rate limiting (Prisma/Postgres backed) ──────────────────────────────
// Uses `rate_limit_entries` table. Each (ip + window) is a row; counts are
// incremented atomically via upsert so it is correct on Vercel's stateless
// serverless functions where an in-memory Map would reset per instance.
//
// Buckets expire as windows advance; an opportunistic batch cleanup keeps the
// table small. Rate limiting FAILS OPEN (a DB hiccup must never brick the site).

const RATE_LIMIT_CLEANUP_THRESHOLD_MS = 3600_000; // keep ~1h of history
const RATE_LIMIT_MAX_WINDOW_MS = 3600_000;

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; remaining: 0 };

export async function rateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000,
  bypass = false
): Promise<RateLimitResult> {
  if (bypass) return { ok: true, remaining: limit };
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `rl:${ip}:${windowStart}`;
  try {
    const entry = await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, windowStart: new Date(windowStart), count: 1 },
      update: { count: { increment: 1 } },
    });
    if (suppressWindow(windowMs)) {
      void prisma.rateLimitEntry
        .deleteMany({
          where: { windowStart: { lt: new Date(Date.now() - RATE_LIMIT_CLEANUP_THRESHOLD_MS) } },
        })
        .catch(() => {});
    }
    if (entry.count > limit) return { ok: false, remaining: 0 };
    return { ok: true, remaining: Math.max(0, limit - entry.count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

// ~1 in 1000 requests triggers cleanup; never blocks a client request.
function suppressWindow(windowMs: number): boolean {
  if (windowMs > RATE_LIMIT_MAX_WINDOW_MS) return false;
  return Math.random() < 0.001;
}

/**
 * Best-effort client IP extraction.
 * Priority: x-real-ip (set by nginx/Vercel), x-vercel-forwarded-for,
 * then the first hop of x-forwarded-for. All input is length-capped.
 * Falls back to a private literal so rate limiting still functions locally.
 */
export function getClientIp(req: NextRequest): string {
  const candidates = [
    req.headers.get('x-real-ip'),
    req.headers.get('x-vercel-forwarded-for'),
    req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
    '127.0.0.1',
  ];
  for (const ip of candidates) {
    if (ip && /^[\w.:\-\[\]]{1,64}$/.test(ip)) return ip;
  }
  return '127.0.0.1';
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
/**
 * A request counts as admin when it presents the configured `ADMIN_SECRET`,
 * either via the `x-admin-secret` header or the `admin_secret` query param.
 * Returns false when `ADMIN_SECRET` is unset (admin features are disabled).
 */
export function isAdminRequest(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('admin_secret');
  return typeof provided === 'string' && provided.length > 0 && provided === secret;
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  return isAdminRequest(req) ? null : err('Unauthorized', 401);
}

// ─── Prisma pagination helpers ───────────────────────────────────────────────
export function getPrismaSkip(page: number, limit: number) {
  return (page - 1) * limit;
}

// ─── Decimal normalization ───────────────────────────────────────────────────
/**
 * Prisma serializes Postgres DECIMAL columns to strings in JSON. This normalizes
 * a Prisma Decimal (or string/number) to a JS number for API responses, or null
 * when the value is absent/unparseable.
 */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}