// src/app/students/page.tsx
import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { StudentsClient } from '@/components/features/students/StudentsClient';
import { ListSkeleton } from '@/components/ui/Skeletons';

export const metadata = { title: 'Students' };

export default function StudentsPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-brand-900/30 border border-brand-800/40">
          <Users className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Students</h1>
          <p className="text-surface-500 text-sm">Search, filter, and browse student academic records</p>
        </div>
      </div>
      <div className="glow-line mb-6" />

      <Suspense fallback={<ListSkeleton rows={15} />}>
        <StudentsClient />
      </Suspense>
    </div>
  );
}
