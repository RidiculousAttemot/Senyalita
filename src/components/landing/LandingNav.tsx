"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SenyalitaMark } from "./SenyalitaMark";
import { useScrollSpy } from "./useScrollSpy";

const GITHUB_URL = "https://github.com/RidiculousAttemot/SignLangVisual";

const navLinks = [
  { name: "Home", href: "#hero", id: "hero" },
  { name: "Features", href: "#features", id: "features" },
  { name: "Recognition", href: "#recognition", id: "recognition" },
  { name: "Translate", href: "#showcase", id: "showcase" },
  { name: "Research", href: "#research", id: "research" },
  { name: "About", href: "#accessibility", id: "accessibility" },
];

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.75.12 3.04.73.8 1.17 1.83 1.17 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.15v3.19c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sectionIds = useMemo(() => navLinks.map((l) => l.id), []);
  const activeId = useScrollSpy(sectionIds);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-senyalita-border bg-senyalita-surface/90 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.02)]"
          : "border-b border-transparent bg-senyalita-warm/70 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="#hero" className="flex items-center gap-2.5">
          <SenyalitaMark className="h-9 w-9" iconClassName="h-5 w-5" />
          <span className="font-display text-lg font-bold tracking-tight text-senyalita-dark">
            Senyalita
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => {
            const isActive = activeId === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative py-1 text-sm font-medium transition-colors",
                  isActive ? "text-senyalita-primary" : "text-senyalita-muted hover:text-senyalita-primary",
                )}
              >
                {link.name}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-underline"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-senyalita-primary"
                  />
                )}
              </Link>
            );
          })}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-senyalita-muted transition-colors hover:text-senyalita-primary"
          >
            <GithubGlyph className="h-4 w-4" />
            GitHub
          </a>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/translate"
            className="rounded-full bg-senyalita-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-senyalita-primary/25 transition-all hover:shadow-lg hover:shadow-senyalita-primary/35 hover:brightness-105"
          >
            Launch App
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-senyalita-dark lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-senyalita-border bg-senyalita-surface lg:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={activeId === link.id ? "true" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-senyalita-warm",
                    activeId === link.id
                      ? "bg-senyalita-primary/5 text-senyalita-primary"
                      : "text-senyalita-text",
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-senyalita-text hover:bg-senyalita-warm"
              >
                <GithubGlyph className="h-4 w-4" /> GitHub
              </a>
              <Link
                href="/translate"
                className="mt-2 rounded-full bg-senyalita-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-senyalita-primary/25"
              >
                Launch App
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="h-0.5 origin-left bg-gradient-to-r from-senyalita-primary to-senyalita-accent"
      />
    </header>
  );
}
