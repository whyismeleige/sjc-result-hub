// src/app/api/students/route.ts
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ok, err, parseQuery, searchSchema, paginate, getPrismaSkip, rateLimit, getClientIp } from '@/lib/api';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 60, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, searchSchema);
  if ('error' in parsed) return parsed.error;

  const { q, program, page, limit, sortBy, sortOrder } = parsed.data;
  const skip = getPrismaSkip(page, limit);

  try {
    const where: Prisma.StudentWhereInput = {};

    if (q) {
      where.OR = [
        { student_name: { contains: q, mode: 'insensitive' } },
        { hall_ticket: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (program) {
      where.program = { contains: program, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          hall_ticket: true,
          student_name: true,
          program: true,
          father_name: true,
          created_at: true,
        },
      }),
      prisma.student.count({ where }),
    ]);

    return ok(rows, paginate(page, limit, total));
  } catch (e) {
    console.error('[GET /api/students]', e);
    return err('Failed to fetch students', 500);
  }
}
