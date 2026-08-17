"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * High contrast and text size, for the whole product.
 *
 * The landing page has advertised these since before they existed: its
 * accessibility section carries two controls and the line "These controls are
 * real. Watch the sample below respond." They moved a sample card and nothing
 * else — local useState, discarded on navigation. For an app whose stated
 * audience is Deaf and Hard-of-Hearing users, a promised accessibility control
 * that does nothing is worse than an absent one.
 *
 * Applied as attributes on <html> rather than through React context alone, so
 * plain CSS can respond and every surface is covered at once, including the
 * ones that never call the hook.
 */

export const TEXT_SIZES = ["default", "large", "larger"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  default: "Default",
  large: "Large",
  larger: "Larger",
};

export interface AccessibilityState {
  highContrast: boolean;
  textSize: TextSize;
}

interface AccessibilityContextValue extends AccessibilityState {
  setHighContrast: (value: boolean) => void;
  setTextSize: (value: TextSize) => void;
}

export const ACCESSIBILITY_STORAGE_KEY = "senyalita:accessibility";

const DEFAULTS: AccessibilityState = { highContrast: false, textSize: "default" };

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

/** Reads a stored choice, tolerating anything that is not one. */
export function parseStoredPreferences(raw: string | null): Partial<AccessibilityState> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<AccessibilityState>;
    const next: Partial<AccessibilityState> = {};
    if (typeof parsed.highContrast === "boolean") next.highContrast = parsed.highContrast;
    if (TEXT_SIZES.includes(parsed.textSize as TextSize)) next.textSize = parsed.textSize;
    return next;
  } catch {
    // A corrupt value must not take the setting away; fall back to defaults.
    return {};
  }
}

/**
 * The script that runs before first paint.
 *
 * Without it the page renders at the default size and contrast, then jumps
 * once React hydrates — the flash lands hardest on exactly the users who
 * turned the setting on. Exported so the layout can inline it and a test can
 * assert the two stay in step.
 */
export const ACCESSIBILITY_BOOT_SCRIPT = `
(function () {
  try {
    var el = document.documentElement;
    var raw = localStorage.getItem(${JSON.stringify(ACCESSIBILITY_STORAGE_KEY)});
    var prefs = raw ? JSON.parse(raw) : {};
    var contrast = typeof prefs.highContrast === "boolean"
      ? prefs.highContrast
      : window.matchMedia("(prefers-contrast: more)").matches;
    var size = ["default","large","larger"].indexOf(prefs.textSize) >= 0 ? prefs.textSize : "default";
    if (contrast) el.setAttribute("data-contrast", "high");
    el.setAttribute("data-text-size", size);
  } catch (e) {}
})();
`.trim();

function applyToDocument(state: AccessibilityState): void {
  const el = document.documentElement;
  if (state.highContrast) el.setAttribute("data-contrast", "high");
  else el.removeAttribute("data-contrast");
  el.setAttribute("data-text-size", state.textSize);
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(DEFAULTS);

  // Read once on mount. The boot script has already painted the right thing;
  // this is only bringing React's copy into line with the DOM.
  useEffect(() => {
    const stored = parseStoredPreferences(
      typeof window === "undefined" ? null : window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY),
    );
    const seeded: AccessibilityState = {
      // An OS-level contrast preference is honoured until the user overrides
      // it here, rather than making them ask twice.
      highContrast: stored.highContrast ?? window.matchMedia("(prefers-contrast: more)").matches,
      textSize: stored.textSize ?? DEFAULTS.textSize,
    };
    setState(seeded);
    applyToDocument(seeded);
  }, []);

  const persist = useCallback((next: AccessibilityState) => {
    setState(next);
    applyToDocument(next);
    try {
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing, or storage full. The setting still applies for this
      // session; losing it on reload is better than losing it now.
    }
  }, []);

  const value = useMemo<AccessibilityContextValue>(() => ({
    ...state,
    setHighContrast: (highContrast) => persist({ ...state, highContrast }),
    setTextSize: (textSize) => persist({ ...state, textSize }),
  }), [state, persist]);

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used inside AccessibilityProvider");
  }
  return context;
}
