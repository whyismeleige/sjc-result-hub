// src/app/rankings/branch/[program]/page.tsx
import { Suspense } from 'react';
import { GraduationCap } from 'lucide-react';
import { BranchDetailClient } from '@/components/features/rankings/BranchDetailClient';
import { ProfileSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Branch Details' };

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ program: string }>;
}) {
  const { program } = await params;
  const programName = decodeURIComponent(program);

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-brand-900/30 border border-brand-800/40">
          <GraduationCap className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">{programName}</h1>
          <p className="text-surface-500 text-sm">Branch overview, student list, and semester analysis</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<ProfileSkeleton />}>
        <BranchDetailClient program={programName} />
      </Suspense>
    </div>
  );
}
