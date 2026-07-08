export interface DriftAlert {
  metric: string;
  severity: "info" | "warning" | "critical";
  message: string;
  currentValue: number;
  baselineValue: number;
  deviationPercent: number;
  timestamp: string;
}

export interface DriftSnapshot {
  timestamp: string;
  accuracy: number;
  avgConfidence: number;
  gestureDistribution: Record<string, number>;
  avgLighting: number;
  avgCameraAngle: number;
  lowConfidenceRate: number;
  predictionCount: number;
}

const DRIFT_WARNING_THRESHOLD = 0.1;
const DRIFT_CRITICAL_THRESHOLD = 0.2;

export class DriftDetector {
  private snapshots: DriftSnapshot[] = [];
  private baseline: DriftSnapshot | null = null;
  private alerts: DriftAlert[] = [];

  setBaseline(snapshot: DriftSnapshot): void {
    this.baseline = snapshot;
  }

  recordSnapshot(snapshot: DriftSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 365) this.snapshots.shift();

    if (this.baseline) {
      const newAlerts = this.detectDrift(snapshot);
      this.alerts.push(...newAlerts);
      if (this.alerts.length > 100) this.alerts.splice(0, this.alerts.length - 100);
    }
  }

  private detectDrift(current: DriftSnapshot): DriftAlert[] {
    const alerts: DriftAlert[] = [];
    if (!this.baseline) return alerts;

    const accuracyDrift = this.computeDeviation(current.accuracy, this.baseline.accuracy);
    if (accuracyDrift > DRIFT_WARNING_THRESHOLD) {
      alerts.push(this.createAlert(
        "accuracy",
        accuracyDrift >= DRIFT_CRITICAL_THRESHOLD ? "critical" : "warning",
        `Accuracy drifted from ${(this.baseline.accuracy * 100).toFixed(1)}% to ${(current.accuracy * 100).toFixed(1)}%`,
        current.accuracy,
        this.baseline.accuracy,
        accuracyDrift,
      ));
    }

    const confidenceDrift = this.computeDeviation(current.avgConfidence, this.baseline.avgConfidence);
    if (confidenceDrift > DRIFT_WARNING_THRESHOLD) {
      alerts.push(this.createAlert(
        "confidence",
        confidenceDrift >= DRIFT_CRITICAL_THRESHOLD ? "critical" : "warning",
        `Average confidence drifted from ${(this.baseline.avgConfidence * 100).toFixed(1)}% to ${(current.avgConfidence * 100).toFixed(1)}%`,
        current.avgConfidence,
        this.baseline.avgConfidence,
        confidenceDrift,
      ));
    }

    const distributionDrift = this.computeDistributionDrift(current.gestureDistribution, this.baseline.gestureDistribution);
    if (distributionDrift > DRIFT_WARNING_THRESHOLD) {
      alerts.push(this.createAlert(
        "gesture_distribution",
        distributionDrift >= DRIFT_CRITICAL_THRESHOLD ? "critical" : "warning",
        `Gesture distribution shifted by ${(distributionDrift * 100).toFixed(1)}%`,
        distributionDrift,
        0,
        distributionDrift,
      ));
    }

    const lightingDrift = this.computeDeviation(current.avgLighting, this.baseline.avgLighting);
    if (lightingDrift > DRIFT_WARNING_THRESHOLD) {
      alerts.push(this.createAlert(
        "lighting",
        "info",
        `Average lighting changed from ${(this.baseline.avgLighting * 100).toFixed(0)}% to ${(current.avgLighting * 100).toFixed(0)}%`,
        current.avgLighting,
        this.baseline.avgLighting,
        lightingDrift,
      ));
    }

    const cameraAngleDrift = this.computeDeviation(current.avgCameraAngle, this.baseline.avgCameraAngle);
    if (cameraAngleDrift > DRIFT_WARNING_THRESHOLD) {
      alerts.push(this.createAlert(
        "camera_angle",
        "info",
        `Average camera angle changed from ${(this.baseline.avgCameraAngle * 100).toFixed(0)}% to ${(current.avgCameraAngle * 100).toFixed(0)}%`,
        current.avgCameraAngle,
        this.baseline.avgCameraAngle,
        cameraAngleDrift,
      ));
    }

    const lcRate = current.lowConfidenceRate;
    const baselineLcRate = this.baseline.lowConfidenceRate;
    if (baselineLcRate > 0) {
      const lcDrift = (lcRate - baselineLcRate) / baselineLcRate;
      if (lcDrift > DRIFT_WARNING_THRESHOLD) {
        alerts.push(this.createAlert(
          "low_confidence_rate",
          lcDrift >= DRIFT_CRITICAL_THRESHOLD ? "critical" : "warning",
          `Low-confidence rate increased from ${(baselineLcRate * 100).toFixed(1)}% to ${(lcRate * 100).toFixed(1)}%`,
          lcRate,
          baselineLcRate,
          lcDrift,
        ));
      }
    }

    return alerts;
  }

  private computeDeviation(current: number, baseline: number): number {
    if (baseline === 0) return Math.abs(current);
    return Math.abs((current - baseline) / baseline);
  }

  private computeDistributionDrift(current: Record<string, number>, baseline: Record<string, number>): number {
    const allKeys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
    let totalDrift = 0;
    for (const key of allKeys) {
      const c = current[key] ?? 0;
      const b = baseline[key] ?? 0;
      const total = Math.max(c + b, 1);
      totalDrift += Math.abs(c - b) / total;
    }
    return totalDrift / allKeys.size;
  }

  private createAlert(
    metric: string,
    severity: DriftAlert["severity"],
    message: string,
    currentValue: number,
    baselineValue: number,
    deviationPercent: number,
  ): DriftAlert {
    return { metric, severity, message, currentValue, baselineValue, deviationPercent, timestamp: new Date().toISOString() };
  }

  getAlerts(severity?: DriftAlert["severity"]): DriftAlert[] {
    if (severity) return this.alerts.filter((a) => a.severity === severity);
    return [...this.alerts];
  }

  getLatestSnapshot(): DriftSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  getSnapshots(): DriftSnapshot[] {
    return [...this.snapshots];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  reset(): void {
    this.snapshots = [];
    this.baseline = null;
    this.alerts = [];
  }
}

export const globalDriftDetector = new DriftDetector();
