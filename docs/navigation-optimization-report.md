# Navigation & Route Consolidation Report

## Current Route Count: 35 pages + 14 API routes = 52 route files

## Duplicate Routes

### `/camera` vs `/translate`
- **Both** provide camera + recognition functionality
- `/camera` — 39.9 KB, 1138 lines, includes built-in dataset recording and debug tools
- `/translate` — 13.6 KB, 344 lines, modern 3-column layout with UserSidebar
- **Recommendation:** Remove `/camera` (not linked from any nav), keep `/translate`

### `/evaluation` as a standalone page
- This is a development/testing tool, not end-user facing
- **Recommendation:** Move to `/admin/evaluation` (already exists) and make `/evaluation` redirect

## User Navigation

### Current User Nav (via UserSidebar)
1. Translate
2. Conversation
3. Learn FSL
4. History
5. Settings
6. Dashboard (home)

### Recommendation: No changes needed
The user navigation is clean and well-organized.

## Admin Navigation

### Current Admin Nav (18 links)
Overview, Gestures, Suggested replies, Dataset, Users, Analytics, Monitoring, Model Health, Import, Conversations, Review, Models, Knowledge Base, Learning, Research, Coverage, System Health, Model Training

### Recommendation: Consolidate
Group related admin pages under expandable sections:

**Data & Models:** Gestures, Replies, Models, Model Training, Import, Dataset, Knowledge Base
**Monitoring:** Overview, Analytics, Monitoring, Model Health, System Health, Coverage
**Users & Feedback:** Users, Conversations, Review, Learning, Evaluation
**Research:** Research

This would reduce visual clutter while keeping all functionality.

## Unused Routes

| Route | Purpose | Still Linked? | Action |
|-------|---------|--------------|--------|
| `/camera` | Legacy camera | No (removed from nav) | **Remove** |
| `/presentation` | Full-screen mode | No (no nav link) | Keep (bookmark use) |

## Streamlined Route Map (After Cleanup)

### Public (4 routes)
- `/` — Landing
- `/login` — Login
- `/register` — Register
- `/evaluation` — Redirect to `/admin/evaluation`

### User (10 routes)
- `/dashboard` — Dashboard
- `/translate` — Camera + translation
- `/conversation` — Conversation
- `/conversation/[id]` — Timeline
- `/learn` — FSL browser
- `/history` — History
- `/settings` — Settings
- `/profile` — Profile
- `/presentation` — Presentation mode

### Admin (19 routes, unchanged)
Already comprehensive — only need nav reorganization
