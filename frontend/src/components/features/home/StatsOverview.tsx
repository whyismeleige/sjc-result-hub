// src/components/features/home/StatsOverview.tsx
import { TrendingUp, Users, BookOpen, CheckCircle } from 'lucide-react';

interface Props {
  stats: {
    studentCount: number;
    semesterCount: number;
    subjectCount: number;
    passRate: number;
  };
}

export function StatsOverview({ stats }: Props) {
  const items = [
    {
      icon: Users,
      label: 'Enrolled Students',
      value: stats.studentCount.toLocaleString(),
      sub: 'Active records',
      color: 'text-brand-400',
      bg: 'bg-brand-900/30 border-brand-800/40',
    },
    {
      icon: TrendingUp,
      label: 'Semester Records',
      value: stats.semesterCount.toLocaleString(),
      sub: 'Across all batches',
      color: 'text-sky-400',
      bg: 'bg-sky-900/30 border-sky-800/40',
    },
    {
      icon: BookOpen,
      label: 'Subjects Tracked',
      value: stats.subjectCount.toLocaleString(),
      sub: 'Unique courses',
      color: 'text-violet-400',
      bg: 'bg-violet-900/30 border-violet-800/40',
    },
    {
      icon: CheckCircle,
      label: 'Overall Pass Rate',
      value: `${stats.passRate}%`,
      sub: 'Across all semesters',
      color: 'text-lime-400',
      bg: 'bg-lime-900/30 border-lime-800/40',
    },
  ];

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display font-bold text-lg text-white">Platform Overview</h2>
        <div className="flex-1 glow-line" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map(({ icon: Icon, label, value, sub, color, bg }, i) => (
          <div
            key={label}
            className="card p-5 animate-fadeInUp hover:border-white/[0.12] transition-all duration-200"
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
          >
            <div className={`inline-flex p-2 rounded-lg border ${bg} mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="font-display font-bold text-2xl text-white tabular-nums">{value}</div>
            <div className="text-sm text-surface-300 font-medium mt-0.5">{label}</div>
            <div className="text-xs text-surface-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}