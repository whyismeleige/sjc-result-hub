'use client';
// src/components/features/students/StudentProfileClient.tsx
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, User, Trophy, TrendingUp, BookOpen,
  ChevronRight, Download, GitCompare, Award
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { parseGPA, sgpaColor, sgpaLabel, gradeColor, resultBadge, formatSemester, rankSuffix, cn } from '@/utils';
import { useSort } from '@/hooks/useSort';
import { SortableTh } from '@/components/ui/SortableTh';

// Types (inline for self-containedness)
interface Subject  { id: number; course_code: string; course_title: string; credits: number | null; }
interface SemResult{ id: number; grade: string | null; subject_result: string | null; subject: Subject; }
interface Semester  {
  id: number; semester_name: string; exam_month_year: string;
  sgpa: string | null; overall_result: string | null;
  results: SemResult[];
}
interface Student {
  id: number; hall_ticket: string; student_name: string;
  father_name: string | null; mother_name: string | null; program: string | null;
  semesters: Semester[];
}

interface Props {
  student: Student;
  programRank: number | null;
}

const TABS = ['Overview', 'Semester Results', 'SGPA Trend', 'Subject Analysis'] as const;
type Tab = typeof TABS[number];

// Custom tooltip for Recharts
function SGPATooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || !payload[0]) return null;
  const val = payload[0].value as number;
  return (
    <div className="card px-3 py-2 text-sm shadow-card-hover">
      <div className="text-surface-400 text-xs mb-1">{label as string}</div>
      <div className="font-display font-bold text-lg" style={{ color: sgpaColor(val) }}>
        {val.toFixed(2)}
      </div>
      <div className="text-surface-500 text-xs">{sgpaLabel(val)}</div>
    </div>
  );
}

export function StudentProfileClient({ student, programRank }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [expandedSem, setExpandedSem] = useState<number | null>(
    student.semesters[student.semesters.length - 1]?.id ?? null
  );

  const validSemesters = student.semesters.filter(s => s.sgpa && parseGPA(s.sgpa) !== null);
  const latestSGPA     = student.semesters.findLast(s => s.sgpa)?.sgpa;
  const bestSGPA       = Math.max(...validSemesters.map(s => parseGPA(s.sgpa) ?? 0));

  const totalSubjects  = student.semesters.reduce((a, s) => a + s.results.length, 0);
  const passCount      = student.semesters.reduce(
    (a, s) => a + s.results.filter(r => r.subject_result?.toUpperCase() === 'PASS').length, 0
  );
  const passRate       = totalSubjects > 0 ? Math.round((passCount / totalSubjects) * 100) : 0;

  // Chart data
  const chartData = student.semesters.map(s => ({
    name: formatSemester(s.semester_name),
    sgpa: parseGPA(s.sgpa),
    exam: s.exam_month_year,
  })).filter(d => d.sgpa !== null);

  const sgpaValue = parseGPA(latestSGPA);

  const { sortKey: sgpaKey, sortDir: sgpaDir, toggle: sgpaToggle, sorted: sgpaSorted } = useSort('semester_name', 'asc');
  const sortedSgpaTable = useMemo(() => sgpaSorted(student.semesters), [student.semesters, sgpaSorted]);

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      {/* Back */}
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </Link>

      {/* Profile header card */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-800 to-brand-950 border border-brand-700/40 flex items-center justify-center shrink-0 shadow-glow-sm">
            <User className="w-8 h-8 text-brand-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-2xl text-white mb-1">
              {student.student_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-surface-400 mb-2">
              <span className="font-mono text-brand-400 text-xs tracking-widest">
                {student.hall_ticket}
              </span>
              {student.program && (
                <>
                  <span className="text-surface-700">·</span>
                  <span>{student.program}</span>
                </>
              )}
            </div>
            {(student.father_name || student.mother_name) && (
              <div className="text-xs text-surface-600 space-x-3">
                {student.father_name && <span>Father: <span className="text-surface-400">{student.father_name}</span></span>}
                {student.mother_name && <span>Mother: <span className="text-surface-400">{student.mother_name}</span></span>}
              </div>
            )}
          </div>

          {programRank && (
              <div className="mt-2 flex items-center gap-1.5 justify-end text-xs text-amber-400">
                <Award className="w-3 h-3" />
                {rankSuffix(programRank)} in program
              </div>
            )}
        </div>

        {/* Quick stats */}
        <div className="glow-line my-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Semesters', value: student.semesters.length, sub: 'completed' },
            { label: 'Best SGPA', value: bestSGPA > 0 ? bestSGPA.toFixed(2) : '—', color: sgpaColor(bestSGPA) },
            { label: 'Latest SGPA', value: sgpaValue?.toFixed(2) ?? '—', color: sgpaColor(sgpaValue) },
            { label: 'Pass Rate', value: `${passRate}%`, sub: `${passCount}/${totalSubjects}` },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-dark-300/50 rounded-lg px-3 py-2.5">
              <div className="text-xs text-surface-500 mb-1">{label}</div>
              <div className="font-display font-bold text-xl tabular-nums"
                   style={color ? { color } : {}}>
                {value}
              </div>
              {sub && <div className="text-xs text-surface-600">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`/compare?a=${student.hall_ticket}`} className="btn-secondary text-xs py-1.5">
            <GitCompare className="w-3.5 h-3.5" /> Compare
          </Link>
          <Link href={`/export?students=${student.hall_ticket}`} className="btn-ghost text-xs py-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </Link>
          <Link href="/rankings" className="btn-ghost text-xs py-1.5">
            <Trophy className="w-3.5 h-3.5" /> Rankings
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.07] overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
              activeTab === tab
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-surface-500 hover:text-surface-200'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-6 animate-fadeInUp">
          {/* Semester summary cards */}
          <div>
            <h3 className="font-display font-semibold text-base text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" /> Semester Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {student.semesters.map(sem => {
                const sgpa = parseGPA(sem.sgpa);
                const badge = resultBadge(sem.overall_result);
                return (
                  <div key={sem.id} className="card p-4 hover:border-white/[0.12] transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm text-surface-200">
                          {formatSemester(sem.semester_name)}
                        </div>
                        <div className="text-xs text-surface-600">{sem.exam_month_year}</div>
                      </div>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        {sgpa !== null ? (
                          <div className="font-display font-bold text-2xl tabular-nums"
                               style={{ color: sgpaColor(sgpa) }}>
                            {sgpa.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-surface-600 text-sm">—</div>
                        )}
                        <div className="text-xs text-surface-600">SGPA</div>
                      </div>
                      <div className="text-right text-xs text-surface-600">
                        {sem.results.length} subjects
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini chart */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" /> SGPA Trend
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<SGPATooltip />} />
                  <ReferenceLine y={7} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="sgpa"
                    stroke="#1aad9e"
                    strokeWidth={2}
                    dot={{ fill: '#1aad9e', r: 4 }}
                    activeDot={{ r: 6, stroke: '#37c9b8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tab: Semester Results */}
      {activeTab === 'Semester Results' && (
        <div className="space-y-4 animate-fadeInUp">
          {student.semesters.map(sem => {
            const isOpen = expandedSem === sem.id;
            const sgpa = parseGPA(sem.sgpa);
            const badge = resultBadge(sem.overall_result);
            return (
              <div key={sem.id} className="card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedSem(isOpen ? null : sem.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-900/40 border border-brand-800/30 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-surface-100">{sem.semester_name}</div>
                      <div className="text-xs text-surface-500">{sem.exam_month_year}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {sgpa !== null && (
                      <span className="font-display font-bold text-xl tabular-nums"
                            style={{ color: sgpaColor(sgpa) }}>
                        {sgpa.toFixed(2)}
                      </span>
                    )}
                    <span className={`badge ${badge.className}`}>{badge.label}</span>
                    <ChevronRight className={cn(
                      'w-4 h-4 text-surface-500 transition-transform',
                      isOpen && 'rotate-90'
                    )} />
                  </div>
                </button>

                {/* Expanded results */}
                {isOpen && (
                  <div className="border-t border-white/[0.06]">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Course Title</th>
                          <th className="text-center">Credits</th>
                          <th className="text-center">Grade</th>
                          <th className="text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sem.results.map(r => {
                          const res = resultBadge(r.subject_result);
                          return (
                            <tr key={r.id}>
                              <td className="font-mono text-xs text-brand-400">
                                {r.subject.course_code}
                              </td>
                              <td className="text-surface-200 text-sm max-w-[260px]">
                                {r.subject.course_title}
                              </td>
                              <td className="text-center text-surface-400 text-xs">
                                {r.subject.credits ?? '—'}
                              </td>
                              <td className="text-center">
                                <span className={`font-bold text-sm tabular-nums ${gradeColor(r.grade)}`}>
                                  {r.grade ?? '—'}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${res.className}`}>{res.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: SGPA Trend */}
      {activeTab === 'SGPA Trend' && (
        <div className="card p-6 animate-fadeInUp">
          <h3 className="font-display font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-400" /> SGPA Performance Over Semesters
          </h3>
          {chartData.length === 0 ? (
            <div className="text-center text-surface-500 py-12">No SGPA data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} ticks={[0,2,4,6,7,8,9,10]} />
                <Tooltip content={<SGPATooltip />} />
                <ReferenceLine y={7} stroke="rgba(132,204,22,0.3)" strokeDasharray="5 5" label={{ value: '7.0', fill: '#84cc16', fontSize: 10 }} />
                <ReferenceLine y={9} stroke="rgba(26,173,158,0.3)" strokeDasharray="5 5" label={{ value: '9.0', fill: '#1aad9e', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="sgpa"
                  stroke="#1aad9e"
                  strokeWidth={2.5}
                  dot={{ fill: '#1aad9e', r: 5, strokeWidth: 2, stroke: '#052c2a' }}
                  activeDot={{ r: 7, stroke: '#37c9b8', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Table view */}
          <div className="mt-6 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Semester" sortKey="semester_name" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} />
                  <SortableTh label="Exam Period" sortKey="exam_month_year" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} />
                  <SortableTh label="SGPA" sortKey="sgpa" currentKey={sgpaKey} dir={sgpaDir} onToggle={sgpaToggle} className="text-right" />
                  <th className="text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {sortedSgpaTable.map(s => {
                  const sgpa = parseGPA(s.sgpa);
                  const badge = resultBadge(s.overall_result);
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{formatSemester(s.semester_name)}</td>
                      <td className="text-surface-500 text-xs">{s.exam_month_year}</td>
                      <td className="text-right font-mono font-bold tabular-nums"
                          style={{ color: sgpaColor(sgpa) }}>
                        {sgpa?.toFixed(2) ?? '—'}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Subject Analysis */}
      {activeTab === 'Subject Analysis' && (
        <div className="space-y-6 animate-fadeInUp">
          {student.semesters.map(sem => (
            <div key={sem.id} className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="font-semibold text-surface-200 text-sm">{sem.semester_name}</span>
                <span className="text-xs text-surface-500">{sem.results.length} subjects</span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {sem.results.map(r => {
                  const res = resultBadge(r.subject_result);
                  return (
                    <div key={r.id}
                         className="bg-dark-300/60 rounded-lg p-3 border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                      <div className="font-mono text-xs text-brand-500 mb-1 truncate">
                        {r.subject.course_code}
                      </div>
                      <div className="text-xs text-surface-300 mb-2 leading-tight line-clamp-2">
                        {r.subject.course_title}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${gradeColor(r.grade)}`}>
                          {r.grade ?? '—'}
                        </span>
                        <span className={`badge text-[10px] py-0 ${res.className}`}>
                          {res.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}