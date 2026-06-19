#!/usr/bin/env node

/**
 * Conversation Quality Analysis
 * Analyzes conversation_sessions and conversation_messages for quality metrics.
 *
 * Usage: node scripts/conversation-analysis.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load env
function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    console.error("❌ No .env file found and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=".repeat(60));
  console.log("  Conversation Quality Analysis");
  console.log("=".repeat(60));

  // 1. Fetch all sessions
  const { data: sessions, error: sErr } = await supabase
    .from("conversation_sessions")
    .select("*")
    .order("started_at", { ascending: false });

  if (sErr) {
    console.error("❌ Failed to fetch sessions:", sErr.message);
    process.exit(1);
  }

  // 2. Fetch all messages
  const { data: messages, error: mErr } = await supabase
    .from("conversation_messages")
    .select("*");

  if (mErr) {
    console.error("❌ Failed to fetch messages:", mErr.message);
    process.exit(1);
  }

  // 3. Analyze
  const totalSessions = sessions?.length ?? 0;
  const totalMessages = messages?.length ?? 0;

  const endedSessions = sessions?.filter((s) => s.status === "ended") ?? [];
  const activeSessions = sessions?.filter((s) => s.status === "active") ?? [];
  const successfulSessions = endedSessions.filter((s) => s.communication_success === true);
  const abandonedSessions = activeSessions.filter((s) => {
    // Abandoned = active for more than 30 minutes with no recent messages
    const sessionMessages = messages?.filter((m) => m.session_id === s.id) ?? [];
    if (sessionMessages.length === 0) return true;
    const lastMsg = new Date(sessionMessages[sessionMessages.length - 1].created_at).getTime();
    return Date.now() - lastMsg > 30 * 60 * 1000;
  });

  // Gesture counts
  const gestureCounts = {};
  const replyCounts = {};
  const responseVideoUsage = { used: 0, total: 0 };
  const sessionMessageCounts = {};
  const sessionGestureCounts = {};
  const sessionReplyCounts = {};
  const sessionDurations = {};

  for (const msg of messages ?? []) {
    if (!sessionMessageCounts[msg.session_id]) sessionMessageCounts[msg.session_id] = 0;
    sessionMessageCounts[msg.session_id]++;

    if (msg.sender_type === "signer" && msg.gesture_label) {
      gestureCounts[msg.gesture_label] = (gestureCounts[msg.gesture_label] ?? 0) + 1;
      if (!sessionGestureCounts[msg.session_id]) sessionGestureCounts[msg.session_id] = 0;
      sessionGestureCounts[msg.session_id]++;
    }

    if (msg.sender_type === "responder") {
      replyCounts[msg.translated_text] = (replyCounts[msg.translated_text] ?? 0) + 1;
      if (!sessionReplyCounts[msg.session_id]) sessionReplyCounts[msg.session_id] = 0;
      sessionReplyCounts[msg.session_id]++;
      if (msg.is_selected_reply) responseVideoUsage.used++;
      responseVideoUsage.total++;
    }
  }

  // Session durations
  for (const session of endedSessions) {
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    sessionDurations[session.id] = (end - start) / 1000; // seconds
  }

  // Top gestures
  const topGestures = Object.entries(gestureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  // Top replies
  const topReplies = Object.entries(replyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  // Session-level stats
  const sessionCounts = Object.values(sessionMessageCounts);
  const gestureCountsPerSession = Object.values(sessionGestureCounts);
  const replyCountsPerSession = Object.values(sessionReplyCounts);
  const durations = Object.values(sessionDurations);

  const avgMessagesPerSession = sessionCounts.length > 0
    ? sessionCounts.reduce((s, c) => s + c, 0) / sessionCounts.length : 0;
  const avgGesturesPerSession = gestureCountsPerSession.length > 0
    ? gestureCountsPerSession.reduce((s, c) => s + c, 0) / gestureCountsPerSession.length : 0;
  const avgRepliesPerSession = replyCountsPerSession.length > 0
    ? replyCountsPerSession.reduce((s, c) => s + c, 0) / replyCountsPerSession.length : 0;
  const avgDuration = durations.length > 0
    ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;

  // Output
  console.log(`\nTotal sessions: ${totalSessions}`);
  console.log(`Active sessions: ${activeSessions.length}`);
  console.log(`Ended sessions: ${endedSessions.length}`);
  console.log(`Successful sessions: ${successfulSessions.length}`);
  console.log(`Abandoned sessions: ${abandonedSessions.length}`);
  console.log(`Total messages: ${totalMessages}`);
  console.log(`\nAvg messages/session: ${avgMessagesPerSession.toFixed(1)}`);
  console.log(`Avg gestures/session: ${avgGesturesPerSession.toFixed(1)}`);
  console.log(`Avg replies/session: ${avgRepliesPerSession.toFixed(1)}`);
  console.log(`Avg duration: ${(avgDuration / 60).toFixed(1)} min`);
  console.log(`Success rate: ${endedSessions.length > 0 ? ((successfulSessions.length / endedSessions.length) * 100).toFixed(1) : 0}%`);
  console.log(`\nTop gestures:`);
  for (const [label, count] of topGestures) {
    console.log(`  ${label}: ${count}`);
  }
  console.log(`\nTop replies:`);
  for (const [text, count] of topReplies) {
    console.log(`  "${text}": ${count}`);
  }

  if (responseVideoUsage.total > 0) {
    console.log(`\nResponse video usage: ${responseVideoUsage.used}/${responseVideoUsage.total} (${((responseVideoUsage.used / responseVideoUsage.total) * 100).toFixed(1)}%)`);
  }

  // Generate report
  const reportPath = resolve(root, "docs", "conversation-quality-report.md");
  let report = `# Conversation Quality Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Overview\n\n`;
  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Total sessions | ${totalSessions} |\n`;
  report += `| Active | ${activeSessions.length} |\n`;
  report += `| Ended | ${endedSessions.length} |\n`;
  report += `| Successful | ${successfulSessions.length} |\n`;
  report += `| Abandoned | ${abandonedSessions.length} |\n`;
  report += `| Total messages | ${totalMessages} |\n`;
  report += `| Avg messages/session | ${avgMessagesPerSession.toFixed(1)} |\n`;
  report += `| Avg gestures/session | ${avgGesturesPerSession.toFixed(1)} |\n`;
  report += `| Avg replies/session | ${avgRepliesPerSession.toFixed(1)} |\n`;
  report += `| Avg duration | ${(avgDuration / 60).toFixed(1)} min |\n`;
  report += `| Success rate | ${endedSessions.length > 0 ? ((successfulSessions.length / endedSessions.length) * 100).toFixed(1) : 0}% |\n\n`;

  report += `## Most Used Gestures\n\n| Rank | Gesture | Count |\n|------|---------|-------|\n`;
  topGestures.forEach(([label, count], i) => {
    report += `| ${i + 1} | ${label} | ${count} |\n`;
  });

  report += `\n## Most Used Replies\n\n| Rank | Reply | Count |\n|------|-------|-------|\n`;
  topReplies.forEach(([text, count], i) => {
    report += `| ${i + 1} | ${text} | ${count} |\n`;
  });

  if (responseVideoUsage.total > 0) {
    report += `\n## Response Video Usage\n\n`;
    report += `| Metric | Value |\n|--------|-------|\n`;
    report += `| Used | ${responseVideoUsage.used} |\n`;
    report += `| Total replies | ${responseVideoUsage.total} |\n`;
    report += `| Usage rate | ${((responseVideoUsage.used / responseVideoUsage.total) * 100).toFixed(1)}% |\n`;
  }

  report += `\n## Session Detail\n\n| Session | Duration | Messages | Gestures | Replies | Success |\n|---------|----------|----------|----------|---------|---------|\n`;
  for (const session of sessions ?? []) {
    const dur = sessionDurations[session.id];
    const gest = sessionGestureCounts[session.id] ?? 0;
    const repl = sessionReplyCounts[session.id] ?? 0;
    report += `| ${session.id.slice(0, 8)} | ${dur ? (dur / 60).toFixed(1) + "m" : "—"} | ${session.total_messages} | ${gest} | ${repl} | ${session.communication_success === true ? "✅" : session.communication_success === false ? "❌" : "—"} |\n`;
  }

  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
