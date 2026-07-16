import { describe, expect, it } from "vitest";
import { formatAdminPercent, getServiceStatus, isTelemetryUnavailableError } from "@/lib/admin/dashboard";

describe("admin dashboard helpers", () => {
  it("formats available confidence values and identifies missing values", () => {
    expect(formatAdminPercent(0.9486)).toBe("94.9%");
    expect(formatAdminPercent(null)).toBe("Unavailable");
  });

  it("does not report unavailable monitoring as healthy", () => {
    expect(getServiceStatus({ hasData: false, isOperational: false, detail: "No telemetry" }))
      .toEqual({ tone: "unknown", label: "Monitoring unavailable", detail: "No telemetry" });
  });

  it("recognizes a missing telemetry table as an unavailable optional data source", () => {
    expect(isTelemetryUnavailableError(new Error("listTelemetryEvents: Could not find the table 'public.telemetry_events' in the schema cache"))).toBe(true);
    expect(isTelemetryUnavailableError(new Error("network unavailable"))).toBe(false);
  });
});