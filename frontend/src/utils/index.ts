// src/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse SGPA string to float safely */
export function parseGPA(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/** Grade → color mapping for UI badges */
export function gradeColor(grade: string | null): string {
  if (!grade) return 'text-surface-400';
  const g = grade.toUpperCase();
  if (g === 'O')  return 'text-brand-400';
  if (g === 'A+') return 'text-lime-500';
  if (g === 'A')  return 'text-sky-400';
  if (g === 'B+') return 'text-violet-400';
  if (g === 'B')  return 'text-amber-400';
  if (g === 'C')  return 'text-amber-500';
  if (g === 'F')  return 'text-rose-500';
  if (g === 'AB') return 'text-surface-500';
  return 'text-surface-400';
}

/** Result → badge styles */
export function resultBadge(result: string | null): { label: string; className: string } {
  if (!result) return { label: '—', className: 'bg-surface-800 text-surface-400' };
  const r = result.toUpperCase();
  if (r === 'PASS')     return { label: 'PASS', className: 'bg-brand-900/60 text-brand-400 border border-brand-800' };
  if (r === 'FAIL')     return { label: 'FAIL', className: 'bg-rose-900/60 text-rose-400 border border-rose-800' };
  if (r === 'PROMOTED') return { label: 'PROMOTED', className: 'bg-violet-900/60 text-violet-400 border border-violet-800' };
  if (r === 'AB')       return { label: 'ABSENT', className: 'bg-surface-800/60 text-surface-400 border border-surface-700' };
  return { label: r, className: 'bg-surface-800 text-surface-300' };
}

/** SGPA → color for sparklines and cards */
export function sgpaColor(sgpa: number | null): string {
  if (!sgpa) return '#636e7d';
  if (sgpa >= 9.0) return '#1aad9e';
  if (sgpa >= 8.0) return '#84cc16';
  if (sgpa >= 7.0) return '#0ea5e9';
  if (sgpa >= 6.0) return '#f59e0b';
  return '#f43f5e';
}

/** SGPA → letter grade label */
export function sgpaLabel(sgpa: number | null): string {
  if (!sgpa) return '—';
  if (sgpa >= 9.5) return 'Exceptional';
  if (sgpa >= 9.0) return 'Outstanding';
  if (sgpa >= 8.0) return 'Excellent';
  if (sgpa >= 7.0) return 'Very Good';
  if (sgpa >= 6.0) return 'Good';
  if (sgpa >= 5.0) return 'Average';
  return 'Below Average';
}

/** Format semester number from name string */
export function formatSemester(name: string): string {
  const match = name.match(/SEMESTER[- ]*([IVX\d]+)/i);
  return match ? `Sem ${match[1]}` : name;
}

/** Extract branch abbreviation from program string */
export function programAbbr(program: string | null): string {
  if (!program) return '—';
  const parts = program.split(' ');
  return parts.length >= 2
    ? `${parts[0]} ${parts.slice(1).map(p => p[0]).join('')}`
    : program;
}

/** Debounce helper */
export function debounce<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  delay: number
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Format number with compact notation */
export function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

/** Rank suffix (1st, 2nd, 3rd…) */
export function rankSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Validate SGPA range */
export function isValidSGPA(value: string | null): boolean {
  if (!value) return false;
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0 && n <= 10;
}

/** Build URL query string from object */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return filtered.length ? `?${filtered.join('&')}` : '';
}

/** Parse program to extract stream */
export function extractStream(program: string | null): string {
  if (!program) return 'Unknown';
  if (program.includes('B.COM') || program.includes('BCOM')) return 'B.Com';
  if (program.includes('BBA')) return 'BBA';
  if (program.includes('B.A') || program.includes('BA ')) return 'B.A';
  if (program.includes('B.SC') || program.includes('BSC')) return 'B.Sc';
  return program.split(' ')[0] || 'Other';
}