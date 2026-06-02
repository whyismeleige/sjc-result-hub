// src/components/features/home/BranchHighlights.tsx
import Link from 'next/link';
import { GraduationCap, ArrowRight } from 'lucide-react';

interface ProgramGroup {
  program: string | null;
  _count: { id: number };
}

interface Props {
  programs: ProgramGroup[];
}

// Color map for programs
const PROGRAM_COLORS: Record<string, string> = {
  'BBA': 'from-brand-900/60 border-brand-800/40',
  'B.COM': 'from-sky-900/60 border-sky-800/40',
  'B.A': 'from-violet-900/60 border-violet-800/40',
  'MBA': 'from-amber-900/60 border-amber-800/40',
};

function getColorClass(program: string | null): string {
  if (!program) return 'from-surface-900/60 border-surface-700/40';
  for (const [key, cls] of Object.entries(PROGRAM_COLORS)) {
    if (program.toUpperCase().includes(key)) return cls;
  }
  return 'from-surface-900/60 border-surface-700/40';
}

export function BranchHighlights({ programs }: Props) {
  const total = programs.reduce((acc, p) => acc + p._count.id, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-violet-400" />
          <h2 className="font-display font-bold text-lg text-white">By Program</h2>
        </div>
        <Link href="/analytics" className="btn-ghost text-xs py-1 px-2 text-brand-400">
          Analytics <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {programs.length === 0 ? (
          <div className="card px-6 py-8 text-center text-surface-500">No data</div>
        ) : (
          programs.map(({ program, _count }) => {
            const pct = total > 0 ? Math.round((_count.id / total) * 100) : 0;
            const colorClass = getColorClass(program);
            return (
              <div
                key={program}
                className={`card p-3.5 bg-gradient-to-r ${colorClass} hover:border-white/[0.12] transition-all duration-200`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-surface-200 truncate">{program ?? 'Unknown'}</span>
                  <span className="font-mono text-sm font-bold text-surface-100 shrink-0 ml-2">
                    {_count.id}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500/70 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-surface-600 mt-1">{pct}% of total</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}