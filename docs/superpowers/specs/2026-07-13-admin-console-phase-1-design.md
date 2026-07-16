# Senyalita Admin Console Phase 1 Design

## Objective

Replace the legacy admin shell and static dashboard presentation with a responsive AI operations console. Phase 1 establishes the shared visual system and overview experience used by existing administrative workflows without changing recognition, translation, animation, Supabase, or model APIs.

## Scope

- Redesign the shared `/admin` layout with a responsive application shell.
- Replace the current grouped, emoji-based sidebar with collapsible icon navigation.
- Add a compact top bar with workspace context, authentication state, and responsive navigation access.
- Rebuild the admin overview as an operations dashboard that uses existing analytics and telemetry queries.
- Add reusable visual primitives for metrics, service health, charts, quick actions, and recent activity.
- Preserve all existing routes and links; reorganize them under the new navigation groups.

## Navigation

Desktop navigation is a collapsible left sidebar. Expanded mode displays the Senyalita Admin brand, icon-and-label sections, active route state, and an account area. Collapsed mode retains accessible icon buttons and tooltips. Mobile uses a top trigger and a slide-in navigation panel.

The primary groups are Dashboard, Recognition, Type-to-Sign, Datasets, Training, Animations, Gloss Dictionary, Suggestions, Analytics, Users, System Health, and Settings. Existing routes are mapped into these groups. Future-facing entries are visibly unavailable rather than routed to non-existent pages.

## Dashboard Overview

The overview uses the existing admin analytics, telemetry, and Supabase queries. It contains:

- Page heading, environment/authentication state, and high-value quick actions.
- Operational metrics for model accuracy, recognition confidence, translation success, dataset/asset availability, inference latency, sessions, events, and training recency. Metrics without a verified data source display an honest unavailable state rather than invented values.
- A service status panel for the recognition engine, MediaPipe, TensorFlow, animation engine, Supabase, and storage. Status is derived from available runtime or query information; otherwise it is presented as an explicit monitoring placeholder.
- Trend cards for recognition volume and confidence, plus reserved chart slots for top signs, phrases, model comparison, and training history.
- A telemetry-backed recent activity feed and workflow shortcuts to existing routes.

## Visual System

The console uses a light operational workspace rather than a generic dark dashboard: off-white canvas, white surfaces, thin neutral borders, restrained shadows, 8px card corners, a coral/orange Senyalita accent, and a deep navy text color. Typography, spacing, status colors, controls, empty states, and loading surfaces are supplied through shared admin styles.

Layouts are dense enough for repeated administrative work while preserving readable hierarchy. No Bootstrap/AdminLTE styles, decorative gradients, or technical model names are exposed in public-facing areas; technical detail remains appropriate in the admin workspace.

## Architecture

- `src/app/admin/layout.tsx` remains the server-side authentication boundary and composes the new shell.
- `src/components/admin/AdminSidebar.tsx` becomes a client-side navigation component with expanded/collapsed and mobile states.
- Shared admin styling is centralized in an admin-specific stylesheet or existing global admin class layer, avoiding changes to public route presentation.
- `src/app/admin/(dashboard)/page.tsx` renders the overview component rather than duplicating data logic.
- `src/components/admin/AdminDashboardOverview.tsx` remains server-rendered and receives focused presentational updates while retaining existing query helpers.

## Error Handling And Accessibility

- Data-dependent panels handle absent telemetry or query results with clear empty states.
- Navigation retains visible keyboard focus, names for icon-only controls, `aria-current` for active routes, and an accessible mobile dialog/panel pattern.
- Collapsed navigation remains usable with labels exposed through tooltips or accessible names.
- Layouts must not create horizontal overflow at 390px, tablet widths, or desktop widths.

## Validation

- Run TypeScript and lint checks after the shared shell changes.
- Use Playwright to capture and inspect desktop and mobile admin dashboards.
- Verify all sidebar links retain their previous destinations.
- Verify unauthenticated and authenticated layout states continue to render without API changes.

## Non-Goals

Phase 1 does not implement camera recording, training execution, deployment actions, animation upload, dictionary CRUD changes, database migrations, or new external APIs. Those belong to later module phases.