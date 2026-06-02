// src/app/students/[hallTicket]/page.tsx
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { StudentProfileClient } from '@/components/features/students/StudentProfileClient';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ hallTicket: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { hallTicket } = await params;
  try {
    const student = await prisma.student.findUnique({
      where: { hall_ticket: hallTicket },
      select: { student_name: true, program: true },
    });
    if (!student) return { title: 'Student Not Found' };
    return {
      title: student.student_name,
      description: `Academic profile for ${student.student_name} — ${student.program}`,
    };
  } catch {
    return { title: 'Student Profile' };
  }
}

export default async function StudentProfilePage({ params }: PageProps) {
  const { hallTicket } = await params;

  let student;
  try {
    student = await prisma.student.findUnique({
      where: { hall_ticket: hallTicket },
      include: {
        semesters: {
          orderBy: { id: 'asc' },
          include: {
            results: {
              include: { subject: true },
              orderBy: { subject_id: 'asc' },
            },
          },
        },
      },
    });
  } catch {
    return notFound();
  }

  if (!student) return notFound();

  // Compute program rank
  let programRank: number | null = null;
  if (student.program) {
    try {
      const allSgpas = await prisma.semester.groupBy({
        by: ['student_id'],
        where: {
          student: { program: student.program },
          sgpa: { not: null },
        },
        _max: { sgpa: true },
        orderBy: { _max: { sgpa: 'desc' } },
      });
      const idx = allSgpas.findIndex(r => r.student_id === student!.id);
      programRank = idx >= 0 ? idx + 1 : null;
    } catch { /* ignore */ }
  }

  return <StudentProfileClient student={student} programRank={programRank} />;
}