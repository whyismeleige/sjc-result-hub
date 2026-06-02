// src/app/api/leaderboard/filters/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ok, err, rateLimit, getClientIp } from '@/lib/api';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 120, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  try {
    const [semesters, examMonths, programs] = await Promise.all([
      prisma.semester.findMany({
        select: { semester_name: true },
        distinct: ['semester_name'],
        orderBy: { semester_name: 'asc' },
      }),
      prisma.semester.findMany({
        select: { exam_month_year: true },
        distinct: ['exam_month_year'],
        orderBy: { exam_month_year: 'desc' },
      }),
      prisma.student.findMany({
        where: { program: { not: null } },
        select: { program: true },
        distinct: ['program'],
        orderBy: { program: 'asc' },
      }),
    ]);

    return ok({
      semesters: semesters.map(s => s.semester_name),
      examMonths: examMonths.map(e => e.exam_month_year),
      programs: programs.map(p => p.program),
    });
  } catch (e) {
    console.error('[GET /api/leaderboard/filters]', e);
    return err('Failed to fetch filters', 500);
  }
}
