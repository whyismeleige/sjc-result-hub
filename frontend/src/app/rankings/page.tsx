// src/app/rankings/page.tsx
import { Suspense } from 'react';
import { Trophy } from 'lucide-react';
import { LeaderboardClient } from '@/components/features/rankings/LeaderboardClient';
import { TableSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Rankings' };

export default function RankingsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-800/40">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Rankings & Leaderboards</h1>
          <p className="text-surface-500 text-sm">Top performers, branch rankings, and semester toppers</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<TableSkeleton rows={15} cols={5} />}>
        <LeaderboardClient />
      </Suspense>
    </div>
  );
}