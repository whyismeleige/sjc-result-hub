// src/app/page.tsx
import { HeroSection } from '@/components/features/home/HeroSection';
import { QuickSearch } from '@/components/features/home/QuickSearch';
import { TopPerformers } from '@/components/features/home/TopPerformers';
import { BranchHighlights } from '@/components/features/home/BranchHighlights';
import prisma from '@/lib/prisma';
import { toNumber } from '@/lib/api';

// Data is read live in production (Vercel) — do not statically prerender
// against a database that may not exist at build time.
export const dynamic = 'force-dynamic';

async function getHomeStats() {
  try {
    const [studentCount, semesterCount, subjectCount, passCount, totalWithResult] = await Promise.all([
      prisma.student.count(),
      prisma.semester.count(),
      prisma.subject.count(),
      prisma.semester.count({ where: { overall_result: 'PASS' } }),
      prisma.semester.count({ where: { overall_result: { not: null } } }),
    ]);

    return {
      studentCount,
      semesterCount,
      subjectCount,
      passRate: totalWithResult > 0 ? Math.round((passCount / totalWithResult) * 100) : 0,
    };
  } catch {
    return { studentCount: 0, semesterCount: 0, subjectCount: 0, passRate: 0 };
  }
}

async function getTopPerformersData() {
  try {
    const topSemesters = await prisma.semester.findMany({
      where: {
        sgpa: { not: null },
        overall_result: 'PASS',
      },
      orderBy: { sgpa: 'desc' },
      take: 5,
      include: {
        student: { select: { id: true, student_name: true, hall_ticket: true, program: true } },
      },
    });
    return topSemesters.map(s => ({
      id: s.id,
      student_id: s.student_id,
      semester_name: s.semester_name,
      exam_month_year: s.exam_month_year,
      sgpa: toNumber(s.sgpa),
      student: s.student,
    }));
  } catch {
    return [];
  }
}

async function getBranchData() {
  try {
    const programs = await prisma.student.groupBy({
      by: ['program'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 6,
    });
    return programs;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [stats, topPerformers, branchData] = await Promise.all([
    getHomeStats(),
    getTopPerformersData(),
    getBranchData(),
  ]);

  return (
    <div className="page-enter">
      {/* Hero */}
      <HeroSection stats={stats} />

      {/* Main content */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pb-16 space-y-10">
        {/* Quick search */}
        <section className="-mt-6 relative z-10">
          <QuickSearch />
        </section>

        {/* Stats overview */}

        {/* Two-col: top performers + branch highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <TopPerformers entries={topPerformers} />
          </div>
          <div className="lg:col-span-2">
            <BranchHighlights programs={branchData} />
          </div>
        </div>
      </div>
    </div>
  );
}