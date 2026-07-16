export type ServiceStatus = {
  tone: "healthy" | "attention" | "unknown";
  label: "Operational" | "Needs attention" | "Monitoring unavailable";
  detail: string;
};

export const formatAdminPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "Unavailable";
  return `${(value * 100).toFixed(1)}%`;
};

export const isTelemetryUnavailableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("telemetry_events") && message.includes("schema cache");
};

export const isOptionalRelationUnavailable = (error: unknown, relation: string): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const relationName = relation.toLowerCase();
  return message.includes(relationName)
    && (message.includes("does not exist") || message.includes("schema cache"));
};

export const getServiceStatus = ({
  hasData,
  isOperational,
  detail,
}: {
  hasData: boolean;
  isOperational: boolean;
  detail: string;
}): ServiceStatus => {
  if (!hasData) {
    return { tone: "unknown", label: "Monitoring unavailable", detail };
  }

  return isOperational
    ? { tone: "healthy", label: "Operational", detail }
    : { tone: "attention", label: "Needs attention", detail };
};