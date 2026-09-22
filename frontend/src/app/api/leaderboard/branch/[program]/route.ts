// src/app/api/leaderboard/branch/[program]/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, err, paginate, getPrismaSkip, rateLimit, getClientIp, isAdminRequest, toNumber } from '@/lib/api';

export const runtime = 'nodejs';

const branchQuerySchema = z.object({
  semester: z.string().max(50).optional(),
  examMonthYear: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ program: string }> }
) {
  const ip = getClientIp(req);
  const { ok: allowed } = await rateLimit(ip, 60, 60_000, isAdminRequest(req));
  if (!allowed) return err('Rate limit exceeded', 429);

  const { program } = await params;
  const programName = decodeURIComponent(program);
  if (programName.length > 120) return err('Invalid program', 400);

  const parsed = branchQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) return err('Invalid query parameters', 400, parsed.error.flatten());
  const { semester, examMonthYear, search, page, limit } = parsed.data;
  const skip = getPrismaSkip(page, limit);

  try {
    // Branch overview stats
    const studentCount = await prisma.student.count({
      where: { program: { equals: programName, mode: 'insensitive' } },
    });

    const ci = (val: string) => ({ contains: val, mode: 'insensitive' as const });
    const semesterFilter = semester ? { semester_name: ci(semester) } : {};
    const examFilter = examMonthYear ? { exam_month_year: ci(examMonthYear) } : {};

    const allSems = await prisma.semester.findMany({
      where: {
        student: { program: { equals: programName, mode: 'insensitive' } },
        sgpa: { not: null },
        ...semesterFilter,
        ...examFilter,
      },
      select: { sgpa: true, overall_result: true },
    });

    const sgpas = allSems.map(s => toNumber(s.sgpa) ?? 0);
    const avgSgpa = sgpas.length ? sgpas.reduce((a, b) => a + b, 0) / sgpas.length : 0;
    const passCount = allSems.filter(s => s.overall_result === 'PASS').length;
    const passRate = allSems.length ? Math.round((passCount / allSems.length) * 100) : 0;
    const topSgpa = sgpas.length ? Math.max(...sgpas) : 0;

    // Semester breakdown
    const sems = await prisma.semester.findMany({
      where: {
        student: { program: { equals: programName, mode: 'insensitive' } },
        sgpa: { not: null },
        ...examFilter,
      },
      select: { semester_name: true, exam_month_year: true, sgpa: true, overall_result: true },
      orderBy: { id: 'asc' },
    });

    const breakdownMap = new Map<string, { sgpaList: number[]; passCount: number; total: number; exam_month_year: string }>();
    for (const s of sems) {
      const key = s.semester_name;
      const existing = breakdownMap.get(key) || { sgpaList: [], passCount: 0, total: 0, exam_month_year: s.exam_month_year };
      existing.sgpaList.push(toNumber(s.sgpa) ?? 0);
      if (s.overall_result === 'PASS') existing.passCount++;
      existing.total++;
      if (!breakdownMap.has(key)) breakdownMap.set(key, existing);
    }

    const semesterBreakdown = Array.from(breakdownMap.entries()).map(([name, data]) => {
      const avg = data.sgpaList.reduce((a, b) => a + b, 0) / data.sgpaList.length;
      return {
        semester_name: name,
        exam_month_year: data.exam_month_year,
        avgSgpa: parseFloat(avg.toFixed(2)),
        studentCount: data.total,
        passRate: Math.round((data.passCount / data.total) * 100),
      };
    });

    // Student list with semester-level results
    const whereStudents: Record<string, unknown> = {
      program: { equals: programName, mode: 'insensitive' },
    };
    if (search) {
      whereStudents.OR = [
        { student_name: ci(search) },
        { hall_ticket: ci(search) },
      ];
    }
    if (semester || examMonthYear) {
      whereStudents.semesters = {
        some: {
          sgpa: { not: null },
          ...semesterFilter,
          ...examFilter,
        },
      };
    }

    const totalStudents = await prisma.student.count({ where: whereStudents });

    const students = await prisma.student.findMany({
      where: whereStudents,
      select: {
        id: true,
        hall_ticket: true,
        student_name: true,
        program: true,
        semesters: {
          where: {
            sgpa: { not: null },
            ...semesterFilter,
            ...examFilter,
          },
          select: { semester_name: true, exam_month_year: true, sgpa: true, overall_result: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      skip,
      take: limit,
      orderBy: { student_name: 'asc' },
    });

    const studentList = students.map(s => ({
      id: s.id,
      hall_ticket: s.hall_ticket,
      student_name: s.student_name,
      sgpa: s.semesters[0] ? toNumber(s.semesters[0].sgpa) : null,
      semester_name: s.semesters[0]?.semester_name ?? null,
      exam_month_year: s.semesters[0]?.exam_month_year ?? null,
    }));

    return ok(
      {
        program: programName,
        studentCount,
        avgSgpa: parseFloat(avgSgpa.toFixed(2)),
        topSgpa: parseFloat(topSgpa.toFixed(2)),
        passRate,
        semesterBreakdown,
        students: studentList,
      },
      paginate(page, limit, totalStudents)
    );
  } catch (e) {
    console.error('[GET /api/leaderboard/branch/[program]]', e);
    return err('Failed to fetch branch details', 500);
  }
}