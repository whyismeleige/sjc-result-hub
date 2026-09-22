// src/app/api/analytics/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ok, err, parseQuery, rateLimit, getClientIp, isAdminRequest, toNumber } from '@/lib/api';
import { bucketSgpas } from '@/lib/sgpa';

export const runtime = 'nodejs';

const analyticsSchema = z.object({
  type: z.enum([
    'overview', 'branch-performance', 'pass-rate',
    'grade-distribution', 'sgpa-distribution'
  ]).default('overview'),
  program: z.string().max(100).optional(),
  semester: z.string().max(50).optional(),
});

const ci = (val: string) => ({ contains: val, mode: 'insensitive' as const });

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = await rateLimit(ip, 30, 60_000, isAdminRequest(req));
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, analyticsSchema);
  if ('error' in parsed) return parsed.error;
  const { type, program, semester } = parsed.data;

  try {
    if (type === 'overview') {
      const [totalStudents, totalSemesters, totalSubjects, passCount, promotedCount, failCount, totalWithResult] =
        await Promise.all([
          prisma.student.count(),
          prisma.semester.count(),
          prisma.subject.count(),
          prisma.semester.count({ where: { overall_result: 'PASS' } }),
          prisma.semester.count({ where: { overall_result: 'PROMOTED' } }),
          prisma.semester.count({ where: { overall_result: 'FAIL' } }),
          prisma.semester.count({ where: { overall_result: { not: null } } }),
        ]);

      const topSgpa = await prisma.semester.findFirst({
        where: { sgpa: { not: null } },
        orderBy: { sgpa: 'desc' },
        select: {
          sgpa: true,
          semester_name: true,
          exam_month_year: true,
          student: { select: { id: true, student_name: true, hall_ticket: true, program: true } },
        },
      });

      const programs = await prisma.student.groupBy({
        by: ['program'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const sgpaSems = await prisma.semester.findMany({
        where: { sgpa: { not: null } },
        select: { sgpa: true },
      });

      return ok({
        totalStudents,
        totalSemesters,
        totalSubjects,
        passCount,
        promotedCount,
        failCount,
        passRate: totalWithResult > 0 ? Math.round((passCount / totalWithResult) * 100) : 0,
        topSgpa: topSgpa
          ? {
              ...topSgpa,
              sgpa: toNumber(topSgpa.sgpa),
              student: { ...topSgpa.student, id: topSgpa.student.id },
            }
          : null,
        branchDistribution: programs.map(p => ({
          program: p.program ?? 'Unknown',
          studentCount: p._count.id,
        })),
        sgpaDistribution: bucketSgpas(sgpaSems.map(s => toNumber(s.sgpa) ?? 0)),
      });
    }

    if (type === 'branch-performance') {
      // Single-pass aggregation avoids querying per-program in a loop.
      const programPart = program
        ? Prisma.sql` AND st.program ILIKE ${'%' + program + '%'}`
        : Prisma.empty;
      const raw = await prisma.$queryRaw<
        Array<{
          program: string | null;
          semesters: number;
          passCount: number;
          avgSgpa: number;
          topSgpa: number;
        }>
      >`
        SELECT st.program AS "program",
               count(s.id)::int AS "semesters",
               count(s.id) FILTER (WHERE s.overall_result = 'PASS')::int AS "passCount",
               round(avg(s.sgpa), 4)::float AS "avgSgpa",
               max(s.sgpa)::float AS "topSgpa"
        FROM semesters s
        JOIN students st ON st.id = s.student_id
        WHERE s.sgpa IS NOT NULL
          ${programPart}
        GROUP BY st.program
        ORDER BY "avgSgpa" DESC`;

      const programs = await prisma.student.groupBy({
        by: ['program'],
        _count: { id: true },
        where: program ? { program: ci(program) } : {},
      });
      const countByProgram = new Map(programs.map(p => [p.program, p._count.id]));

      const stats = raw.map(r => ({
        program: r.program ?? 'Unknown',
        studentCount: countByProgram.get(r.program) ?? 0,
        avgSgpa: Number(r.avgSgpa.toFixed(2)),
        passRate: r.semesters ? Math.round((r.passCount / r.semesters) * 100) : 0,
        topSgpa: Number(r.topSgpa.toFixed(2)),
      }));

      return ok(stats);
    }

    if (type === 'grade-distribution') {
      // NOTE: previously the two spreads collapsed into one another, so passing
      // both program AND semester silently dropped the semester filter.
      const where: Record<string, unknown> = {};
      if (program || semester) {
        where.semester = {
          ...(program ? { student: { program: ci(program) } } : {}),
          ...(semester ? { semester_name: ci(semester) } : {}),
        };
      }

      const grades = await prisma.semesterResult.groupBy({
        by: ['grade'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const total = grades.reduce((a, g) => a + g._count.id, 0);
      return ok(grades.map(g => ({
        grade: g.grade ?? 'N/A',
        count: g._count.id,
        percentage: total > 0 ? Math.round((g._count.id / total) * 1000) / 10 : 0,
      })));
    }

    if (type === 'pass-rate') {
      // Single raw aggregation (avoids a count query per semester group).
      const rows = await prisma.$queryRaw<
        Array<{
          semester_name: string;
          exam_month_year: string;
          total: number;
          passCount: number;
        }>
      >`
        SELECT semester_name, exam_month_year,
               count(*)::int AS "total",
               count(*) FILTER (WHERE overall_result = 'PASS')::int AS "passCount"
        FROM semesters
        GROUP BY semester_name, exam_month_year
        ORDER BY exam_month_year ASC, semester_name ASC`;

      return ok(rows.map(r => ({
        semester_name: r.semester_name,
        exam_month_year: r.exam_month_year,
        total: r.total,
        passCount: r.passCount,
        passRate: r.total ? Math.round((r.passCount / r.total) * 100) : 0,
      })));
    }

    if (type === 'sgpa-distribution') {
      const sems = await prisma.semester.findMany({
        where: {
          sgpa: { not: null },
          ...(program ? { student: { program: ci(program) } } : {}),
          ...(semester ? { semester_name: ci(semester) } : {}),
        },
        select: { sgpa: true },
      });

      return ok(bucketSgpas(sems.map(s => toNumber(s.sgpa) ?? 0)));
    }

    return err('Unknown analytics type', 400);
  } catch (e) {
    console.error('[GET /api/analytics]', e);
    return err('Failed to fetch analytics', 500);
  }
}