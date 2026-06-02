'use client';
// src/components/features/home/HeroSection.tsx
import { ArrowRight, TrendingUp, Award, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { compactNumber } from '@/utils';

interface Props {
  stats: {
    studentCount: number;
    semesterCount: number;
    subjectCount: number;
    passRate: number;
  };
}

export function HeroSection({ stats }: Props) {
  return (
    <section className="relative overflow-hidden bg-dark-200 border-b border-white/[0.05]">
      {/* Background grid + glow */}
      <div className="absolute inset-0 bg-grid-dark opacity-100" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-sky-600/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 pt-16 pb-20">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-950/80 border border-brand-800/60 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
            <span className="text-brand-300 text-xs font-medium font-mono tracking-wide">
              SJC RESULT HUB
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display text-center text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] mb-4">
          St. Joseph&rsquo;s College{' '}
          <span className="gradient-text">Results</span>
        </h1>
        <p className="text-center text-surface-400 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Search student results, track SGPA trends, explore leaderboards and unlock
          deep academic insights — all in one place.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
          <Link href="/students" className="btn-primary text-base px-6 py-2.5">
            Search Students
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/rankings" className="btn-secondary text-base px-6 py-2.5">
            <Award className="w-4 h-4" />
            View Rankings
          </Link>
          <Link href="/analytics" className="btn-ghost text-base px-6 py-2.5">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </Link>
        </div>

        {/* Hero stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            { icon: BookOpen, label: 'Students', value: compactNumber(stats.studentCount) },
            { icon: TrendingUp, label: 'Semester Records', value: compactNumber(stats.semesterCount) },
            { icon: Award,     label: 'Subjects',   value: compactNumber(stats.subjectCount) },
            { icon: TrendingUp, label: 'Pass Rate', value: `${stats.passRate}%` },
          ].map(({ icon: Icon, label, value }, i) => (
            <div
              key={label}
              className="glass p-4 text-center animate-fadeInUp"
              style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
            >
              <div className="flex justify-center mb-2">
                <Icon className="w-4 h-4 text-brand-400" />
              </div>
              <div className="font-display font-bold text-2xl text-white tabular-nums">{value}</div>
              <div className="text-xs text-surface-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}