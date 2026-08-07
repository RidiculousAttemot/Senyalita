"use client";

import { motion } from "framer-motion";
import { FlipHorizontal2, Hand, ScanLine, SlidersHorizontal, Tag, X } from "lucide-react";
// The shared primitives. This panel is where several of them were lifted
// from, so it consumes them rather than keeping a second copy -- if these
// drift from the admin's, it is now a change to one file, not two.
import {
  Badge,
  Notice,
  OptionRow,
  SectionHeader,
  SegmentedControl,
  ToggleRow,
} from "@/components/ui/surfaces";
import { MODE_CONFIGS, MODE_ORDER, type RecognitionMode } from "@/features/recognition/recognitionModes";
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
  cameraActive: boolean;
  onClose: () => void;
}

const SENSITIVITY_ORDER: DetectionSensitivity[] = ["relaxed", "balanced", "strict"];

export function CameraSettingsPanel({
  settings, onChange, mode, onModeChange, sensitivityPending, modePending, cameraActive, onClose,
}: CameraSettingsPanelProps) {
  return (
    <motion.div
      role="dialog"
      aria-label="Camera settings"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      /*
        Capped and scrollable, because the stage it sits in is a fixed 400px
        (560px from md) with overflow hidden. The panel opens 4rem down, so
        anything past roughly 320px was simply clipped — on a short viewport
        that hid the whole sensitivity section, and there was no way to reach
        it. 5rem is the 4rem offset plus a 1rem gap at the bottom edge.

        overflow-x stays hidden so the rounded corners still clip their
        content, and overscroll-contain stops a flick inside the panel from
        scrolling the page behind it.
      */
      className="absolute right-4 top-16 z-20 max-h-[calc(100%-5rem)] w-[290px] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-white/15 bg-slate-900/85 shadow-2xl ring-1 ring-black/20 backdrop-blur-xl"
    >
      <SectionHeader
        tone="dark"
        // Pinned, so the close button stays reachable once the panel scrolls.
        // It needs its own near-opaque background: the panel's own translucency
        // would let the scrolling rows show through the title.
        className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-xl"
        icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        actions={
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera settings"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        }
      >
        Camera settings
      </SectionHeader>

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
          {/*
            The caveat is stated on the mode itself, not tucked away: someone
            who tries phrase signs and gets poor results should know that is
            expected, rather than conclude the system is broken.
          */}
          {MODE_ORDER.map((m) => (
            <OptionRow
              key={m}
              tone="dark"
              selected={mode === m}
              label={MODE_CONFIGS[m].label}
              description={MODE_CONFIGS[m].description}
              caveat={MODE_CONFIGS[m].caveat}
              badge={MODE_CONFIGS[m].beta ? <Badge tone="warn">Beta</Badge> : undefined}
              onSelect={() => onModeChange(m)}
            />
          ))}
        </div>

        {/* Progress, not an instruction. This used to read "restart the camera
            to apply", which was accurate then and is not now: the detector is
            rebuilt for the new hand count while the camera keeps running, and
            this is only on screen for the moment that takes. Leaving the old
            wording would ask for a restart that does nothing. */}
        {modePending && cameraActive && (
          <Notice tone="info" className="mt-2">
            Switching hand tracking for this mode — alphabet follows one hand,
            phrase signs need both.
          </Notice>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Detection sensitivity</p>
        <SegmentedControl
          tone="dark"
          value={settings.sensitivity}
          onChange={(s) => onChange("sensitivity", s)}
          options={SENSITIVITY_ORDER.map((s) => ({
            value: s,
            label: SENSITIVITY_LABELS[s].label,
            hint: SENSITIVITY_LABELS[s].hint,
          }))}
        />
        <p className="mt-2 text-[10px] leading-snug text-white/45">{SENSITIVITY_LABELS[settings.sensitivity].hint}</p>
        {sensitivityPending && cameraActive && (
          <Notice tone="warn" className="mt-1.5">
            Restart the camera to apply this — the detector is built when capture starts.
          </Notice>
        )}
      </div>
    </motion.div>
  );
}
