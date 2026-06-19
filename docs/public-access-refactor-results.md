# Public Access Refactor Results

## Removed Pages

| Page | Route | Reason |
|------|-------|--------|
| Login | `/login` | User auth removed |
| Register | `/register` | User auth removed |
| Profile | `/profile` | No user profiles |
| Dashboard | `/dashboard` | No user accounts |
| Settings | `/settings` | No user settings |

## Removed API Routes

| Route | Reason |
|-------|--------|
| `/api/achievements/check` | Gamification removed (user-based) |
| `/api/user-progress/log` | Learning progress removed (user-based) |

## Removed Database Tables

| Table | Type | Reason |
|-------|------|--------|
| `profiles` | REMOVE | User account profiles |
| `user_learning_progress` | REMOVE | Per-user practice tracking |
| `practice_sessions` | REMOVE | Per-user practice sessions |
| `user_analytics` | REMOVE | Per-user analytics rollup |
| `user_achievements` | REMOVE | Gamification badges |
| `admin_ai_conversations` | REMOVE | Admin AI chat history |

## Refactored Tables (added `session_token`, nullable `user_id`)

| Table | Change |
|-------|--------|
| `translation_sessions` | `session_token` added, `user_id` nullable |
| `translation_logs` | `user_id` nullable (via trigger) |
| `transcripts` | `user_id` nullable (via trigger) |
| `feedback` | `session_token` added, `user_id` nullable |
| `conversation_sessions` | `session_token` added, `user_id` nullable |
| `conversation_messages` | No change (auth via parent session) |
| `gesture_captures` | `session_token` added, `captured_by` nullable |
| `telemetry_events` | `session_token` added |
| `prediction_corrections` | `session_token` added, `user_id` nullable |
| `review_queue` | No change (admin-only) |

## Removed Files

| File | Reason |
|------|--------|
| `src/app/(auth)/` directory | All auth pages |
| `src/app/dashboard/` | Dashboard page |
| `src/app/settings/` | Settings page |
| `src/components/UserPageWrapper.tsx` | Auth wrapper no longer needed |
| `src/components/dashboard/` | Dashboard components |

## Removed Code

| Function/Export | File | Reason |
|----------------|------|--------|
| `signUpWithPassword` | `actions.ts` | No user registration |
| `signOutAction` | `actions.ts` | No user sign out |
| `requestPasswordReset` | `actions.ts` | No password reset |
| `updatePasswordAction` | `actions.ts` | No password update |
| `updateDisplayNameAction` | `actions.ts` | No profile |
| `getCurrentProfile` | `profiles.ts` | Replaced by `getCurrentUser` |
| `requireCurrentProfile` | `profiles.ts` | Removed |
| `listProfiles` | `profiles.ts` | No profiles table |
| `updateOwnDisplayName` | `profiles.ts` | No profile |
| `isAdmin` type guard | `profiles.ts` | Replaced by `requireAdmin` |
| Auth check in feedback action | `feedback/actions.ts` | Now anonymous |
| Auth check in feedback API | `api/feedback/route.ts` | Now anonymous |
| Auth check in corrections API | `api/predictions/correct/route.ts` | Now anonymous |

## Retained Admin Features

| Feature | Route/File | Status |
|---------|-----------|--------|
| Admin login | `/admin/login` | New (replaces public login) |
| Admin overview | `/admin` | Active |
| Gesture management | `/admin/gestures` | Active |
| Reply management | `/admin/replies` | Active |
| Analytics | `/admin/analytics` | Active |
| Dataset management | `/admin/dataset` | Active |
| Model health | `/admin/model-health` | Active |
| Review queue | `/admin/review` | Active |
| System health | `/admin/system` | Active |
| Users page | `/admin/users` | Refactored (reads auth.users) |

## Codebase Size

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Route files | 35+ | 25+ | ~30% fewer |
| Auth imports | ~15 files | ~1 file (profiles.ts only) | ~93% fewer |
| Protected routes | 10+ | 1 prefix (`/admin/*`) | ~90% reduction |
| User-based tables | 9 | 0 | 100% removed |
