export const getMetricDisplay = ({
  value,
  available,
  format = (metricValue: number) => metricValue.toLocaleString(),
}: {
  value: number | null | undefined;
  available: boolean;
  format?: (metricValue: number) => string;
}): string => {
  if (!available) return "Unavailable";
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "No activity yet";
  }
  return format(value);
};