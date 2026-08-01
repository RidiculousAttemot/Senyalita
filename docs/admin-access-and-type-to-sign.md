# Admin Access and Type-to-Sign

## Starting the App

```bash
npm run dev
```

The dev server prints a local URL, typically:

```
http://localhost:3000
```

If port 3000 is busy, Next.js prints the actual port (e.g. `http://localhost:3001`).

## Admin Access

Admin is **not linked from the public landing page**. Access it by direct URL:

| Page | URL |
|------|-----|
| Admin Dashboard | `http://localhost:3000/admin` |
| Animation Studio (upload/extract/publish) | `http://localhost:3000/admin/animation-studio` |
| Animation Library | `http://localhost:3000/admin/animation-library` |
| Animation Dataset Manager | `http://localhost:3000/admin/animation-dataset` |
| Animation Inspector | `http://localhost:3000/admin/animation-inspector` |
| System Health | `http://localhost:3000/admin/system` |
| Admin Login | `http://localhost:3000/admin/login` |

(Replace `3000` with the actual port printed by `npm run dev`.) The admin panel
manages animation assets only — there is no gesture/dataset/training UI in the
running app; see `docs/admin-dashboard-structure.md` for the full route list.

### Supabase Admin Auth

Admin access is backed by Supabase Auth. The visible `/admin/login` page signs in with an email/password account from your Supabase project.

1. Open the Supabase dashboard for your project
2. Create or select the admin user in Auth
3. Set the user metadata so the account has `app_metadata.role = "admin"`
4. Make sure the app is configured with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
5. Restart the dev server if you changed environment variables
6. Open `http://localhost:3000/admin/login` and sign in with the admin account

**Important:** admin access is now tied to the Supabase user record and its role metadata.
- The admin account is visible in Supabase Auth
- Database policies and `requireAdmin()` use the Supabase role check
- Logging out clears the Supabase session (legacy cookie cleanup is harmless but no longer required)

### Login Flow

1. Visit `/admin`
2. If not authenticated, you are redirected once to `/admin/login`
3. Sign in with the Supabase admin email and password
4. Correct credentials create a Supabase session and redirect to `/admin`
5. If the account is missing `app_metadata.role = "admin"`, the admin area stays locked (access denied page shown)
6. Logout clears the session and returns to `/admin/login`

### Troubleshooting Redirect Loops

If you see an infinite redirect loop when opening `/admin` or `/admin/login`:

1. Clear cookies for `localhost` in your browser
2. Restart the dev server after changing Supabase env vars or role metadata
3. Open `http://localhost:3000/admin/login` directly and confirm it loads
4. Then open `http://localhost:3000/admin` and confirm it redirects once to `/admin/login`
5. Sign in again with the Supabase admin account

### Admin Dashboard UI

The admin area features a polished dashboard:

- **Login Page** (`/admin/login`): Clean, centered auth card with Senyalita branding. No dashboard navigation or tools visible until authenticated.
- **Dashboard** (`/admin`): Left sidebar navigation grouped into categories:
  - **Dashboard** — Overview
  - **Animations** — Animation Studio, Animation Dataset, Animation Library, Animation Inspector
  - **System** — System Health
- Responsive: sidebar collapses on mobile with a drawer.
- Every page (and every `/api/admin/*` route) calls `requireAdmin()` itself in
  addition to the middleware check.

## Type-to-Sign

### URL

```
http://localhost:3000/TypeToSign
http://localhost:3000/type-to-sign
```

Both URLs serve the same page.

### Current Behavior

- **Alphabet-first**: The page displays all supported letters (A–Z) and numbers (0–9).
- Type text (e.g. "abc") and press **Translate to Sign**.
- The pipeline maps individual letters and known words to sign animations.
- Unknown words fall back to fingerspelling (letter-by-letter).
- Avatar animation plays the sign sequence.

### Sign Asset Library

The admin page at `/admin/animation-library` lists every animation asset (one
row per gloss, including the alphabet) with its published/latest version
status, quality score, and review count. Assets are created via
`/admin/animation-studio` (upload → extract → preview → publish), not through
a separate import tool.

### Admin URL

Open the admin area directly at:

```text
http://localhost:3000/admin
```

If Next.js prints a different port, replace `3000` with that value.

## Future Work

- Full word/phrase gloss library (beyond alphabet) — in progress via Animation Studio
- Video trimming in Animation Studio (currently uploads the recording as-is; no in/out point selection)
- Continuous sign language translation (word-level, not just isolated)