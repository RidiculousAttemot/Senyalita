# Vercel Production Validation

## Deployment Info

| Field | Value |
|-------|-------|
| Production URL | `https://signlangvisual.vercel.app` (or your custom domain) |
| Framework | Next.js 14.2.5 |
| Build command | `next build` |
| Output directory | `.next` |
| Node version | 18.x (Vercel default) |
| Deployment date | `YYYY-MM-DD` |
| Build ID | `(from Vercel dashboard)` |

## Environment Variables (Required)

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API | Public, starts with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API | Server-only, never exposed |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL | e.g. `https://signlangvisual.vercel.app` |

## Smoke Test Results

### Authentication

| Test | Result | Notes |
|------|--------|-------|
| Register new user | | |
| Login | | |
| Session persists on refresh | | |
| Logout | | |
| Guest mode (no login) | | |

### Camera & Recognition

| Test | Result | Notes |
|------|--------|-------|
| Camera permission prompt | | |
| Camera feed displays | | |
| MediaPipe hand tracking | | |
| Model loads | | |
| Alphabet recognition | | |
| Phrase recognition | | |
| Category detection (alphabet vs phrase) | | |
| Debug overlay (`?debug=1`) | | |

### Features

| Test | Result | Notes |
|------|--------|-------|
| Transcript generation | | |
| TTS playback | | |
| Suggested replies (phrase only) | | |
| Reference video playback | | (if uploaded) |
| Response video modal | | (if uploaded) |
| Feedback submission | | |
| History page | | |

### Admin

| Test | Result | Notes |
|------|--------|-------|
| Admin layout loads | | |
| Gestures list | | |
| Gesture edit | | |
| Replies list | | |
| Users list | | |
| Analytics | | |
| Dataset page | | |
| Monitoring page | | |
| Import page | | |

### Evaluation Page

| Test | Result | Notes |
|------|--------|-------|
| `/evaluation` loads | | |
| Gesture prompt displays | | |
| Correct/Incorrect recording | | |
| Session log table | | |
| Export JSON | | |

### Storage

| Test | Result | Notes |
|------|--------|-------|
| Storage bucket accessible | | |
| Video URLs resolve | | (if uploaded) |
| Admin upload works | | |

## Rollback Plan

1. In Vercel dashboard, navigate to project → Deployments
2. Find the last known-good deployment
3. Click the "..." menu → Promote to Production
4. Verify smoke tests again
