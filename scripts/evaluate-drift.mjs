/**
 * evaluate-drift.mjs
 *
 * Evaluates the Drift Detection system from Phase 44.
 *
 * Usage: node scripts/evaluate-drift.mjs
 *   or: npx tsx scripts/evaluate-drift.mjs
 */

async function evaluate() {
  console.log("=".repeat(60));
  console.log("  Drift Detection Evaluation (Phase 44)");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    const mod = await import("../src/features/analytics/driftDetection.ts");
    const { DriftDetector } = mod;
    const detector = new DriftDetector();

    // Test 1: Empty state
    if (detector.getAlerts().length === 0) {
      console.log("  ✓ No alerts initially"); passed++;
    } else { console.log("  ✗ Alerts on init"); failed++; }

    if (detector.getLatestSnapshot() === null) {
      console.log("  ✓ No snapshots initially"); passed++;
    } else { console.log("  ✗ Snapshots on init"); failed++; }

    // Test 2: Set baseline and record snapshot
    detector.setBaseline({
      timestamp: new Date().toISOString(),
      accuracy: 0.95,
      avgConfidence: 0.85,
      gestureDistribution: { A: 100, B: 100 },
      avgLighting: 0.6,
      avgCameraAngle: 0.5,
      lowConfidenceRate: 0.1,
      predictionCount: 1000,
    });

    // Test 3: Similar snapshot — no drift
    detector.recordSnapshot({
      timestamp: new Date().toISOString(),
      accuracy: 0.94,
      avgConfidence: 0.84,
      gestureDistribution: { A: 100, B: 100 },
      avgLighting: 0.6,
      avgCameraAngle: 0.5,
      lowConfidenceRate: 0.11,
      predictionCount: 1000,
    });

    if (detector.getAlerts().length === 0) {
      console.log("  ✓ No drift for similar metrics"); passed++;
    } else {
      console.log(`  ✗ False drift: ${detector.getAlerts().length} alerts`); failed++;
    }

    // Test 4: Significant drift
    detector.recordSnapshot({
      timestamp: new Date().toISOString(),
      accuracy: 0.70,
      avgConfidence: 0.55,
      gestureDistribution: { A: 200, B: 50, C: 100 },
      avgLighting: 0.3,
      avgCameraAngle: 0.2,
      lowConfidenceRate: 0.4,
      predictionCount: 800,
    });

    const alerts = detector.getAlerts();
    if (alerts.length >= 3) {
      console.log(`  ✓ Drift detected: ${alerts.length} alerts`); passed++;
    } else {
      console.log(`  ✗ Expected ≥3 drift alerts, got ${alerts.length}`); failed++;
    }

    const critical = detector.getAlerts("critical");
    if (critical.length > 0) {
      console.log("  ✓ Critical drift alerts generated"); passed++;
    } else {
      console.log("  ✗ No critical alerts for large drift"); failed++;
    }

    // Test 5: Snapshot history
    if (detector.getSnapshots().length === 2) {
      console.log("  ✓ Snapshot history"); passed++;
    } else { console.log("  ✗ Snapshot count"); failed++; }

    // Test 6: Reset
    detector.reset();
    if (detector.getAlerts().length === 0 && detector.getSnapshots().length === 0) {
      console.log("  ✓ Reset clears all data"); passed++;
    } else { console.log("  ✗ Reset failed"); failed++; }
  } catch (e) {
    console.log(`  ✗ Drift tests failed: ${e.message}`);
    failed += 6;
  }

  console.log();
  const total = passed + failed;
  console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

evaluate().catch((e) => {
  console.error("Evaluation failed:", e.message);
  process.exit(1);
});
