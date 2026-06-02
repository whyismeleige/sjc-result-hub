// src/app/api/leaderboard/branch/[program]/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ok, err, paginate, getPrismaSkip, rateLimit, getClientIp } from '@/lib/api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ program: string }> }
) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 60, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const { program } = await params;
  const programName = decodeURIComponent(program);

  const searchParams = req.nextUrl.searchParams;
  const semester = searchParams.get('semester') || undefined;
  const examMonthYear = searchParams.get('examMonthYear') || undefined;
  const search = searchParams.get('search') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
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

    const sgpas = allSems.map(s => parseFloat(s.sgpa!)).filter(n => !isNaN(n));
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
      existing.sgpaList.push(parseFloat(s.sgpa!));
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
      sgpa: s.semesters[0] ? parseFloat(s.semesters[0].sgpa!) : null,
      semester_name: s.semesters[0]?.semester_name ?? null,
      exam_month_year: s.semesters[0]?.exam_month_year ?? null,
    }));

    return ok(
      {
        program: programName,
        studentCount,
        avgSgpa: parseFloat(avgSgpa.toFixed(2)),
        topSgpa,
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
