"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The primitives the public UI is built from, in one place.
 *
 * These were not invented here. Every value is lifted from what /translate
 * already renders -- the page cards on the translate surface and the camera
 * settings overlay -- so the admin can be rebuilt on the same definitions
 * instead of a second set that drifts.
 *
 * TONE is the one axis that varies. The product uses light cards on the page
 * and a dark panel where content sits over video; the admin is a dark surface
 * throughout. Encoding that as a prop keeps it one design language with two
 * surfaces, rather than two design languages.
 *
 * Colours reference the senyalita-* tokens from tailwind.config.ts. Nothing
 * here hardcodes a hex value, which is what let the admin drift in the first
 * place: seven files carrying their own #0f172a and #1e293b in inline <style>
 * blocks that no token change could ever reach.
 */

export type SurfaceTone = "light" | "dark";

const TONE = {
  light: {
    card: "border-senyalita-border bg-white/70 text-senyalita-text",
    header: "text-senyalita-muted",
    label: "text-senyalita-text",
    hint: "text-senyalita-muted",
    rowHover: "hover:bg-senyalita-primary/5",
    divider: "border-senyalita-border",
    trackOff: "bg-senyalita-border",
    segment: "bg-senyalita-primary/[0.06]",
    segmentActive: "bg-white text-senyalita-text shadow-sm",
    segmentIdle: "text-senyalita-muted hover:text-senyalita-text",
    focus: "focus-visible:outline-senyalita-primary",
    input:
      "border-senyalita-border bg-white text-senyalita-text placeholder:text-senyalita-muted/70 focus:border-senyalita-primary",
  },
  dark: {
    card: "border-white/15 bg-slate-900/85 text-white",
    header: "text-white/60",
    label: "text-white",
    hint: "text-white/45",
    rowHover: "hover:bg-white/8",
    divider: "border-white/10",
    trackOff: "bg-white/20",
    segment: "bg-white/8",
    segmentActive: "bg-white text-slate-900",
    segmentIdle: "text-white/60 hover:text-white",
    focus: "focus-visible:outline-white",
    input:
      "border-white/15 bg-white/5 text-white placeholder:text-white/35 focus:border-senyalita-primary",
  },
} as const;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** The card every section sits in. Radius and blur come from /translate. */
export function SurfaceCard({
  tone = "light",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: SurfaceTone }) {
  return (
    <div
      className={cn(
        "rounded-[22px] border backdrop-blur-xl",
        TONE[tone].card,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The small uppercase label above a section.
 *
 * 11px/700/0.14em tracking is the product's section voice, used verbatim by
 * "Supported characters" and "Camera settings".
 */
export function SectionHeader({
  tone = "light",
  icon,
  actions,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)} {...rest}>
      <span
        className={cn(
          "flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em]",
          TONE[tone].header,
        )}
      >
        {icon}
        {children}
      </span>
      {actions}
    </div>
  );
}

/** A labelled switch. Lifted from the camera settings ToggleRow. */
export function ToggleRow({
  tone = "dark",
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  tone?: SurfaceTone;
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        t.rowHover,
        FOCUS_RING,
        t.focus,
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
      )}
    >
      {icon && (
        <span className={cn("shrink-0", checked ? "text-senyalita-secondary" : t.hint)}>{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-xs font-medium", t.label)}>{label}</span>
        {hint && <span className={cn("block text-[0.625rem] leading-snug", t.hint)}>{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-senyalita-primary" : t.trackOff,
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** The pill group. Lifted from the detection-sensitivity control. */
export function SegmentedControl<T extends string>({
  tone = "dark",
  options,
  value,
  onChange,
  className,
}: {
  tone?: SurfaceTone;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn("grid gap-1 rounded-full p-1", t.segment, className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full py-1.5 text-[0.6875rem] font-semibold transition-colors",
            FOCUS_RING,
            t.focus,
            value === o.value ? t.segmentActive : t.segmentIdle,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A selectable row with a description. The recognition-mode picker's shape,
 * which is also what the admin needs wherever one option among several
 * carries an explanation.
 */
export function OptionRow({
  tone = "dark",
  selected,
  label,
  description,
  badge,
  caveat,
  onSelect,
}: {
  tone?: SurfaceTone;
  selected: boolean;
  label: string;
  description?: string;
  badge?: React.ReactNode;
  caveat?: string;
  onSelect: () => void;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        FOCUS_RING,
        t.focus,
        selected ? "bg-senyalita-primary/25 ring-1 ring-inset ring-senyalita-primary/40" : t.rowHover,
      )}
    >
      <Check
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          selected ? "text-senyalita-secondary" : "text-transparent",
        )}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={cn("text-xs font-semibold", t.label)}>{label}</span>
          {badge}
        </span>
        {description && (
          <span className={cn("block text-[0.625rem] leading-snug", t.hint)}>{description}</span>
        )}
        {caveat && (
          <span className="mt-0.5 block text-[0.625rem] leading-snug text-amber-200/70">{caveat}</span>
        )}
      </span>
    </button>
  );
}

export type BadgeTone = "neutral" | "info" | "success" | "warn" | "danger";

/**
 * Opaque grounds with dark text, so a badge carries its own contrast.
 *
 * These tones were translucent tints with light-300 text -- built for a dark
 * surface and correct there. Two of the three usages are on LIGHT surfaces
 * (/learn), where a 20%-alpha tint composites to near-white and the light text
 * lands on top of it: the gloss badge measured 3.65:1 against a 4.5:1 floor at
 * 9px. A badge cannot know what is behind it, so it should not depend on it.
 *
 * Opaque backgrounds also fix the ratio at authoring time, rather than making
 * it a function of whatever surface a future caller drops the badge onto.
 */
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-slate-200 text-slate-800",
  info: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
};

/** The Beta badge's shape, generalised over the states the admin shows. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-px text-[0.5625rem] font-bold uppercase tracking-wide",
        BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The monospace character chip from the supported-characters panel. */
export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-md border border-senyalita-primary/15",
        "bg-senyalita-primary/[0.07] px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold",
        "uppercase text-senyalita-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An inline notice. The camera panel's restart hint, generalised. */
export function Notice({
  tone = "warn",
  className,
  children,
}: {
  tone?: "warn" | "danger" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    warn: "bg-amber-400/12 text-amber-200/90",
    danger: "bg-red-500/12 text-red-200/90",
    info: "bg-senyalita-primary/12 text-senyalita-secondary",
  } as const;
  return (
    <p className={cn("rounded-md px-2.5 py-1.5 text-[0.625rem] leading-snug", styles[tone], className)}>
      {children}
    </p>
  );
}

/** A labelled form control, so the admin's inputs stop carrying their own CSS. */
export function Field({
  tone = "dark",
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  tone?: SurfaceTone;
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className={cn("block text-[0.6875rem] font-medium", t.hint)}>
        {label}
      </label>
      {children}
      {hint && <p className={cn("text-[0.625rem] leading-snug", t.hint)}>{hint}</p>}
    </div>
  );
}

export const inputClasses = (tone: SurfaceTone = "dark", className?: string) =>
  cn(
    "w-full rounded-lg border px-3 py-2 text-[0.8125rem] outline-none transition-colors",
    TONE[tone].input,
    FOCUS_RING,
    TONE[tone].focus,
    className,
  );

export const dividerClasses = (tone: SurfaceTone = "dark") => cn("border-t", TONE[tone].divider);
