import { requireAdmin } from '@/lib/supabase/queries/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AuditsPage() {
  await requireAdmin();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem', color: '#0f172a' }}>
          Audits & Logs
        </h1>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem' }}>
          Recognition history, confidence reports, and usage analytics
        </p>
      </div>

      {/* Audit Sections Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Recognition Logs Card */}
        <div
          style={{
            padding: '20px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>📋</span>
            <h3 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Recognition Logs
            </h3>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            View all recognized gestures with confidence scores, timestamps, and sources.
          </p>
          <div
            style={{
              padding: '12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#166534',
            }}
          >
            <strong>Status:</strong> Ready to view
          </div>
          <a
            href="/admin/audits/logs"
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginTop: '8px',
              cursor: 'pointer',
              border: 'none',
              textAlign: 'center',
            }}
          >
            View Logs →
          </a>
        </div>

        {/* Gesture History Card (Coming Soon) */}
        <div
          style={{
            padding: '20px',
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            opacity: 0.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>📜</span>
            <h3 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Gesture History
            </h3>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            Historical analysis of gesture recognition patterns and trends over time.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#e2e8f0',
              color: '#64748b',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginTop: '8px',
              cursor: 'not-allowed',
            }}
          >
            Coming Soon
          </div>
        </div>

        {/* Confidence Reports Card (Coming Soon) */}
        <div
          style={{
            padding: '20px',
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            opacity: 0.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>📊</span>
            <h3 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Confidence Reports
            </h3>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            Statistical analysis of model confidence scores per gesture class.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#e2e8f0',
              color: '#64748b',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginTop: '8px',
              cursor: 'not-allowed',
            }}
          >
            Coming Soon
          </div>
        </div>

        {/* Translation Usage Card (Coming Soon) */}
        <div
          style={{
            padding: '20px',
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            opacity: 0.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>🌐</span>
            <h3 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Translation Usage
            </h3>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            Analyze how recognized gestures are being translated to text and type-to-sign.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#e2e8f0',
              color: '#64748b',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginTop: '8px',
              cursor: 'not-allowed',
            }}
          >
            Coming Soon
          </div>
        </div>
      </div>

      {/* Empty State Info */}
      <section
        style={{
          padding: '20px',
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a' }}>
          📝 Recognition Logging Plan
        </h3>
        <p style={{ margin: '0', color: '#78350f', fontSize: '0.9rem' }}>
          The Audits section is ready for integration with a recognition logging pipeline. When implemented,
          each prediction will be recorded with:
        </p>
        <ul style={{ margin: '8px 0 0', color: '#78350f', fontSize: '0.9rem', paddingLeft: '20px' }}>
          <li>Gesture label and predicted class</li>
          <li>Confidence score and prediction timestamp</li>
          <li>Input modality (hand, pose, etc.) and source session</li>
          <li>Transcript result and any user corrections</li>
          <li>Performance metrics for model drift detection</li>
        </ul>
      </section>

      {/* Current Status */}
      <section
        style={{
          padding: '20px',
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a' }}>
          🔄 Current Status
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ padding: '12px', background: '#ffffff', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              LOGS AVAILABLE
            </p>
            <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              No logs yet
            </p>
          </div>
          <div style={{ padding: '12px', background: '#ffffff', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              LOGGING ENABLED
            </p>
            <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
              In Setup
            </p>
          </div>
          <div style={{ padding: '12px', background: '#ffffff', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              DATABASE TABLE
            </p>
            <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>
              Ready ✓
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
