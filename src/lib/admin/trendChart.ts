/**
 * Geometry for the dashboard sparklines.
 *
 * Extracted from AdminDashboardOverview so the one case that broke it is
 * testable. "Recognition usage" drew an empty axis for weeks while the chart
 * beside it plotted fine, and the cause was arithmetic, not data: a
 * single-element series produced the path "M0.0,9.0" -- a moveto with nothing
 * after it, which is valid SVG that paints no pixels. The caller's empty state
 * only fired on a zero-length array, so a one-point series landed in the gap
 * between the two branches and rendered as silence.
 *
 * The shape of the series therefore decides the mark, and that decision is
 * returned rather than left implicit at the call site.
 */

export const TREND_CHART_WIDTH = 280;
export const TREND_CHART_HEIGHT = 88;

/** Distance from the baseline the tallest point is allowed to reach. */
const PLOT_HEIGHT = 70;
/** Gap kept above the tallest point so a peak is not flush with the edge. */
const TOP_PADDING = 9;

export type TrendPoint = { x: number; y: number };

export type TrendChart =
  /** Nothing recorded: the caller should say so in words, not draw an axis. */
  | { kind: "empty" }
  /** One reading: a dot. A line needs two points and would render as nothing. */
  | { kind: "point"; point: TrendPoint }
  | { kind: "line"; points: TrendPoint[]; path: string };

const project = (values: number[]): TrendPoint[] => {
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  // Guard a flat series: every value equal would divide by zero and NaN the
  // whole path.
  const range = Math.max(maximum - minimum, 1);

  return values.map((value, index) => ({
    x: (index / Math.max(values.length - 1, 1)) * TREND_CHART_WIDTH,
    y: TREND_CHART_HEIGHT - ((value - minimum) / range) * PLOT_HEIGHT - TOP_PADDING,
  }));
};

export function buildTrendChart(values: readonly number[]): TrendChart {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { kind: "empty" };

  // All zeros is no data, not a reading of zero.
  //
  // "Recognition usage" plots translation_logs, which currently has 0 rows.
  // Today that yields an empty array and renders "No data yet" correctly, but
  // the same condition reached through the analytics path yields fourteen
  // zeros instead — a line pinned flat to the baseline, which is exactly what
  // an empty axis looks like and reads as a broken chart rather than an idle
  // one. A flat NON-zero series still draws: [4,4,4] is a real measurement.
  if (finite.every((value) => value === 0)) return { kind: "empty" };

  const points = project([...finite]);
  if (points.length === 1) {
    // Centred rather than at x=0, where half the dot would sit outside the
    // viewBox and be clipped to a sliver.
    return { kind: "point", point: { x: TREND_CHART_WIDTH / 2, y: points[0].y } };
  }

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return { kind: "line", points, path };
}
