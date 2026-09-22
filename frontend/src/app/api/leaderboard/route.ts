// src/app/api/leaderboard/route.ts
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  ok, err, parseQuery, leaderboardSchema,
  paginate, getPrismaSkip, rateLimit, getClientIp, isAdminRequest, toNumber,
} from '@/lib/api';

export const runtime = 'nodejs';

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
    where.student.program = ci(program);
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
  const { ok: allowed } = await rateLimit(ip, 60, 60_000, isAdminRequest(req));
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, leaderboardSchema);
  if ('error' in parsed) return parsed.error;

  const { type, program, semester, examMonthYear, page, limit } = parsed.data;
  const skip = getPrismaSkip(page, limit);

  try {
    if (type === 'sgpa' || type === 'semester') {
      const where = buildWhere({ program, semester, examMonthYear, sgpaRequired: true });
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
          sgpa: toNumber(r.sgpa),
          semester_name: r.semester_name,
          exam_month_year: r.exam_month_year,
        })),
        paginate(page, limit, total)
      );
    }

    if (type === 'branch') {
      // One-pass aggregation instead of a query per program.
      const semesterPart = semester
        ? Prisma.sql` AND s.semester_name ILIKE ${'%' + semester + '%'}`
        : Prisma.empty;
      const examPart = examMonthYear
        ? Prisma.sql` AND s.exam_month_year ILIKE ${'%' + examMonthYear + '%'}`
        : Prisma.empty;
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
               count(*)::int AS "semesters",
               count(*) FILTER (WHERE s.overall_result = 'PASS')::int AS "passCount",
               round(avg(s.sgpa), 4)::float AS "avgSgpa",
               max(s.sgpa)::float AS "topSgpa"
        FROM semesters s
        JOIN students st ON st.id = s.student_id
        WHERE s.sgpa IS NOT NULL
          ${semesterPart}${examPart}${programPart}
        GROUP BY st.program
        ORDER BY "avgSgpa" DESC`;

      // Full program enrollment counts (all students, not only those with SGPA).
      const programCounts = await prisma.student.groupBy({
        by: ['program'],
        _count: { id: true },
        where: program ? { program: { contains: program, mode: 'insensitive' as const } } : {},
      });
      const countByProgram = new Map(programCounts.map(p => [p.program, p._count.id]));

      const branchStats = raw.map(r => ({
        program: r.program ?? 'Unknown',
        studentCount: countByProgram.get(r.program) ?? 0,
        avgSgpa: Number(r.avgSgpa.toFixed(2)),
        passRate: r.semesters ? Math.round((r.passCount / r.semesters) * 100) : 0,
        topSgpa: Number(r.topSgpa.toFixed(2)),
      }));

      const sorted = branchStats.map((b, i) => ({ rank: i + 1, ...b }));
      return ok(sorted.slice(skip, skip + limit), paginate(page, limit, sorted.length));
    }

    return err('Unknown leaderboard type', 400);
  } catch (e) {
    console.error('[GET /api/leaderboard]', e);
    return err('Failed to fetch leaderboard', 500);
  }
}