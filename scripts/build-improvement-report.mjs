#!/usr/bin/env node

/**
 * Continuous Improvement Pipeline
 *
 * Combines recognition metrics, translation metrics, animation metrics,
 * conversation metrics, feedback, administrator corrections, and dataset growth
 * into a single prioritized improvement report.
 *
 * Usage: node scripts/build-improvement-report.mjs [--days 30] [--output report.json]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load env vars
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      const env = readFileSync(envPath, "utf-8");
      for (const line of env.split("\n")) {
        const [key, ...rest] = line.split("=");
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = value;
        if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") supabaseKey = value;
      }
    }
  } catch {}
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const args = process.argv.slice(2);
let daysBack = 30;
let outputFile = "data/improvement-report.json";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--days" && args[i + 1]) daysBack = parseInt(args[i + 1], 10);
  if (args[i] === "--output" && args[i + 1]) outputFile = args[i + 1];
}

const since = new Date(Date.now() - daysBack * 86400000).toISOString();
const now = new Date().toISOString();

console.log(`Building improvement report (last ${daysBack} days, since ${since})...`);

async function main() {
  try {
    // 1. Fetch recognition metrics
    const { data: logs } = await supabase
      .from("translation_logs")
      .select("gesture_label, confidence, inference_time_ms, created_at")
      .gte("created_at", since);

    const logList = logs ?? [];
    const totalRecognitions = logList.length;
    const avgConfidence = totalRecognitions > 0
      ? logList.reduce((s, l) => s + (l.confidence ?? 0), 0) / totalRecognitions
      : 0;
    const avgLatency = totalRecognitions > 0
      ? logList.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) / totalRecognitions
      : 0;
    const lowConfRate = totalRecognitions > 0
      ? logList.filter((l) => (l.confidence ?? 0) < 0.5).length / totalRecognitions
      : 0;

    // Per-gesture recognition quality
    const gestureQuality = {};
    for (const log of logList) {
      if (!gestureQuality[log.gesture_label]) {
        gestureQuality[log.gesture_label] = { total: 0, confSum: 0, lowConf: 0 };
      }
      gestureQuality[log.gesture_label].total++;
      gestureQuality[log.gesture_label].confSum += log.confidence ?? 0;
      if ((log.confidence ?? 0) < 0.5) gestureQuality[log.gesture_label].lowConf++;
    }

    const gestureRankings = Object.entries(gestureQuality)
      .map(([label, stats]) => ({
        label,
        total: stats.total,
        avgConfidence: stats.confSum / stats.total,
        lowConfRate: stats.lowConf / stats.total,
        priority: (stats.lowConf / stats.total) * 0.4 + (1 - stats.confSum / stats.total) * 0.6,
      }))
      .sort((a, b) => b.priority - a.priority);

    // 2. Fetch translation metrics
    const { data: gestures } = await supabase.from("gestures").select("label, status");
    const gestureList = gestures ?? [];

    const { data: fslEntries } = await supabase
      .from("gesture_knowledge_base")
      .select("category, difficulty_level");

    // 3. Fetch conversation metrics
    const { data: convSessions } = await supabase
      .from("conversation_sessions")
      .select("communication_success, total_messages, created_at")
      .gte("created_at", since);

    const convList = convSessions ?? [];
    const totalConversations = convList.length;
    const successfulConversations = convList.filter((c) => c.communication_success === true).length;
    const conversationSuccessRate = totalConversations > 0 ? successfulConversations / totalConversations : 0;
    const stalledConversations = convList.filter((c) => (c.total_messages ?? 0) <= 2 && c.communication_success !== true).length;

    // 4. Fetch feedback
    const { data: feedback } = await supabase
      .from("feedback")
      .select("gesture_label, rating")
      .gte("created_at", since);

    const feedbackList = feedback ?? [];
    const totalFeedback = feedbackList.length;
    const correctFeedback = feedbackList.filter((f) => f.rating === "correct").length;
    const feedbackAccuracy = totalFeedback > 0 ? correctFeedback / totalFeedback : 0;

    // 5. Fetch corrections
    const { data: corrections } = await supabase
      .from("prediction_corrections")
      .select("predicted_label, corrected_label")
      .gte("created_at", since);

    const correctionsList = (corrections ?? []) as any[];
    const uniqueCorrectionTargets = new Set(correctionsList.map((c) => c.corrected_label ?? c.predicted_label));

    // 6. Fetch dataset growth
    const { count: trainingSampleCount } = await supabase
      .from("training_samples")
      .select("*", { count: "exact", head: true });

    const { count: reviewQueueCount } = await supabase
      .from("review_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // 7. Fetch animation manifest
    let animationAssets = 0;
    let animationTotal = 0;
    try {
      const manifestPath = join(__dirname, "..", "public", "animations", "manifest.json");
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        animationAssets = manifest.generated ?? 0;
        animationTotal = manifest.totalGestures ?? 0;
      }
    } catch {}

    // 8. Animation coverage check
    const missingAnimations = gestureList
      .filter((g) => {
        try {
          const assetPath = join(__dirname, "..", "public", "animations", `${g.label}.json`);
          return !existsSync(assetPath);
        } catch {
          return true;
        }
      })
      .map((g) => g.label);

    // 9. Compute difficulty data
    const { data: difficultyRaw } = await supabase
      .from("gesture_difficulty_tracking")
      .select("*")
      .order("difficulty_score", { ascending: false });

    const difficultyList = (difficultyRaw ?? []) as any[];

    // Build prioritized improvement report
    const priorities = [];

    // Gestures with highest low-confidence rate
    for (const g of gestureRankings.slice(0, 10)) {
      if (g.lowConfRate > 0.3) {
        priorities.push({
          rank: priorities.length + 1,
          category: "recognition",
          item: g.label,
          issue: `Low confidence rate (${(g.lowConfRate * 100).toFixed(0)}%)`,
          impact: (g.lowConfRate * 10).toFixed(1),
          suggestion: "Collect more diverse training samples",
        });
      }
    }

    // Visually similar letter confusions (V/U, M/N, etc.)
    const confusionPairs = {};
    for (const c of correctionsList) {
      if (c.predicted_label && c.corrected_label && c.predicted_label !== c.corrected_label) {
        const key = [c.predicted_label, c.corrected_label].sort().join("-");
        confusionPairs[key] = (confusionPairs[key] ?? 0) + 1;
      }
    }
    const topConfusions = Object.entries(confusionPairs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [pair, count] of topConfusions) {
      priorities.push({
        rank: priorities.length + 1,
        category: "confusion",
        item: pair,
        issue: `Frequent confusion (${count} occurrences)`,
        impact: (count * 2).toFixed(1),
        suggestion: "Improve gesture separation in training data",
      });
    }

    // Missing animation assets
    for (const label of missingAnimations.slice(0, 10)) {
      priorities.push({
        rank: priorities.length + 1,
        category: "animation",
        item: label,
        issue: "Missing animation asset",
        impact: "5.0",
        suggestion: "Generate animation asset for this gesture",
      });
    }

    // Conversation health issues
    if (conversationSuccessRate < 0.5) {
      priorities.push({
        rank: priorities.length + 1,
        category: "conversation",
        item: "Overall conversation success",
        issue: `Low success rate (${(conversationSuccessRate * 100).toFixed(0)}%)`,
        impact: "8.0",
        suggestion: "Improve gesture suggestions and reply ranking",
      });
    }

    if (stalledConversations > totalConversations * 0.3) {
      priorities.push({
        rank: priorities.length + 1,
        category: "conversation",
        item: "Stalled conversations",
        issue: `High stall rate (${((stalledConversations / totalConversations) * 100).toFixed(0)}%)`,
        impact: "7.0",
        suggestion: "Add more entry-level gestures and conversation starters",
      });
    }

    // Dataset diversity suggestions
    if (difficultyList.length > 0) {
      const hardest = difficultyList.slice(0, 5);
      for (const h of hardest) {
        priorities.push({
          rank: priorities.length + 1,
          category: "dataset",
          item: h.gesture_label,
          issue: `High difficulty score (${(h.difficulty_score * 100).toFixed(0)}%)`,
          impact: (h.difficulty_score * 10).toFixed(1),
          suggestion: "Increase training sample diversity",
        });
      }
    }

    // Low feedback accuracy
    if (totalFeedback >= 5 && feedbackAccuracy < 0.6) {
      priorities.push({
        rank: priorities.length + 1,
        category: "feedback",
        item: "Overall feedback accuracy",
        issue: `Low accuracy (${(feedbackAccuracy * 100).toFixed(0)}%)`,
        impact: "6.0",
        suggestion: "Review gestures with frequent incorrect ratings",
      });
    }

    // Coverage gaps
    const gestureCoverage = (gestureList.length > 0)
      ? ((gestureList.filter((g) => g.status === "approved").length / gestureList.length) * 100).toFixed(0)
      : 0;
    if (gestureCoverage < 80) {
      priorities.push({
        rank: priorities.length + 1,
        category: "coverage",
        item: "Gesture coverage",
        issue: `Only ${gestureCoverage}% of gestures approved`,
        impact: "5.0",
        suggestion: "Review and approve pending gestures",
      });
    }

    // Sort final priorities by impact
    priorities.sort((a, b) => parseFloat(b.impact) - parseFloat(a.impact));
    priorities.forEach((p, i) => { p.rank = i + 1; });

    const report = {
      generatedAt: now,
      periodDays: daysBack,
      periodSince: since,
      summary: {
        totalRecognitions,
        totalConversations,
        totalFeedback,
        totalCorrections: correctionsList.length,
        totalTrainingSamples: trainingSampleCount ?? 0,
        totalGestures: gestureList.length,
        animationCoverage: `${animationAssets}/${gestureList.length}`,
        avgConfidence: parseFloat(avgConfidence.toFixed(3)),
        avgLatencyMs: parseFloat(avgLatency.toFixed(1)),
        conversationSuccessRate: parseFloat(conversationSuccessRate.toFixed(3)),
        feedbackAccuracy: parseFloat(feedbackAccuracy.toFixed(3)),
      },
      metrics: {
        recognition: {
          totalSamples: totalRecognitions,
          avgConfidence: parseFloat(avgConfidence.toFixed(3)),
          avgLatencyMs: parseFloat(avgLatency.toFixed(1)),
          lowConfidenceRate: parseFloat(lowConfRate.toFixed(3)),
        },
        conversation: {
          totalSessions: totalConversations,
          successRate: parseFloat(conversationSuccessRate.toFixed(3)),
          stalledRate: totalConversations > 0 ? parseFloat((stalledConversations / totalConversations).toFixed(3)) : 0,
        },
        feedback: {
          total: totalFeedback,
          accuracy: parseFloat(feedbackAccuracy.toFixed(3)),
        },
        dataset: {
          trainingSamples: trainingSampleCount ?? 0,
          reviewQueue: reviewQueueCount ?? 0,
        },
        animation: {
          totalAssets: animationAssets,
          totalGestures: gestureList.length,
          missingCount: missingAnimations.length,
        },
      },
      topPriorities: priorities.slice(0, 15),
      allPriorities: priorities,
      recommendations: [
        ...(gestureRankings[0]?.lowConfRate > 0.3
          ? [`Improve ${gestureRankings[0].label} — low confidence rate of ${(gestureRankings[0].lowConfRate * 100).toFixed(0)}%`]
          : []),
        ...(topConfusions[0]
          ? [`Improve ${topConfusions[0][0]} separation — ${topConfusions[0][1]} confusion events`] : []),
        ...(missingAnimations.length > 0
          ? [`Add facial expression assets for ${missingAnimations.length} missing gestures`] : []),
        ...(signerProfiles?.length > 0 && signerProfiles.length < 5
          ? ["Increase signer diversity — only " + signerProfiles.length + " signers enrolled"] : []),
        ...(gestureList.length < 100
          ? ["Expand vocabulary — current coverage is limited"] : []),
        "Monitor translation memory growth for patterns",
      ],
    };

    const outputPath = join(__dirname, "..", outputFile);
    const outputDir = dirname(outputPath);
    try {
      const { mkdirSync } = await import("fs");
      mkdirSync(outputDir, { recursive: true });
    } catch {}
    writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("\n=== Improvement Report ===\n");
    console.log(`Period: ${daysBack} days (${since} — ${now})`);
    console.log(`Total recognitions: ${totalRecognitions}`);
    console.log(`Total conversations: ${totalConversations}`);
    console.log(`Feedback accuracy: ${(feedbackAccuracy * 100).toFixed(1)}%`);
    console.log(`Animation coverage: ${animationAssets}/${gestureList.length}`);
    console.log(`\nTop 5 Priorities:`);
    for (const p of priorities.slice(0, 5)) {
      console.log(`  ${p.rank}. [${p.category}] ${p.item}: ${p.issue}`);
    }
    console.log(`\nReport saved to: ${outputPath}`);
  } catch (err) {
    console.error("Error building improvement report:", err);
    process.exit(1);
  }
}

main();
