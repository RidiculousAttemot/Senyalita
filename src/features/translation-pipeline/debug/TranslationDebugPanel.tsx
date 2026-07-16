"use client";

import { useState, useCallback } from "react";
import { globalPipeline } from "../PipelineOrchestrator";
import type { TranslationPipelineResult } from "../types";

function StageBadge({ stageName, durationMs, success, error }: { stageName: string; durationMs: number; success: boolean; error?: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
    }`}>
      <span className={`w-2 h-2 rounded-full ${success ? "bg-emerald-500" : "bg-red-500"}`} />
      <span className="font-medium">{stageName}</span>
      <span className="text-xs opacity-70 ml-auto">{durationMs}ms</span>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </div>
  );
}

export function TranslationDebugPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TranslationPipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = useCallback(() => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = globalPipeline.translate(input);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }, [input]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Translation Debug Panel</h2>
        <p className="text-sm text-gray-500 mt-1">Inspect every stage of the translation pipeline.</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTranslate()}
          placeholder="Type text to translate..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <button
          onClick={handleTranslate}
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Processing..." : "Translate"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Processing Time" value={`${result.totalProcessingTimeMs}ms`} />
            <MetricCard label="Gloss Count" value={`${result.glossSequence.length}`} />
            <MetricCard label="Unknown Glosses" value={`${result.unknownGlosses.length}`} />
            <MetricCard label="Plan Duration" value={`${result.animationPlan.totalDuration.toFixed(1)}s`} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <h3 className="text-sm font-semibold text-gray-700">Pipeline Stages</h3>
            </div>
            <div className="p-4 space-y-2">
              {result.stageResults.map((stage) => (
                <StageBadge key={stage.stageName} stageName={stage.stageName} durationMs={stage.durationMs} success={stage.success} error={stage.error} />
              ))}
            </div>
          </div>

          <DebugSection title="Original Text">
            <code className="text-sm">{result.originalText}</code>
          </DebugSection>

          <DebugSection title="Normalized Text">
            <div className="space-y-1 text-sm">
              <p><span className="font-medium text-gray-500">Normalized:</span> {result.normalized.normalized}</p>
              <p><span className="font-medium text-gray-500">Words:</span> [{result.normalized.words.join(", ")}]</p>
            </div>
          </DebugSection>

          <DebugSection title="Detected Language">
            <div className="text-sm">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                result.language.language === "tl" ? "bg-blue-50 text-blue-700" :
                result.language.language === "mixed" ? "bg-purple-50 text-purple-700" :
                "bg-green-50 text-green-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  result.language.language === "tl" ? "bg-blue-500" :
                  result.language.language === "mixed" ? "bg-purple-500" :
                  "bg-green-500"
                }`} />
                {result.language.language === "tl" ? "Filipino" :
                 result.language.language === "mixed" ? "Mixed" : "English"}
              </span>
              <span className="ml-2 text-gray-400">confidence: {(result.language.confidence * 100).toFixed(0)}%</span>
            </div>
          </DebugSection>

          <DebugSection title="Sentences">
            <div className="space-y-1">
              {result.sentences.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 font-mono text-xs">{s.index}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    s.type === "interrogative" ? "bg-purple-50 text-purple-600" :
                    s.type === "exclamatory" ? "bg-orange-50 text-orange-600" :
                    s.type === "imperative" ? "bg-blue-50 text-blue-600" :
                    "bg-gray-50 text-gray-600"
                  }`}>{s.type}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Canonical Gloss Sequence ({result.glossSequence.length})">
            <div className="space-y-1">
              {result.glossSequence.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-stone-50 last:border-0">
                  <span className="text-gray-400 font-mono text-xs w-6">{i}</span>
                  <span className="font-semibold text-stone-800">{g.gloss}</span>
                  <span className="text-gray-400">← {g.original}</span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${
                    g.strategy === "direct" ? "bg-emerald-50 text-emerald-600" :
                    g.strategy === "synonym" ? "bg-blue-50 text-blue-600" :
                    g.strategy === "fingerspelling" ? "bg-amber-50 text-amber-600" :
                    "bg-red-50 text-red-600"
                  }`}>{g.strategy}</span>
                  <span className="text-gray-400 text-xs">{(g.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Animation Plan ({result.animationPlan.items.length} items)">
            <div className="space-y-1">
              {result.animationPlan.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-stone-50 last:border-0">
                  <span className="text-gray-400 font-mono text-xs w-6">{i}</span>
                  <span className="font-medium text-stone-800">{item.gloss}</span>
                  <span className="text-gray-400 text-xs">{item.startTime.toFixed(1)}s → {item.endTime.toFixed(1)}s</span>
                  <span className="text-gray-400 text-xs">({item.duration.toFixed(1)}s)</span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.fallbackUsed ? "bg-red-50 text-red-600" :
                    "bg-stone-50 text-stone-600"
                  }`}>{item.action}</span>
                  {item.expressionTag !== "neutral" && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-600">{item.expressionTag}</span>
                  )}
                  {item.fallbackUsed && <span className="text-xs text-red-400">{item.fallbackReason}</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Total duration: {result.animationPlan.totalDuration.toFixed(1)}s | 
              Transitions: {result.animationPlan.timeline.transitions.length}
            </div>
          </DebugSection>

          <DebugSection title="Timeline">
            <div className="relative h-16 bg-stone-50 rounded-lg overflow-hidden">
              {result.animationPlan.timeline.segments.map((seg, i) => {
                const totalDuration = result.animationPlan.totalDuration || 1;
                const left = (seg.startTime / totalDuration) * 100;
                const width = ((seg.endTime - seg.startTime) / totalDuration) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 1)}%`,
                      backgroundColor: seg.type === "gesture" ? "#78716c" :
                        seg.type === "pause" ? "#d6d3d1" : "#a8a29e",
                    }}
                    title={`${seg.gloss} (${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s)`}
                  >
                    {width > 8 && <span className="truncate px-1">{seg.gloss}</span>}
                  </div>
                );
              })}
            </div>
          </DebugSection>

          <DebugSection title="Unknown Glosses">
            {result.unknownGlosses.length === 0 ? (
              <p className="text-sm text-emerald-600">No unknown glosses.</p>
            ) : (
              <div className="space-y-1">
                {result.unknownGlosses.map((ug, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1">
                    <span className="text-gray-400 font-mono text-xs w-6">{i}</span>
                    <span className="text-stone-700">{ug.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-stone-800">{ug.resolvedGloss}</span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${
                      ug.strategy === "synonym" ? "bg-blue-50 text-blue-600" :
                      ug.strategy === "parent_category" ? "bg-purple-50 text-purple-600" :
                      ug.strategy === "fingerspelling" ? "bg-amber-50 text-amber-600" :
                      "bg-red-50 text-red-600"
                    }`}>{ug.strategy}</span>
                    <span className="text-gray-400 text-xs">{(ug.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </DebugSection>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
