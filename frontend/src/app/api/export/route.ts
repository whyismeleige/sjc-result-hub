// src/app/api/export/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { err, parseQuery, rateLimit, getClientIp, isAdminRequest, toNumber } from '@/lib/api';
import { sanitizeCsvCell } from '@/utils';
import {
  computeGradeDist, computeSgpaDist, computeProgramDist,
  computeSemesterAverages, computePassRateTrend,
} from '@/lib/export-metrics';

export const runtime = 'nodejs';

const FORMATS = ['csv', 'json'] as const;

const exportSchema = z.object({
  format: z.enum(FORMATS).default('csv'),
  scope: z.enum(['students', 'semesters', 'grades', 'all']).default('all'),
  students: z.string().max(4000).optional(),
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

function toCsv(rows: string[][], includeHeaders: boolean, headers: string[]) {
  const lines: string[][] = includeHeaders ? [headers] : [];
  for (const row of rows) {
    lines.push(row.map(cell => `"${sanitizeCsvCell(cell).replace(/"/g, '""')}"`));
  }
  return lines.map(line => line.join(',')).join('\n');
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { ok: allowed } = await rateLimit(ip, 20, 60_000, isAdminRequest(req));
  if (!allowed) return err('Rate limit exceeded', 429);

  const parsed = parseQuery(req, exportSchema);
  if ('error' in parsed) return parsed.error;

  const { format, scope, students, preview } = parsed.data;
  const { where: whereStudent, list: studentList } = getStudentFilter(students);

  const isJson = format === 'json';
  const jsonData: Record<string, unknown> = { scope, charts: {} as Record<string, unknown> };
  let csvHeaders: string[] = [];
  let totalRows = 0;
  const csvRows: string[][] = [];

  try {
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
        csvHeaders = ['Hall Ticket', 'Name', 'Father Name', 'Mother Name', 'Program'];
        for (const r of rows) {
          csvRows.push([r.hall_ticket, r.student_name, r.father_name || '', r.mother_name || '', r.program || '']);
        }
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
        jsonData.semesters = semRows.map(s => ({
          ...s,
          sgpa: toNumber(s.sgpa),
        }));
        (jsonData.charts as Record<string, unknown>).semesterAverages =
          computeSemesterAverages(semRows.map(s => ({ semester_name: s.semester_name, sgpa: toNumber(s.sgpa) })));
        (jsonData.charts as Record<string, unknown>).passRateTrend = computePassRateTrend(semRows);
        (jsonData.charts as Record<string, unknown>).sgpaDistribution =
          computeSgpaDist(semRows.map(s => toNumber(s.sgpa)));
      } else {
        if (csvHeaders.length === 0) {
          csvHeaders = ['Hall Ticket', 'Student Name', 'Semester', 'Exam Period', 'SGPA', 'Result'];
        }
        for (const r of semRows) {
          csvRows.push([r.student.hall_ticket, r.student.student_name, r.semester_name, r.exam_month_year, r.sgpa ? String(r.sgpa) : '', r.overall_result || '']);
        }
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
        if (csvHeaders.length === 0) {
          csvHeaders = ['Hall Ticket', 'Student Name', 'Semester', 'Course Code', 'Course Title', 'Grade', 'Result'];
        }
        for (const r of gradeRows) {
          csvRows.push([r.semester.student.hall_ticket, r.semester.student.student_name, r.semester.semester_name, r.subject.course_code, r.subject.course_title, r.grade || '', r.subject_result || '']);
        }
      }
      if (scope === 'grades') totalRows = gradeRows.length;
      else totalRows += gradeRows.length;
    }

    jsonData.totalRows = totalRows;

    // ── Preview mode ────────────────────────────────────────────
    if (preview) {
      return new Response(JSON.stringify({ totalRows, headers: csvHeaders }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── JSON output ─────────────────────────────────────────────
    if (isJson) {
      return new Response(JSON.stringify(jsonData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── CSV output (formula-injection sanitized) ────────────────
    const csvContent = toCsv(csvRows, !preview, csvHeaders);
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