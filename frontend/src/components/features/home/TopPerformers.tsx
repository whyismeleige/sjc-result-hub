'use client';
// src/components/features/home/TopPerformers.tsx
import { useMemo } from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight } from 'lucide-react';
import { parseGPA, sgpaColor, formatSemester } from '@/utils';
import { useSort } from '@/hooks/useSort';
import { SortableTh } from '@/components/ui/SortableTh';

interface SemesterEntry {
  id: number;
  student_id: number;
  semester_name: string;
  exam_month_year: string;
  sgpa: string | null;
  student: {
    student_name: string;
    hall_ticket: string;
    program: string | null;
  };
}

interface Props {
  entries: SemesterEntry[];
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function TopPerformers({ entries }: Props) {
  const { sortKey, sortDir, toggle, sorted } = useSort('sgpa', 'desc');
  const sortedData = useMemo(() => sorted(
    entries.map(e => ({
      ...e,
      _studentName: e.student.student_name,
      _program: e.student.program ?? '',
    }))
  ), [entries, sorted]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="font-display font-bold text-lg text-white">Top Performers</h2>
          <span className="badge bg-amber-900/40 text-amber-400 border-amber-800/40 border ml-1">
            Latest Semester
          </span>
        </div>
        <Link href="/rankings" className="btn-ghost text-xs py-1 px-2 text-brand-400">
          Full Rankings <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="card overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-10 text-center text-surface-500">No data available</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <SortableTh label="Student" sortKey="_studentName" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <SortableTh label="Semester" sortKey="semester_name" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <SortableTh label="SGPA" sortKey="sgpa" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map((entry, i) => {
                const sgpa = parseGPA(entry.sgpa);
                return (
                  <tr key={entry.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'both' }}>
                    <td className="font-mono text-xs">
                      {i < 3 ? MEDAL[i] : <span className="text-surface-500">{i + 1}</span>}
                    </td>
                    <td>
                      <Link
                        href={`/students/${entry.student.hall_ticket}`}
                        className="group"
                      >
                        <div className="font-medium text-surface-100 group-hover:text-brand-300 transition-colors">
                          {entry.student.student_name}
                        </div>
                        <div className="text-xs text-surface-600 font-mono flex gap-2">
                          <span>{entry.student.hall_ticket}</span>
                          {entry.student.program && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{entry.student.program}</span>
                            </>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="text-xs text-surface-500">
                      {formatSemester(entry.semester_name)}
                      <div className="text-surface-600">{entry.exam_month_year}</div>
                    </td>
                    <td className="text-right">
                      <span
                        className="font-display font-bold text-lg tabular-nums"
                        style={{ color: sgpaColor(sgpa) }}
                      >
                        {sgpa?.toFixed(2) ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}