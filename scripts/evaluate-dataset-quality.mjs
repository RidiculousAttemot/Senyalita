/**
 * evaluate-dataset-quality.mjs
 *
 * Evaluates the Dataset Quality Inspector from Phase 44.
 *
 * Usage: node scripts/evaluate-dataset-quality.mjs
 *   or: npx tsx scripts/evaluate-dataset-quality.mjs
 */

async function evaluate() {
  console.log("=".repeat(60));
  console.log("  Dataset Quality Inspector Evaluation (Phase 44)");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    const mod = await import("../src/features/analytics/datasetQuality.ts");
    const { DatasetQualityInspector } = mod;

    const inspector = new DatasetQualityInspector();

    // Test 1: Empty sample
    const emptyScore = inspector.inspect({ id: "empty", frames: [] });
    if (!emptyScore.passed && emptyScore.overall === 0) {
      console.log("  ✓ Empty sample rejected"); passed++;
    } else {
      console.log(`  ✗ Empty sample: ${emptyScore.overall} score`); failed++;
    }

    // Test 2: Good sample
    const goodFrames = Array.from({ length: 30 }, (_, i) => ({
      timestamp: i * 0.033,
      landmarks: Array.from({ length: 21 }, (_, j) => ({
        x: 0.1 + Math.random() * 0.3 + j * 0.01,
        y: 0.2 + Math.random() * 0.3 + j * 0.01,
        z: Math.random() * 0.1,
      })),
      brightness: 0.6,
      motion: 0.5,
    }));

    const goodScore = inspector.inspect({
      id: "good",
      frames: goodFrames,
      width: 640,
      height: 480,
    });

    if (goodScore.passed && goodScore.overall >= 60) {
      console.log(`  ✓ Good sample passed: ${goodScore.overall}/100`); passed++;
    } else {
      console.log(`  ✗ Good sample: ${goodScore.overall}/100 — ${goodScore.reasons.join(", ")}`); failed++;
    }

    // Test 3: Poor sample (few landmarks, low light)
    const poorFrames = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i * 0.033,
      landmarks: [
        { x: 0.5, y: 0.5, z: 0 },
        { x: 0.51, y: 0.51, z: 0 },
        { x: 0.52, y: 0.52, z: 0 },
      ],
      brightness: 0.1,
      motion: 0.01,
    }));

    const poorScore = inspector.inspect({
      id: "poor",
      frames: poorFrames,
      width: 640,
      height: 480,
    });

    if (!poorScore.passed || poorScore.overall < 60) {
      console.log(`  ✓ Poor sample rejected: ${poorScore.overall}/100`); passed++;
    } else {
      console.log(`  ✗ Poor sample passed incorrectly`); failed++;
    }

    // Test 4: Custom threshold
    const customScore = inspector.inspect({
      id: "custom",
      frames: goodFrames,
      width: 640,
      height: 480,
    }, 90);

    if (!customScore.passed && customScore.overall < 90) {
      console.log("  ✓ Custom threshold respected"); passed++;
    } else {
      console.log("  ✗ Custom threshold ignored"); failed++;
    }

    // Test 5: Batch scoring
    const batchScores = inspector.inspectBatch([
      { id: "a", frames: goodFrames, width: 640, height: 480 },
      { id: "b", frames: poorFrames, width: 640, height: 480 },
    ]);

    if (batchScores.length === 2 && batchScores[0].passed !== batchScores[1].passed) {
      console.log("  ✓ Batch scoring works"); passed++;
    } else {
      console.log("  ✗ Batch scoring failed"); failed++;
    }

    // Test 6: Hand presence scoring
    const hpScore = inspector.inspect({
      id: "hp",
      frames: [{ timestamp: 0, landmarks: [{ x: 0.1, y: 0.2, z: 0 }] }],
    });

    if (hpScore.handPresenceScore < 50) {
      console.log("  ✓ Hand presence detection"); passed++;
    } else {
      console.log(`  ✗ Hand presence: ${hpScore.handPresenceScore} score`); failed++;
    }
  } catch (e) {
    console.log(`  ✗ Dataset quality tests failed: ${e.message}`);
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
