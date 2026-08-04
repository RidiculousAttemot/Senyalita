"use client";

import { motion } from "framer-motion";
import { Check, FlipHorizontal2, Hand, ScanLine, SlidersHorizontal, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODE_CONFIGS, type RecognitionMode } from "@/features/recognition/recognitionModes";
import { SENSITIVITY_LABELS, type DetectionSensitivity } from "./handCaptureProfile";

export interface CameraSettings {
  mirrored: boolean;
  showSkeleton: boolean;
  showHandLabels: boolean;
  showDetails: boolean;
  sensitivity: DetectionSensitivity;
}

interface CameraSettingsPanelProps {
  settings: CameraSettings;
  onChange: <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => void;
  mode: RecognitionMode;
  onModeChange: (mode: RecognitionMode) => void;
  /** Sensitivity is baked into the MediaPipe detector when the camera starts. */
  sensitivityPending: boolean;
  /** True when the chosen mode needs a different hand count than the running one. */
  modePending?: boolean;
  /** Phrases Conversation mode can produce, shown so the choice is informed. */
  supportedPhrases?: readonly string[];
  cameraActive: boolean;
  onClose: () => void;
}

const MODE_ORDER: RecognitionMode[] = ["auto", "alphabet-practice", "conversation"];
const SENSITIVITY_ORDER: DetectionSensitivity[] = ["relaxed", "balanced", "strict"];

export function CameraSettingsPanel({
  settings, onChange, mode, onModeChange, sensitivityPending, modePending, supportedPhrases, cameraActive, onClose,
}: CameraSettingsPanelProps) {
  return (
    <motion.div
      role="dialog"
      aria-label="Camera settings"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className="absolute right-4 top-16 z-20 w-[290px] overflow-hidden rounded-2xl border border-white/15 bg-slate-900/85 shadow-2xl ring-1 ring-black/20 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
          <SlidersHorizontal className="h-3.5 w-3.5" />Camera settings
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera settings"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1 px-2 py-2">
        <ToggleRow
          icon={<FlipHorizontal2 className="h-4 w-4" />}
          label="Mirror camera"
          hint="Shows you as a mirror would"
          checked={settings.mirrored}
          onChange={(v) => onChange("mirrored", v)}
        />
        <ToggleRow
          icon={<Hand className="h-4 w-4" />}
          label="Hand skeleton"
          hint="Draw tracked landmarks"
          checked={settings.showSkeleton}
          onChange={(v) => onChange("showSkeleton", v)}
        />
        <ToggleRow
          icon={<Tag className="h-4 w-4" />}
          label="Left / right labels"
          checked={settings.showHandLabels}
          disabled={!settings.showSkeleton}
          onChange={(v) => onChange("showHandLabels", v)}
        />
        <ToggleRow
          icon={<ScanLine className="h-4 w-4" />}
          label="Recognition details"
          hint="Buffer, FPS and model readout"
          checked={settings.showDetails}
          onChange={(v) => onChange("showDetails", v)}
        />
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Recognition mode</p>
        <div className="space-y-1">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                mode === m ? "bg-senyalita-primary/25 ring-1 ring-inset ring-senyalita-primary/40" : "hover:bg-white/8",
              )}
            >
              <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", mode === m ? "text-senyalita-secondary" : "text-transparent")} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-white">{MODE_CONFIGS[m].label}</span>
                <span className="block text-[10px] leading-snug text-white/50">{MODE_CONFIGS[m].description}</span>
              </span>
            </button>
          ))}
        </div>

        {modePending && cameraActive && (
          <p className="mt-2 rounded-md bg-amber-400/12 px-2.5 py-1.5 text-[10px] leading-snug text-amber-200/90">
            Restart the camera to apply — this mode tracks a different number of hands,
            which is fixed when the detector starts.
          </p>
        )}

        {/*
          The supported set, shown only where it is not obvious. Letters are
          self-evident (a-z); the 95 phrase classes are not, and a user who
          cannot see them is guessing at what the mode will recognise.
        */}
        {mode === "conversation" && supportedPhrases && supportedPhrases.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              Supported phrases ({supportedPhrases.length})
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-black/25 p-2">
              <ul className="flex flex-wrap gap-1">
                {supportedPhrases.map((phrase) => (
                  <li
                    key={phrase}
                    className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/75"
                  >
                    {phrase}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mode === "alphabet-practice" && (
          <p className="mt-2 text-[10px] leading-snug text-white/50">
            Letters a–z only. Tracks one hand, which is faster on phones —
            fingerspelling is one-handed.
          </p>
        )}

        {mode === "auto" && (
          <p className="mt-2 text-[10px] leading-snug text-white/50">
            Letters a–z and the numbers 1–10. Tracks both hands.
          </p>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Detection sensitivity</p>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-white/8 p-1">
          {SENSITIVITY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange("sensitivity", s)}
              title={SENSITIVITY_LABELS[s].hint}
              className={cn(
                "rounded-full py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                settings.sensitivity === s ? "bg-white text-slate-900" : "text-white/60 hover:text-white",
              )}
            >
              {SENSITIVITY_LABELS[s].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-white/45">{SENSITIVITY_LABELS[settings.sensitivity].hint}</p>
        {sensitivityPending && cameraActive && (
          <p className="mt-1.5 rounded-lg bg-amber-400/15 px-2 py-1.5 text-[10px] font-medium leading-snug text-amber-200">
            Restart the camera to apply this — the detector is built when capture starts.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ToggleRow({
  icon, label, hint, checked, disabled, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className={cn("shrink-0", checked ? "text-senyalita-secondary" : "text-white/45")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-white">{label}</span>
        {hint && <span className="block text-[10px] leading-snug text-white/45">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-senyalita-primary" : "bg-white/20",
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
