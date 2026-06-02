// src/app/analytics/page.tsx
import { Suspense } from 'react';
import { BarChart3 } from 'lucide-react';
import { AnalyticsClient } from '@/components/features/analytics/AnalyticsClient';
import { PageShellSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-sky-900/30 border border-sky-800/40">
          <BarChart3 className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Analytics</h1>
          <p className="text-surface-500 text-sm">Academic insights, grade distributions, and performance trends</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<PageShellSkeleton />}>
        <AnalyticsClient />
      </Suspense>
    </div>
  );
}
