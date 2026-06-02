'use client';
// src/components/features/home/QuickSearch.tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, User, Loader2 } from 'lucide-react';
import { debounce } from '@/utils';
import Link from 'next/link';

interface Suggestion {
  id: number;
  hall_ticket: string;
  student_name: string;
  program: string | null;
}

export function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useMemo(
    () => debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); setLoading(false); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/students?q=${encodeURIComponent(q)}&limit=6`);
        const json = await res.json();
        setSuggestions(json.data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280),
    []
  );

  useEffect(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/students?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
    }
  };

  const showDropdown = focused && query.length >= 2;

  return (
    <div className="relative max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative card shadow-card-dark">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {loading ? (
              <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-surface-400" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search by name, hall ticket, or program…"
            className="w-full bg-transparent border-0 outline-none pl-12 pr-14 py-4 text-surface-100 placeholder-surface-500 text-base font-medium"
            autoComplete="off"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-3"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1.5 card shadow-card-hover border-white/[0.1] overflow-hidden z-50"
        >
          {suggestions.length === 0 && !loading && (
            <div className="px-4 py-4 text-surface-500 text-sm text-center">No matches found</div>
          )}
          {suggestions.map(s => (
            <Link
              key={s.id}
              href={`/students/${s.hall_ticket}`}
              onClick={() => { setFocused(false); setQuery(''); }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-surface-100 font-medium text-sm truncate">{s.student_name}</div>
                <div className="text-surface-500 text-xs font-mono flex gap-2">
                  <span>{s.hall_ticket}</span>
                  {s.program && <span className="text-brand-600">·</span>}
                  {s.program && <span className="truncate">{s.program}</span>}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-surface-600 shrink-0" />
            </Link>
          ))}
          {suggestions.length > 0 && (
            <Link
              href={`/students?q=${encodeURIComponent(query)}`}
              onClick={() => setFocused(false)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-dark-300/50 text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
            >
              View all results for &quot;{query}&quot;
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}