// src/components/ui/SortableTh.tsx
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export function SortableTh({ label, sortKey, currentKey, dir, onToggle, className = '' }: {
  label: string; sortKey: string; currentKey: string; dir: 'asc' | 'desc'; onToggle: (k: string) => void; className?: string;
}) {
  const active = currentKey === sortKey;
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`cursor-pointer select-none ${className}`} onClick={() => onToggle(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`w-3 h-3 transition-opacity ${active ? 'text-brand-400' : 'text-surface-600'}`} />
      </span>
    </th>
  );
}
