/**
 * evaluate-active-learning.mjs
 *
 * Evaluates the Active Learning components from Phase 44:
 * - Error Analysis Engine
 * - Dataset Expansion Engine
 * - Gesture Clustering Engine
 *
 * Usage: node scripts/evaluate-active-learning.mjs
 *   or: npx tsx scripts/evaluate-active-learning.mjs
 */

async function evaluate() {
  console.log("=".repeat(60));
  console.log("  Active Learning Evaluation (Phase 44)");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    const mod = await import("../src/features/analytics/errorAnalysis.ts");
    const { ErrorAnalysisEngine } = mod;
    const engine = new ErrorAnalysisEngine();

    // Test 1: Empty state
    const pairs1 = engine.findConfusionPairs();
    if (pairs1.length === 0) { console.log("  ✓ Empty confusion pairs"); passed++; }
    else { console.log("  ✗ Empty confusion pairs"); failed++; }

    const unstable1 = engine.findUnstableGestures();
    if (unstable1.length === 0) { console.log("  ✓ Empty unstable gestures"); passed++; }
    else { console.log("  ✗ Empty unstable gestures"); failed++; }

    // Test 2: Add records
    engine.addRecord({
      predictedGesture: "M",
      expectedGesture: "N",
      confidence: 0.45,
      motionScore: 0.02,
      timestamp: new Date().toISOString(),
    });
    engine.addRecord({
      predictedGesture: "M",
      expectedGesture: "N",
      confidence: 0.52,
      motionScore: 0.03,
      timestamp: new Date().toISOString(),
    });
    engine.addRecord({
      predictedGesture: "V",
      expectedGesture: "U",
      confidence: 0.38,
      motionScore: 0.01,
      timestamp: new Date().toISOString(),
    });

    const pairs2 = engine.findConfusionPairs(2);
    if (pairs2.length === 1 && pairs2[0].predicted === "M" && pairs2[0].expected === "N") {
      console.log("  ✓ Confusion pair detection"); passed++;
    } else {
      console.log(`  ✗ Confusion pair detection: got ${pairs2.length} pairs`); failed++;
    }

    // Test 3: Weekly report
    const report = engine.generateWeeklyReport();
    if (report.totalPredictions === 3 && report.lowConfidenceCount === 2) {
      console.log("  ✓ Weekly report generation"); passed++;
    } else {
      console.log(`  ✗ Weekly report: ${report.totalPredictions} predictions, ${report.lowConfidenceCount} low`); failed++;
    }
  } catch (e) {
    console.log(`  ✗ ErrorAnalysis tests failed: ${e.message}`);
    failed += 3;
  }

  try {
    const mod = await import("../src/features/analytics/datasetExpansion.ts");
    const { DatasetExpansionEngine } = mod;

    const engine = new DatasetExpansionEngine();

    engine.updateGesture({
      gesture: "M", falsePositives: 12, falseNegatives: 8,
      f1Score: 0.65, avgConfidence: 0.55, correctionCount: 15,
      totalPredictions: 100, currentSamples: 30, targetSamples: 200, sampleGap: 170,
    });
    engine.updateGesture({
      gesture: "A", falsePositives: 1, falseNegatives: 2,
      f1Score: 0.95, avgConfidence: 0.92, correctionCount: 1,
      totalPredictions: 200, currentSamples: 180, targetSamples: 200, sampleGap: 20,
    });

    const recs = engine.getRecommendations();
    if (recs.length >= 1 && recs[0].gesture === "M" && recs[0].priority > recs[1]?.priority) {
      console.log("  ✓ Dataset recommendation ranking"); passed++;
    } else {
      console.log(`  ✗ Dataset recommendation: got ${recs.length} recs`); failed++;
    }

    const under = engine.getUnderrepresentedGestures();
    if (under.length >= 1 && under[0].gesture === "M") {
      console.log("  ✓ Underrepresented gesture detection"); passed++;
    } else {
      console.log("  ✗ Underrepresented gesture detection"); failed++;
    }
  } catch (e) {
    console.log(`  ✗ DatasetExpansion tests failed: ${e.message}`);
    failed += 2;
  }

  try {
    const mod = await import("../src/features/analytics/gestureClustering.ts");
    const { GestureClusteringEngine } = mod;

    const engine = new GestureClusteringEngine();

    engine.addBatch([
      { id: "1", label: "A", landmarks: [{ x: 0.1, y: 0.2, z: 0 }, { x: 0.3, y: 0.4, z: 0 }], timestamp: new Date().toISOString() },
      { id: "2", label: "A", landmarks: [{ x: 0.12, y: 0.22, z: 0 }, { x: 0.32, y: 0.42, z: 0 }], signerId: "s1", timestamp: new Date().toISOString() },
      { id: "3", label: "A", landmarks: [{ x: 0.15, y: 0.25, z: 0 }, { x: 0.35, y: 0.45, z: 0 }], signerId: "s2", timestamp: new Date().toISOString() },
    ]);

    const clusters = engine.cluster("A", 2);
    if (clusters.length > 0) {
      console.log(`  ✓ Gesture clustering: ${clusters.length} clusters`); passed++;
    } else {
      console.log("  ✗ Gesture clustering: no clusters"); failed++;
    }

    const variation = engine.classifyVariation([
      { id: "1", label: "A", landmarks: [], signerId: "s1", timestamp: "" },
      { id: "2", label: "A", landmarks: [], signerId: "s2", timestamp: "" },
    ]);
    if (variation.type === "signer") {
      console.log("  ✓ Variation classification"); passed++;
    } else {
      console.log(`  ✗ Variation classification: got ${variation.type}`); failed++;
    }
  } catch (e) {
    console.log(`  ✗ GestureClustering tests failed: ${e.message}`);
    failed += 2;
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
