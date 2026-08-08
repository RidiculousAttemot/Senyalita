"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SenyalitaMark } from "@/components/landing/SenyalitaMark";
import { PUBLIC_NAV, isActiveNav } from "./publicNav";

/**
 * The chrome every public route shares.
 *
 * There used to be one Header and one Footer, but each was a route SWITCH with
 * divergent branches -- /translate got a bespoke inline header, "/" got
 * LandingNav, and everything else fell through to a default nobody maintained.
 * That default is what /learn and /evaluation rendered: #FDF8F0 and stone-500
 * rather than the senyalita tokens, nav links pointing at landing-page anchors
 * (#why-it-matters) that do not exist on those pages, and no active state
 * anywhere. Nothing was duplicated per page; one component was quietly being
 * three designs.
 *
 * Defined once here, from the design language /translate already used.
 *
 * Routes that need their own controls in the header -- /translate's mode
 * toggle and camera button, the landing page's section links -- inject them
 * through HeaderActions rather than growing another branch. The shell stays
 * ignorant of camera state; the wiring stays in the feature that owns it.
 */

/** The element HeaderActions portals into. */
const ACTIONS_SLOT_ID = "public-shell-actions";

/** The admin has its own chrome and must not inherit the public shell. */
const isAdminRoute = (pathname: string | null) =>
  pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Route changes must close the menu, or navigating from it leaves the panel
  // covering the page you just asked for.
  useEffect(() => setMobileOpen(false), [pathname]);

  if (isAdminRoute(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-senyalita-warm">
      <header className="sticky top-0 z-50 w-full border-b border-senyalita-border/70 bg-senyalita-warm/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 md:px-8 md:py-3.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
          >
            <SenyalitaMark className="h-9 w-9" iconClassName="h-5 w-5" />
            <span className="font-display text-lg font-bold leading-none tracking-tight text-senyalita-dark">
              Senyalita
            </span>
          </Link>

          <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map((link) => {
              const active = isActiveNav(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
                    active
                      ? "bg-senyalita-primary/10 text-senyalita-primary"
                      : "text-senyalita-muted hover:bg-senyalita-primary/5 hover:text-senyalita-dark",
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Page-owned controls land here. Empty on routes that inject none. */}
          <div id={ACTIONS_SLOT_ID} className="ml-auto flex items-center gap-2" />

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="public-shell-mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-senyalita-border bg-white text-senyalita-dark md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/*
          A real menu, not `hidden md:flex` with nothing behind it. The previous
          default header hid its nav below md and offered no replacement, so
          /learn and /evaluation had no navigation at all on a phone.
        */}
        {mobileOpen && (
          <nav
            id="public-shell-mobile-nav"
            aria-label="Primary"
            className="border-t border-senyalita-border/70 bg-senyalita-warm px-4 py-2 md:hidden"
          >
            {PUBLIC_NAV.map((link) => {
              const active = isActiveNav(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-senyalita-primary/10 text-senyalita-primary"
                      : "text-senyalita-muted hover:bg-senyalita-primary/5 hover:text-senyalita-dark",
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-grow">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-senyalita-border/70 bg-white/60">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-6 px-4 py-10 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <SenyalitaMark className="h-8 w-8" iconClassName="h-4 w-4" />
          <span className="font-display text-base font-bold tracking-tight text-senyalita-dark">
            Senyalita
          </span>
        </Link>

        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {PUBLIC_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-senyalita-muted transition-colors hover:text-senyalita-primary"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/*
          No admin link. The old footer linked /admin/login from every public
          page, which returns 404 in production now that the admin is
          local-only -- a dead link shipped to every visitor.
        */}
        <p className="text-xs text-senyalita-muted">
          &copy; {new Date().getFullYear()} Senyalita FSL Thesis Project. Built for inclusive communication.
        </p>
      </div>
    </footer>
  );
}

/**
 * Injects page-owned controls into the shell's header.
 *
 * A portal rather than context state: the shell renders on every route and
 * would otherwise need to know which page wants what, which is how the header
 * became a route switch the first time.
 */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(ACTIONS_SLOT_ID));
  }, []);

  if (!slot) return null;
  return createPortal(children, slot);
}
