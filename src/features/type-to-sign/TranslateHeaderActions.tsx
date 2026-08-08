"use client";

import { useEffect, useState } from "react";
import { Keyboard, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderActions } from "@/components/layout/PublicShell";

/**
 * /translate's own controls, injected into the shared header.
 *
 * These used to live inside the site Header, which is why that component knew
 * about camera state at all -- it listened for senyalita:camera-state and
 * dispatched senyalita:camera-toggle, so the chrome was coupled to a feature
 * and had to branch by route to stay correct.
 *
 * The markup moved; the wiring did not. The same window events are listened
 * for and dispatched here, so Sign-to-Text is untouched and the camera button
 * behaves exactly as before -- it is simply owned by the page that means it
 * rather than by the shell that merely displays it.
 */
export function TranslateHeaderActions() {
  const [mode, setMode] = useState<"type-to-sign" | "sign-to-text">("type-to-sign");
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const syncMode = (event: Event) => {
      const next = (event as CustomEvent<"type-to-sign" | "sign-to-text">).detail;
      if (next === "type-to-sign" || next === "sign-to-text") setMode(next);
    };
    window.addEventListener("senyalita:translation-mode", syncMode);
    return () => window.removeEventListener("senyalita:translation-mode", syncMode);
  }, []);

  useEffect(() => {
    const syncCamera = (event: Event) => setCameraActive(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("senyalita:camera-state", syncCamera);
    return () => window.removeEventListener("senyalita:camera-state", syncCamera);
  }, []);

  const selectMode = (next: "type-to-sign" | "sign-to-text") => {
    setMode(next);
    window.dispatchEvent(new CustomEvent("senyalita:translation-mode", { detail: next }));
  };

  return (
    <HeaderActions>
      <nav
        aria-label="Translation mode"
        className="grid h-10 grid-cols-2 gap-1 rounded-full border border-senyalita-border bg-white/80 p-1 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.6)]"
      >
        {(
          [
            { value: "type-to-sign", label: "Type → Sign", Icon: Keyboard },
            { value: "sign-to-text", label: "Sign → Text", Icon: Video },
          ] as const
        ).map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => selectMode(value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary sm:text-sm",
              mode === value
                ? "bg-senyalita-primary text-white shadow-md shadow-senyalita-primary/30"
                : "text-senyalita-muted hover:bg-senyalita-primary/5 hover:text-senyalita-dark",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {mode === "sign-to-text" && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("senyalita:camera-toggle"))}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
            cameraActive
              ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              : "bg-senyalita-primary text-white shadow-lg shadow-senyalita-primary/25 hover:brightness-110",
          )}
        >
          <span
            className={cn("h-2 w-2 rounded-full", cameraActive ? "animate-pulse bg-rose-500" : "bg-white/80")}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{cameraActive ? "Stop camera" : "Start camera"}</span>
          <span className="sm:hidden">{cameraActive ? "Stop" : "Start"}</span>
        </button>
      )}
    </HeaderActions>
  );
}
