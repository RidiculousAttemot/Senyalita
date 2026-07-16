# Senyalita Admin Console Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy admin shell and dashboard overview with a responsive, query-backed Senyalita AI operations console while preserving all backend APIs and existing routes.

**Architecture:** Add a typed admin navigation model so the sidebar has one source of truth for labels, route matching, future availability, and Lucide icons. Use an admin-scoped stylesheet imported by the server-side admin layout, keeping public pages unchanged. The dashboard route delegates to the existing server-rendered overview component, which keeps existing analytics and telemetry queries and derives only presentational operational states from a small pure helper.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, CSS Modules/admin-scoped CSS, Lucide React, Supabase SSR, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve recognition, TensorFlow inference, MediaPipe, translation, animation playback, routing, and Supabase query APIs.
- Keep `/admin` authentication based on `auth.users.app_metadata.role = "admin"`.
- Do not add a database migration, external API, or package dependency.
- Use Lucide icons rather than emoji or manually drawn SVG icons for admin controls.
- Limit visual changes to the admin route tree; do not alter public pages.
- Use light operational styling: off-white canvas, white surfaces, neutral borders, restrained shadows, 8px card radius, coral/orange accent, and deep navy text.
- Show unavailable data honestly; never manufacture metrics or service status.
- Validate 390px mobile, tablet, and desktop layouts without horizontal overflow.
- Do not create a git commit unless the user explicitly requests one.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/admin/navigation.ts` | Typed navigation source of truth and route-matching helper. |
| `src/lib/admin/dashboard.ts` | Pure formatting and operational status helpers for dashboard data. |
| `src/lib/__tests__/adminNavigation.test.ts` | Navigation grouping and route matching tests. |
| `src/lib/__tests__/adminDashboard.test.ts` | Dashboard helper tests for available/unavailable data states. |
| `src/components/admin/AdminSidebar.tsx` | Responsive, collapsible client navigation driven by the shared model. |
| `src/components/admin/AdminSidebar.module.css` | Sidebar-specific desktop, collapsed, and mobile-panel styles. |
| `src/components/admin/AdminDashboardOverview.tsx` | Query-backed dashboard content, service status, visual metrics, charts, and activity. |
| `src/app/admin/layout.tsx` | Auth-preserving shell composition, mobile nav trigger, and scoped stylesheet import. |
| `src/app/admin/admin.css` | Admin-only visual tokens, top bar, dashboard cards, chart primitives, and responsive grids. |
| `src/app/admin/(dashboard)/page.tsx` | Delegates the `/admin` route to `AdminDashboardOverview`. |
| `vitest.config.ts` | Includes the two new `src/lib/__tests__` unit test files, already covered by the existing include pattern. |

## Task 1: Establish Typed Navigation And Dashboard Presentation Helpers

**Files:**
- Create: `src/lib/admin/navigation.ts`
- Create: `src/lib/admin/dashboard.ts`
- Create: `src/lib/__tests__/adminNavigation.test.ts`
- Create: `src/lib/__tests__/adminDashboard.test.ts`

**Interfaces:**
- Produces `ADMIN_NAVIGATION`, `AdminNavigationSection`, `AdminNavigationItem`, and `isAdminNavigationItemActive(pathname, item)` for `AdminSidebar`.
- Produces `formatAdminPercent(value)`, `getServiceStatus(input)`, and `ServiceStatus` for `AdminDashboardOverview`.
- `getServiceStatus({ hasData, isOperational, detail })` returns `{ tone: "healthy" | "attention" | "unknown", label: string, detail: string }` and never treats absent data as healthy.

- [ ] **Step 1: Write the failing navigation tests**

Create `src/lib/__tests__/adminNavigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ADMIN_NAVIGATION, isAdminNavigationItemActive } from "@/lib/admin/navigation";

describe("admin navigation", () => {
  it("exposes the required control-center sections", () => {
    expect(ADMIN_NAVIGATION.map((section) => section.label)).toEqual([
      "Dashboard", "Recognition", "Type-to-Sign", "Datasets", "Training",
      "Animations", "Gloss Dictionary", "Suggestions", "Analytics", "Users",
      "System Health", "Settings",
    ]);
  });

  it("matches a nested route without activating unrelated routes", () => {
    const models = ADMIN_NAVIGATION.flatMap((section) => section.items)
      .find((item) => item.href === "/admin/models");
    expect(models).toBeDefined();
    expect(isAdminNavigationItemActive("/admin/models/training", models!)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/model-health", models!)).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing dashboard helper tests**

Create `src/lib/__tests__/adminDashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatAdminPercent, getServiceStatus } from "@/lib/admin/dashboard";

describe("admin dashboard helpers", () => {
  it("formats available confidence values and identifies missing values", () => {
    expect(formatAdminPercent(0.9486)).toBe("94.9%");
    expect(formatAdminPercent(null)).toBe("Unavailable");
  });

  it("does not report unavailable monitoring as healthy", () => {
    expect(getServiceStatus({ hasData: false, isOperational: false, detail: "No telemetry" }))
      .toEqual({ tone: "unknown", label: "Monitoring unavailable", detail: "No telemetry" });
  });
});
```

- [ ] **Step 3: Run the tests to verify failure**

Run: `npm test -- src/lib/__tests__/adminNavigation.test.ts src/lib/__tests__/adminDashboard.test.ts`

Expected: FAIL because `@/lib/admin/navigation` and `@/lib/admin/dashboard` do not exist.

- [ ] **Step 4: Implement the navigation model**

Create `src/lib/admin/navigation.ts` with Lucide icon component references and route definitions. Use this shape:

```ts
import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, BookOpen, Bot, BrainCircuit, Database, FileText, FolderKanban, Gauge, LayoutDashboard, Settings, Users } from "lucide-react";

export type AdminNavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  exact?: boolean;
  unavailable?: boolean;
};

export type AdminNavigationSection = {
  label: string;
  items: AdminNavigationItem[];
};

export const isAdminNavigationItemActive = (pathname: string, item: AdminNavigationItem) =>
  Boolean(item.href && (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
```

Populate `ADMIN_NAVIGATION` with the required top-level labels and only existing route targets. Mark future-only items unavailable and omit `href` so they cannot navigate.

- [ ] **Step 5: Implement dashboard helpers**

Create `src/lib/admin/dashboard.ts`:

```ts
export type ServiceStatus = {
  tone: "healthy" | "attention" | "unknown";
  label: "Operational" | "Needs attention" | "Monitoring unavailable";
  detail: string;
};

export const formatAdminPercent = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? "Unavailable" : `${(value * 100).toFixed(1)}%`;

export const getServiceStatus = ({ hasData, isOperational, detail }: { hasData: boolean; isOperational: boolean; detail: string }): ServiceStatus => {
  if (!hasData) return { tone: "unknown", label: "Monitoring unavailable", detail };
  return isOperational
    ? { tone: "healthy", label: "Operational", detail }
    : { tone: "attention", label: "Needs attention", detail };
};
```

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/lib/__tests__/adminNavigation.test.ts src/lib/__tests__/adminDashboard.test.ts`

Expected: PASS with four tests.

## Task 2: Implement The Responsive, Collapsible Admin Navigation

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/admin/AdminSidebar.module.css`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes `ADMIN_NAVIGATION` and `isAdminNavigationItemActive` from `src/lib/admin/navigation.ts`.
- Produces `AdminSidebar` with `collapsed` and `onCollapsedChange` props, and a mobile trigger passed from `AdminLayout`.
- Sidebar links retain existing route targets and have accessible labels in collapsed mode.

- [ ] **Step 1: Write the failing sidebar behavior test**

Create `src/components/admin/__tests__/AdminSidebar.test.tsx`, then extend `vitest.config.ts` `include` with `"src/components/**/__tests__/**/*.test.tsx"`.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSidebar from "../AdminSidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/models/training" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));

describe("AdminSidebar", () => {
  it("marks the active nested route and exposes a collapsed navigation control", () => {
    render(<AdminSidebar collapsed={false} onCollapsedChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the sidebar test to verify failure**

Run: `npm test -- src/components/admin/__tests__/AdminSidebar.test.tsx`

Expected: FAIL because `AdminSidebar` does not accept the required props or contain the collapse control.

- [ ] **Step 3: Replace the old grouped sidebar implementation**

Update `AdminSidebar.tsx` to:

```tsx
type AdminSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};
```

Render all `ADMIN_NAVIGATION` sections with `item.icon`, `Link` for available routes, a disabled button for unavailable entries, `aria-current="page"` for the active item, and a named collapse button. Use a close button on mobile and call `onMobileOpenChange(false)` when a navigable item is selected.

- [ ] **Step 4: Replace sidebar CSS with the responsive console styles**

Update `AdminSidebar.module.css` with:

```css
.sidebar { width: 248px; min-height: 100dvh; background: #fffdf9; border-right: 1px solid #e8e4dd; }
.sidebarCollapsed { width: 72px; }
.navItemActive { background: #fff0ea; color: #a34d32; }
.collapseButton, .mobileClose { min-width: 40px; min-height: 40px; }
@media (max-width: 900px) { .sidebar { position: fixed; transform: translateX(-100%); } .mobileOpen { transform: translateX(0); } }
```

Keep all interactive controls at least 40px square, use the existing `font-display` utility for branding, and set transition properties only for `width`, `transform`, `background-color`, and `color`.

- [ ] **Step 5: Compose sidebar state in the admin layout**

Create a small client `AdminShell` component if needed to own `collapsed` and `mobileOpen` state, then have `src/app/admin/layout.tsx` keep only server-side auth retrieval and render:

```tsx
<AdminShell isAuthenticated={isAuthenticated} email={user?.email ?? null}>
  {children}
</AdminShell>
```

The shell must display a mobile menu button, a concise workspace label, the existing authentication status, and the page content. Do not move the role check to the client.

- [ ] **Step 6: Run the focused sidebar test**

Run: `npm test -- src/components/admin/__tests__/AdminSidebar.test.tsx`

Expected: PASS.

## Task 3: Add A Scoped Admin Visual System And Shell Surfaces

**Files:**
- Create: `src/components/admin/AdminShell.tsx`
- Create: `src/app/admin/admin.css`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- `AdminShell` is a client component accepting `{ children: React.ReactNode; isAuthenticated: boolean; email: string | null }`.
- `AdminLayout` imports `./admin.css` and remains the only Supabase authentication owner.
- All shared classes are prefixed `admin-console-` or nested under `.admin-console`.

- [ ] **Step 1: Write the failing shell test**

Create `src/components/admin/__tests__/AdminShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminShell from "../AdminShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));

describe("AdminShell", () => {
  it("renders authenticated workspace context and a mobile navigation trigger", () => {
    render(<AdminShell isAuthenticated email="admin@senyalita.test"><p>Dashboard content</p></AdminShell>);
    expect(screen.getByText("admin@senyalita.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the shell test to verify failure**

Run: `npm test -- src/components/admin/__tests__/AdminShell.test.tsx`

Expected: FAIL because `AdminShell` does not exist.

- [ ] **Step 3: Implement the shell component**

Create `AdminShell.tsx` as a client component. It owns `collapsed` and `mobileOpen`, renders `AdminSidebar`, a semantic `<main id="main-content">`, and a top bar with a menu button, `Senyalita Admin` workspace label, authenticated/locked status pill, and email only when present.

- [ ] **Step 4: Add the admin-scoped stylesheet**

Create `src/app/admin/admin.css` with tokens and shell primitives:

```css
.admin-console { --admin-canvas: #f7f5f1; --admin-surface: #ffffff; --admin-ink: #15233a; --admin-muted: #6b7280; --admin-border: #e8e4dd; --admin-accent: #c96745; --admin-radius: 8px; min-height: 100dvh; background: var(--admin-canvas); color: var(--admin-ink); }
.admin-console-main { min-width: 0; flex: 1; }
.admin-console-topbar { min-height: 64px; border-bottom: 1px solid var(--admin-border); background: color-mix(in srgb, var(--admin-surface) 92%, transparent); }
.admin-console-content { width: min(100% - 40px, 1480px); margin: 0 auto; padding: 32px 0 48px; }
@media (max-width: 640px) { .admin-console-content { width: min(100% - 32px, 1480px); padding-top: 20px; } }
```

Use no global `body`, `button`, or public-route selectors.

- [ ] **Step 5: Update the server layout**

Replace inline flex/top-bar styles in `src/app/admin/layout.tsx` with `AdminShell`, preserving:

```ts
const isAuthenticated = user?.app_metadata?.role === "admin";
```

and pass the email as `user?.email ?? null`.

- [ ] **Step 6: Run focused component tests**

Run: `npm test -- src/components/admin/__tests__/AdminSidebar.test.tsx src/components/admin/__tests__/AdminShell.test.tsx`

Expected: PASS.

## Task 4: Rebuild The Query-Backed Dashboard Overview

**Files:**
- Modify: `src/components/admin/AdminDashboardOverview.tsx`
- Modify: `src/app/admin/(dashboard)/page.tsx`
- Modify: `src/app/admin/admin.css`

**Interfaces:**
- Consumes existing `fetchAdminAnalytics`, `listTelemetryEvents`, and direct `translation_logs` query without changing their signatures.
- Consumes `formatAdminPercent` and `getServiceStatus` from `src/lib/admin/dashboard.ts`.
- `/admin` renders `<AdminDashboardOverview />` and no longer duplicates a static dashboard.

- [ ] **Step 1: Write a failing dashboard semantic render test**

Create `src/components/admin/__tests__/AdminDashboardOverview.test.tsx` only after extracting a data-free `DashboardServiceGrid` presentational component from the server component. Test it as:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardServiceGrid } from "../DashboardServiceGrid";

describe("DashboardServiceGrid", () => {
  it("renders service names and honest unavailable monitoring status", () => {
    render(<DashboardServiceGrid services={[{ name: "MediaPipe", tone: "unknown", label: "Monitoring unavailable", detail: "No browser session" }]} />);
    expect(screen.getByText("MediaPipe")).toBeInTheDocument();
    expect(screen.getByText("Monitoring unavailable")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dashboard presentation test to verify failure**

Run: `npm test -- src/components/admin/__tests__/AdminDashboardOverview.test.tsx`

Expected: FAIL because `DashboardServiceGrid` does not exist.

- [ ] **Step 3: Implement dashboard service and metric presentation**

Extract `DashboardServiceGrid` into `src/components/admin/DashboardServiceGrid.tsx` with typed props:

```ts
export type DashboardService = { name: string; tone: ServiceStatus["tone"]; label: ServiceStatus["label"]; detail: string };
```

Update `AdminDashboardOverview.tsx` to use current real analytics/telemetry data for recognition activity, confidence, recent event count, active users, and activity rows. Build the service grid with `unknown` state for browser-only engines and unavailable storage information; do not mark them operational merely because the page rendered. Keep existing short sparkline computation, add chart cards for available data, and label unavailable slots as `No data connected`.

- [ ] **Step 4: Apply dashboard visual classes**

Extend `admin.css` with the following responsive visual hierarchy:

```css
.admin-dashboard-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
.admin-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.admin-service-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.admin-chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.admin-panel { border: 1px solid var(--admin-border); border-radius: var(--admin-radius); background: var(--admin-surface); box-shadow: 0 8px 24px rgba(32, 29, 24, 0.04); }
@media (max-width: 1100px) { .admin-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .admin-service-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .admin-dashboard-header, .admin-metric-grid, .admin-service-grid, .admin-chart-grid { grid-template-columns: 1fr; flex-direction: column; } }
```

Use a status dot with text; color cannot be the only status indicator.

- [ ] **Step 5: Route `/admin` through the overview component**

Replace `src/app/admin/(dashboard)/page.tsx` content with:

```tsx
import AdminDashboardOverview from "@/components/admin/AdminDashboardOverview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminDashboardPage() {
  return <AdminDashboardOverview />;
}
```

- [ ] **Step 6: Run focused dashboard tests**

Run: `npm test -- src/lib/__tests__/adminDashboard.test.ts src/components/admin/__tests__/AdminDashboardOverview.test.tsx`

Expected: PASS.

## Task 5: Validate Route Safety, Rendering, And Responsiveness

**Files:**
- Modify only when validation exposes a Phase 1 defect: files from Tasks 1-4.

**Interfaces:**
- Every existing sidebar destination remains navigable.
- `/admin` continues using the server-side Supabase role check.

- [ ] **Step 1: Run all unit tests**

Run: `npm test`

Expected: PASS with existing tests plus the Phase 1 navigation, helper, sidebar, shell, and service grid tests.

- [ ] **Step 2: Run static checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: no new lint errors. Existing unrelated warnings may remain documented in terminal output.

- [ ] **Step 3: Run desktop browser validation**

Run the existing local development server, then use Playwright at 1440x1024 to visit `/admin`. Verify the sidebar opens to the active route, collapses/expands without content overlap, dashboard metric grid uses four columns, service grid uses three columns, and the recent activity table remains visible.

- [ ] **Step 4: Run mobile browser validation**

Use Playwright at 390x844 to visit `/admin`. Verify `document.documentElement.scrollWidth === window.innerWidth`, the menu trigger opens the sidebar, the close control works, all metric/service/chart grids become one column, and the top bar content does not overlap.

- [ ] **Step 5: Verify preserved destinations**

In Playwright, inspect every available navigation anchor’s `href` and compare them against the previous destination list: `/admin`, `/admin/gesture-library`, `/admin/capture`, `/admin/dataset`, `/admin/models`, `/admin/training`, `/admin/analytics`, `/admin/users`, and `/admin/system`. Confirm each route remains present or is mapped to an equivalent existing route.

## Self-Review

- Spec coverage: Tasks 1-4 cover the shell, collapsible navigation, visual system, operational overview, real analytics/telemetry, service status, quick actions, responsive behavior, and future navigation placeholders. Task 5 covers static and browser validation.
- Non-goals: No task creates migrations, changes model/recognition/translation/animation APIs, implements training execution, camera capture, or asset upload.
- Placeholder scan: all planned code, test file paths, commands, types, and interfaces are explicit. Unavailable dashboard values are intentional user-facing states, not implementation placeholders.
- Type consistency: `AdminNavigationItem`, `AdminSidebarProps`, `ServiceStatus`, and `DashboardService` are introduced before their consumers and use consistent field names.