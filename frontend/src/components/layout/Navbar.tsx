'use client';
// src/components/layout/Navbar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3, Users, Trophy, GitCompare, Download,
  Menu, X, Zap
} from 'lucide-react';
import { cn } from '@/utils';

const NAV_LINKS = [
  { href: '/students',  label: 'Students',   icon: Users },
  { href: '/rankings',  label: 'Rankings',   icon: Trophy },
  { href: '/analytics', label: 'Analytics',  icon: BarChart3 },
  { href: '/compare',   label: 'Compare',    icon: GitCompare },
  { href: '/export',    label: 'Export',     icon: Download },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-dark-200/80 backdrop-blur-xl">
      <nav className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-sky-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-brand transition-shadow">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-white text-lg tracking-tight">
            <span className="text-brand-400">SJC</span> Result Hub
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-brand-900/50 text-brand-300'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-white/[0.04]'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right area */}
        <div className="flex items-center gap-2">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-surface-400 hover:text-surface-100 hover:bg-white/[0.06] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-dark-200/95 backdrop-blur-xl">
          <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-900/40 text-brand-300'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-white/[0.05]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}