'use client';
// src/components/features/analytics/AnalyticsClient.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Users, BookOpen, CheckCircle,
  Award, GraduationCap, BarChart3
} from 'lucide-react';
import { cn, compactNumber, sgpaColor } from '@/utils';
import { useSort } from '@/hooks/useSort';
import { SortableTh } from '@/components/ui/SortableTh';

interface Overview {
  totalStudents: number;
  totalSemesters: number;
  totalSubjects: number;
  passCount: number;
  promotedCount: number;
  failCount: number;
  passRate: number;
  topSgpa: { sgpa: string; student: { student_name: string; hall_ticket: string } } | null;
  branchDistribution: { program: string; studentCount: number }[];
  sgpaDistribution: { range: string; count: number; percentage: number }[];
}

interface BranchStat {
  program: string;
  studentCount: number;
  avgSgpa: number;
  passRate: number;
  topSgpa: number;
}

interface GradeDist {
  grade: string;
  count: number;
  percentage: number;
}

interface PassRateItem {
  semester_name: string;
  exam_month_year: string;
  total: number;
  passCount: number;
  passRate: number;
}

interface SgpaBucket {
  range: string;
  count: number;
  percentage: number;
}

const GRADE_COLORS: Record<string, string> = {
  'O': '#1aad9e', 'A+': '#84cc16', 'A': '#0ea5e9',
  'B+': '#a855f7', 'B': '#f59e0b', 'C': '#f97316',
  'F': '#f43f5e', 'AB': '#636e7d',
};

const BRAND_COLORS = ['#1aad9e', '#0ea5e9', '#a855f7', '#f59e0b', '#84cc16', '#f97316', '#f43f5e', '#636e7d'];

type Tab = 'overview' | 'branch-performance' | 'grade-distribution' | 'pass-rate' | 'sgpa-distribution';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'branch-performance', label: 'Branch Performance' },
  { key: 'grade-distribution', label: 'Grades' },
  { key: 'pass-rate', label: 'Pass Rate' },
  { key: 'sgpa-distribution', label: 'SGPA Distribution' },
];

const SGPA_RANGE_COLORS: Record<string, string> = {
  '9.0-10.0': '#1aad9e',
  '8.0-8.9': '#84cc16',
  '7.0-7.9': '#0ea5e9',
  '6.0-6.9': '#f59e0b',
  '5.0-5.9': '#f97316',
  '0-4.9': '#f43f5e',
};

function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview) {
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-4"><div className="skeleton h-8 w-8 rounded-lg mb-3" /><div className="skeleton h-6 w-16 mb-1" /><div className="skeleton h-3 w-12" /></div>
      ))}
    </div>;
  }

  const cards = [
    { icon: Users, label: 'Total Students', value: compactNumber(overview.totalStudents), color: 'text-brand-400', bg: 'bg-brand-900/30 border-brand-800/40' },
    { icon: BookOpen, label: 'Semester Records', value: compactNumber(overview.totalSemesters), color: 'text-sky-400', bg: 'bg-sky-900/30 border-sky-800/40' },
    { icon: Award, label: 'Subjects', value: compactNumber(overview.totalSubjects), color: 'text-violet-400', bg: 'bg-violet-900/30 border-violet-800/40' },
    { icon: CheckCircle, label: 'Pass Rate', value: `${overview.passRate}%`, color: 'text-lime-400', bg: 'bg-lime-900/30 border-lime-800/40' },
    { icon: TrendingUp, label: 'Promoted', value: compactNumber(overview.promotedCount), color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-800/40' },
    { icon: TrendingUp, label: 'Failed', value: compactNumber(overview.failCount), color: 'text-rose-400', bg: 'bg-rose-900/30 border-rose-800/40' },
  ];

  const branchData = overview.branchDistribution ?? [];
  const sgpaDist = overview.sgpaDistribution ?? [];

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(({ icon: Icon, label, value, color, bg }, i) => (
          <div key={label} className="card p-4 animate-fadeInUp" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'both' }}>
            <div className={`inline-flex p-2 rounded-lg border ${bg} mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="font-display font-bold text-2xl text-white tabular-nums">{value}</div>
            <div className="text-xs text-surface-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Top performer + SGPA distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top performer */}
        <div className="lg:col-span-2">
          {overview.topSgpa ? (
            <div className="card p-5 h-full flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-800/40">
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-surface-500">Top Performer</div>
                  <div className="text-xs text-surface-600">All-time SGPA</div>
                </div>
              </div>
              <div className="font-display font-bold text-xl text-white">
                {overview.topSgpa.student.student_name}
                <span className="text-brand-400 ml-3 font-mono">{parseFloat(overview.topSgpa.sgpa).toFixed(2)}</span>
              </div>
              <div className="text-xs text-surface-500 font-mono">{overview.topSgpa.student.hall_ticket}</div>
            </div>
          ) : (
            <div className="card p-5 h-full flex items-center justify-center text-surface-500 text-sm">
              No top performer data
            </div>
          )}
        </div>

        {/* SGPA Distribution mini */}
        <div className="lg:col-span-3 card p-5">
          <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" /> SGPA Distribution
          </h3>
          {sgpaDist.length === 0 ? (
            <div className="text-surface-500 text-sm text-center py-6">No data</div>
          ) : (
            <div className="space-y-2.5">
              {sgpaDist.map(b => (
                <div key={b.range}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-surface-400">{b.range}</span>
                    <span className="font-mono text-surface-500">{b.count} ({b.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${b.percentage}%`, backgroundColor: SGPA_RANGE_COLORS[b.range] || '#636e7d' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch Distribution chart */}
      {branchData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-400" /> Branch-wise Student Distribution
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branchData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="program" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#14181f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                labelStyle={{ color: '#a0aab5' }}
              />
              <Bar dataKey="studentCount" radius={[6, 6, 0, 0]}>
                {branchData.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BranchTab({ branchStats, loading }: { branchStats: BranchStat[] | null; loading: boolean }) {
  const { sortKey, sortDir, toggle, sorted } = useSort('studentCount', 'desc');
  const sortedData = useMemo(() => sorted(branchStats ?? []), [branchStats, sorted]);
  if (loading) return <div className="card p-5"><div className="skeleton h-64 w-full rounded-lg" /></div>;
  if (!branchStats || branchStats.length === 0) return <div className="card p-12 text-center text-surface-500">No branch data available</div>;

  return (
    <div className="space-y-6">
      {/* Comparison chart */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" /> Branch Performance Comparison
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sortedData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="program" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#14181f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
              labelStyle={{ color: '#a0aab5' }}
            />
            <Bar yAxisId="left" dataKey="avgSgpa" name="Avg SGPA" fill="#1aad9e" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="passRate" name="Pass Rate %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Program" sortKey="program" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
              <SortableTh label="Students" sortKey="studentCount" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              <SortableTh label="Avg SGPA" sortKey="avgSgpa" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              <SortableTh label="Top SGPA" sortKey="topSgpa" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              <SortableTh label="Pass Rate" sortKey="passRate" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((b, i) => (
              <tr key={b.program} className="animate-fadeInUp" style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}>
                <td className="font-medium text-surface-100">{b.program}</td>
                <td className="text-right font-mono text-surface-300">{b.studentCount}</td>
                <td className="text-right font-mono font-bold tabular-nums" style={{ color: sgpaColor(b.avgSgpa) }}>
                  {b.avgSgpa.toFixed(2)}
                </td>
                <td className="text-right font-mono text-brand-400">{b.topSgpa.toFixed(2)}</td>
                <td className="text-right">
                  <span className={cn('font-bold text-sm', b.passRate >= 80 ? 'text-brand-400' : b.passRate >= 60 ? 'text-amber-400' : 'text-rose-400')}>
                    {b.passRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradeTab({ gradeDist, loading }: { gradeDist: GradeDist[] | null; loading: boolean }) {
  const { sortKey, sortDir, toggle, sorted } = useSort('grade', 'asc');
  const sortedData = useMemo(() => sorted(gradeDist ?? []), [gradeDist, sorted]);
  if (loading) return <div className="card p-5"><div className="skeleton h-64 w-full rounded-lg" /></div>;
  if (!gradeDist || gradeDist.length === 0) return <div className="card p-12 text-center text-surface-500">No grade data available</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">Grade Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={gradeDist}
              dataKey="count"
              nameKey="grade"
              cx="50%" cy="50%" outerRadius={100}
              label={({ payload }) => `${(payload as Record<string, unknown>).grade} (${(payload as Record<string, unknown>).percentage}%)`}
            >
              {gradeDist.map((entry) => (
                <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#1aad9e'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">Grade Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={gradeDist} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {gradeDist.map((entry) => (
                <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#1aad9e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="lg:col-span-2 card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">Grade Table</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Grade" sortKey="grade" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <SortableTh label="Count" sortKey="count" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
                <SortableTh label="Percentage" sortKey="percentage" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map((g) => (
                <tr key={g.grade}>
                  <td><span className="font-bold" style={{ color: GRADE_COLORS[g.grade] || '#fff' }}>{g.grade}</span></td>
                  <td className="text-right font-mono">{g.count}</td>
                  <td className="text-right font-mono">{g.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PassRateTab({ passRates, loading }: { passRates: PassRateItem[] | null; loading: boolean }) {
  const { sortKey, sortDir, toggle, sorted } = useSort('semester_name', 'asc');
  const sortedData = useMemo(() => sorted(passRates ?? []), [passRates, sorted]);
  if (loading) return <div className="card p-5"><div className="skeleton h-64 w-full rounded-lg" /></div>;
  if (!passRates || passRates.length === 0) return <div className="card p-12 text-center text-surface-500">No pass rate data available</div>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">Pass Rate by Semester</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={passRates} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="exam_month_year" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
            <Tooltip />
            <Area type="monotone" dataKey="passRate" stroke="#1aad9e" fill="#1aad9e" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Semester" sortKey="semester_name" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
              <SortableTh label="Exam Period" sortKey="exam_month_year" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
              <SortableTh label="Total" sortKey="total" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              <SortableTh label="Passed" sortKey="passCount" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
              <SortableTh label="Pass Rate" sortKey="passRate" currentKey={sortKey} dir={sortDir} onToggle={toggle} className="text-right" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((r, i) => (
              <tr key={i}>
                <td>{r.semester_name}</td>
                <td className="text-surface-500 text-xs">{r.exam_month_year}</td>
                <td className="text-right font-mono">{r.total}</td>
                <td className="text-right font-mono">{r.passCount}</td>
                <td className="text-right">
                  <span className={cn('font-bold text-sm', r.passRate >= 80 ? 'text-brand-400' : r.passRate >= 60 ? 'text-amber-400' : 'text-rose-400')}>
                    {r.passRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SgpaDistTab({ sgpaBuckets, loading }: { sgpaBuckets: SgpaBucket[] | null; loading: boolean }) {
  if (loading) return <div className="card p-5"><div className="skeleton h-64 w-full rounded-lg" /></div>;
  if (!sgpaBuckets || sgpaBuckets.length === 0) return <div className="card p-12 text-center text-surface-500">No SGPA distribution data available</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">SGPA Distribution</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={sgpaBuckets} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {sgpaBuckets.map((entry) => {
                const lo = parseFloat(entry.range.split('-')[0]);
                return <Cell key={entry.range} fill={sgpaColor(isNaN(lo) ? 0 : lo)} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-sm text-white mb-4">Percentage Breakdown</h3>
        <div className="space-y-3">
          {sgpaBuckets.map(b => {
            const lo = parseFloat(b.range.split('-')[0]);
            return (
              <div key={b.range}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-300">{b.range}</span>
                  <span className="font-mono text-surface-400">{b.count} ({b.percentage}%)</span>
                </div>
                <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${b.percentage}%`, backgroundColor: sgpaColor(isNaN(lo) ? 0 : lo) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsClient() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [branchStats, setBranchStats] = useState<BranchStat[] | null>(null);
  const [gradeDist, setGradeDist] = useState<GradeDist[] | null>(null);
  const [passRates, setPassRates] = useState<PassRateItem[] | null>(null);
  const [sgpaBuckets, setSgpaBuckets] = useState<SgpaBucket[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    fetch(`/api/analytics?type=${tab}`, { signal: ac.signal })
      .then(res => res.json())
      .then(json => {
        if (ac.signal.aborted) return;
        const data = json.data || [];
        switch (tab) {
          case 'overview': setOverview(data); break;
          case 'branch-performance': setBranchStats(data); break;
          case 'grade-distribution': setGradeDist(data); break;
          case 'pass-rate': setPassRates(data); break;
          case 'sgpa-distribution': setSgpaBuckets(data); break;
        }
      })
      .catch(() => {});

    return () => ac.abort();
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-dark-200 p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              tab === key ? 'bg-brand-700/60 text-brand-200 shadow-glow-sm' : 'text-surface-400 hover:text-surface-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab overview={overview} />}
      {tab === 'branch-performance' && <BranchTab branchStats={branchStats} loading={branchStats === null} />}
      {tab === 'grade-distribution' && <GradeTab gradeDist={gradeDist} loading={gradeDist === null} />}
      {tab === 'pass-rate' && <PassRateTab passRates={passRates} loading={passRates === null} />}
      {tab === 'sgpa-distribution' && <SgpaDistTab sgpaBuckets={sgpaBuckets} loading={sgpaBuckets === null} />}
    </div>
  );
}
