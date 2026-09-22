// src/lib/export-metrics.ts
// Pure aggregations for export reports (no DB/Next imports — unit-testable).

export function computeGradeDist(grades: { grade: string | null }[]) {
  const map = new Map<string, number>();
  grades.forEach(g => {
    const key = g.grade || 'Ungraded';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => (a.grade < b.grade ? -1 : 1));
}

export function computeSgpaDist(sgpas: (number | null)[]) {
  const buckets = ['0.0-2.0', '2.0-4.0', '4.0-6.0', '6.0-8.0', '8.0-10.0'];
  const counts = new Map(buckets.map(b => [b, 0]));
  sgpas.forEach(s => {
    const v = s ?? 0;
    if (v < 2) counts.set('0.0-2.0', counts.get('0.0-2.0')! + 1);
    else if (v < 4) counts.set('2.0-4.0', counts.get('2.0-4.0')! + 1);
    else if (v < 6) counts.set('4.0-6.0', counts.get('4.0-6.0')! + 1);
    else if (v < 8) counts.set('6.0-8.0', counts.get('6.0-8.0')! + 1);
    else counts.set('8.0-10.0', counts.get('8.0-10.0')! + 1);
  });
  return buckets.map(range => ({ range, count: counts.get(range)! }));
}

export function computeProgramDist(students: { program: string | null }[]) {
  const map = new Map<string, number>();
  students.forEach(s => {
    const p = s.program || 'Unknown';
    map.set(p, (map.get(p) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeSemesterAverages(semesters: { semester_name: string; sgpa: number | null }[]) {
  const groups = new Map<string, { sum: number; count: number }>();
  semesters.forEach(s => {
    const v = s.sgpa ?? 0;
    if (!groups.has(s.semester_name)) groups.set(s.semester_name, { sum: 0, count: 0 });
    const g = groups.get(s.semester_name)!;
    g.sum += v;
    g.count += 1;
  });
  return Array.from(groups.entries())
    .map(([semester, { sum, count }]) => ({ semester, avgSgpa: Math.round((sum / count) * 100) / 100 }))
    .sort((a, b) => (a.semester < b.semester ? -1 : 1));
}

export function computePassRateTrend(semesters: { semester_name: string; overall_result: string | null }[]) {
  const groups = new Map<string, { total: number; passed: number }>();
  semesters.forEach(s => {
    if (!groups.has(s.semester_name)) groups.set(s.semester_name, { total: 0, passed: 0 });
    const g = groups.get(s.semester_name)!;
    g.total += 1;
    if (s.overall_result?.toLowerCase() === 'pass') g.passed += 1;
  });
  return Array.from(groups.entries())
    .map(([semester, { total, passed }]) => ({ semester, passRate: Math.round((passed / total) * 100) }))
    .sort((a, b) => (a.semester < b.semester ? -1 : 1));
}