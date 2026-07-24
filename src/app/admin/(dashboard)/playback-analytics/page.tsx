"use client";

import { useState, useRef, useCallback } from "react";
import { Activity, BarChart3, Clock, Film, Hand, Layers, Eye, Search, TrendingUp, Zap, RefreshCw, MessageSquare, AlertTriangle, BookOpen, ThumbsDown } from "lucide-react";
import { AnimationLoader } from "@/features/sign-animation/loader/AnimationLoader";
import { AnimationCache, PlaybackAnalytics } from "@/features/sign-animation/player/AnimationCache";
import { AnimationRecommendationEngine } from "@/features/sign-animation/player/AnimationRecommendationEngine";
import type { AnimationRecommendation } from "@/features/sign-animation/types";

const loader = new AnimationLoader();
const cache = new AnimationCache();
const analytics = new PlaybackAnalytics();
const recommender = new AnimationRecommendationEngine();

export default function PlaybackAnalyticsPage() {
  const [searching, setSearching] = useState(false);
  const [searchGloss, setSearchGloss] = useState("");
  const [cacheStats, setCacheStats] = useState(cache.getStats());
  const [analyticsEvents, setAnalyticsEvents] = useState(analytics.getEvents());
  const [mostPlayed, setMostPlayed] = useState<Array<{ gesture: string; count: number }>>([]);
  const [recommendations, setRecommendations] = useState<AnimationRecommendation[]>([]);
  const [tab, setTab] = useState<"overview" | "recommendations">("overview");

  const handleSearch = useCallback(async () => {
    if (!searchGloss.trim()) return;
    setSearching(true);

    const gloss = searchGloss.toUpperCase().replace(/\s+/g, "_");
    const existing = cache.getAsset(gloss);
    if (!existing) {
      const asset = await loader.load(gloss);
      if (asset) {
        cache.setAsset(gloss, asset);
        analytics.record({ type: "cache_miss", gesture: gloss, details: "loaded from API" });
      } else {
        analytics.record({ type: "resolution_fallback", gesture: gloss, details: "not found, would fingerspell" });
        recommender.recordFingerspell(gloss);
      }
    } else {
      analytics.record({ type: "cache_hit", gesture: gloss, details: "from cache" });
    }

    analytics.record({ type: "gesture_played", gesture: gloss, duration: existing?.duration });
    setCacheStats(cache.getStats());
    setAnalyticsEvents(analytics.getEvents());
    setMostPlayed(analytics.getMostPlayed());
    setRecommendations(recommender.getRecommendations());
    setSearching(false);
  }, [searchGloss]);

  const handleReset = useCallback(() => {
    cache.clear();
    analytics.reset();
    recommender.reset();
    setCacheStats(cache.getStats());
    setAnalyticsEvents([]);
    setMostPlayed([]);
    setRecommendations([]);
  }, []);

  const statsCards = [
    { icon: Layers, label: "Cached Assets", value: cacheStats.assetCount.toString() },
    { icon: Activity, label: "Cache Hit Rate", value: `${Math.round(cacheStats.hitRate * 100)}%`, color: cacheStats.hitRate > 0.7 ? "#4ade80" : "#fbbf24" },
    { icon: BarChart3, label: "Resolutions", value: cacheStats.resolutionCount.toString() },
    { icon: Hand, label: "Gestures Played", value: analytics.getTotalPlayed().toString() },
    { icon: Clock, label: "Session", value: `${Math.round(analytics.getTotalSessionDuration() / 1000)}s` },
    { icon: Eye, label: "Unique Gestures", value: analytics.getUniqueGestures().length.toString() },
    { icon: BookOpen, label: "Phrase Resolutions", value: analytics.getPhraseResolutionCount().toString(), color: "#4ade80" },
    { icon: ThumbsDown, label: "Fallback Rate", value: `${Math.round(analytics.getFallbackRate() * 100)}%`, color: analytics.getFallbackRate() > 0.3 ? "#ef4444" : "#4ade80" },
    { icon: Zap, label: "Fingerspelled", value: analytics.getFingerspellCount().toString(), color: "#fb923c" },
    { icon: MessageSquare, label: "Avg Latency", value: `${Math.round(analytics.getAverageTranslationLatency())}ms`, color: "#60a5fa" },
    { icon: Layers, label: "Playback Plans", value: cacheStats.playbackPlanCount.toString(), color: "#22d3ee" },
    { icon: Film, label: "Fingerspell Cache", value: cacheStats.fingerspellCount.toString(), color: "#fb923c" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto", color: "#e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Playback Analytics</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab(tab === "overview" ? "recommendations" : "overview")} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: tab === "recommendations" ? "#2563eb" : "#1e293b",
            border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 13, cursor: "pointer",
          }}>
            <TrendingUp size={14} /> {tab === "overview" ? "Recommendations" : "Overview"}
          </button>
          <button onClick={handleReset} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: "#1e293b", border: "1px solid #334155",
            borderRadius: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer",
          }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>
        Track animation playback performance, cache efficiency, phrase resolution, and animation recommendations
      </p>

      {tab === "overview" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
            {statsCards.map((card) => (
              <div key={card.label} style={{
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10,
                padding: "14px 16px", textAlign: "center",
              }}>
                <card.icon size={20} style={{ color: "#60a5fa", marginBottom: 4 }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color ?? "#e2e8f0" }}>{card.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", padding: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase" }}>
                <TrendingUp size={14} style={{ marginRight: 6 }} /> Most Played Gestures
              </h3>
              {mostPlayed.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {mostPlayed.map((item) => (
                    <div key={item.gesture} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 13,
                    }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{item.gesture}</span>
                      <span style={{ color: "#60a5fa", fontWeight: 700 }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: "#64748b", fontSize: 12 }}>
                  No playback data yet. Search for glosses below.
                </div>
              )}
            </div>

            <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", padding: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase" }}>
                <Zap size={14} style={{ marginRight: 6 }} /> Recent Events
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 300, overflow: "auto" }}>
                {analyticsEvents.slice(-30).reverse().map((event, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 8, alignItems: "center",
                    padding: "4px 8px", fontSize: 11, borderRadius: 4,
                    background: event.type === "gesture_played" ? "rgba(74,222,128,0.06)" : "#1e293b",
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: event.type === "cache_hit" ? "#4ade80" :
                                  event.type === "gesture_played" ? "#60a5fa" :
                                  event.type === "cache_miss" ? "#fbbf24" :
                                  event.type === "resolution_fallback" ? "#ef4444" :
                                  event.type === "phrase_resolved" ? "#22d3ee" : "#64748b",
                    }} />
                    <span style={{ color: "#94a3b8", minWidth: 80 }}>{event.type}</span>
                    {event.gesture && <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#e2e8f0" }}>{event.gesture}</span>}
                    {event.details && <span style={{ color: "#64748b", marginLeft: "auto" }}>{event.details}</span>}
                  </div>
                ))}
                {analyticsEvents.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "#64748b", fontSize: 12 }}>
                    No events recorded
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", padding: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase" }}>
            <AlertTriangle size={14} style={{ marginRight: 6 }} /> Animation Recommendations
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
            Words that are frequently fingerspelled and should have dedicated animations.
            Threshold: {recommender.getOccurrenceThreshold()}+ occurrences.
          </p>

          {recommendations.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recommendations.map((rec) => (
                <div key={rec.word} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", background: "#1e293b", borderRadius: 8,
                  border: "1px solid #334155",
                }}>
                  <div>
                    <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#fb923c" }}>{rec.word}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{rec.recommendation}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#fbbf24" }}>{rec.occurrences}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>times fingerspelled</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 30, color: "#64748b", fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
              No recommendations yet. Search glosses that don&apos;t have animations to generate fingerspelling data.
            </div>
          )}

          {/* All fingerspelled words */}
          {recommender.getAllFingerspelled().length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 8px" }}>
                All Fingerspelled Words ({recommender.getAllFingerspelled().length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {recommender.getAllFingerspelled().map((rec) => (
                  <div key={rec.word} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 10px", fontSize: 12, borderRadius: 4, background: "#1e293b",
                  }}>
                    <span style={{ fontFamily: "monospace", color: rec.occurrences >= recommender.getOccurrenceThreshold() ? "#fb923c" : "#94a3b8" }}>
                      {rec.word}
                    </span>
                    <span style={{ color: "#64748b" }}>
                      {rec.occurrences}x
                      {rec.occurrences >= recommender.getOccurrenceThreshold() && (
                        <span style={{ color: "#4ade80", marginLeft: 4 }}>Recommend</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <Search size={16} color="#64748b" />
        <input
          value={searchGloss}
          onChange={(e) => setSearchGloss(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Test a gloss to record analytics (e.g., HELLO, THANK_YOU, CHATGPT)"
          style={{
            flex: 1, padding: "10px 14px", background: "#0f172a", border: "1px solid #334155",
            borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none",
          }}
        />
        <button onClick={handleSearch} disabled={searching || !searchGloss.trim()} style={{
          padding: "10px 20px", background: "#2563eb", border: "none", borderRadius: 8,
          color: "#fff", fontWeight: 600, cursor: "pointer",
        }}>
          {searching ? "Searching..." : "Simulate Playback"}
        </button>
      </div>
    </div>
  );
}
