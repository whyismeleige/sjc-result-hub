'use client';
// src/components/features/students/StudentsClient.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, User, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { debounce } from '@/utils';
import { ListSkeleton } from '@/components/ui/Skeletons';

interface StudentEntry {
  id: number;
  hall_ticket: string;
  student_name: string;
  program: string | null;
  father_name: string | null;
  created_at: string;
}

export function StudentsClient() {
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StudentEntry[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const loading = data === null;

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (query) params.set('q', query);
    if (program) params.set('program', program);

    fetch(`/api/students?${params}`, { signal: ac.signal })
      .then(res => res.json())
      .then(json => {
        if (ac.signal.aborted) return;
        setData(json.data || []);
        setMeta(json.meta || null);
      })
      .catch(() => { if (!ac.signal.aborted) { setData([]); setMeta(null); } });

    return () => ac.abort();
  }, [query, program, page]);

  const handleSearch = debounce((val: string) => {
    setQuery(val);
    setPage(1);
  }, 300);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-4 h-4 text-surface-400" />
          </div>
          <input
            type="text"
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or hall ticket…"
            className="input pl-10"
            autoComplete="off"
          />
        </div>
        <input
          type="text"
          onChange={e => { setProgram(e.target.value); setPage(1); }}
          placeholder="Filter by program…"
          className="input sm:max-w-60"
        />
      </div>

      {/* Meta */}
      {meta && !loading && (
        <div className="text-xs text-surface-500 font-mono">
          {meta.total} student{meta.total !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Results */}
      {loading ? (
        <ListSkeleton rows={10} />
      ) : data.length === 0 ? (
        <div className="card p-12 text-center">
          <User className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-500 text-sm">No students match your search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((s, i) => (
            <Link
              key={s.id}
              href={`/students/${s.hall_ticket}`}
              className="card p-4 flex items-center gap-4 hover:border-white/[0.12] transition-all group animate-fadeInUp"
              style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}
            >
              <div className="w-10 h-10 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-surface-100 group-hover:text-brand-300 transition-colors truncate">
                  {s.student_name}
                </div>
                <div className="text-xs text-surface-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="text-brand-500">{s.hall_ticket}</span>
                  {s.program && <span>{s.program}</span>}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-surface-600 shrink-0 group-hover:text-brand-400 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary py-1.5 px-3 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-surface-400 font-mono">
            {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="btn-secondary py-1.5 px-3 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
