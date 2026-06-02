// src/app/export/page.tsx
import { Suspense } from 'react';
import { Download } from 'lucide-react';
import { ExportClient } from '@/components/features/export/ExportClient';
import { PageShellSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Export' };

export default function ExportPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-800/40">
          <Download className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Data Export</h1>
          <p className="text-surface-500 text-sm">Export academic data in CSV or PDF format with charts</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<PageShellSkeleton />}>
        <ExportClient />
      </Suspense>
    </div>
  );
}
