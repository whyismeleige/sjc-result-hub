'use client';
// src/components/features/compare/CompareClient.tsx
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  GitCompare, User, X, Plus, TrendingUp, Loader2,
  ArrowLeft
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { parseGPA, sgpaColor, formatSemester } from '@/utils';

interface StudentSummary {
  id: number;
  hall_ticket: string;
  student_name: string;
  program: string | null;
}

interface SemesterBrief {
  semester_name: string;
  exam_month_year: string;
  sgpa: number | null;
  overall_result: string | null;
}

interface StudentProfile {
  id: number;
  hall_ticket: string;
  student_name: string;
  program: string | null;
  semesters: SemesterBrief[];
}

function StudentSelector({ onSelect }: { onSelect: (s: StudentSummary) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentSummary[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/students?q=${encodeURIComponent(query)}&limit=6`);
        const json = await res.json();
        setResults(json.data || []);
      } catch { setResults([]); }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name or hall ticket…"
        className="input pl-9"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <User className="w-4 h-4 text-surface-400" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 card border-white/[0.1] overflow-hidden z-50">
          {results.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelect(s); setQuery(''); setOpen(false); setResults([]); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04] last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-surface-100 font-medium text-sm truncate">{s.student_name}</div>
                <div className="text-surface-500 text-xs font-mono">{s.hall_ticket}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SemesterCompareChart({ students }: { students: { name: string; semesters: SemesterBrief[] }[] }) {
  const allSemNames = [...new Set(students.flatMap(s => s.semesters.map(sem => sem.semester_name)))].sort();
  const chartData = allSemNames.map(name => {
    const point: Record<string, string | number | null> = { name: formatSemester(name) };
    students.forEach(s => {
      const sem = s.semesters.find(sem => sem.semester_name === name);
      point[s.name] = sem?.sgpa ?? null;
    });
    return point;
  });

  const COLORS = ['#1aad9e', '#0ea5e9', '#a855f7', '#f59e0b'];

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-400" /> SGPA Comparison
      </h3>
      {chartData.length === 0 ? (
        <div className="text-center text-surface-500 py-12">No semester data to compare</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {students.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

async function fetchStudentProfile(summary: StudentSummary): Promise<StudentProfile | null> {
  try {
    const res = await fetch(`/api/students/detail?id=${summary.id}`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.data;
    if (!raw) return null;
    return {
      id: raw.id,
      hall_ticket: raw.hall_ticket,
      student_name: raw.student_name,
      program: raw.program,
      semesters: (raw.semesters || []).map((s: Record<string, unknown>) => ({
        semester_name: s.semester_name as string,
        exam_month_year: s.exam_month_year as string,
        sgpa: parseGPA(s.sgpa as string | null),
        overall_result: s.overall_result as string | null,
      })),
    };
  } catch {
    return null;
  }
}

export function CompareClient({ initialTickets = [] }: { initialTickets?: string[] }) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingUrl, setLoadingUrl] = useState(false);

  useEffect(() => {
    if (initialTickets.length === 0) return;
    const timer = setTimeout(async () => {
      setLoadingUrl(true);
      const results = await Promise.all(initialTickets.map(async ticket => {
        const searchRes = await fetch(`/api/students?q=${encodeURIComponent(ticket)}&limit=5`);
        const searchJson = await searchRes.json();
        const match = (searchJson.data || []).find(
          (s: StudentSummary) => s.hall_ticket.toUpperCase() === ticket.toUpperCase()
        );
        return match ? fetchStudentProfile(match) : null;
      }));
      setStudents(results.filter((s): s is StudentProfile => s !== null));
      setLoadingUrl(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialTickets]);

  const addStudent = useCallback(async (summary: StudentSummary) => {
    if (students.length >= 4) return;
    if (students.some(s => s.id === summary.id)) return;
    const profile = await fetchStudentProfile(summary);
    if (profile) setStudents(prev => [...prev, profile]);
  }, [students]);

  const removeStudent = (id: number) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[200px]">
            {students[i] ? (
              <div className="card p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-100 truncate">{students[i].student_name}</div>
                  <div className="text-xs text-surface-500 font-mono truncate">{students[i].hall_ticket}</div>
                </div>
                <button onClick={() => removeStudent(students[i].id)} className="p-1 hover:bg-white/[0.06] rounded transition-colors">
                  <X className="w-4 h-4 text-surface-400" />
                </button>
              </div>
            ) : (
              <div className="relative">
                {i === students.length ? (
                  <StudentSelector onSelect={addStudent} />
                ) : (
                  <div className="card p-3 flex items-center gap-3 opacity-40">
                    <div className="w-9 h-9 rounded-lg bg-surface-800/50 border border-surface-700/40 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-surface-500" />
                    </div>
                    <span className="text-sm text-surface-500">Select student {i + 1}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {loadingUrl && (
        <div className="card p-16 text-center">
          <Loader2 className="w-8 h-8 text-brand-400 mx-auto mb-4 animate-spin" />
          <p className="text-surface-500 text-sm">Loading students…</p>
        </div>
      )}

      {!loadingUrl && students.length === 0 && (
        <div className="card p-16 text-center">
          <GitCompare className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <h3 className="font-display font-semibold text-lg text-white mb-2">Compare Students</h3>
          <p className="text-surface-500 text-sm max-w-md mx-auto">
            Select up to 4 students above to compare their academic performance side by side.
          </p>
        </div>
      )}

      {students.length >= 2 && (
        <>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-48">Metric</th>
                  {students.map(s => (
                    <th key={s.id} className="text-center">{s.student_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium text-surface-300">Program</td>
                  {students.map(s => (
                    <td key={s.id} className="text-center text-surface-400 text-xs">{s.program || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium text-surface-300">Hall Ticket</td>
                  {students.map(s => (
                    <td key={s.id} className="text-center font-mono text-brand-400 text-xs">{s.hall_ticket}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium text-surface-300">Semesters Completed</td>
                  {students.map(s => (
                    <td key={s.id} className="text-center font-mono">{s.semesters.length}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium text-surface-300">Latest SGPA</td>
                  {students.map(s => {
                    const last = [...s.semesters].reverse().find(sem => sem.sgpa !== null);
                    return (
                      <td key={s.id} className="text-center font-display font-bold tabular-nums" style={{ color: sgpaColor(last?.sgpa ?? null) }}>
                        {last?.sgpa?.toFixed(2) ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <SemesterCompareChart
            students={students.map(s => ({ name: s.student_name, semesters: s.semesters }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {students.map(s => (
              <Link
                key={s.id}
                href={`/students/${s.hall_ticket}`}
                className="card p-4 flex items-center gap-3 hover:border-white/[0.12] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-surface-100 group-hover:text-brand-300 transition-colors truncate">
                    {s.student_name}
                  </div>
                  <div className="text-xs text-surface-500 font-mono">{s.hall_ticket}</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-surface-600 rotate-180 shrink-0 group-hover:text-brand-400 transition-colors" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
