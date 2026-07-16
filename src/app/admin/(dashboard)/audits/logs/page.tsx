import { requireAdmin } from '@/lib/supabase/queries/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RecognitionLogsPage() {
  await requireAdmin();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem', color: '#0f172a' }}>
          Recognition Logs
        </h1>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem' }}>
          Real-time view of gesture predictions and confidence scores
        </p>
      </div>

      {/* Empty State */}
      <div
        style={{
          padding: '40px 20px',
          background: '#f8fafc',
          border: '2px dashed #cbd5e1',
          borderRadius: '12px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '3rem' }}>📋</span>
        <h2 style={{ margin: '0', fontSize: '1.2rem', color: '#0f172a' }}>
          No Recognition Logs Yet
        </h2>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem', maxWidth: '400px' }}>
          Recognition logs will appear here once gesture predictions are recorded by the system.
          Start using Sign-to-Text to see predictions logged.
        </p>
      </div>

      {/* Info Section */}
      <section
        style={{
          padding: '20px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a' }}>
          ℹ️ About Recognition Logs
        </h3>
        <p style={{ margin: '0', color: '#1e40af', fontSize: '0.9rem' }}>
          This page will display:
        </p>
        <ul style={{ margin: '8px 0 0', color: '#1e40af', fontSize: '0.9rem', paddingLeft: '20px' }}>
          <li>Gesture label and predicted class</li>
          <li>Confidence score (0.0 - 1.0)</li>
          <li>Prediction timestamp</li>
          <li>Input mode (hand tracking, pose estimation)</li>
          <li>Source page (e.g., /translate, /conversation)</li>
          <li>Transcript result (recognized text)</li>
        </ul>
      </section>

      <section
        style={{
          padding: '20px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a' }}>
          🔧 Setup Instructions
        </h3>
        <p style={{ margin: '0', color: '#166534', fontSize: '0.9rem' }}>
          To start logging recognitions:
        </p>
        <ol style={{ margin: '8px 0 0', color: '#166534', fontSize: '0.9rem', paddingLeft: '20px' }}>
          <li>Ensure recognition_logs table exists in Supabase</li>
          <li>Enable recognition event logging in useRecognition hook</li>
          <li>Use the Sign-to-Text page to generate predictions</li>
          <li>Logs will appear in real-time or with a refresh</li>
        </ol>
      </section>
    </div>
  );
}
