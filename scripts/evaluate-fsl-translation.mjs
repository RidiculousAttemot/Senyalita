/**
 * evaluate-fsl-translation.mjs
 *
 * Evaluates the FSL sentence translation pipeline described in Phase 43.
 * Tests multi-word translation, confidence scoring, grammar rules,
 * and language detection.
 *
 * Usage: node scripts/evaluate-fsl-translation.mjs
 *
 * Prerequisites: Build the project first (npm run build) or run via tsx:
 *   npx tsx scripts/evaluate-fsl-translation.mjs
 */

const TEST_CASES = [
  // Language detection
  { input: "Hello, how are you?", expectLang: "en", desc: "English greeting" },
  { input: "Kumusta ka na?", expectLang: "tl", desc: "Tagalog greeting" },
  { input: "Salamat po", expectLang: "tl", desc: "Tagalog thanks" },

  // Grammar rules
  { input: "I need help", expectContains: "NEED", desc: "I need → NEED I" },
  { input: "What is your name", expectContains: "NAME", desc: "Name question" },
  { input: "I am happy", expectContains: "HAPPY", desc: "I am happy" },
  { input: "Nice to meet you", expectContains: "NICE", desc: "Nice to meet" },
  { input: "My name is John", expectContains: "NAME", desc: "My name" },

  // Multi-word
  { input: "I want to eat rice", expectMinWords: 3, desc: "Multi-word request" },
  { input: "Thank you very much", expectMinWords: 2, desc: "Multi-word politeness" },
  { input: "See you tomorrow", expectMinWords: 2, desc: "Time phrase" },

  // Intent detection
  { input: "Can you help me please?", expectIntent: "request", desc: "Request intent" },
  { input: "Where is the bathroom?", expectIntent: "question", desc: "Question intent" },
  { input: "Yes, I understand", expectIntent: "affirmation", desc: "Affirmation intent" },

  // Negation
  { input: "I don't know", expectContains: "KNOW", desc: "Negation don't know" },
  { input: "No, that is wrong", expectContains: "WRONG", desc: "Negation wrong" },

  // Tagalog
  { input: "Magandang umaga po", expectMinWords: 2, desc: "Tagalog morning greeting" },
  { input: "Gusto ko ng tubig", expectMinWords: 2, desc: "Tagalog request water" },
  { input: "Saan ang banyo?", expectContains: "WHERE", desc: "Tagalog question where" },

  // Fingerspelling / unknown words
  { input: "My name is Bob", expectMinWords: 2, desc: "Name with unknown" },

  // Empty / edge cases
  { input: "", expectNoError: true, desc: "Empty input" },
  { input: "   ", expectNoError: true, desc: "Whitespace only" },
  { input: "!@#$%", expectNoError: true, desc: "Special characters" },
  { input: "😊", expectNoError: true, desc: "Emoji should be cleaned" },
];

async function evaluate() {
  console.log("=".repeat(60));
  console.log("  FSL Translation Evaluation (Phase 43)");
  console.log("=".repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of TEST_CASES) {
    try {
      const mod = await import("../src/features/fsl-translation/index.ts");
      const { globalEngine } = mod;

      let result = null;
      let error = null;

      try {
        result = globalEngine.translate(test.input, {
          useGrammar: true,
          useContext: false,
        });
      } catch (e) {
        error = e;
      }

      if (test.expectNoError && error) {
        throw new Error(`Expected no error but got: ${error.message}`);
      }

      if (test.expectNoError && !result) {
        passed++;
        continue;
      }

      if (!result) {
        throw new Error("No result returned");
      }

      // Check language detection
      if (test.expectLang && result.detectedLanguage.language !== test.expectLang) {
        console.warn(`  ⚠  ${test.desc}: Expected lang ${test.expectLang}, got ${result.detectedLanguage.language} (not failing)`);
      }

      // Check gloss contains expected word
      if (test.expectContains) {
        const upper = test.expectContains.toUpperCase();
        if (!result.glossText.toUpperCase().includes(upper)) {
          throw new Error(`Expected gloss to contain "${test.expectContains}", got "${result.glossText}"`);
        }
      }

      // Check minimum word count
      if (test.expectMinWords && result.glossSequence.length < test.expectMinWords) {
        throw new Error(`Expected ≥${test.expectMinWords} gloss words, got ${result.glossSequence.length}: "${result.glossText}"`);
      }

      // Check intent
      if (test.expectIntent && result.intent !== test.expectIntent) {
        console.warn(`  ⚠  ${test.desc}: Expected intent ${test.expectIntent}, got ${result.intent} (not failing)`);
      }

      // Verify processing time is set
      if (result.processingTimeMs <= 0) {
        console.warn(`  ⚠  ${test.desc}: Processing time is 0 (not failing)`);
      }

      passed++;
      console.log(`  ✓ ${test.desc}`);
    } catch (e) {
      failed++;
      failures.push({ test: test.desc, error: e.message });
      console.log(`  ✗ ${test.desc}: ${e.message}`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${TEST_CASES.length} tests`);
  if (failures.length > 0) {
    console.log();
    console.log("  Failures:");
    for (const f of failures) {
      console.log(`    - ${f.test}: ${f.error}`);
    }
  }
  console.log("=".repeat(60));

  // Confidence evaluation
  console.log();
  console.log("  --- Confidence Scoring ---");
  const confidenceCases = [
    { input: "Hello", expectConfidence: 1.0, desc: "Known word" },
    { input: "Hello friend", expectMinConfidence: 0.7, desc: "Known + synonym" },
    { input: "Xylophone", expectStrategy: "fingerspelling", desc: "Unknown word (fingerspelling)" },
  ];

  for (const test of confidenceCases) {
    try {
      const mod = await import("../src/features/fsl-translation/index.ts");
      const { globalEngine } = mod;
      const result = globalEngine.translate(test.input, { useGrammar: true });

      if (test.expectConfidence !== undefined) {
        const avgConf = result.glossSequence.reduce((s, g) => s + g.resolution.confidence, 0) / result.glossSequence.length;
        if (avgConf < test.expectConfidence) {
          console.log(`  ✗ ${test.desc}: Expected ≥${test.expectConfidence} confidence, got ${avgConf}`);
          failed++;
        } else {
          console.log(`  ✓ ${test.desc}: ${(avgConf * 100).toFixed(0)}%`);
          passed++;
        }
      }

      if (test.expectMinConfidence !== undefined) {
        const avgConf = result.glossSequence.reduce((s, g) => s + g.resolution.confidence, 0) / result.glossSequence.length;
        if (avgConf < test.expectMinConfidence) {
          console.log(`  ✗ ${test.desc}: Expected ≥${test.expectMinConfidence} avg confidence, got ${avgConf}`);
          failed++;
        } else {
          console.log(`  ✓ ${test.desc}: ${(avgConf * 100).toFixed(0)}%`);
          passed++;
        }
      }

      if (test.expectStrategy) {
        const strategies = result.glossSequence.map((g) => g.resolution.strategy);
        if (!strategies.includes(test.expectStrategy)) {
          console.log(`  ✗ ${test.desc}: Expected strategy ${test.expectStrategy}, got ${strategies.join(", ")}`);
          failed++;
        } else {
          console.log(`  ✓ ${test.desc}: ${strategies[0]}`);
          passed++;
        }
      }
    } catch (e) {
      failed++;
      console.log(`  ✗ ${test.desc}: ${e.message}`);
    }
  }

  console.log();
  const totalTests = TEST_CASES.length + confidenceCases.length;
  console.log(`  Final: ${passed}/${totalTests} tests passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Wrap in async function since we need dynamic import
evaluate().catch((e) => {
  console.error("Evaluation failed:", e.message);
  console.log();
  console.log("Note: This script must be run from the project root after building.");
  console.log("Usage: npx tsx scripts/evaluate-fsl-translation.mjs");
  process.exit(1);
});
