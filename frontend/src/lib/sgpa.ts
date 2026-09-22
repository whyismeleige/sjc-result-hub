// src/lib/sgpa.ts
// Pure SGPA aggregation helpers (no DB/Next imports — unit-testable).

export const SGPA_BUCKETS: { label: string; from: number }[] = [
  { label: '9.0-10.0', from: 9.0 },
  { label: '8.0-8.9', from: 8.0 },
  { label: '7.0-7.9', from: 7.0 },
  { label: '6.0-6.9', from: 6.0 },
  { label: '5.0-5.9', from: 5.0 },
  { label: '0-4.9', from: 0 },
];

/** Distribute SGPA values into fixed buckets with a percentage per bucket. */
export function bucketSgpas(sgpas: number[]): { range: string; count: number; percentage: number }[] {
  const buckets: Record<string, number> = Object.fromEntries(SGPA_BUCKETS.map(b => [b.label, 0]));
  for (const val of sgpas) {
    if (val >= 9.0) buckets['9.0-10.0']++;
    else if (val >= 8.0) buckets['8.0-8.9']++;
    else if (val >= 7.0) buckets['7.0-7.9']++;
    else if (val >= 6.0) buckets['6.0-6.9']++;
    else if (val >= 5.0) buckets['5.0-5.9']++;
    else buckets['0-4.9']++;
  }
  return Object.entries(buckets).map(([range, count]) => ({
    range,
    count,
    percentage: sgpas.length > 0 ? Math.round((count / sgpas.length) * 1000) / 10 : 0,
  }));
}