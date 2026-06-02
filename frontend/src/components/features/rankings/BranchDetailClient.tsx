'use client';
// src/components/features/rankings/BranchDetailClient.tsx
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, Award, Plus, ChevronLeft, ChevronRight, ArrowLeft, Search, X, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { sgpaColor, cn, formatSemester } from '@/utils';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/hooks/useSort';

interface SemesterBreakdown {
  semester_name: string;
  exam_month_year: string;
  avgSgpa: number | null;
  studentCount: number;
  passRate: number | null;
}

interface StudentEntry {
  id: number;
  hall_ticket: string;
  student_name: string;
  sgpa: number | null;
  semester_name: string | null;
  exam_month_year: string | null;
}

interface BranchData {
  program: string;
  studentCount: number;
  avgSgpa: number | null;
  topSgpa: number | null;
  passRate: number | null;
  semesterBreakdown: SemesterBreakdown[];
  students: StudentEntry[];
}

interface FilterOptions {
  semesters: string[];
  examMonths: string[];
}

function SGPATooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || !payload[0]) return null;
  const val = payload[0].value as number;
  return (
    <div className="card px-3 py-2 text-sm shadow-card-hover">
      <div className="text-surface-400 text-xs mb-1">{label as string}</div>
      <div className="font-display font-bold text-lg" style={{ color: sgpaColor(val) }}>
        {val.toFixed(2)}
      </div>
    </div>
  );
}

export function BranchDetailClient({ program }: { program: string }) {
  const [data, setData] = useState<BranchData | null>(null);
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const loading = data === null;

  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [semester, setSemester] = useState('');
  const [examMonthYear, setExamMonthYear] = useState('');
  const [search, setSearch] = useState('');

  const [activeTab, setActiveTab] = useState<'students' | 'analysis'>('students');

  useEffect(() => {
    fetch('/api/leaderboard/filters')
      .then(r => r.json())
      .then(j => setFilters(j.data || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setPage(1));
    return () => clearTimeout(id);
  }, [semester, examMonthYear, search]);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (semester)  params.set('semester', semester);
    if (examMonthYear) params.set('examMonthYear', examMonthYear);
    if (search)    params.set('search', search);

    fetch(`/api/leaderboard/branch/${encodeURIComponent(program)}?${params.toString()}`, { signal: ac.signal })
      .then(res => res.json())
      .then(json => {
        if (ac.signal.aborted) return;
        setData(json.data || null);
        setMeta(json.meta || null);
      })
      .catch(() => { if (!ac.signal.aborted) setData(null); });
    return () => ac.abort();
  }, [program, page, semester, examMonthYear, search]);

  const clearFilters = () => {
    setSemester('');
    setExamMonthYear('');
    setSearch('');
  };

  const activeFilterCount = [semester, examMonthYear, search].filter(Boolean).length;

  const chartData = (data?.semesterBreakdown ?? []).map(s => ({
    name: formatSemester(s.semester_name),
    avgSgpa: s.avgSgpa,
    exam: s.exam_month_year,
  }));

  const { sortKey: studentKey, sortDir: studentDir, toggle: studentToggle, sorted: studentSorted } = useSort('student_name', 'asc');
  const { sortKey: brKey, sortDir: brDir, toggle: brToggle, sorted: brSorted } = useSort('semester_name', 'asc');

  const sortedStudents = useMemo(() => studentSorted(data?.students ?? []), [data?.students, studentSorted]);
  const sortedBreakdown = useMemo(() => brSorted(data?.semesterBreakdown ?? []), [data?.semesterBreakdown, brSorted]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-10 bg-dark-300 rounded" /></div>
          ))}
        </div>
        <TableSkeleton rows={10} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/rankings" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-200 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Rankings
      </Link>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Students', value: data.studentCount, icon: Users, color: 'text-brand-400' },
          { label: 'Avg SGPA', value: data.avgSgpa?.toFixed(2) ?? '—', icon: TrendingUp, color: sgpaColor(data.avgSgpa) },
          { label: 'Top SGPA', value: data.topSgpa?.toFixed(2) ?? '—', icon: Award, color: sgpaColor(data.topSgpa) },
          { label: 'Pass Rate', value: data.passRate != null ? `${data.passRate}%` : '—', icon: Plus, color: data.passRate != null ? (data.passRate >= 80 ? 'text-brand-400' : data.passRate >= 60 ? 'text-amber-400' : 'text-rose-400') : 'text-surface-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-surface-500">{label}</span>
            </div>
            <div className="font-display font-bold text-2xl tabular-nums" style={color.startsWith('text-') ? {} : { color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-200 p-1 rounded-xl border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab('students')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'students'
              ? 'bg-brand-700/60 text-brand-200 shadow-glow-sm'
              : 'text-surface-400 hover:text-surface-200'
          )}
        >
          <Users className="w-4 h-4" /> Students
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'analysis'
              ? 'bg-brand-700/60 text-brand-200 shadow-glow-sm'
              : 'text-surface-400 hover:text-surface-200'
          )}
        >
          <BarChart3 className="w-4 h-4" /> Semester Analysis
        </button>
      </div>

      {/* ───── STUDENTS TAB ───── */}
      {activeTab === 'students' && (
        <>
          {/* Filters + search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search students…"
                className="input text-sm py-2 pl-9"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select value={semester} onChange={e => setSemester(e.target.value)} className="input text-sm py-2 w-auto">
              <option value="">All Semesters</option>
              {(filters?.semesters ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={examMonthYear} onChange={e => setExamMonthYear(e.target.value)} className="input text-sm py-2 w-auto">
              <option value="">All Periods</option>
              {(filters?.examMonths ?? []).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-surface-500 hover:text-surface-200 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Student table */}
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Student" sortKey="student_name" currentKey={studentKey} dir={studentDir} onToggle={studentToggle} />
                  <SortableTh label="Hall Ticket" sortKey="hall_ticket" currentKey={studentKey} dir={studentDir} onToggle={studentToggle} />
                  <SortableTh label="SGPA" sortKey="sgpa" currentKey={studentKey} dir={studentDir} onToggle={studentToggle} className="text-right" />
                  <SortableTh label="Semester" sortKey="semester_name" currentKey={studentKey} dir={studentDir} onToggle={studentToggle} className="text-center" />
                  <SortableTh label="Period" sortKey="exam_month_year" currentKey={studentKey} dir={studentDir} onToggle={studentToggle} className="text-center" />
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-surface-500 py-12">No students found</td></tr>
                ) : (
                  sortedStudents.map((s, i) => (
                    <tr key={s.id} className="animate-fadeInUp"
                        style={{ animationDelay: `${i * 0.03}s`, animationFillMode: 'both' }}>
                      <td>
                        <Link href={`/students/${s.hall_ticket}`}
                              className="font-medium text-surface-100 hover:text-brand-300 transition-colors">
                          {s.student_name}
                        </Link>
                      </td>
                      <td className="font-mono text-xs text-brand-400">{s.hall_ticket}</td>
                      <td className="text-right">
                        <span className="font-display font-bold text-lg tabular-nums"
                              style={{ color: sgpaColor(s.sgpa) }}>
                          {s.sgpa?.toFixed(2) ?? '—'}
                        </span>
                      </td>
                      <td className="text-center text-xs text-surface-400">{s.semester_name ?? '—'}</td>
                      <td className="text-center text-xs text-surface-500">{s.exam_month_year ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-surface-400 font-mono">{page} / {meta.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                      disabled={page >= meta.totalPages}
                      className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ───── ANALYSIS TAB ───── */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Semester avg bar chart */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" /> Average SGPA by Semester
            </h3>
            {chartData.length === 0 ? (
              <div className="text-center text-surface-500 py-12">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<SGPATooltip />} />
                  <ReferenceLine y={7} stroke="rgba(132,204,22,0.3)" strokeDasharray="5 5" />
                  <Bar dataKey="avgSgpa" fill="#1aad9e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Semester breakdown table */}
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Semester" sortKey="semester_name" currentKey={brKey} dir={brDir} onToggle={brToggle} />
                  <th>Exam Period</th>
                  <SortableTh label="Avg SGPA" sortKey="avgSgpa" currentKey={brKey} dir={brDir} onToggle={brToggle} className="text-right" />
                  <SortableTh label="Students" sortKey="studentCount" currentKey={brKey} dir={brDir} onToggle={brToggle} className="text-right" />
                  <SortableTh label="Pass Rate" sortKey="passRate" currentKey={brKey} dir={brDir} onToggle={brToggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {sortedBreakdown.map((s, i) => (
                  <tr key={i}>
                    <td className="font-medium">{formatSemester(s.semester_name)}</td>
                    <td className="text-xs text-surface-500">{s.exam_month_year}</td>
                    <td className="text-right">
                      <span className="font-bold tabular-nums" style={{ color: sgpaColor(s.avgSgpa) }}>
                        {s.avgSgpa?.toFixed(2) ?? '—'}
                      </span>
                    </td>
                    <td className="text-right font-mono text-surface-300">{s.studentCount}</td>
                    <td className="text-right">
                      <span className={cn('font-bold text-sm',
                        s.passRate == null ? 'text-surface-500' :
                        s.passRate >= 80 ? 'text-brand-400' :
                        s.passRate >= 60 ? 'text-amber-400' : 'text-rose-400'
                      )}>
                        {s.passRate != null ? `${s.passRate}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
