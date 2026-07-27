import { NextResponse } from "next/server";

/**
 * Errors that map to a specific HTTP status.
 *
 * Route handlers previously funnelled every throw — including a Supabase
 * outage or a malformed upload — into a single `catch` that returned 403.
 * That made a broken dependency look like a permissions problem, and made it
 * impossible to tell from the outside whether a route was even guarded.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly expose = true,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** No usable session. */
export class UnauthenticatedError extends HttpError {
  constructor(message = "Authentication required.") {
    super(401, message);
    this.name = "UnauthenticatedError";
  }
}

/** Authenticated, but lacking the required role. */
export class ForbiddenError extends HttpError {
  constructor(message = "Administrator access required.") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

/** Caller-supplied input failed validation. */
export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/**
 * Maps a thrown value to a JSON response.
 *
 * Anything that is not an HttpError is treated as an unexpected server fault:
 * it is logged in full and reported as a generic 500, so internal messages
 * (connection strings, driver errors) never reach the client.
 */
export function toErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[api] ${context} failed:`, error);
  return NextResponse.json(
    { error: "Something went wrong handling this request." },
    { status: 500 },
  );
}
