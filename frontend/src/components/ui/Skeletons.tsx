// src/components/ui/Skeletons.tsx

export function TableSkeleton({ rows = 10, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skeleton h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <div className="skeleton h-4 w-full" style={{ maxWidth: `${60 + Math.random() * 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-6 w-24" />
          <div className="skeleton h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="card p-5">
      <div className="skeleton h-4 w-32 mb-4" />
      <div className="skeleton w-full rounded-lg" style={{ height }} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex gap-5">
          <div className="skeleton h-16 w-16 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-36" />
          </div>
          <div className="skeleton h-12 w-20 shrink-0" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-3 space-y-2">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="skeleton h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-4 w-3/5" />
            <div className="skeleton h-3 w-2/5" />
          </div>
          <div className="skeleton h-6 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function PageShellSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 page-enter space-y-6">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="space-y-1.5">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-3 w-56" />
        </div>
      </div>
      <div className="glow-line" />
      <CardSkeleton count={4} />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
