"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Keyboard, Video } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";

// The first three are in-page anchors on the landing page; "Learn FSL" is a
// real route. Kept in one list because they render as one nav — Link handles
// both, and separating them would mean two loops rendering identical markup.
const navLinks = [
  { name: "Why it matters", href: "#why-it-matters" },
  { name: "How you use it", href: "#how-it-works" },
  { name: "How it works", href: "#principles" },
  { name: "Learn FSL", href: "/learn" },
];

export function Header() {
  const pathname = usePathname();
  const [translationMode, setTranslationMode] = useState<"type-to-sign" | "sign-to-text">("type-to-sign");
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const syncTranslationMode = (event: Event) => {
      const mode = (event as CustomEvent<"type-to-sign" | "sign-to-text">).detail;
      if (mode === "type-to-sign" || mode === "sign-to-text") setTranslationMode(mode);
    };

    window.addEventListener("senyalita:translation-mode", syncTranslationMode);
    return () => window.removeEventListener("senyalita:translation-mode", syncTranslationMode);
  }, []);

  useEffect(() => {
    const syncCameraState = (event: Event) => setCameraActive(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("senyalita:camera-state", syncCameraState);
    return () => window.removeEventListener("senyalita:camera-state", syncCameraState);
  }, []);

  const selectTranslationMode = (mode: "type-to-sign" | "sign-to-text") => {
    setTranslationMode(mode);
    window.dispatchEvent(new CustomEvent("senyalita:translation-mode", { detail: mode }));
  };

  if (pathname === "/admin" || pathname?.startsWith("/admin/")) {
    return null;
  }

  // On translation pages, show a specific back-to-home header
  if (pathname === "/translate" || pathname?.startsWith("/translate/")) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-senyalita-border/70 bg-senyalita-warm/85 px-4 py-3 backdrop-blur-xl md:px-8 md:py-3.5">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-0">
          <Link
            href="/"
            className="group flex items-center gap-2.5 justify-self-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary md:justify-self-start"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-senyalita-border bg-white text-senyalita-muted transition-all duration-150 group-hover:-translate-x-0.5 group-hover:border-senyalita-primary/40 group-hover:text-senyalita-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span className="sr-only">Back to home</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-senyalita-primary shadow-lg shadow-senyalita-primary/25">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/>
                <circle cx="12" cy="13" r="4" fill="transparent" stroke="white" strokeWidth="2"/>
              </svg>
            </span>
            <span className="font-display text-xl font-bold leading-none tracking-tight text-senyalita-dark">Senyalita</span>
          </Link>

          <nav
            aria-label="Translation mode"
            className="grid h-12 w-[320px] grid-cols-2 gap-1 justify-self-center rounded-full border border-senyalita-border bg-white/80 p-1 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.6)] backdrop-blur-xl"
          >
            <button
              type="button"
              aria-pressed={translationMode === "type-to-sign"}
              onClick={() => selectTranslationMode("type-to-sign")}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
                translationMode === "type-to-sign"
                  ? "bg-senyalita-primary text-white shadow-md shadow-senyalita-primary/30"
                  : "text-senyalita-muted hover:bg-senyalita-primary/5 hover:text-senyalita-dark",
              )}
            >
              <Keyboard className="h-4 w-4" /> Type &rarr; Sign
            </button>
            <button
              type="button"
              aria-pressed={translationMode === "sign-to-text"}
              onClick={() => selectTranslationMode("sign-to-text")}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
                translationMode === "sign-to-text"
                  ? "bg-senyalita-primary text-white shadow-md shadow-senyalita-primary/30"
                  : "text-senyalita-muted hover:bg-senyalita-primary/5 hover:text-senyalita-dark",
              )}
            >
              <Video className="h-4 w-4" /> Sign &rarr; Text
            </button>
          </nav>

          <div className="justify-self-center md:justify-self-end">
            {translationMode === "sign-to-text" && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("senyalita:camera-toggle"))}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
                  cameraActive
                    ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                    : "bg-senyalita-primary text-white shadow-lg shadow-senyalita-primary/25 hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    cameraActive ? "animate-pulse bg-rose-500" : "bg-white/80",
                  )}
                  aria-hidden="true"
                />
                {cameraActive ? "Stop camera" : "Start camera"}
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Landing page ("/") gets its own Senyalita-branded nav — scoped here so it
  // never touches the header used by /translate, /learn, /conversation, etc.
  if (pathname === "/") {
    return <LandingNav />;
  }

  // Otherwise, default header shared by remaining app pages (learn, conversation, history, presentation)
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 w-full bg-[#FDF8F0]/90 backdrop-blur-md"
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/>
              <circle cx="12" cy="13" r="4" fill="transparent" stroke="white" strokeWidth="2"/>
            </svg>
          </div>
          <span className="font-display text-lg font-bold text-gray-900">
            Senyalita
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold tracking-wide text-stone-500 transition-colors hover:text-gray-900 uppercase"
            >
              {link.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Button asChild className="bg-[hsl(var(--primary-hsl))] hover:bg-black text-white rounded-full px-6 text-sm font-medium transition-colors shadow-none">
            <Link href="/translate">Open Senyalita</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
