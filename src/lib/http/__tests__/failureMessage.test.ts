import { describe, expect, it } from "vitest";
import { failureMessage } from "../failureMessage";

/**
 * These cases are the four real shapes an admin fetch failure arrives in. The
 * regression each one guards is that the *reason* survives to the screen.
 */
describe("failureMessage", () => {
  it("prefers the server's own error string", async () => {
    const res = new Response(JSON.stringify({ error: "Gloss THANK YOU already has a published version" }), {
      status: 409,
    });
    expect(await failureMessage(res, "Publish failed")).toBe(
      "Gloss THANK YOU already has a published version (HTTP 409)",
    );
  });

  it("survives an HTML error page instead of throwing a JSON parse error", async () => {
    // This is the 500-above-the-route-handler case that produced
    // `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` on screen.
    const res = new Response("<!DOCTYPE html><html><body>Internal Server Error</body></html>", { status: 500 });
    const message = await failureMessage(res, "Publish failed");
    expect(message).toContain("Publish failed (HTTP 500)");
    expect(message).toContain("Internal Server Error");
  });

  it("keeps the status code when the body is empty", async () => {
    const res = new Response("", { status: 413 });
    expect(await failureMessage(res, "Upload failed")).toBe("Upload failed (HTTP 413)");
  });

  it("distinguishes an auth failure from a server fault", async () => {
    const unauthorised = await failureMessage(new Response("", { status: 401 }), "Failed to load dataset");
    const faulted = await failureMessage(new Response("", { status: 500 }), "Failed to load dataset");
    expect(unauthorised).not.toBe(faulted);
  });

  it("truncates a long body rather than pasting a whole page into the banner", async () => {
    const res = new Response("x".repeat(5000), { status: 502 });
    expect((await failureMessage(res, "Failed")).length).toBeLessThan(200);
  });
});
