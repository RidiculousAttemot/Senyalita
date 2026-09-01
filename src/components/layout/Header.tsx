"use client";

import Link from "next/link";
import { AccessibilityMenu } from "@/features/accessibility/AccessibilityMenu";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Keyboard, Video } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { SenyalitaMark } from "@/components/landing/SenyalitaMark";

// The anchor list that used to live here went with the template header below.
// It was never the landing nav — LandingNav owns its own links — so those
// #why-it-matters anchors only ever rendered on /learn and /evaluation, where
// they pointed at sections that do not exist on the page.

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
            <SenyalitaMark className="h-9 w-9" iconClassName="h-5 w-5" />
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

          <div className="flex items-center gap-2 justify-self-center md:justify-self-end">
            {/* Always present, whichever direction is open: someone who needs
                larger text needs it on both tabs. */}
            <AccessibilityMenu compact />
            {translationMode === "sign-to-text" && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("senyalita:camera-toggle"))}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
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

  /**
   * The remaining public pages: /learn and /evaluation.
   *
   * This was the original template header — its own palette (#FDF8F0, gray-900,
   * stone-500) rather than the senyalita tokens every other surface uses, and a
   * nav of landing-page anchors (#why-it-matters, #how-it-works) that resolve to
   * nothing from anywhere except "/". On /learn that read as a different
   * product with three dead links.
   *
   * It now mirrors the /translate header: the same back-to-home affordance, the
   * same palette, minus the translation-mode switcher and camera control, which
   * belong to that page alone.
   */
  return (
    <header className="sticky top-0 z-50 w-full border-b border-senyalita-border/70 bg-senyalita-warm/85 px-4 py-3 backdrop-blur-xl md:px-8 md:py-3.5">
      <div className="mx-auto flex w-full max-w-[1160px] items-center justify-between gap-3">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-senyalita-border bg-white text-senyalita-muted transition-all duration-150 group-hover:-translate-x-0.5 group-hover:border-senyalita-primary/40 group-hover:text-senyalita-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span className="sr-only">Back to home</span>
          </span>
          <SenyalitaMark className="h-9 w-9" iconClassName="h-5 w-5" />
          <span className="font-display text-xl font-bold leading-none tracking-tight text-senyalita-dark">Senyalita</span>
        </Link>

        <div className="flex items-center gap-2">
          <AccessibilityMenu compact />
          <Link
            href="/translate"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-senyalita-primary px-5 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all duration-150 hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
          >
            Open translator
          </Link>
        </div>
      </div>
    </header>
  );
}
