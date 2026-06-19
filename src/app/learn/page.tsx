"use client";

import { useEffect, useState, useMemo } from "react";
import { UserSidebar } from "@/components/UserSidebar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { translateLabel, classifyLabel } from "@/features/recognition";
import { LearningRecommendationEngine, type LearningRecommendation } from "@/features/analytics/learningEngine";
import { GestureDifficultyAnalyzer, type GestureDifficultyRank } from "@/features/analytics/gestureDifficulty";

type GestureRecord = {
  id: string;
  label: string;
  description: string;
  video_path: string | null;
  status: string;
};

type FilterMode = "all" | "alphabet" | "phrase";
type SortMode = "name" | "difficulty" | "recommended";

export default function LearnPage() {
  const [gestures, setGestures] = useState<GestureRecord[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FilterMode>("all");
  const [sortBy, setSortBy] = useState<SortMode>("recommended");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GestureRecord | null>(null);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [difficultyData, setDifficultyData] = useState<GestureDifficultyRank[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const loadData = async () => {
      const [gestureResult, difficultyDataRaw] = await Promise.all([
        supabase
          .from("gestures")
          .select("*")
          .order("label", { ascending: true }),
        supabase
          .from("gesture_difficulty_tracking")
          .select("*")
          .order("difficulty_score", { ascending: false }),
      ]);

      if (gestureResult.data) {
        setGestures(gestureResult.data as GestureRecord[]);
      }

      type DifficultyRow = {
        gesture_label: string;
        difficulty_score: number;
        total_recognitions: number;
        correction_count: number;
        confusion_count: number;
        retry_count: number;
        avg_confidence: number | null;
      };

      const difficultyResult = (difficultyDataRaw.data ?? []) as unknown as DifficultyRow[];

      if (difficultyResult.length > 0) {
        const analyzer = new GestureDifficultyAnalyzer();
        analyzer.addTrackings(difficultyResult as any);
        setDifficultyData(analyzer.getRanked());

        const engine = new LearningRecommendationEngine();
        engine.setDifficultyRankings(analyzer.getRanked());

        const lowConfGestures = difficultyResult
          .filter((d) => (d.avg_confidence ?? 0) < 0.6)
          .slice(0, 5);
        for (const g of lowConfGestures) {
          engine.recordLowConfidence(g.gesture_label, g.avg_confidence ?? 0.4);
        }

        setRecommendations(engine.getRecommendations(6));
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const filtered = useMemo(() => {
    let result = gestures.filter((g) => {
      const matchesSearch = g.label.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase()) ||
        translateLabel(g.label)?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || classifyLabel(g.label) === category;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === "difficulty") {
      const diffMap = new Map(difficultyData.map(d => [d.gesture_label, d.difficulty_score]));
      result.sort((a, b) => (diffMap.get(b.label) ?? 0.5) - (diffMap.get(a.label) ?? 0.5));
    } else if (sortBy === "recommended" && recommendations.length > 0) {
      const recLabels = new Set(recommendations.map(r => r.gestureLabel));
      result.sort((a, b) => {
        const aRec = recLabels.has(a.label) ? 0 : 1;
        const bRec = recLabels.has(b.label) ? 0 : 1;
        return aRec - bRec;
      });
    }

    return result;
  }, [gestures, search, category, sortBy, difficultyData, recommendations]);

  const getDifficultyBadge = (label: string): { text: string; color: string } | null => {
    const entry = difficultyData.find(d => d.gesture_label === label);
    if (!entry) return null;
    const colors: Record<string, string> = {
      easy: "#22c55e",
      moderate: "#3b82f6",
      hard: "#eab308",
      very_hard: "#ef4444",
    };
    return { text: entry.difficultyLabel, color: colors[entry.difficultyLabel] ?? "#888" };
  };

  return (
    <UserSidebar>
      <div className="learn">
        <h1>Learn FSL</h1>
        <p className="panel-note">
          Browse the Filipino Sign Language gesture library. Search for signs, watch reference videos, and practice.
          Personalized recommendations help you focus on gestures that need improvement.
        </p>

        {recommendations.length > 0 && (
          <div className="panel" style={{ padding: 16, marginBottom: 16, borderColor: "#a855f7" }}>
            <h3 style={{ color: "#a855f7", marginBottom: 8, fontSize: 14 }}>
              Recommended for You
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recommendations.map((rec) => (
                <button
                  key={rec.gestureLabel}
                  className="gesture-recommendation-btn"
                  onClick={() => {
                    setSearch(rec.gestureLabel);
                    setSelected(null);
                    window.scrollTo({ top: 400, behavior: "smooth" });
                  }}
                  title={rec.reason}
                >
                  {rec.gestureLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="learn-controls">
          <input
            type="text"
            className="learn-search"
            placeholder="Search gestures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="learn-categories">
            {(["all", "alphabet", "phrase"] as const).map((c) => (
              <button
                key={c}
                className={`button ${category === c ? "" : "button-secondary"}`}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "All" : c === "alphabet" ? "Alphabet" : "Phrases"}
              </button>
            ))}
            <select
              className="learn-search"
              style={{ width: "auto", padding: "4px 8px" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
            >
              <option value="recommended">Recommended</option>
              <option value="name">Alphabetical</option>
              <option value="difficulty">By Difficulty</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="panel-note">Loading gesture library...</p>
        ) : filtered.length === 0 ? (
          <p className="panel-note">No gestures found. Try a different search.</p>
        ) : (
          <div className="learn-grid">
            {filtered.map((g) => {
              const cat = classifyLabel(g.label);
              const translation = translateLabel(g.label);
              const diffBadge = getDifficultyBadge(g.label);
              return (
                <button
                  key={g.id}
                  className="learn-card"
                  onClick={() => setSelected(selected?.id === g.id ? null : g)}
                >
                  <div className="learn-card-header">
                    <code className="learn-card-label">{g.label}</code>
                    <span className={`learn-card-badge learn-card-badge-${cat}`}>
                      {cat}
                    </span>
                  </div>
                  <p className="learn-card-translation">{translation}</p>
                  {diffBadge && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: `${diffBadge.color}22`,
                        color: diffBadge.color,
                        marginTop: 2,
                      }}
                    >
                      {diffBadge.text}
                    </span>
                  )}
                  {selected?.id === g.id && (
                    <div className="learn-card-detail">
                      <p className="learn-card-desc">{g.description || "No description available."}</p>
                      {g.video_path && (
                        <video
                          src={g.video_path}
                          controls
                          className="learn-card-video"
                          playsInline
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </UserSidebar>
  );
}
