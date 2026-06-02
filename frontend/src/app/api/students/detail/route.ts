// src/app/api/students/detail/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ok, err, getClientIp, rateLimit } from '@/lib/api';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 60, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return err('Missing student id', 400);

  const studentId = parseInt(id, 10);
  if (isNaN(studentId)) return err('Invalid student id', 400);

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        semesters: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            semester_name: true,
            exam_month_year: true,
            sgpa: true,
            overall_result: true,
          },
        },
      },
    });

    if (!student) return err('Student not found', 404);

    return ok(student);
  } catch (e) {
    console.error('[GET /api/students/detail]', e);
    return err('Failed to fetch student detail', 500);
  }
}
