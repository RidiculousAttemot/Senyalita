# Privacy-First Architecture

## Design Principles

1. **No Account Required** — All public features are accessible without authentication
2. **No Personal Data Collection** — No email, name, or profile storage for public users
3. **On-Device Recognition** — All gesture recognition runs in-browser via TensorFlow.js and MediaPipe
4. **Local Storage First** — Session data stored in IndexedDB, not in the cloud
5. **Ephemeral Sessions** — Conversations and translations exist only during the browser session
6. **Optional Export** — Users can export conversation transcripts as TXT

## Data Flow

```
[Camera] → [MediaPipe Hands] → [TF.js Model] → [Recognition Result]
                               ↓
                    All processing on-device
                    No video/images leave the browser
```

## What We Do NOT Collect

| Data | Status |
|------|--------|
| Email addresses | ❌ Not collected |
| Passwords | ❌ Not applicable |
| Names | ❌ Not collected |
| User profiles | ❌ No profiles |
| Video recordings | ❌ Real-time only, never stored |
| Personal identifiers | ❌ None |
| IP addresses | ❌ Not logged |
| Device fingerprints | ❌ Not collected |
| Location data | ❌ Not collected |

## What We Store (Locally Only)

| Data | Storage | Purpose |
|------|---------|---------|
| Session predictions | IndexedDB | History display during session |
| Conversation messages | In-memory | Real-time conversation display |
| Export files | User-downloaded | User-initiated TXT export |

## Admin Data

Admin authentication uses Supabase Auth with email/password. Admin accounts are created manually. Administrative access provides visibility into aggregate session metrics only — no personal user data is available because none is collected.

## Security

- All recognition runs on-device (no cloud processing)
- No data transmission for public users
- Admin authentication is separate from public access
- Supabase RLS policies enforce admin-only access to system data
