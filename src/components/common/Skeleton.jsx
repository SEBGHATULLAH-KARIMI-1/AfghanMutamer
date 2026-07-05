export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return <div className="skeleton" style={{ width, height, marginBottom: 8, ...style }} />
}

export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div style={{ padding: 20 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 18, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 14, marginBottom: 14 }} />
          <div className="skeleton" style={{ width: '60%', height: 22, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '40%', height: 14 }} />
        </div>
      ))}
    </div>
  )
}
