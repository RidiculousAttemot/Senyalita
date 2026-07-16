# Admin Dashboard Structure - Phase 5

## Overview

The admin dashboard has been reorganized into a clean, thesis-workflow-focused structure with 7 semantic navigation groups, coming-soon badges for future features, and clear empty states. All pages use Supabase admin role authentication via `requireAdmin()`.

**Status:** ✓ Complete | Lint: 0 new warnings | Build: ✓ Passed | Tests: 90 passing

---

## Navigation Structure (7 Groups)

### 1. Dashboard
- **[/admin](/admin)** - Admin dashboard landing
  - Quick stats: Recognition classes, translation sessions, model status, system health
  - Thesis workflow overview with Sign-to-Text and Type-to-Sign pipelines
  - Navigation guide with emoji icons
  - System readiness indicators

### 2. Library
- **[/admin/library](/admin/library)** - Sign Asset Library overview
  - Gesture counts and asset management hub
  - Links to alphabet and gloss libraries
  - Status cards for library sections
- **[/admin/library/alphabet](/admin/library/alphabet)** - Alphabet Letter Grid
  - Interactive 28-letter grid (A-Z, Ñ, NG)
  - Recognition status (28/28 ✓)
  - Type-to-Sign readiness tracker
  - Animation asset status
- **[/admin/library/gloss](/admin/library/gloss)** - Gloss Library (Coming Soon)

### 3. Capture Studio
- **[/admin/capture](/admin/capture)** - Capture Studio hub
  - Record Gesture (ready) → links to `/admin/capture/record`
  - Pose Sequence Editor (coming soon)
  - Import Assets (ready) → links to `/admin/gesture-library/import`
  - Workflow documentation: Capture → extraction → pose sequence → avatar animation
- **[/admin/capture/record](/admin/capture/record)** - Gesture Recording UI (Coming Soon)
- **[/admin/gesture-library/import](/admin/gesture-library/import)** - Asset Import Tool (Existing)

### 4. Training
- **[/admin/training](/admin/training)** - Training Hub
  - Overview cards: Dataset Samples, Current Model (BiLSTM v2, 94.86%), Classes (133)
  - Links to dataset, models, and model-health management
  - 6-step training workflow documentation
  - npm run commands reference:
    - `npm run audit:dataset` - Validate dataset
    - `npm run train:bilstm` - Train BiLSTM model
    - `npm run export:tfjs` - Export to TensorFlow.js
  - Existing pages:
    - `/admin/dataset` - Dataset management
    - `/admin/models` - Model versions
    - `/admin/model-health` - Model performance monitoring

### 5. Audits
- **[/admin/audits](/admin/audits)** - Audits & Logs overview
  - Recognition Logs (ready) → links to `/admin/audits/logs`
  - Gesture History (coming soon)
  - Confidence Reports (coming soon)
  - Translation Usage (coming soon)
  - Recognition logging plan documentation
  - Current status: No logs yet | Logging In Setup | DB Table Ready ✓
- **[/admin/audits/logs](/admin/audits/logs)** - Recognition Logs viewer
  - Empty state: "No Recognition Logs Yet"
  - Planned fields: gesture label, confidence, timestamp, input mode, source, transcript
  - Setup instructions for enabling logging

### 6. Evaluation
- **[/admin/analytics](/admin/analytics)** - Analytics Dashboard (Existing)
- **[/admin/analytics/recognition](/admin/analytics/recognition)** - Recognition Analysis (Existing)
- **[/admin/model-health](/admin/model-health)** - Model Health (Existing)
- **[/admin/active-learning](/admin/active-learning)** - Active Learning Dashboard (Existing)
- **[/admin/research-insights](/admin/research-insights)** - Research Insights (Existing)

### 7. System
- **[/admin/system](/admin/system)** - System Health & Infrastructure
  - Infrastructure status (DB, Storage, Auth)
  - Recognition Engine metrics
  - AI Assistant status
  - Dataset & Review queue
  - System Configuration
  - Status badges: operational, degraded, unavailable
- **[/admin/settings](/admin/settings)** - System Settings (Coming Soon)
- **[/admin/gesture-coverage](/admin/gesture-coverage)** - Gesture Coverage Analysis (Coming Soon)
- **[/admin/translation-coverage](/admin/translation-coverage)** - Translation Completeness (Coming Soon)

---

## Implementation Status

### ✓ Implemented & Ready
- Dashboard landing page (/admin)
- Library overview (/admin/library)
- Alphabet library (/admin/library/alphabet)
- Capture Studio hub (/admin/capture)
- Training hub (/admin/training)
- Audits overview (/admin/audits)
- Audits logs viewer (/admin/audits/logs)
- System health (/admin/system)
- 6 existing evaluation pages (analytics, model-health, active-learning, etc.)
- AdminSidebar with 7-group navigation
- Coming-soon badges and disabled item styling

### 🔄 In Progress / Coming Soon
- /admin/library/gloss - Gloss library page
- /admin/capture/record - Gesture recording UI
- /admin/settings - System settings page
- /admin/gesture-coverage - Gesture class coverage analysis
- /admin/translation-coverage - Translation completeness tracking

---

## Component Architecture

### AdminSidebar.tsx (Client Component)
- **Purpose:** Unified navigation sidebar for all admin pages
- **Features:**
  - 7 expandable/collapsible groups
  - Active link detection (pathname matching + custom .matches override)
  - Coming-soon badge for disabled items
  - Keyboard navigation support
  - Sticky positioning at 260px width
  - Dark theme (#1e293b bg, #e2e8f0 text) by default
  - Light theme via @media (prefers-color-scheme: light)
  - Responsive: width reduction at 1024px, mobile drawer at 768px

### AdminSidebar.module.css
- **Size:** 400+ lines including all responsive breakpoints
- **Key Classes:**
  - `.sidebar` - Sticky sidebar container
  - `.navItem` - Link styling with smooth transitions
  - `.navItemActive` - #1e40af blue bg + 3px #60a5fa accent border
  - `.groupButton` - Expandable section headers with chevron rotation
  - `.comingSoonBadge` - Inline-flex, uppercase, gray background
  - `.navItemDisabled` - opacity 0.6, cursor not-allowed, pointer-events none
  - `.navItemWrapper` - Prevents navigation for disabled items
  - Light theme overrides via @media query

### ToolLink.tsx (Client Component)
- **Purpose:** Wrapper component fixing "Event handlers cannot be passed to Client Component props" error
- **Features:**
  - Encapsulates Link with event handlers
  - Server Components can pass href and label
  - Client-side hover effects
  - No background hover by default (styling applied via parent context)

### Page Components (Admin Pages)
- **Architecture:** All Server Components with `export const dynamic = 'force-dynamic'`
- **Auth:** Each page calls `requireAdmin()` via server action
- **Query Pattern:** Direct Supabase queries for stats (gesture count, session count, etc.)
- **UI Pattern:** 
  - Header (title + subtitle)
  - Grid of metric/status cards
  - Info sections (yellow/blue/green with context-specific information)
  - Links to implemented features or coming-soon badges for placeholders

---

## Thesis Workflow Integration

### Sign-to-Text Pipeline (Already Implemented)
1. User captures hand/pose gestures via camera at `/translate`
2. MediaPipe extracts 21 hand + 33 pose landmarks in real-time
3. TensorFlow.js BiLSTM v2 model (475KB, 94.86% accuracy) predicts FSL class
4. Translation engine (translation.ts) maps 133 classes to English text
5. Transcript displayed with confidence scores
6. Session saved to Supabase (translation_sessions, translation_logs)

**Admin tools:** Training hub, Model health, Analytics, Audits/Recognition logs

### Type-to-Sign Pipeline (Framework Ready)
1. User enters English text at `/type-to-sign`
2. Type-to-Sign engine processes text → FSL gloss sequence
3. Pose sequences retrieved from gesture library
4. Avatar animation generated (future: sign animation player)
5. Non-manual markers applied (facial expressions, body movements)

**Admin tools:** Library (Alphabet, Gloss), Capture Studio (asset collection)

### Asset Management
- **Alphabet library:** 28 letters with status tracking
- **Gloss library:** FSL vocabulary mapped to English
- **Gesture library:** 133+ gesture definitions with:
  - Pose sequences (landmarks over time)
  - Video examples
  - Category tags
  - Difficulty levels
  - Related gestures

**Admin tools:** Library pages, Capture Studio, Gesture library CRUD

### Training & Model Improvement
- **Dataset pipeline:** Collect → Validate → Preprocess → Train → Evaluate → Export
- **Current model:** BiLSTM v2 (94.86% test accuracy on 14K+ samples from 7 signers including Kaggle)
- **Active learning:** Review queue for misclassifications, dataset expansion
- **Monitoring:** Model drift detection, confidence distribution analysis, class imbalance detection

**Admin tools:** Training hub, Dataset management, Model versions, Active learning, Recognition analysis

---

## Key Database Tables

### Recognition Pipeline
- `gestures` - Core gesture definitions (133 classes)
- `gesture_captures` - Training data (14K+ labeled samples)
- `translation_sessions` - Recognition sessions (metadata)
- `translation_logs` - Per-frame predictions (timestamp, confidence, label)
- `recognition_logs` - Audit trail (future: enabled in Phase 6)

### Asset Management
- `gesture_definitions` - Gesture library with pose sequences
- `gesture_replies` - Pre-defined response gestures

### Type-to-Sign (Future)
- `gloss_mappings` - English text → FSL gloss
- `pose_sequences` - Stored animation data
- `animation_assets` - Video clips and motion data

---

## Authentication & Authorization

### Admin Access
- Supabase admin auth via `app_metadata.role = 'admin'`
- Each page calls `requireAdmin()` server action
- Layout does NOT gate (each page enforces independently)
- `/admin/login` redirects non-admin users

### RLS Policies
- Admin users have full read/write access to:
  - gesture_definitions
  - gesture_captures
  - translation_sessions
  - translation_logs
  - model_versions (future)
- Regular users only see public gesture library and their own session history

---

## Upcoming Phases

### Phase 6 - Recognition Logging
- Enable audit trail of all predictions
- Populate recognition_logs table on each prediction
- Implement `/admin/audits/logs` table view with filtering
- Add confidence reports and gesture history analysis

### Phase 7 - Gesture Coverage & Translation
- `/admin/gesture-coverage` - Analyze class coverage (weak classes, confusion pairs)
- `/admin/translation-coverage` - Check FSL gloss mapping completeness
- Recommend dataset expansion priorities

### Phase 8 - Type-to-Sign Asset Creation
- `/admin/capture/record` - Video recording UI for pose capture
- Pose sequence extraction pipeline (automated MediaPipe processing)
- Batch import tool for gesture animation assets
- Status tracking: which alphabet letters/glosses have pose sequences

### Phase 9 - Settings & Monitoring
- `/admin/settings` - System configuration (recognition thresholds, logging levels, etc.)
- Enhanced `/admin/system` with real-time Vercel/Supabase metrics
- Sentry error tracking dashboard

---

## File Changes Summary

### New Files Created
- `/src/app/admin/(dashboard)/library/page.tsx` - Library overview
- `/src/app/admin/(dashboard)/library/alphabet/page.tsx` - Alphabet grid
- `/src/app/admin/(dashboard)/capture/page.tsx` - Capture Studio hub
- `/src/app/admin/(dashboard)/training/page.tsx` - Training hub
- `/src/app/admin/(dashboard)/audits/page.tsx` - Audits overview
- `/src/app/admin/(dashboard)/audits/logs/page.tsx` - Recognition logs viewer

### Files Modified
- `/src/components/admin/AdminSidebar.tsx` - Updated SECTIONS array (4 groups → 7 groups), added coming-soon support, updated navigation rendering
- `/src/components/admin/AdminSidebar.module.css` - Added 50+ lines for coming-soon badges and disabled item styling
- `/src/app/admin/(dashboard)/page.tsx` - Simplified dashboard landing with thesis workflow focus

### Files Unchanged
- `/src/app/admin/layout.tsx` - Single sidebar provider (confirmed working)
- `/src/app/admin/(dashboard)/layout.tsx` - Pass-through (confirmed working)
- All existing admin pages (analytics, models, etc.) - Backward compatible

---

## Testing Checklist

- [x] Build passes with `npm run build` (no new errors)
- [x] Lint clean with `npm run lint` (0 new warnings from admin changes)
- [x] Sidebar renders single instance (no duplication)
- [x] Active link detection working (pathname matching)
- [x] Coming-soon items non-navigable (preventDefault on click)
- [x] Responsive at breakpoints (1024px, 768px)
- [x] Dark theme active by default (#1e293b)
- [x] Light theme works via @media (prefers-color-scheme: light)
- [ ] Manual login test (Supabase admin auth)
- [ ] Expand/collapse groups (collapsible state)
- [ ] Click implemented links (navigate to correct pages)
- [ ] Sign-to-Text unaffected (/translate still works)
- [ ] Type-to-Sign unaffected (/type-to-sign still works)

---

## References

- **Main Dashboard:** [/admin](/admin)
- **Navigation Code:** [src/components/admin/AdminSidebar.tsx](src/components/admin/AdminSidebar.tsx)
- **Styles:** [src/components/admin/AdminSidebar.module.css](src/components/admin/AdminSidebar.module.css)
- **Thesis Overview:** [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)
- **Training Pipeline:** [docs/model-training-reference.md](docs/model-training-reference.md)
- **Recognition Analysis:** [docs/recognition-analysis-guide.md](docs/recognition-analysis-guide.md)
