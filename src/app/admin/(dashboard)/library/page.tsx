import { requireAdmin } from '@/lib/supabase/queries/profiles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LibraryPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // Get gesture library stats
  const { count: totalGestures } = await supabase
    .from('gestures')
    .select('*', { count: 'exact', head: true });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem', color: '#0f172a' }}>
          Sign Asset Library
        </h1>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem' }}>
          Manage gesture assets, alphabets, and glossaries
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Sign Assets Card */}
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
            <span style={{ fontSize: '1.8rem' }}>🤲</span>
            <h2 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Sign Assets
            </h2>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            {totalGestures ?? 0} gesture definitions
          </p>
          <a
            href="/admin/gesture-library"
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'background-color 0.15s',
              marginTop: '8px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Manage →
          </a>
        </div>

        {/* Alphabet Library Card */}
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
            <span style={{ fontSize: '1.8rem' }}>🔤</span>
            <h2 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Alphabet Library
            </h2>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            A-Z, Ñ, NG letters and phonemes
          </p>
          <a
            href="/admin/library/alphabet"
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'background-color 0.15s',
              marginTop: '8px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            View →
          </a>
        </div>

        {/* Gloss Library Card (Coming Soon) */}
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
            <span style={{ fontSize: '1.8rem' }}>📖</span>
            <h2 style={{ margin: '0', fontSize: '1.05rem', color: '#0f172a' }}>
              Gloss Library
            </h2>
          </div>
          <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem' }}>
            Words and phrases library
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: '#e2e8f0',
              color: '#64748b',
              borderRadius: '6px',
              textDecoration: 'none',
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

      {/* Library Info */}
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
          📚 About the Library
        </h3>
        <p style={{ margin: '0', color: '#1e40af', fontSize: '0.9rem' }}>
          The Sign Asset Library organizes gesture definitions, alphabet letters, and gloss entries.
          Each asset can reference video files, pose sequences, or animation data for Type-to-Sign
          generation.
        </p>
      </section>
    </div>
  );
}
