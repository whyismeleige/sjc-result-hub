import { describe, it, expect } from 'vitest';
import { bucketSgpas } from '@/lib/sgpa';
import {
  computeGradeDist, computeSgpaDist, computeProgramDist,
  computeSemesterAverages, computePassRateTrend,
} from '@/lib/export-metrics';

describe('bucketSgpas', () => {
  it('places values into the correct buckets', () => {
    const dist = bucketSgpas([9.5, 9.0, 8.5, 8.0, 7.5, 7.1, 6.5, 6.2, 5.5, 5.0, 4.9, 3.0]);
    const byRange = Object.fromEntries(dist.map(d => [d.range, d.count]));
    expect(byRange['9.0-10.0']).toBe(2);
    expect(byRange['8.0-8.9']).toBe(2);
    expect(byRange['7.0-7.9']).toBe(2);
    expect(byRange['6.0-6.9']).toBe(2);
    expect(byRange['5.0-5.9']).toBe(2);
    expect(byRange['0-4.9']).toBe(2);
  });
  it('computes percentages totalling ~100', () => {
    const dist = bucketSgpas([10, 8, 6, 4, 2]);
    const totalPct = dist.reduce((a, d) => a + d.percentage, 0);
    expect(dist.reduce((a, d) => a + d.count, 0)).toBe(5);
    expect(totalPct).toBe(100);
  });
  it('handles empty input', () => {
    const dist = bucketSgpas([]);
    expect(dist.every(d => d.count === 0 && d.percentage === 0)).toBe(true);
  });
});

describe('export metrics', () => {
  it('computeGradeDist', () => {
    const rows = [{ grade: 'O' }, { grade: 'A' }, { grade: 'O' }, { grade: null }];
    const dist = computeGradeDist(rows);
    expect(dist.find(d => d.grade === 'O')?.count).toBe(2);
    expect(dist.find(d => d.grade === 'Ungraded')?.count).toBe(1);
  });

  it('computeSgpaDist', () => {
    // null answers are bucketed at 0 (legacy parity with parseFloat(sgpa||'0')).
    const dist = computeSgpaDist([1.5, 3, 5, 7, 9, null]);
    const byRange = Object.fromEntries(dist.map(d => [d.range, d.count]));
    expect(byRange['0.0-2.0']).toBe(2);
    expect(byRange['2.0-4.0']).toBe(1);
    expect(byRange['4.0-6.0']).toBe(1);
    expect(byRange['6.0-8.0']).toBe(1);
    expect(byRange['8.0-10.0']).toBe(1);
  });

  it('computeProgramDist sorts by count desc', () => {
    const rows = [
      { program: 'B' }, { program: 'B' }, { program: 'A' }, { program: null }, { program: null },
    ];
    const dist = computeProgramDist(rows);
    expect(dist[0]).toEqual({ name: 'B', value: 2 });
    const counts = Object.fromEntries(dist.map(d => [d.name, d.value]));
    expect(counts).toEqual({ B: 2, A: 1, Unknown: 2 });
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(5);
  });

  it('computeSemesterAverages', () => {
    const rows = [
      { semester_name: 'SEMESTER-I(REGULAR)', sgpa: 8 },
      { semester_name: 'SEMESTER-I(REGULAR)', sgpa: 9 },
      { semester_name: 'SEMESTER-II(REGULAR)', sgpa: 10 },
    ];
    const avgs = computeSemesterAverages(rows);
    expect(avgs.find(a => a.semester === 'SEMESTER-I(REGULAR)')?.avgSgpa).toBe(8.5);
    expect(avgs.find(a => a.semester === 'SEMESTER-II(REGULAR)')?.avgSgpa).toBe(10);
  });

  it('computePassRateTrend', () => {
    const rows = [
      { semester_name: 'S1', overall_result: 'PASS' },
      { semester_name: 'S1', overall_result: 'FAIL' },
      { semester_name: 'S1', overall_result: 'pass' },
    ];
    const trend = computePassRateTrend(rows);
    expect(trend.find(t => t.semester === 'S1')?.passRate).toBe(67);
  });
});