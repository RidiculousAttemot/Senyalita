import { describe, expect, it } from "vitest";
import { buildTrendChart, TREND_CHART_WIDTH } from "../trendChart";

describe("buildTrendChart", () => {
  it("says nothing rather than drawing an empty axis when there is no data", () => {
    expect(buildTrendChart([]).kind).toBe("empty");
  });

  /**
   * The regression this module exists for.
   *
   * "Recognition usage" was blank on the live dashboard because every
   * telemetry event so far falls on one calendar day, making the daily series
   * one element long. The old builder turned that into "M0.0,9.0" -- a moveto
   * and nothing else -- which is a legal path that paints no pixels, so the
   * card rendered an axis and no mark while the chart beside it plotted 14
   * points fine.
   */
  it("draws a dot for a single reading, never a moveto-only path", () => {
    const chart = buildTrendChart([38]);

    expect(chart.kind).toBe("point");
    if (chart.kind !== "point") throw new Error("expected a point");
    // Centred, or half the dot falls outside the viewBox.
    expect(chart.point.x).toBe(TREND_CHART_WIDTH / 2);
    expect(Number.isFinite(chart.point.y)).toBe(true);
  });

  it("draws a line once there are two readings to join", () => {
    const chart = buildTrendChart([1, 9]);

    expect(chart.kind).toBe("line");
    if (chart.kind !== "line") throw new Error("expected a line");
    // A moveto AND a lineto: the pair is what makes it visible.
    expect(chart.path).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
    expect(chart.points).toHaveLength(2);
  });

  it("spans the full width and keeps a higher value above a lower one", () => {
    const chart = buildTrendChart([0, 5, 10]);
    if (chart.kind !== "line") throw new Error("expected a line");

    expect(chart.points[0].x).toBe(0);
    expect(chart.points[2].x).toBe(TREND_CHART_WIDTH);
    // SVG y grows downward, so the larger value must have the smaller y.
    expect(chart.points[2].y).toBeLessThan(chart.points[0].y);
  });

  it("keeps a flat series on the canvas instead of dividing by zero", () => {
    const chart = buildTrendChart([4, 4, 4]);
    if (chart.kind !== "line") throw new Error("expected a line");

    expect(chart.points.every((point) => Number.isFinite(point.y))).toBe(true);
  });

  it("ignores non-finite values rather than NaN-ing the whole path", () => {
    expect(buildTrendChart([Number.NaN, Number.POSITIVE_INFINITY]).kind).toBe("empty");

    const chart = buildTrendChart([3, Number.NaN, 7]);
    if (chart.kind !== "line") throw new Error("expected a line");
    expect(chart.path).not.toContain("NaN");
  });
});

/**
 * An idle series and an absent one must look the same, because they mean the
 * same thing to the reader.
 *
 * "Recognition usage" plots translation_logs, which has 0 rows. Reached one way
 * that is an empty array and renders "No data yet"; reached through the
 * analytics path it is fourteen zeros, which drew a line pinned flat to the
 * baseline — indistinguishable from an empty axis, and reported as a rendering
 * bug rather than as no activity.
 */
describe("all-zero series", () => {
  it("is empty, so the card says so instead of drawing a flat baseline", () => {
    expect(buildTrendChart([0, 0, 0]).kind).toBe("empty");
    expect(buildTrendChart(new Array(14).fill(0)).kind).toBe("empty");
    expect(buildTrendChart([0]).kind).toBe("empty");
  });

  it("still draws a flat NON-zero series, which is a real measurement", () => {
    expect(buildTrendChart([4, 4, 4]).kind).toBe("line");
  });

  it("draws a series that is only partly zero", () => {
    expect(buildTrendChart([0, 3, 0]).kind).toBe("line");
  });
});
