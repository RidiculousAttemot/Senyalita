"use client";

import { useState, useCallback } from "react";
import { globalPipeline } from "../PipelineOrchestrator";
import { globalMetricsCollector } from "../utils/metrics";
import type { TranslationCoverageStats } from "../types";

function StatsCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function FrequencyTable({ title, data, maxItems = 10 }: { title: string; data: Record<string, number> | Array<{ text: string; count: number }>; maxItems?: number }) {
  const entries = Array.isArray(data)
    ? data.slice(0, maxItems)
    : Object.entries(data)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxItems)
        .map(([text, count]) => ({ text, count }));

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
        <p className="text-sm text-gray-400">No data recorded yet.</p>
      </div>
    );
  }

  const maxCount = Math.max(...entries.map((e) => e.count));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-gray-400 font-mono text-xs w-5">{i + 1}</span>
            <span className="flex-1 truncate text-gray-700">{entry.text}</span>
            <span className="text-gray-500 text-xs w-8 text-right">{entry.count}</span>
            <div className="w-20 h-2 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-stone-600 rounded-full transition-all"
                style={{ width: `${(entry.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TranslationEvaluation() {
  const [stats, setStats] = useState<TranslationCoverageStats | null>(null);
  const [recentCount, setRecentCount] = useState(0);

  const refresh = useCallback(() => {
    const s = globalMetricsCollector.getCoverageStats();
    setStats(s);
    setRecentCount(globalMetricsCollector.getRecentRecords(100).length);
  }, []);

  const handleTestTranslation = useCallback(() => {
    const tests = [
      "Hello",
      "Kamusta ka?",
      "Good morning everyone",
      "Salamat po",
      "How are you today?",
      "Paalam",
      "Magandang umaga",
      "Thank you very much",
      "What is your name?",
      "Mahal kita",
    ];
    for (const test of tests) {
      globalPipeline.translate(test);
    }
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Translation Evaluation</h2>
          <p className="text-sm text-gray-500 mt-1">Coverage, fallback frequency, and translation metrics.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestTranslation}
            className="px-4 py-2 rounded-lg border border-stone-200 bg-white text-sm font-medium text-gray-700 hover:bg-stone-50 transition-colors"
          >
            Run Test Translations
          </button>
          <button
            onClick={refresh}
            className="px-4 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard label="Total Requests" value={stats.totalRequests} sub={`${stats.uniqueInputs} unique`} />
            <StatsCard label="Gloss Coverage" value={`${(stats.coverageRate * 100).toFixed(1)}%`} sub={`${stats.totalGlossesGenerated} glosses`} />
            <StatsCard label="Unknown Glosses" value={stats.totalUnknownGlosses} sub={`${((stats.totalUnknownGlosses / Math.max(stats.totalGlossesGenerated, 1)) * 100).toFixed(1)}% rate`} />
            <StatsCard label="Fallbacks" value={stats.totalFallbacks} sub={`${stats.totalRequests} requests`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard label="Avg Confidence" value={`${(stats.averageConfidence * 100).toFixed(0)}%`} />
            <StatsCard label="Avg Processing" value={`${stats.averageProcessingTime.toFixed(0)}ms`} />
            <StatsCard label="Avg Sentence" value={`${stats.averageSentenceLength.toFixed(1)} glosses`} />
            <StatsCard label="Avg Duration" value={`${stats.averagePlaybackDuration.toFixed(1)}s`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <FrequencyTable title="Most Requested Translations" data={stats.mostRequestedTranslations} />
            <FrequencyTable title="Unknown Word Frequency" data={stats.unknownWordsFrequency} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <FrequencyTable title="Gloss Frequency" data={stats.glossFrequency} maxItems={20} />
            <FrequencyTable title="Fallback Frequency" data={stats.fallbackFrequency} maxItems={20} />
          </div>
        </>
      )}

      {!stats && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No data collected yet. Click &quot;Run Test Translations&quot; or use the Type-to-Sign interface to generate data.</p>
        </div>
      )}
    </div>
  );
}
