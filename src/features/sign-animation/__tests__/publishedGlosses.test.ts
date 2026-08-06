import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishedGlossRegistry, normalizeGloss } from "../publishedGlosses";

/**
 * The registry is what makes an upload visible to the public app.
 *
 * Before it existed, animation keys came only from a hardcoded 217-entry
 * dictionary, so a published gloss that file did not name was unreachable: the
 * word fingerspelled and /api/animations was never asked for it. Publishing
 * changed a database row and nothing on screen.
 *
 * The behaviour that matters most here is the failure path. If this registry
 * ever turns a network problem into a *wrong* answer, it costs the user a word
 * that would previously have fingerspelled correctly -- a regression against
 * the fallback the brief explicitly protects.
 */

const mockFetch = (impl: () => unknown) => {
  const fn = vi.fn(impl as never);
  vi.stubGlobal("fetch", fn);
  return fn;
};

const ok = (glosses: string[]) => () =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ glosses }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("normalizeGloss", () => {
  it("matches how the upload route stores a gloss", () => {
    // The route does trim().toUpperCase(); multi-word glosses keep single
    // spaces. Anything else here silently fails to match a real row.
    expect(normalizeGloss("  hello ")).toBe("HELLO");
    expect(normalizeGloss("good   morning")).toBe("GOOD MORNING");
    expect(normalizeGloss("Thank You")).toBe("THANK YOU");
  });
});

describe("PublishedGlossRegistry", () => {
  it("reports a published gloss as available", async () => {
    mockFetch(ok(["HELLO", "GOOD MORNING"]));
    const registry = new PublishedGlossRegistry();
    expect(await registry.has("hello")).toBe(true);
    expect(await registry.has("Good Morning")).toBe(true);
    expect(await registry.has("MABUHAY")).toBe(false);
  });

  it("fetches once no matter how many words resolve at the same time", async () => {
    // A translation resolves its words in parallel. Without collapsing the
    // in-flight promise, a five-word sentence fires five identical requests.
    const fn = mockFetch(ok(["A", "B"]));
    const registry = new PublishedGlossRegistry();
    await Promise.all(["A", "B", "C", "D", "E"].map((w) => registry.has(w)));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("answers 'not published' when the network fails, so the word still fingerspells", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = new PublishedGlossRegistry();
    // Must not throw: a rejection here would propagate into resolveItem and
    // drop the word entirely rather than falling back.
    await expect(registry.has("HELLO")).resolves.toBe(false);
  });

  it("answers 'not published' on a non-OK response", async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = new PublishedGlossRegistry();
    await expect(registry.has("HELLO")).resolves.toBe(false);
  });

  it("answers 'not published' when the payload is malformed", async () => {
    mockFetch(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ nope: 1 }) }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = new PublishedGlossRegistry();
    await expect(registry.has("HELLO")).resolves.toBe(false);
  });

  it("ignores non-string entries rather than matching undefined", async () => {
    mockFetch(ok(["HELLO", null as unknown as string, 7 as unknown as string]));
    const registry = new PublishedGlossRegistry();
    expect(await registry.has("HELLO")).toBe(true);
    expect(await registry.has("")).toBe(false);
  });

  it("re-fetches after invalidate, so a publish can appear without a reload", async () => {
    let glosses = ["A"];
    const fn = mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ glosses }) }),
    );
    const registry = new PublishedGlossRegistry();
    expect(await registry.has("MABUHAY")).toBe(false);

    glosses = ["A", "MABUHAY"];
    expect(await registry.has("MABUHAY")).toBe(false); // still cached
    registry.invalidate();
    expect(await registry.has("MABUHAY")).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
