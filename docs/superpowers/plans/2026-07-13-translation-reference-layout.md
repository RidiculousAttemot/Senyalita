# Translation Reference Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Sign-to-Text and Type-to-Sign workspaces with the supplied screenshot references while preserving existing recognition and animation behavior.

**Architecture:** The two existing feature components remain their own behavior owners. This pass replaces only JSX structure and Tailwind presentation classes, retaining the same state, callbacks, camera stream, recognition hook, animation pipeline, and controls.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS v4, Radix UI, Lucide, Framer Motion.

## Global Constraints
- Preserve the existing cream and terracotta palette; the user will choose a replacement palette later.
- Use `Senyalita` branding in visible workspace text.
- Do not change recognition, camera, text-to-speech, or animation APIs.
- Verify with `npm run typecheck`, `npm run lint`, `npm run build`, and desktop/mobile browser checks when available.

---

### Task 1: Rebuild the Sign-to-Text Workspace

**Files:**
- Modify: `src/features/sign-to-text/SignToTextInterface.tsx`

**Interfaces:**
- Consumes: `useRecognition(onPrediction)`, `translateLabel`, `startCamera`, `stopCamera`, and existing transcript state.
- Produces: The existing `SignToTextInterface` React component with unchanged functional behaviors.

- [ ] **Step 1: Establish the reference layout**

Replace the current dark-card plus separate transcript column with a responsive `lg:grid-cols-[minmax(0,1fr)_310px]` workspace. The left region contains a bordered camera frame and output strip; the right region contains stacked help cards.

- [ ] **Step 2: Place controls in their screenshot positions**

Render the start/stop control, FPS/status chip, and debug trigger over the camera. Place transcript output and copy/clear actions below the camera; preserve all existing callbacks.

- [ ] **Step 3: Add static sidebar panels**

Render FSL instruction, recognition-language notice, live transcript mirror, and alphabet/number reference panels without introducing new state.

- [ ] **Step 4: Verify the component**

Run: `npm run typecheck`
Expected: no errors introduced by `SignToTextInterface.tsx`.

### Task 2: Rebuild the Type-to-Sign Workspace

**Files:**
- Modify: `src/features/type-to-sign/TypeToSignInterface.tsx`

**Interfaces:**
- Consumes: existing message state, `handleTranslate`, `handleSpeak`, animation clips, player callbacks, and selected theme state.
- Produces: The existing `TypeToSignInterface` React component with unchanged functional behaviors.

- [ ] **Step 1: Align the page shell**

Use the same responsive workspace grid as Sign-to-Text. Reframe the input and preview as contiguous panes in the main region and keep help/reference content in the sidebar.

- [ ] **Step 2: Align input, actions, and quick phrases**

Keep the textarea, translation, voice, and quick phrase interactions intact but position the primary controls in the screenshot-aligned toolbar.

- [ ] **Step 3: Align the preview and avatar themes**

Keep `SignAnimationPlayer` and its overlay playback controls unchanged. Update its container, placeholder state, and theme selector spacing to match the reference hierarchy.

- [ ] **Step 4: Verify the component**

Run: `npm run typecheck`
Expected: no errors introduced by `TypeToSignInterface.tsx`.

### Task 3: Validate Both Modes

**Files:**
- Modify: `src/app/translate/page.tsx` only if the shared page padding or tab bar prevents reference alignment.

**Interfaces:**
- Consumes: unchanged tab values `type-to-sign` and `sign-to-text`.
- Produces: unchanged route behavior at `/translate`.

- [ ] **Step 1: Validate static analysis**

Run: `npm run typecheck` and `npm run lint`.
Expected: no errors caused by the workspace redesign.

- [ ] **Step 2: Validate production compilation**

Run: `npm run build`.
Expected: the changed components compile; report unrelated repository warnings or failures separately.

- [ ] **Step 3: Validate the visual result**

Open `/translate` at desktop and mobile viewport widths. Verify that both tabs render without horizontal overflow, camera/preview frames retain visible dimensions, controls remain accessible, and sidebar content moves below the main region on small screens.

## Self-Review
- Scope coverage: Task 1 covers the Sign-to-Text reference; Task 2 covers Type-to-Sign; Task 3 covers route-level visual constraints and compilation.
- Placeholder scan: no TBD or incomplete implementation tasks.
- Type consistency: all tasks preserve existing public component interfaces and state callbacks.
