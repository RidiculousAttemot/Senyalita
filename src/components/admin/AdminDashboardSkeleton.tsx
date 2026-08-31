export function AdminDashboardSkeleton() {
  return (
    <section className="admin-dashboard">
      <style>{`
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e8eef6 37%, #f1f5f9 63%); background-size: 400% 100%; animation: shimmer 1.3s ease infinite; }
        @keyframes shimmer { 0% { background-position: 400% 0; } 100% { background-position: -400% 0; } }
        .skeleton-header { height: 32px; border-radius: 8px; margin-bottom: 12px; width: 60%; }
        .skeleton-subtitle { height: 16px; border-radius: 6px; margin-bottom: 24px; width: 80%; }
        .skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
        .skeleton-card { border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; height: 160px; }
        .skeleton-card-line { height: 18px; border-radius: 6px; margin-bottom: 8px; width: 80%; }
        .skeleton-card-line:last-child { margin-bottom: 0; }
        @media (max-width: 1100px) { .skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .skeleton-grid { grid-template-columns: 1fr; } }
      `}</style>
      <header className="admin-dashboard-header">
        <div>
          <div className="skeleton skeleton-header" style={{ width: '40%', height: '28px' }} />
          <div className="skeleton skeleton-subtitle" style={{ width: '70%', height: '18px' }} />
        </div>
      </header>

      <div className="skeleton-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <article key={i} className="skeleton skeleton-card">
            <div className="skeleton-card-line" style={{ width: '60%', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-card-line" style={{ width: '40%', height: '24px', marginBottom: '8px' }} />
            <div className="skeleton-card-line" style={{ width: '100%', height: '12px' }} />
          </article>
        ))}
      </div>

      <div className="skeleton-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="skeleton skeleton-card">
            <div className="skeleton-card-line" style={{ width: '60%', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-card-line" style={{ width: '40%', height: '24px', marginBottom: '8px' }} />
            <div className="skeleton-card-line" style={{ width: '100%', height: '12px' }} />
          </article>
        ))}
      </div>
    </section>
  );
}
