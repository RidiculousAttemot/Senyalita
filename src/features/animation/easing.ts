import type { EasingType } from "./types";

export function applyEasing(t: number, type: EasingType): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (type) {
    case "linear":
      return clamped;
    case "ease-in":
      return clamped * clamped;
    case "ease-out":
      return clamped * (2 - clamped);
    case "ease-in-out":
      return clamped < 0.5
        ? 2 * clamped * clamped
        : -1 + (4 - 2 * clamped) * clamped;
    case "bounce": {
      let b = 0;
      let a = clamped;
      while (a < (1 / 2.75)) { b = 7.5625 * a * a; break; }
      if (a < (2 / 2.75)) { b = 7.5625 * (a -= 1.5 / 2.75) * a + 0.75; }
      else if (a < (2.5 / 2.75)) { b = 7.5625 * (a -= 2.25 / 2.75) * a + 0.9375; }
      else { b = 7.5625 * (a -= 2.625 / 2.75) * a + 0.984375; }
      return b;
    }
    case "elastic": {
      if (clamped === 0 || clamped === 1) return clamped;
      return Math.pow(2, -10 * clamped) * Math.sin((clamped - 0.075) * (2 * Math.PI) / 0.3) + 1;
    }
    default:
      return clamped;
  }
}
