/**
 * Turns a failed response into something a human can act on.
 *
 * Admin fetches kept losing the reason a request failed, in two ways:
 *
 *   res.json() on the error branch   assumes every failure is one of ours. A
 *                                    500 raised above the route handler comes
 *                                    back as an HTML page, so the parse itself
 *                                    threw and the admin saw
 *                                    `Unexpected token '<', "<!DOCTYPE "...`
 *                                    instead of the reason.
 *
 *   throw new Error("Failed to …")   checks res.ok, then discards the server's
 *                                    message and substitutes a generic one. The
 *                                    cause reaches the client and is dropped on
 *                                    the floor.
 *
 * Both leave you guessing at exactly the moment something needs fixing, and the
 * second is worse than the first because it looks handled.
 *
 * Reads the body once as text, tries JSON, falls back to a snippet. The status
 * code is always included: 401, 413 and 500 call for completely different
 * responses from whoever reads the message.
 */
export async function failureMessage(res: Response, fallback: string): Promise<string> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    return `${fallback} (HTTP ${res.status}, response body unreadable)`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) {
      return `${parsed.error} (HTTP ${res.status})`;
    }
  } catch {
    // Not JSON — an HTML error page, or an empty body.
  }

  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
  return snippet
    ? `${fallback} (HTTP ${res.status}): ${snippet}`
    : `${fallback} (HTTP ${res.status})`;
}
