# Bundle Optimization Report

## Current Bundle Analysis (from `next build` output)

### Largest First Load JS (shared: 87.5 KB)

| Page | First Load JS | Notes |
|------|--------------|-------|
| `/conversation` | 450 KB | Includes useRecognition, ConversationAssistant, AI replies |
| `/learn` | 440 KB | Includes gesture library, translation map |
| `/camera` | 443 KB | Legacy page with full MediaPipe + TF.js |
| `/presentation` | 377 KB | Full-screen mode with TTS |
| `/translate` | 385 KB | 3-column layout with recognition |
| `/evaluation` | 376 KB | Evaluation tool |
| `/dashboard` | 163 KB | Stats, achievements, learning progress |
| `/admin/knowledge-base` | 155 KB | KB editor component |
| `/admin/review` | 155 KB | Review queue client component |

### Largest Components

| Component | Size | Notes |
|-----------|------|-------|
| `(routes)/camera/page.tsx` | 39.9 KB | Legacy, duplicate of translate |
| `conversation/page.tsx` | 31.0 KB | Conversation page |
| `translate/page.tsx` | 13.6 KB | Main translation page |
| `evaluation/page.tsx` | 12.2 KB | Evaluation page |

## Optimization Opportunities

### 1. Remove Legacy Camera Page
- `/camera` adds 39.9 KB of client code served on a route that is no longer linked from the nav
- **Savings:** ~40 KB client bundle reduction
- **Risk:** Low — the route is not referenced anywhere in app navigation

### 2. Dynamic Imports for Admin Pages
Admin pages like `/admin/knowledge-base` (155 KB), `/admin/review` (155 KB) and `/admin/dataset` (156 KB) contain large client components loaded eagerly.

**Recommendation:** Use dynamic imports for:
- `KnowledgeBaseEditor` component → saves ~75 KB from initial admin load
- Dataset camera capture component → saves ~70 KB

### 3. Remove Unused Public Models
- `public/models/fsl_alphabet/tfjs/` (89 KB) — never loaded
- `public/models/fsl_alphabet/bilstm_v2_tfjs/` (170 KB) — never loaded  
- `public/models/fsl_105/` (195 KB) — never loaded
- **Savings:** ~454 KB of static assets served but never requested

### 4. Service Worker Pre-Caching
The service worker (`public/sw.js`) pre-caches page shells but not model files. Adding model caching would reduce cold-start model load time.

### 5. Remove Unused Model Training Artifacts
- `models/fsl_alphabet/` (orphaned dirs) — ~12.5 MB
- `models/fsl_105/bilstm/` — ~950 KB
- **Savings:** ~13.5 MB disk, not bundle

## Target Improvements

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| First Load JS (all pages) | 87.5 KB shared | 87.5 KB (same) |
| `/camera` bundle | 443 KB | 0 (remove route) |
| Static assets served | 657 KB | 203 KB (remove legacy models) |
| Disk usage (models/) | ~14.5 MB | ~1 MB (keep unified only) |

## Recommended Actions

1. ☐ Remove `src/app/(routes)/camera/page.tsx` (legacy)
2. ☐ Remove `public/models/fsl_alphabet/` (legacy exports)
3. ☐ Remove `public/models/fsl_105/` (legacy export)
4. ☐ Remove `models/fsl_alphabet/baseline/`, `lstm/`, `bilstm/`, `bilstm_v3/`, `cnn_lstm/`, `cross_signer_eval/`
5. ☐ Remove `models/fsl_105/bilstm/`
6. ☐ Keep `models/fsl_unified/bilstm/` as training source
7. ☐ Keep `public/models/fsl_unified/bilstm_tfjs/` as deployed model
