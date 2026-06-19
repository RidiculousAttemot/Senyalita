# Phase 19 — Role-Based UX Refactor (Admin vs User Experience)

## Objective

Refactor SignLangVisual into two completely separate experiences:
1. **User Experience** — Modern SaaS-style platform for Deaf, Hard-of-Hearing, and hearing users
2. **Admin Experience** — All technical/dataset/research functionality under `/admin`

---

## Part A — User Profile Verification

The existing `profiles` table already existed with `id`, `email`, `display_name`, `role`, `created_at`, `updated_at`.

**Migration 0022** added:
- `full_name` — generated column (alias for `display_name`)
- `preferred_language` — user-facing language preference (default `'en'`)
- `avatar_url` — optional avatar field
- Auto-profile creation trigger on signup (idempotent `handle_new_user()` function)

---

## Part B — Modern Landing Page

**Route**: `/`

Completely redesigned from a simple "Start" button to a full SaaS-style homepage with:

- **Hero**: Gradient background, product headline, subheadline, Get Started / Login / Watch Demo buttons
- **Features**: 6 feature cards (Real-Time Sign Recognition, AI Conversation Assistant, Response Video Playback, Multi-Language Support, Communication Analytics, Accessibility Features)
- **How It Works**: 3-step process (Open Camera → Perform Gesture → Receive Translation)
- **About**: FSL context + project purpose + privacy guarantee
- **Statistics**: 133 signs, 105 gestures, 28 alphabet, 94%+ accuracy
- **Footer**: Navigation links + copyright

---

## Part C — User Dashboard

**Route**: `/dashboard`

Welcome section with user name + activity cards:
- Start Translation → `/translate`
- Start Conversation → `/conversation`
- Learn FSL → `/learn`
- History → `/history`
- Profile → `/profile`

Activity stats: translation count, conversation count, gestures available.

---

## Part D — User Camera Experience

**Route**: `/translate`

Clean 3-column layout (no debug/dataset/evaluation/admin controls):

| Column | Content |
|--------|---------|
| Left | Camera feed with MediaPipe hand tracking |
| Center | Live translation: detected sign name, confidence bar, percentage, translated text |
| Right | Suggested responses: clickable chips with TTS + video playback |

---

## Part E — User Side Navigation

**Component**: `src/components/UserSidebar.tsx`

Features:
- Collapsible sidebar (240px → 60px)
- Active route highlighting
- 7 nav items: Dashboard, Translate, Conversation, Learn FSL, History, Profile, Settings
- Desktop: sticky sidebar, collapsible
- Mobile: hamburger menu with overlay + bottom navigation bar (5 main items)

---

## Part F — Admin Separation

All admin routes remain under `/admin` with `requireAdmin()` protection:

- Overview, Gestures, Replies, Dataset, Review Queue, Analytics, Conversations, Model Health, Models, Research Export, Monitoring, Users
- Admin nav updated with new links (Review, Models, Research)

All technical functionality (debug panels, dataset tools, evaluation, explainability) is NOT included in the user-facing `/translate` or `/dashboard` pages.

---

## Part G — Learn FSL Portal

**Route**: `/learn`

- Search gestures by label, description, or translation
- Category filter: All / Alphabet / Phrases
- Card grid with label, category badge, translation
- Expandable detail: description + reference video player

---

## Part H — Profile & Settings

**Profile** (`/profile`): Existing page updated with UserSidebar wrapper. Displays profile form with display name, email, admin link.

**Settings** (`/settings`): New page with:
- Language selector (English, Filipino, Cebuano)
- Text size (Normal, Large, Extra Large)
- TTS toggle
- Theme toggle (Light/Dark)
- Persists to `localStorage` + syncs `preferred_language` to `profiles` table

---

## Part I — Mobile Responsive Design

- **Sidebar**: Hidden off-screen on mobile, toggled via hamburger menu
- **Bottom navigation**: 5 primary nav items (Dashboard, Translate, Conversation, Learn, History)
- **Overlay**: Click-to-close sidebar backdrop
- **Touch-friendly**: Minimum 44px touch targets for reply chips, nav items
- **Safe area**: `env(safe-area-inset-bottom)` for notched devices

---

## New Routes

| Route | Component | Type | Auth |
|-------|-----------|------|------|
| `/` | Landing page | Server | Public |
| `/dashboard` | User dashboard | Client | Protected |
| `/translate` | Camera + translation | Client | Protected |
| `/learn` | Gesture library | Client | Protected |
| `/settings` | User preferences | Client | Protected |

## Updated Routes

| Route | Change |
|-------|--------|
| `/conversation` | Wrapped with UserSidebar |
| `/history` | Wrapped with UserPageWrapper |
| `/profile` | Wrapped with UserPageWrapper |

## User Flow Diagram

```
Landing (/)
  │
  ├─ Get Started → Register → Dashboard
  ├─ Login → Dashboard
  └─ Watch Demo → Camera

Dashboard (/dashboard)
  │
  ├─ Start Translation → Camera + Translation + Replies
  ├─ Start Conversation → Two-way conversation with AI replies
  ├─ Learn FSL → Gesture library browser
  ├─ History → Past translation/conversation sessions
  └─ Profile → Account management

Settings (/settings)
  ├─ Language, Text Size, TTS, Theme
  └─ Persisted to localStorage + profiles table
```

## Admin Flow Diagram

```
Admin Overview (/admin)
  │
  ├─ Gestures → CRUD gesture definitions
  ├─ Replies → Manage suggested replies
  ├─ Dataset → Capture gesture videos
  ├─ Review Queue → Approve/reject/relabel predictions
  ├─ Analytics → Recognition/conversation stats
  ├─ Conversations → Quality metrics
  ├─ Model Health → Recognition quality dashboard
  ├─ Models → Version management
  ├─ Research Export → Anonymized dataset download
  └─ Users → Role management
```

## Accessibility Considerations

- Sidebar uses `aria-label` on toggle buttons
- Active nav items have distinct visual styling + color
- Mobile bottom nav uses `min-height` for touch targets
- All interactive elements in sidebar are `<Link>` or `<button>` elements
- Color contrast: sidebar background `#1e293b` with text `#e2e8f0` = 12.3:1 ratio

## Validation

| Check | Status |
|-------|--------|
| `npm run lint` | ✅ (3 pre-existing warnings only) |
| `npm run test` | ✅ 90/90 |
| `npm run build` | ✅ 30 routes |
| `npx tsc --noEmit` | ✅ |

## Compatibility

- ✅ Existing 133-class model
- ✅ Conversation system
- ✅ AI replies
- ✅ Supabase
- ✅ Vercel
- ✅ Telemetry
- ✅ Active learning
- ✅ Model versioning
- ✅ Admin portal
