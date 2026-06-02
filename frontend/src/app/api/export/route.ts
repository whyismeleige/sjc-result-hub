// src/app/api/export/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { err, parseQuery, rateLimit, getClientIp } from '@/lib/api';

const FORMATS = ['csv', 'json', 'pdf', 'xlsx'] as const;

const exportSchema = z.object({
  format: z.enum(FORMATS).default('csv'),
  scope: z.enum(['students', 'semesters', 'grades', 'all']).default('all'),
  students: z.string().optional(),
  preview: z.coerce.boolean().default(false),
});

function getStudentFilter(students?: string) {
  const list = students
    ? students.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : undefined;
  return {
    where: list?.length ? { hall_ticket: { in: list } } : {},
    list,
  };
}

function computeGradeDist(grades: { grade: string | null }[]) {
  const map = new Map<string, number>();
  grades.forEach(g => {
    const key = g.grade || 'Ungraded';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => (a.grade < b.grade ? -1 : 1));
}

function computeSgpaDist(sgpas: (string | null)[]) {
  const buckets = ['0.0-2.0', '2.0-4.0', '4.0-6.0', '6.0-8.0', '8.0-10.0'];
  const counts = new Map(buckets.map(b => [b, 0]));
  sgpas.forEach(s => {
    const v = parseFloat(s || '0');
    if (v < 2) counts.set('0.0-2.0', counts.get('0.0-2.0')! + 1);
    else if (v < 4) counts.set('2.0-4.0', counts.get('2.0-4.0')! + 1);
    else if (v < 6) counts.set('4.0-6.0', counts.get('4.0-6.0')! + 1);
    else if (v < 8) counts.set('6.0-8.0', counts.get('6.0-8.0')! + 1);
    else counts.set('8.0-10.0', counts.get('8.0-10.0')! + 1);
  });
  return buckets.map(range => ({ range, count: counts.get(range)! }));
}

function computeProgramDist(students: { program: string | null }[]) {
  const map = new Map<string, number>();
  students.forEach(s => {
    const p = s.program || 'Unknown';
    map.set(p, (map.get(p) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function computeSemesterAverages(semesters: { semester_name: string; sgpa: string | null }[]) {
  const groups = new Map<string, { sum: number; count: number }>();
  semesters.forEach(s => {
    const v = parseFloat(s.sgpa || '0');
    if (!groups.has(s.semester_name)) groups.set(s.semester_name, { sum: 0, count: 0 });
    const g = groups.get(s.semester_name)!;
    g.sum += v;
    g.count += 1;
  });
  return Array.from(groups.entries())
    .map(([semester, { sum, count }]) => ({ semester, avgSgpa: Math.round((sum / count) * 100) / 100 }))
    .sort((a, b) => (a.semester < b.semester ? -1 : 1));
}

function computePassRateTrend(semesters: { semester_name: string; overall_result: string | null }[]) {
  const groups = new Map<string, { total: number; passed: number }>();
  semesters.forEach(s => {
    if (!groups.has(s.semester_name)) groups.set(s.semester_name, { total: 0, passed: 0 });
    const g = groups.get(s.semester_name)!;
    g.total += 1;
    if (s.overall_result?.toLowerCase() === 'pass') g.passed += 1;
  });
  return Array.from(groups.entries())
    .map(([semester, { total, passed }]) => ({ semester, passRate: Math.round((passed / total) * 100) }))
    .sort((a, b) => (a.semester < b.semester ? -1 : 1));
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = rateLimit(ip, 20, 60_000);
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, exportSchema);
  if ('error' in parsed) return parsed.error;

  const { format, scope, students, preview } = parsed.data;
  const { where: whereStudent, list: studentList } = getStudentFilter(students);

  const isJson = format === 'json' || format === 'pdf' || format === 'xlsx';
  const jsonData: Record<string, unknown> = { scope, charts: {} as Record<string, unknown> };

  try {
    let csvRows: string[][] = [];
    let headers: string[] = [];
    let totalRows = 0;

    // ── Students scope ──────────────────────────────────────────
    if (scope === 'all' || scope === 'students') {
      const rows = await prisma.student.findMany({
        where: whereStudent,
        select: { hall_ticket: true, student_name: true, father_name: true, mother_name: true, program: true },
        orderBy: { student_name: 'asc' },
      });

      if (isJson) {
        jsonData.students = rows;
        (jsonData.charts as Record<string, unknown>).programDistribution = computeProgramDist(rows);
      } else {
        headers = ['Hall Ticket', 'Name', 'Father Name', 'Mother Name', 'Program'];
        if (!preview) csvRows.push(headers);
        rows.forEach(r => csvRows.push([r.hall_ticket, r.student_name, r.father_name || '', r.mother_name || '', r.program || '']));
      }
      totalRows += rows.length;
    }

    // ── Semesters scope ─────────────────────────────────────────
    if (scope === 'all' || scope === 'semesters') {
      const semRows = await prisma.semester.findMany({
        where: studentList?.length ? { student: whereStudent } : {},
        select: {
          semester_name: true, exam_month_year: true, sgpa: true, overall_result: true,
          student: { select: { hall_ticket: true, student_name: true } },
        },
        orderBy: [{ student_id: 'asc' }, { id: 'asc' }],
      });

      if (isJson) {
        jsonData.semesters = semRows;
        (jsonData.charts as Record<string, unknown>).semesterAverages = computeSemesterAverages(semRows);
        (jsonData.charts as Record<string, unknown>).passRateTrend = computePassRateTrend(semRows);
        (jsonData.charts as Record<string, unknown>).sgpaDistribution = computeSgpaDist(semRows.map(s => s.sgpa));
      } else {
        const semHeaders = ['Hall Ticket', 'Student Name', 'Semester', 'Exam Period', 'SGPA', 'Result'];
        if (scope === 'semesters') {
          headers = semHeaders;
          if (!preview) csvRows.push(headers);
        } else if (!preview) {
          headers = csvRows[0] || semHeaders;
        }
        semRows.forEach(r => csvRows.push([r.student.hall_ticket, r.student.student_name, r.semester_name, r.exam_month_year, r.sgpa || '', r.overall_result || '']));
      }
      totalRows += semRows.length;
    }

    // ── Grades scope ────────────────────────────────────────────
    if (scope === 'all' || scope === 'grades') {
      const gradeRows = await prisma.semesterResult.findMany({
        where: studentList?.length ? { semester: { student: whereStudent } } : {},
        select: {
          grade: true, subject_result: true,
          semester: {
            select: {
              semester_name: true, exam_month_year: true,
              student: { select: { hall_ticket: true, student_name: true } },
            },
          },
          subject: { select: { course_code: true, course_title: true } },
        },
        orderBy: { id: 'asc' },
      });

      if (isJson) {
        jsonData.grades = gradeRows;
        (jsonData.charts as Record<string, unknown>).gradeDistribution = computeGradeDist(gradeRows);
      } else {
        const gradeHeaders = ['Hall Ticket', 'Student Name', 'Semester', 'Course Code', 'Course Title', 'Grade', 'Result'];
        if (scope === 'grades' || (!preview && csvRows.length === 0)) {
          headers = gradeHeaders;
          if (!preview) csvRows = [gradeHeaders];
        }
        gradeRows.forEach(r => csvRows.push([r.semester.student.hall_ticket, r.semester.student.student_name, r.semester.semester_name, r.subject.course_code, r.subject.course_title, r.grade || '', r.subject_result || '']));
      }
      if (scope === 'grades') totalRows = gradeRows.length;
      else totalRows += gradeRows.length;
    }

    jsonData.totalRows = totalRows;

    // ── Preview mode ────────────────────────────────────────────
    if (preview) {
      return new Response(JSON.stringify({ totalRows, headers }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── JSON output ─────────────────────────────────────────────
    if (isJson) {
      return new Response(JSON.stringify(jsonData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── CSV output ──────────────────────────────────────────────
    const csvContent = csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = scope === 'all' ? 'complete-export.csv'
      : scope === 'students' ? 'students.csv'
      : scope === 'semesters' ? 'semester-results.csv'
      : 'grade-breakdown.csv';

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Rows': String(totalRows),
      },
    });
  } catch (e) {
    console.error('[GET /api/export]', e);
    return err('Export failed', 500);
  }
}
