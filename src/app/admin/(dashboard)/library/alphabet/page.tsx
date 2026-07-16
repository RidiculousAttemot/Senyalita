import { requireAdmin } from '@/lib/supabase/queries/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALPHABET_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'NG'
];

export default async function AlphabetLibraryPage() {
  await requireAdmin();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem', color: '#0f172a' }}>
          Alphabet Library
        </h1>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem' }}>
          Filipino Sign Language alphabet (A-Z, Ñ, NG) — {ALPHABET_LETTERS.length} letters
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: '12px',
        }}
      >
        {ALPHABET_LETTERS.map((letter) => (
          <div
            key={letter}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '1.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#2563eb';
              (e.currentTarget as HTMLElement).style.backgroundColor = '#eff6ff';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            {letter}
          </div>
        ))}
      </div>

      <section
        style={{
          padding: '20px',
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a' }}>
          🔤 Alphabet Coverage
        </h3>
        <p style={{ margin: '0', color: '#1e40af', fontSize: '0.9rem' }}>
          All FSL alphabet letters are available for recognition and Type-to-Sign generation. Each letter
          has associated gesture recordings and pose sequences for avatar animation.
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            RECOGNITION STATUS
          </p>
          <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
            28 / 28 ✓
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            TYPE-TO-SIGN READY
          </p>
          <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>
            In Progress
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            ANIMATION ASSETS
          </p>
          <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
            Partial
          </p>
        </div>
      </div>
    </div>
  );
}
