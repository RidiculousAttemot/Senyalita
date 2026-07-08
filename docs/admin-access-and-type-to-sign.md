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
| Sign Asset Library (Alphabet) | `http://localhost:3000/admin/gesture-library` |
| Import Gestures | `http://localhost:3000/admin/gesture-library/import` |
| Admin Login | `http://localhost:3000/admin/login` |

(Replace `3000` with the actual port printed by `npm run dev`.)

### Password Protection

Admin is protected by a simple password set in `.env.local`:

```env
ADMIN_PASSWORD=your-password
```

1. Open (or create) `.env.local` in the project root
2. Add `ADMIN_PASSWORD=your-password`
3. Restart the dev server (`npm run dev`)
4. Visit `http://localhost:3000/admin`
5. Enter the password on the login page

**Important:** This is local protection only, not a production auth system.
- The password is stored in plain text in `.env.local`
- The session is stored in an httpOnly cookie with a 4-hour expiry
- Supabase/auth should be added later for real deployed admin security

### Login Flow

1. Visit any `/admin/*` URL
2. If not authenticated, you are redirected to `/admin/login`
3. Enter the `ADMIN_PASSWORD` value
4. Correct password sets a session cookie and redirects to `/admin`
5. Wrong password shows an error message

### Troubleshooting Redirect Loops

If you see an infinite redirect loop when opening `/admin` or `/admin/login`:

1. **Clear cookies** for `localhost` in your browser
2. **Restart the dev server** after changing `.env.local` (e.g. adding/removing `ADMIN_PASSWORD`)
3. Open `http://localhost:3000/admin/login?setup=1` to verify the login page loads without looping
4. Then open `http://localhost:3000/admin` — unauthenticated access should redirect once to `/admin/login`
5. Enter `ADMIN_PASSWORD` — authenticated access should land on the admin dashboard

### Local Dev Mode

A yellow banner at the top of every admin page reads:

> **Local developer admin only. No production authentication/backend yet.**

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

The admin page at `/admin/gesture-library` lists all alphabet entries (A–Z, Ñ, NG) with:

| Column | Description |
|--------|-------------|
| Label | Letter or token (A, B, ..., Z, Ñ, NG) |
| Display | Visual representation |
| Asset Type | `pose-sequence`, `video`, or `animation` |
| Status | Ready / Draft / Missing |
| Notes | Description and model support status |

Letters A–Z are marked **Ready** (supported by the current `bilstm_v4` model).
Ñ and NG are marked **Missing** (not yet in the model — future development).

## Future Work

- Full word/phrase gloss library (beyond alphabet)
- Animation assets for each alphabet entry
- Sign asset upload/edit UI
- Continuous sign language translation (word-level, not just isolated)
- Production authentication for admin pages (Supabase/auth)
