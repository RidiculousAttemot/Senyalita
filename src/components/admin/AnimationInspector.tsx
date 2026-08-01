"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, AlertCircle, CheckCircle2, XCircle, Activity, Film, Clock, Layers, BarChart3, Eye, Hand, Loader2 } from "lucide-react";
import { AnimationLoader } from "@/features/sign-animation/loader/AnimationLoader";
import { SmartAnimationResolver } from "@/features/sign-animation/player/SmartAnimationResolver";
import { AdvancedCanvasRenderer } from "@/features/sign-animation/renderer/AdvancedCanvasRenderer";
import { NonManualController } from "@/features/sign-animation/engine/nonManualFeatures";
import type { GestureAnimationAsset, AnimationInspectorData, ResolverResult } from "@/features/sign-animation/types";

const loader = new AnimationLoader();
const resolver = new SmartAnimationResolver(loader);

export function AnimationInspector() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Array<{ gloss: string; asset: GestureAnimationAsset | null; resolution: ResolverResult }>>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<GestureAnimationAsset | null>(null);
  const [selectedGloss, setSelectedGloss] = useState("");
  const [nonManual] = useState(() => new NonManualController());

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    if (!node || !selectedAsset) return;
    const renderer = new AdvancedCanvasRenderer(node, {
      width: 320, height: 400, theme: "skeleton", showLabels: false, showNonManual: true,
      backgroundColor: "#0f172a",
    });
    if (selectedAsset.frames.length > 0) {
      nonManual.setGestureExpression(selectedAsset.label);
      nonManual.update(1);
      renderer.render(selectedAsset.frames[0], { nonManual: nonManual.getFeatures() });
    }
    return () => renderer.dispose();
  }, [selectedAsset, nonManual]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    const glosses = searchQuery
      .toUpperCase()
      .split(/[,\s]+/)
      .filter(Boolean)
      .slice(0, 10);

    const resolved = await Promise.all(
      glosses.map(async (gloss) => {
        const resolution = await resolver.resolve(gloss);
        return { gloss, asset: resolution.asset, resolution };
      })
    );

    setResults(resolved);
    setSearching(false);
  }, [searchQuery]);

  const selectGloss = useCallback(async (gloss: string) => {
    setSelectedGloss(gloss);
    const asset = await loader.load(gloss);
    setSelectedAsset(asset);
  }, []);

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case "exact_phrase": return "#4ade80";
      case "phrase_alias": return "#22d3ee";
      case "exact_gloss": return "#4ade80";
      case "gloss_alias": return "#60a5fa";
      case "synonym": return "#fbbf24";
      case "morphological": return "#a78bfa";
      case "category_mapping": return "#f472b6";
      case "fingerspell": return "#fb923c";
      case "unknown_placeholder": return "#ef4444";
      default: return "#64748b";
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Animation Inspector</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px" }}>
        Search glosses, inspect resolution strategy, preview skeleton, and analyze animation quality
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search glosses: HELLO, THANK_YOU, GOODBYE"
            style={{
              width: "100%", padding: "10px 14px 10px 36px",
              background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
              color: "#e2e8f0", fontSize: 14, outline: "none",
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          style={{
            padding: "10px 20px", background: "#2563eb", border: "none", borderRadius: 8,
            color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}
        >
          {searching ? "Searching..." : "Inspect"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Results list */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
            Results ({results.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map(({ gloss, resolution }) => (
              <div
                key={gloss}
                onClick={() => selectGloss(gloss)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  background: selectedGloss === gloss ? "rgba(96,165,250,0.1)" : "#0f172a",
                  border: `1px solid ${selectedGloss === gloss ? "rgba(96,165,250,0.3)" : "#1e293b"}`,
                  borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {resolution.resolved ? <CheckCircle2 size={16} color="#4ade80" /> : <XCircle size={16} color="#f87171" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "monospace" }}>{gloss}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 3,
                      background: `${getStrategyColor(resolution.strategy)}22`,
                      color: getStrategyColor(resolution.strategy),
                      fontWeight: 600,
                    }}>
                      {resolution.strategy}
                    </span>
                    {resolution.resolved && (
                      <span style={{ fontSize: 10, color: "#64748b" }}>
                        {Math.round(resolution.confidence * 100)}% confidence
                      </span>
                    )}
                    {resolution.fallbackChain && resolution.fallbackChain.length > 1 && (
                      <span style={{ fontSize: 9, color: "#64748b" }}>
                        chain: {resolution.fallbackChain.join(" \u2192 ")}
                      </span>
                    )}
                  </div>
                </div>
                <Film size={16} color="#64748b" />
              </div>
            ))}
            {results.length === 0 && !searching && (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                Search for glosses to inspect their resolution
              </div>
            )}
          </div>
        </div>

        {/* Detail view */}
        <div>
          {selectedAsset ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
                <canvas ref={canvasRef} width={320} height={400} style={{ width: "100%", height: "auto", display: "block" }} />
              </div>

              <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", padding: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", fontFamily: "monospace", color: "#60a5fa" }}>
                  {selectedGloss}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { icon: Film, label: "Label", value: selectedAsset.label },
                    { icon: Clock, label: "Duration", value: `${(selectedAsset.duration / 1000).toFixed(1)}s` },
                    { icon: Layers, label: "Frames", value: selectedAsset.totalFrames.toString() },
                    { icon: Activity, label: "FPS", value: selectedAsset.fps.toString() },
                    { icon: BarChart3, label: "Source", value: selectedAsset.metadata.source ?? "unknown" },
                    { icon: Eye, label: "Version", value: `v${selectedAsset.metadata.version}` },
                    { icon: Hand, label: "Hands", value: selectedAsset.frames.some(f => f.landmarks.length > 0) ? "Yes" : "No" },
                    { icon: Eye, label: "Pose", value: selectedAsset.frames.some(f => (f.poseLandmarks?.length ?? 0) > 0) ? "Yes" : "No" },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                      <item.icon size={14} color="#64748b" />
                      <span>{item.label}:</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: 60, background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", color: "#64748b",
            }}>
              <Eye size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>Select a result to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
