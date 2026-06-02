'use client';
// src/components/features/rankings/LeaderboardClient.tsx
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, GraduationCap, ChevronLeft, ChevronRight, X, Filter, ArrowRight
} from 'lucide-react';
import { sgpaColor, cn } from '@/utils';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/hooks/useSort';

type LeaderboardType = 'sgpa' | 'branch';

interface RankEntry {
  rank: number;
  student?: {
    id: number;
    hall_ticket: string;
    student_name: string;
    program: string | null;
  };
  sgpa?: number | null;
  semester_name?: string;
  exam_month_year?: string;
  // branch type
  program?: string;
  studentCount?: number;
  avgSgpa?: number;
  passRate?: number;
  topSgpa?: number;
}

interface FiltersData {
  semesters: string[];
  examMonths: string[];
  programs: (string | null)[];
}

const TABS: { type: LeaderboardType; label: string; icon: typeof TrendingUp }[] = [
  { type: 'sgpa',   label: 'Semester SGPA',   icon: TrendingUp },
  { type: 'branch', label: 'Branch Rankings', icon: GraduationCap },
];

export function LeaderboardClient() {
  const router = useRouter();
  const [type, setType]       = useState<LeaderboardType>('sgpa');
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState<RankEntry[] | null>(null);
  const [meta, setMeta]       = useState<{ total: number; totalPages: number } | null>(null);
  const loading = data === null;

  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [program, setProgram] = useState('');
  const [semester, setSemester] = useState('');
  const [examMonthYear, setExamMonthYear] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard/filters')
      .then(r => r.json())
      .then(j => setFilters(j.data || null))
      .catch(() => {});
  }, []);

  const activeFilterCount = [program, semester, examMonthYear].filter(Boolean).length;

  useEffect(() => {
    const id = setTimeout(() => setPage(1));
    return () => clearTimeout(id);
  }, [type, program, semester, examMonthYear]);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ type, page: String(page), limit: '20' });
    if (program)   params.set('program', program);
    if (semester)  params.set('semester', semester);
    if (examMonthYear) params.set('examMonthYear', examMonthYear);
    const url = `/api/leaderboard?${params.toString()}`;

    fetch(url, { signal: ac.signal })
      .then(res => res.json())
      .then(json => {
        if (ac.signal.aborted) return;
        setData(json.data || []);
        setMeta(json.meta || null);
      })
      .catch(() => { if (!ac.signal.aborted) { setData([]); setMeta(null); } });
    return () => ac.abort();
  }, [type, page, program, semester, examMonthYear]);

  const { sortKey: sgpaKey, sortDir: sgpaDir, toggle: sgpaToggle, sorted: sgpaSorted } = useSort('sgpa', 'desc');
  const { sortKey: branchKey, sortDir: branchDir, toggle: branchToggle, sorted: branchSorted } = useSort('avgSgpa', 'desc');

  const sortedSgpa = useMemo(() => sgpaSorted(
    (data ?? []).map(e => ({
      ...e,
      _studentName: e.student?.student_name ?? '',
      _program: e.student?.program ?? '',
    }))
  ), [data, sgpaSorted]);

  const sortedBranch = useMemo(() => branchSorted(data ?? []), [data, branchSorted]);

  const clearFilters = () => {
    setProgram('');
    setSemester('');
    setExamMonthYear('');
  };

  return (
    <div className="space-y-6">
      {/* Header + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-dark-200 p-1 rounded-xl border border-white/[0.06] w-fit">
          {TABS.map(({ type: t, label, icon: Icon }) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                type === t
                  ? 'bg-brand-700/60 text-brand-200 shadow-glow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5',
            showFilters && 'ring-1 ring-brand-600/50'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-brand-700 text-brand-200 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 animate-fadeInUp">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-surface-500 hover:text-surface-200 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Program */}
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Program</label>
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                className="input text-sm py-1.5"
              >
                <option value="">All Programs</option>
                {(filters?.programs ?? []).map(p => p && (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Semester</label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="input text-sm py-1.5"
              >
                <option value="">All Semesters</option>
                {(filters?.semesters ?? []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Exam Month/Year */}
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Exam Period</label>
              <select
                value={examMonthYear}
                onChange={e => setExamMonthYear(e.target.value)}
                className="input text-sm py-1.5"
              >
                <option value="">All Periods</option>
                {(filters?.examMonths ?? []).map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {program && <span className="badge bg-brand-900/40 text-brand-300 border-brand-800/40 text-xs">Program: {program}</span>}
          {semester && <span className="badge bg-brand-900/40 text-brand-300 border-brand-800/40 text-xs">Semester: {semester}</span>}
          {examMonthYear && <span className="badge bg-brand-900/40 text-brand-300 border-brand-800/40 text-xs">Period: {examMonthYear}</span>}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={15} cols={5} />
      ) : (
        <>
          {/* Semester SGPA student table */}
          {type === 'sgpa' && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-12">Rank</th>
                    <SortableTh label="Student" sortKey="_studentName" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} />
                    <SortableTh label="Program" sortKey="_program" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} />
                    <SortableTh label="SGPA" sortKey="sgpa" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} className="text-right" />
                    <SortableTh label="Semester" sortKey="semester_name" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} className="text-center" />
                  </tr>
                </thead>
                <tbody>
                  {sortedSgpa.map((entry, i) => (
                    <tr key={i} className="animate-fadeInUp"
                        style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'both' }}>
                      <td>
                        <span className={cn('font-mono font-bold text-sm',
                          entry.rank === 1 ? 'rank-1' :
                          entry.rank === 2 ? 'rank-2' :
                          entry.rank === 3 ? 'rank-3' : 'text-surface-500'
                        )}>
                          {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank-1] : entry.rank}
                        </span>
                      </td>
                      <td>
                        <Link href={`/students/${entry.student?.hall_ticket}`}
                              className="group flex items-center gap-2">
                          <span className="font-medium text-surface-100 group-hover:text-brand-300 transition-colors">
                            {entry.student?.student_name}
                          </span>
                          <span className="font-mono text-xs text-surface-600">
                            {entry.student?.hall_ticket}
                          </span>
                        </Link>
                      </td>
                      <td className="text-xs text-surface-400 max-w-[200px] truncate">
                        {entry.student?.program ?? '—'}
                      </td>
                      <td className="text-right">
                        <span className="font-display font-bold text-lg tabular-nums"
                              style={{ color: sgpaColor(entry.sgpa ?? null) }}>
                          {entry.sgpa?.toFixed(2) ?? '—'}
                        </span>
                      </td>
                      <td className="text-center text-xs text-surface-500">
                        {entry.semester_name}<br />
                        <span className="text-surface-600">{entry.exam_month_year}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Branch leaderboard */}
          {type === 'branch' && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-12">Rank</th>
                    <SortableTh label="Program" sortKey="program" currentKey={branchKey} dir={branchDir} onToggle={branchToggle} />
                    <SortableTh label="Students" sortKey="studentCount" currentKey={branchKey} dir={branchDir} onToggle={branchToggle} className="text-right" />
                    <SortableTh label="Avg SGPA" sortKey="avgSgpa" currentKey={branchKey} dir={branchDir} onToggle={branchToggle} className="text-right" />
                    <SortableTh label="Top SGPA" sortKey="topSgpa" currentKey={branchKey} dir={branchDir} onToggle={branchToggle} className="text-right" />
                    <SortableTh label="Pass Rate" sortKey="passRate" currentKey={branchKey} dir={branchDir} onToggle={branchToggle} className="text-right" />
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBranch.map((entry, i) => (
                    <tr key={i} className="animate-fadeInUp group cursor-pointer"
                        style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}
                        onClick={() => router.push(`/rankings/branch/${encodeURIComponent(entry.program ?? '')}`)}>
                      <td>
                        <span className={cn('font-mono font-bold text-sm',
                          entry.rank === 1 ? 'rank-1' :
                          entry.rank === 2 ? 'rank-2' :
                          entry.rank === 3 ? 'rank-3' : 'text-surface-500'
                        )}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="font-medium text-surface-100 group-hover:text-brand-300 transition-colors">
                        {entry.program}
                      </td>
                      <td className="text-right font-mono text-surface-300">{entry.studentCount}</td>
                      <td className="text-right">
                        <span className="font-bold tabular-nums"
                              style={{ color: sgpaColor(entry.avgSgpa ?? null) }}>
                          {entry.avgSgpa?.toFixed(2) ?? '—'}
                        </span>
                      </td>
                      <td className="text-right font-mono text-brand-400 tabular-nums">
                        {entry.topSgpa?.toFixed(2) ?? '—'}
                      </td>
                      <td className="text-right">
                        <span className={cn('font-bold text-sm',
                          (entry.passRate ?? 0) >= 80 ? 'text-brand-400' :
                          (entry.passRate ?? 0) >= 60 ? 'text-amber-400' : 'text-rose-400'
                        )}>
                          {entry.passRate}%
                        </span>
                      </td>
                      <td className="text-center">
                        <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-brand-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p-1))}
                      disabled={page <= 1}
                      className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-surface-400 font-mono">
                {page} / {meta.totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p+1))}
                      disabled={page >= meta.totalPages}
                      className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}