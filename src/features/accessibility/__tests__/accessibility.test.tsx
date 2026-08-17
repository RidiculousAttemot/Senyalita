import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  ACCESSIBILITY_BOOT_SCRIPT,
  ACCESSIBILITY_STORAGE_KEY,
  AccessibilityProvider,
  TEXT_SIZES,
  parseStoredPreferences,
  useAccessibility,
} from "../AccessibilityProvider";

/**
 * The setting has to survive a reload and reach the whole document, or it is
 * the same promise the landing page was already making and not keeping.
 */

function Probe() {
  const { highContrast, textSize, setHighContrast, setTextSize } = useAccessibility();
  return (
    <div>
      <span data-testid="state">{`${highContrast}:${textSize}`}</span>
      <button onClick={() => setHighContrast(!highContrast)}>contrast</button>
      <button onClick={() => setTextSize("larger")}>larger</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-contrast");
  document.documentElement.removeAttribute("data-text-size");
  // jsdom has no matchMedia; the provider asks for prefers-contrast.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {},
    removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => window.localStorage.clear());

describe("parseStoredPreferences", () => {
  it("accepts a well-formed stored choice", () => {
    expect(parseStoredPreferences('{"highContrast":true,"textSize":"large"}'))
      .toEqual({ highContrast: true, textSize: "large" });
  });

  it("ignores a corrupt value rather than losing the setting", () => {
    expect(parseStoredPreferences("not json")).toEqual({});
    expect(parseStoredPreferences('{"textSize":"enormous"}')).toEqual({});
    expect(parseStoredPreferences(null)).toEqual({});
  });
});

describe("AccessibilityProvider", () => {
  it("writes the choice onto the document, not just into React state", async () => {
    render(<AccessibilityProvider><Probe /></AccessibilityProvider>);
    await act(async () => { screen.getByText("contrast").click(); });

    // CSS keys off these; without them only components calling the hook change.
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
    expect(screen.getByTestId("state").textContent).toBe("true:default");
  });

  it("removes the attribute when contrast is turned back off", async () => {
    render(<AccessibilityProvider><Probe /></AccessibilityProvider>);
    await act(async () => { screen.getByText("contrast").click(); });
    await act(async () => { screen.getByText("contrast").click(); });
    expect(document.documentElement.hasAttribute("data-contrast")).toBe(false);
  });

  it("persists, so the setting survives a reload", async () => {
    render(<AccessibilityProvider><Probe /></AccessibilityProvider>);
    await act(async () => { screen.getByText("larger").click(); });

    expect(parseStoredPreferences(window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)))
      .toMatchObject({ textSize: "larger" });
  });

  it("restores a stored choice on mount", async () => {
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEY,
      JSON.stringify({ highContrast: true, textSize: "large" }),
    );
    await act(async () => { render(<AccessibilityProvider><Probe /></AccessibilityProvider>); });

    expect(screen.getByTestId("state").textContent).toBe("true:large");
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
  });

  it("honours an OS contrast preference until the user chooses otherwise", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-contrast"), media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {},
      removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    await act(async () => { render(<AccessibilityProvider><Probe /></AccessibilityProvider>); });
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
  });
});

describe("the pre-paint boot script", () => {
  it("uses the same storage key and sizes as the provider", () => {
    // These are separate implementations of one rule — a plain script that has
    // to run before React exists, and the provider. If they drift, the page
    // paints one setting and then jumps to another.
    expect(ACCESSIBILITY_BOOT_SCRIPT).toContain(ACCESSIBILITY_STORAGE_KEY);
    for (const size of TEXT_SIZES) expect(ACCESSIBILITY_BOOT_SCRIPT).toContain(size);
  });

  it("applies a stored choice when executed", () => {
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEY,
      JSON.stringify({ highContrast: true, textSize: "larger" }),
    );
    // eslint-disable-next-line no-new-func
    new Function(ACCESSIBILITY_BOOT_SCRIPT)();

    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
    expect(document.documentElement.getAttribute("data-text-size")).toBe("larger");
  });

  it("survives corrupt storage without throwing", () => {
    window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, "{{{");
    // eslint-disable-next-line no-new-func
    expect(() => new Function(ACCESSIBILITY_BOOT_SCRIPT)()).not.toThrow();
  });
});
