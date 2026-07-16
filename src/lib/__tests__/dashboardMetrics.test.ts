import { describe, expect, it } from "vitest";
import { getMetricDisplay } from "@/lib/admin/dashboardMetrics";
import { isOptionalRelationUnavailable } from "@/lib/admin/dashboard";

describe("getMetricDisplay", () => {
  it("keeps zero when a successful query has no countable records", () => {
    expect(getMetricDisplay({ value: 0, available: true })).toBe("0");
  });

  it("identifies an available metric that has no activity yet", () => {
    expect(getMetricDisplay({ value: null, available: true })).toBe("No activity yet");
  });

  it("identifies a failed data source without presenting a false zero", () => {
    expect(getMetricDisplay({ value: null, available: false })).toBe("Unavailable");
  });

  it("formats available duration metrics", () => {
    expect(getMetricDisplay({ value: 18.46, available: true, format: (value) => `${value.toFixed(1)} ms` })).toBe("18.5 ms");
  });
});

describe("isOptionalRelationUnavailable", () => {
  it("recognizes a missing optional relation reported by Postgres", () => {
    expect(isOptionalRelationUnavailable(
      new Error('relation "public.model_metrics_daily" does not exist'),
      "model_metrics_daily",
    )).toBe(true);
  });

  it("recognizes a missing optional relation reported by the Supabase schema cache", () => {
    expect(isOptionalRelationUnavailable(
      new Error("Could not find the table 'public.model_metrics_daily' in the schema cache"),
      "model_metrics_daily",
    )).toBe(true);
  });

  it("does not hide authorization failures", () => {
    expect(isOptionalRelationUnavailable(new Error("admin only"), "model_metrics_daily")).toBe(false);
  });
});