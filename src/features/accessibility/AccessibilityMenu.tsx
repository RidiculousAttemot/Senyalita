"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Check } from "lucide-react";
import { TEXT_SIZES, TEXT_SIZE_LABEL, useAccessibility } from "./AccessibilityProvider";

/**
 * Contrast and text size, from anywhere in the app.
 *
 * Lives in the shared header rather than inside one screen's settings panel:
 * someone who needs larger text needs it on the landing page and the learn
 * page too, not only once they have reached the translator. The camera gear on
 * Sign-to-Text stays what it is — sensitivity, skeleton, hand labels — because
 * those are camera settings, not accessibility ones.
 */
export function AccessibilityMenu({ compact = false }: { compact?: boolean }) {
  const { highContrast, setHighContrast, textSize, setTextSize } = useAccessibility();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape closes it, because a popover you can only dismiss with the mouse
    // is exactly the thing this menu exists to avoid.
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/*
        Deliberately not a quiet icon.

        This started as a muted-grey glyph on white behind a hairline border,
        which read as decoration rather than a control — the wrong outcome for
        the one button on the page whose whole purpose is being findable by
        someone who is struggling to read the rest of it. It now carries the
        brand colour, a filled tint, and its name wherever there is room.
      */}
      <button
        type="button"
        data-testid="accessibility-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Accessibility settings"
        onClick={() => setOpen((v) => !v)}
        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-senyalita-primary/35 bg-senyalita-primary/10 text-senyalita-primary shadow-sm transition-all duration-150 hover:border-senyalita-primary/60 hover:bg-senyalita-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary ${
          compact ? "h-10 px-3" : "h-10 px-4"
        } ${open ? "border-senyalita-primary bg-senyalita-primary/20" : ""}`}
      >
        <Accessibility className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.25} aria-hidden="true" />
        {/*
          Named wherever the row can carry it. The compact variant sits in the
          translate header beside the mode switcher and the camera button, and
          at tablet width the three together squeezed "Start camera" onto two
          lines — so the label waits for lg there and the icon carries it below.
        */}
        <span className={compact ? "hidden text-[0.8125rem] font-bold lg:inline" : "text-[0.8125rem] font-bold"}>
          Accessibility
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Accessibility settings"
          data-testid="accessibility-panel"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-senyalita-border bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.5)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.8125rem] font-semibold text-senyalita-dark">High contrast</p>
              <p className="text-[0.6875rem] leading-snug text-senyalita-muted">Stronger text and borders.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              data-testid="accessibility-contrast"
              onClick={() => setHighContrast(!highContrast)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary ${
                highContrast ? "bg-senyalita-primary" : "bg-slate-300"
              }`}
            >
              <span className="sr-only">Toggle high contrast</span>
              <span
                aria-hidden="true"
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  highContrast ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="mt-4">
            <p className="text-[0.8125rem] font-semibold text-senyalita-dark">Text size</p>
            <div role="radiogroup" aria-label="Text size" className="mt-2 grid grid-cols-3 gap-1.5">
              {TEXT_SIZES.map((size) => {
                const active = textSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`accessibility-size-${size}`}
                    onClick={() => setTextSize(size)}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[0.6875rem] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary ${
                      active
                        ? "border-senyalita-primary bg-senyalita-primary/10 text-senyalita-primary"
                        : "border-senyalita-border text-senyalita-muted hover:border-senyalita-primary/40"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" aria-hidden="true" />}
                    {TEXT_SIZE_LABEL[size]}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-[0.6875rem] leading-snug text-senyalita-muted">
            Saved on this device and applied across the whole app.
          </p>
        </div>
      )}
    </div>
  );
}
