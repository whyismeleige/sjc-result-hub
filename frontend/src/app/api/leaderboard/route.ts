// src/app/api/leaderboard/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ok, err, parseQuery, leaderboardSchema,
  paginate, getPrismaSkip, rateLimit, getClientIp
} from '@/lib/api';
import { Prisma } from '@prisma/client';

type SemesterWhere = Prisma.SemesterWhereInput;

function buildWhere(params: {
  program?: string;
  semester?: string;
  examMonthYear?: string;
  sgpaRequired?: boolean;
}): SemesterWhere {
  const { program, semester, examMonthYear, sgpaRequired } = params;
  const ci = (val: string) => ({ contains: val, mode: 'insensitive' as const });

  const where: SemesterWhere = {};
  if (sgpaRequired) where.sgpa = { not: null };

  if (semester) where.semester_name = ci(semester);
  if (examMonthYear) where.exam_month_year = ci(examMonthYear);

  if (program) {
    where.student = {};
    if (program) where.student.program = ci(program);
  }

  return where;
}

const semesterSelectBrief = {
  id: true,
  sgpa: true,
  semester_name: true,
  exam_month_year: true,
  student: {
    select: {
      id: true, hall_ticket: true, student_name: true, program: true,
    },
  },
} satisfies Prisma.SemesterSelect;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 60, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, leaderboardSchema);
  if ('error' in parsed) return parsed.error;

  const { type, program, semester, examMonthYear, page, limit } = parsed.data;
  const skip = getPrismaSkip(page, limit);

  try {
    if (type === 'sgpa' || type === 'semester') {
      const where = buildWhere({ program, semester, examMonthYear });
      where.sgpa = { not: null };
      where.overall_result = 'PASS';

      const [rows, total] = await Promise.all([
        prisma.semester.findMany({
          where,
          orderBy: { sgpa: 'desc' },
          skip,
          take: limit,
          select: semesterSelectBrief,
        }),
        prisma.semester.count({ where }),
      ]);

      return ok(
        rows.map((r, i) => ({
          rank: skip + i + 1,
          student: r.student,
          sgpa: r.sgpa ? parseFloat(r.sgpa) : null,
          semester_name: r.semester_name,
          exam_month_year: r.exam_month_year,
        })),
        paginate(page, limit, total)
      );
    }

    if (type === 'branch') {
      const programWhere = program ? { program: { contains: program, mode: 'insensitive' as const } } : {};
      const programs = await prisma.student.groupBy({
        by: ['program'],
        where: programWhere,
        _count: { id: true },
      });

      const branchStats = await Promise.all(
        programs.map(async p => {
          const semWhere = buildWhere({ program: p.program ?? undefined, semester, examMonthYear, sgpaRequired: true });
          const sems = await prisma.semester.findMany({
            where: semWhere,
            select: { sgpa: true, overall_result: true },
          });

          const sgpas = sems.map(s => parseFloat(s.sgpa!)).filter(n => !isNaN(n));
          const avgSgpa = sgpas.length ? sgpas.reduce((a, b) => a + b, 0) / sgpas.length : 0;
          const passCount = sems.filter(s => s.overall_result === 'PASS').length;
          const passRate = sems.length ? Math.round((passCount / sems.length) * 100) : 0;

          return {
            program: p.program ?? 'Unknown',
            studentCount: p._count.id,
            avgSgpa: parseFloat(avgSgpa.toFixed(2)),
            passRate,
            topSgpa: sgpas.length ? Math.max(...sgpas) : 0,
          };
        })
      );

      const sorted = branchStats
        .sort((a, b) => b.avgSgpa - a.avgSgpa)
        .map((b, i) => ({ rank: i + 1, ...b }));

      return ok(sorted.slice(skip, skip + limit), paginate(page, limit, sorted.length));
    }

    return err('Unknown leaderboard type', 400);
  } catch (e) {
    console.error('[GET /api/leaderboard]', e);
    return err('Failed to fetch leaderboard', 500);
  }
}
