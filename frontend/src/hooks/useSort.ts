import { useState, useMemo, useCallback } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

export function useSort(initialKey: string, initialDir: SortDir = 'desc') {
  const [sort, setSort] = useState<SortState>({ key: initialKey, dir: initialDir });

  const toggle = useCallback((key: string) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }, []);

  const sorted = useMemo(() => <T>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sort.key];
      const bv = (b as Record<string, unknown>)[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [sort]);

  return useMemo(() => ({ sortKey: sort.key, sortDir: sort.dir, toggle, sorted }), [sort.key, sort.dir, toggle, sorted]);
}
