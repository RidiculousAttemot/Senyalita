# Communication Profile Design

## Overview

Personalized Communication Profiles enable SignLangVisual to adapt to individual
users' preferences and communication styles without requiring user accounts.
All profiles are session-based, identified by an anonymous session token stored
in `localStorage`.

## Table: `communication_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `session_token` | `text` (unique) | Anonymous session identifier |
| `preferred_language` | `text` (`en` or `tl`) | User's preferred language for replies |
| `preferred_reply_style` | `text` (`concise`, `detailed`, `casual`, `formal`) | Reply tone preference |
| `conversation_speed` | `text` (`slow`, `normal`, `fast`) | Pace of conversation |
| `frequently_used_gestures` | `text[]` | Rollup of most-used gesture labels |
| `commonly_selected_replies` | `text[]` | Rollup of frequently selected replies |
| `accessibility_preferences` | `jsonb` | Accessibility settings (font size, contrast, etc.) |
| `total_sessions` | `integer` | Session count for this token |
| `last_active_at` | `timestamptz` | Last activity timestamp |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Row update time |

## Implementation

### Server-side

- RLS policy allows any request to read/write its own profile via `session_token`
- An `updated_at` trigger keeps the timestamp current
- Profiles are upserted on each session start

### Client-side (src/features/profiles/index.ts)

The `CommunicationProfileManager` class:

- Generates and persists an anonymous `anon_xxx` token in `localStorage`
- Tracks frequently used gestures (rolling 50 max)
- Tracks commonly selected replies (rolling 30 max)
- Provides preference data to the assistant for reply ranking and conversation pacing

## Usage Flow

1. First visit: token is generated and stored, a new profile row is created
2. Subsequent visits: token is loaded, profile preferences are hydrated
3. Throughout session: gestures and replies are logged to the profile
4. Profile data feeds into the Adaptive Reply Ranking engine

## Integration Points

- **Assistant**: Queries `getPreferredLanguage()` for reply translation
- **Reply Ranker**: Uses `getCommonReplies()` for history boosting
- **Learn Page**: Uses `getRecentGestures()` to identify practice candidates
