// src/app/compare/page.tsx
import { Suspense } from 'react';
import { GitCompare } from 'lucide-react';
import { CompareClient } from '@/components/features/compare/CompareClient';
import { PageShellSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Compare' };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const initialTickets = ['a', 'b', 'c', 'd']
    .map(k => sp[k])
    .filter((v): v is string => typeof v === 'string');

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-violet-900/30 border border-violet-800/40">
          <GitCompare className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Compare Students</h1>
          <p className="text-surface-500 text-sm">Side-by-side academic comparison across semesters</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<PageShellSkeleton />}>
        <CompareClient initialTickets={initialTickets} />
      </Suspense>
    </div>
  );
}
