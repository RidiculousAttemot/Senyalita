# Release Candidate Report — v1.2.0-rc

## Version Info

| Field | Value |
|-------|-------|
| **Version** | v1.2.0-rc |
| **Date** | TBD |
| **Commit** | TBD |
| **Branch** | main |
| **Status** | Release Candidate |

---

## Build Verification

### 1. TypeScript

```bash
npx tsc --noEmit --pretty
```
Status: ⬜

### 2. Lint

```bash
npm run lint
```
Status: ⬜

### 3. Tests

```bash
npm run test
```
Status: ⬜

### 4. Build

```bash
npm run build
```
Status: ⬜

---

## Feature Checklist

### Recognition

- [ ] 133-class model loads and infers
- [ ] Alphabet recognition works (A-Z, Ñ, NG)
- [ ] Phrase recognition works (106 phrases)
- [ ] Real-time camera at ≥25 FPS
- [ ] Hand landmarks rendered on canvas
- [ ] Debug overlay available
- [ ] Confidence threshold (0.7) respected

### Conversation

- [ ] 3-panel layout renders correctly
- [ ] Auto-append with cooldown
- [ ] Context-aware reply suggestions
- [ ] Custom reply typing
- [ ] Frequent replies saved/displayed
- [ ] Guided mode works (lock/release)
- [ ] Response video playback
- [ ] TTS output
- [ ] Tagalog/English toggle
- [ ] Text size toggle
- [ ] Keyboard shortcuts (G, T, E)

### Presentation

- [ ] Full-screen mode renders
- [ ] Large text display
- [ ] PIP camera preview
- [ ] Auto TTS
- [ ] Tagalog toggle

### History

- [ ] Translation session list
- [ ] Session detail view
- [ ] Prediction log table
- [ ] Conversation tab
- [ ] Conversation message replay
- [ ] TXT export for conversations

### Admin

- [ ] Overview dashboard
- [ ] Analytics (recognition, users, top gestures)
- [ ] Conversation analytics
- [ ] User management
- [ ] Gesture CRUD
- [ ] Reply CRUD
- [ ] Gesture import tool

### Auth

- [ ] Login
- [ ] Register
- [ ] Profile management
- [ ] Role enforcement (user/admin)

---

## Verification Scripts

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Unit tests
npm run test

# Production build
npm run build

# Runtime benchmark
node scripts/runtime-benchmark.mjs

# Gesture coverage audit
npm run audit:gesture-coverage

# Content audit
npm run audit:content

# Conversation analysis (requires Supabase connection)
node scripts/conversation-analysis.mjs
```

---

## Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| | | | |

---

## Release Artifacts

- Vercel deployment: `https://signlangvisual.vercel.app`
- Supabase project: TBD
- Source: `git tag v1.2.0-rc`

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Developer | | |
| Tester | | |
| Thesis advisor | | |
