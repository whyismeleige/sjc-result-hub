// src/app/api/students/detail/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, err, parseQuery, getClientIp, rateLimit, isAdminRequest, toNumber } from '@/lib/api';

export const runtime = 'nodejs';

const detailSchema = z.object({
  id: z.coerce.number().int().min(1),
});

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = await rateLimit(ip, 60, 60_000, isAdminRequest(req));
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, detailSchema);
  if ('error' in parsed) return parsed.error;
  const { id } = parsed.data;

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        semesters: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            semester_name: true,
            exam_month_year: true,
            sgpa: true,
            overall_result: true,
            source_run_id: true,
          },
        },
      },
    });

    if (!student) return err('Student not found', 404);

    return ok({
      ...student,
      semesters: student.semesters.map(s => ({
        ...s,
        sgpa: toNumber(s.sgpa),
        source_run_id: s.source_run_id ?? null,
      })),
    });
  } catch (e) {
    console.error('[GET /api/students/detail]', e);
    return err('Failed to fetch student detail', 500);
  }
}