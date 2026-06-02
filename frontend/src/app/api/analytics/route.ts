// src/app/api/analytics/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, err, parseQuery, rateLimit, getClientIp } from '@/lib/api';

const analyticsSchema = z.object({
  type: z.enum([
    'overview', 'branch-performance', 'pass-rate',
    'grade-distribution', 'sgpa-distribution'
  ]).default('overview'),
  program: z.string().max(100).optional(),
  semester: z.string().max(50).optional(),
});

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 30, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, analyticsSchema);
  if ('error' in parsed) return parsed.error;
  const { type, program, semester } = parsed.data;

  try {
    if (type === 'overview') {
      const [totalStudents, totalSemesters, totalSubjects, passCount, totalWithResult] =
        await Promise.all([
          prisma.student.count(),
          prisma.semester.count(),
          prisma.subject.count(),
          prisma.semester.count({ where: { overall_result: 'PASS' } }),
          prisma.semester.count({ where: { overall_result: { not: null } } }),
        ]);

      const promotedCount = await prisma.semester.count({ where: { overall_result: 'PROMOTED' } });
      const failCount     = await prisma.semester.count({ where: { overall_result: 'FAIL' } });

      const topSgpa = await prisma.semester.findFirst({
        where: { sgpa: { not: null } },
        orderBy: { sgpa: 'desc' },
        select: {
          sgpa: true,
          student: { select: { student_name: true, hall_ticket: true } },
        },
      });

      const programs = await prisma.student.groupBy({
        by: ['program'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const branchDistribution = programs.map(p => ({
        program: p.program ?? 'Unknown',
        studentCount: p._count.id,
      }));

      const sgpaSems = await prisma.semester.findMany({
        where: { sgpa: { not: null } },
        select: { sgpa: true },
      });

      const sgpaBuckets: Record<string, number> = {
        '9.0-10.0': 0, '8.0-8.9': 0, '7.0-7.9': 0,
        '6.0-6.9': 0, '5.0-5.9': 0, '0-4.9': 0,
      };
      for (const s of sgpaSems) {
        const val = parseFloat(s.sgpa!);
        if (isNaN(val)) continue;
        if (val >= 9.0) sgpaBuckets['9.0-10.0']++;
        else if (val >= 8.0) sgpaBuckets['8.0-8.9']++;
        else if (val >= 7.0) sgpaBuckets['7.0-7.9']++;
        else if (val >= 6.0) sgpaBuckets['6.0-6.9']++;
        else if (val >= 5.0) sgpaBuckets['5.0-5.9']++;
        else sgpaBuckets['0-4.9']++;
      }
      const sgpaDistribution = Object.entries(sgpaBuckets).map(([range, count]) => ({
        range,
        count,
        percentage: sgpaSems.length > 0 ? Math.round((count / sgpaSems.length) * 1000) / 10 : 0,
      }));

      return ok({
        totalStudents,
        totalSemesters,
        totalSubjects,
        passCount,
        promotedCount,
        failCount,
        passRate: totalWithResult > 0 ? Math.round((passCount / totalWithResult) * 100) : 0,
        topSgpa,
        branchDistribution,
        sgpaDistribution,
      });
    }

    if (type === 'branch-performance') {
      const programs = await prisma.student.groupBy({
        by: ['program'],
        _count: { id: true },
        where: program ? { program: { contains: program, mode: 'insensitive' } } : {},
      });

      const stats = await Promise.all(
        programs.map(async p => {
          const sems = await prisma.semester.findMany({
            where: { student: { program: p.program ?? '' }, sgpa: { not: null } },
            select: { sgpa: true, overall_result: true },
          });
          const sgpas = sems.map(s => parseFloat(s.sgpa!)).filter(n => !isNaN(n));
          const avgSgpa = sgpas.length ? sgpas.reduce((a, b) => a + b, 0) / sgpas.length : 0;
          const passCount = sems.filter(s => s.overall_result === 'PASS').length;
          return {
            program: p.program ?? 'Unknown',
            studentCount: p._count.id,
            avgSgpa: parseFloat(avgSgpa.toFixed(2)),
            passRate: sems.length ? Math.round((passCount / sems.length) * 100) : 0,
            topSgpa: sgpas.length ? parseFloat(Math.max(...sgpas).toFixed(2)) : 0,
          };
        })
      );

      return ok(stats.sort((a, b) => b.avgSgpa - a.avgSgpa));
    }

    if (type === 'grade-distribution') {
      const where = {
        ...(program ? { semester: { student: { program: { contains: program, mode: 'insensitive' as const } } } } : {}),
        ...(semester ? { semester: { semester_name: { contains: semester, mode: 'insensitive' as const } } } : {}),
      };

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
      // Per-semester pass rates
      const semesters = await prisma.semester.groupBy({
        by: ['semester_name', 'exam_month_year'],
        _count: { id: true },
        orderBy: { exam_month_year: 'asc' },
      });

      const withRates = await Promise.all(
        semesters.map(async s => {
          const passCount = await prisma.semester.count({
            where: {
              semester_name: s.semester_name,
              exam_month_year: s.exam_month_year,
              overall_result: 'PASS',
            },
          });
          return {
            semester_name: s.semester_name,
            exam_month_year: s.exam_month_year,
            total: s._count.id,
            passCount,
            passRate: Math.round((passCount / s._count.id) * 100),
          };
        })
      );

      return ok(withRates);
    }

    if (type === 'sgpa-distribution') {
      const sems = await prisma.semester.findMany({
        where: {
          sgpa: { not: null },
          ...(program ? { student: { program: { contains: program, mode: 'insensitive' } } } : {}),
        },
        select: { sgpa: true },
      });

      const buckets: Record<string, number> = {
        '9.0-10.0': 0, '8.0-8.9': 0, '7.0-7.9': 0,
        '6.0-6.9': 0, '5.0-5.9': 0, '0-4.9': 0,
      };

      for (const s of sems) {
        const val = parseFloat(s.sgpa!);
        if (isNaN(val)) continue;
        if (val >= 9.0) buckets['9.0-10.0']++;
        else if (val >= 8.0) buckets['8.0-8.9']++;
        else if (val >= 7.0) buckets['7.0-7.9']++;
        else if (val >= 6.0) buckets['6.0-6.9']++;
        else if (val >= 5.0) buckets['5.0-5.9']++;
        else buckets['0-4.9']++;
      }

      return ok(
        Object.entries(buckets).map(([range, count]) => ({
          range,
          count,
          percentage: sems.length > 0 ? Math.round((count / sems.length) * 1000) / 10 : 0,
        }))
      );
    }

    return err('Unknown analytics type', 400);
  } catch (e) {
    console.error('[GET /api/analytics]', e);
    return err('Failed to fetch analytics', 500);
  }
}