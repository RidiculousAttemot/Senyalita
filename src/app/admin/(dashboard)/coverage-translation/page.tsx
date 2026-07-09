import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/supabase/queries/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CoverageMetric {
  label: string;
  animFile: boolean;
  glossEntry: boolean;
  suggRules: boolean;
  category: string;
}

function labelToAnimFile(label: string): string {
  return label.toUpperCase().replace(/\s+/g, "_") + ".json";
}

function loadCoverageData(): {
  labels: string[];
  metrics: CoverageMetric[];
  counts: { total: number; animOk: number; glossOk: number; suggOk: number };
} {
  const ROOT = process.cwd();
  const labelsPath = path.join(ROOT, "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json");
  const animDir = path.join(ROOT, "public", "animations");
  const glossPath = path.join(ROOT, "src", "features", "gesture-mapping", "glossDictionary.ts");
  const suggPath = path.join(ROOT, "src", "features", "translation", "smartSuggestions.ts");

  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf8")).labels;
  const animFiles = new Set(
    fs.existsSync(animDir)
      ? fs.readdirSync(animDir).filter((f) => f.endsWith(".json"))
      : []
  );
  const glossContent = fs.existsSync(glossPath) ? fs.readFileSync(glossPath, "utf8") : "";
  const suggContent = fs.existsSync(suggPath) ? fs.readFileSync(suggPath, "utf8") : "";

  const sugRuleLabels = new Set<string>();
  const gestureRe = /gesture:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = gestureRe.exec(suggContent)) !== null) sugRuleLabels.add(m[1].toUpperCase());
  const alphabetRe = /"([A-Z])":\s*\[/g;
  while ((m = alphabetRe.exec(suggContent)) !== null) sugRuleLabels.add(m[1].toUpperCase());

  const counts = { total: labels.length, animOk: 0, glossOk: 0, suggOk: 0 };
  const metrics: CoverageMetric[] = [];

  const labelInGloss = (l: string) => {
    const u = l.toUpperCase();
    const lo = l.toLowerCase();
    const re = new RegExp(`["'\`]?${u}["'\`]?\\s*[:]|["'\`]?${lo}["'\`]?\\s*[:]`);
    return re.test(glossContent);
  };

  // Build category map from GESTURE_CATEGORIES
  const catRe = /["']?([A-Z][A-Z\s']+)["']?\s*:\s*"(\w+)"/g;
  const catMap: Record<string, string> = {};
  let catMatch: RegExpExecArray | null;
  while ((catMatch = catRe.exec(glossContent)) !== null) {
    catMap[catMatch[1].trim()] = catMatch[2];
  }

  for (const label of labels) {
    const hasAnim = animFiles.has(labelToAnimFile(label));
    const hasGloss = labelInGloss(label);
    const hasSugg = sugRuleLabels.has(label.toUpperCase());
    const category = catMap[label] ?? (label.length === 1 ? "alphabet" : "phrase");

    if (hasAnim) counts.animOk++;
    if (hasGloss) counts.glossOk++;
    if (hasSugg) counts.suggOk++;

    metrics.push({ label, animFile: hasAnim, glossEntry: hasGloss, suggRules: hasSugg, category });
  }

  return { labels, metrics, counts };
}

export default async function CoverageTranslationPage() {
  await requireAdmin();
  const { labels, metrics, counts } = loadCoverageData();

  const pctAnim = ((counts.animOk / counts.total) * 100).toFixed(1);
  const pctGloss = ((counts.glossOk / counts.total) * 100).toFixed(1);
  const pctSugg = ((counts.suggOk / counts.total) * 100).toFixed(1);

  const missing = metrics.filter((m) => !m.animFile || !m.glossEntry || !m.suggRules);
  const categoryCounts: Record<string, { total: number; ok: number }> = {};
  for (const m of metrics) {
    if (!categoryCounts[m.category]) categoryCounts[m.category] = { total: 0, ok: 0 };
    categoryCounts[m.category].total++;
    if (m.animFile && m.glossEntry && m.suggRules) categoryCounts[m.category].ok++;
  }

  return (
    <div>
      <h2>Translation Pipeline Coverage</h2>

      <div className="admin-cards">
        <div className="analytics-card" style={{ borderLeft: "4px solid #22c55e" }}>
          <span className="analytics-label">Total classes</span>
          <span className="analytics-value">{counts.total}</span>
        </div>
        <div className="analytics-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <span className="analytics-label">Animation files</span>
          <span className="analytics-value">{counts.animOk}/{counts.total}</span>
          <span className="analytics-sub">{pctAnim}%</span>
        </div>
        <div className="analytics-card" style={{ borderLeft: "4px solid #a855f7" }}>
          <span className="analytics-label">Gloss dictionary</span>
          <span className="analytics-value">{counts.glossOk}/{counts.total}</span>
          <span className="analytics-sub">{pctGloss}%</span>
        </div>
        <div className="analytics-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span className="analytics-label">Smart suggestions</span>
          <span className="analytics-value">{counts.suggOk}/{counts.total}</span>
          <span className="analytics-sub">{pctSugg}%</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Coverage by Category</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total</th>
              <th>Fully Covered</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categoryCounts)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([cat, { total, ok }]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{total}</td>
                  <td>{ok}</td>
                  <td>
                    <div className="coverage-bar-wrap">
                      <div
                        className="coverage-bar"
                        style={{ width: `${(ok / total) * 100}%` }}
                      />
                    </div>
                    <small>{((ok / total) * 100).toFixed(0)}%</small>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h3 className="analytics-section-title">Detailed Class Coverage</h3>
      {missing.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Category</th>
                <th>Animation</th>
                <th>Gloss</th>
                <th>Suggestions</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((m) => (
                <tr key={m.label}>
                  <td><code>{m.label}</code></td>
                  <td>{m.category}</td>
                  <td style={{ color: m.animFile ? "#22c55e" : "#ef4444" }}>
                    {m.animFile ? "✓" : "✗"}
                  </td>
                  <td style={{ color: m.glossEntry ? "#22c55e" : "#ef4444" }}>
                    {m.glossEntry ? "✓" : "✗"}
                  </td>
                  <td style={{ color: m.suggRules ? "#22c55e" : "#ef4444" }}>
                    {m.suggRules ? "✓" : "✗"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel-note" style={{ color: "#22c55e", fontWeight: "bold" }}>
          ✓ All {counts.total} classes have complete pipeline coverage
        </p>
      )}

      <style>{`
        .analytics-sub { display: block; font-size: 0.75rem; color: #666; }
        .coverage-bar-wrap { display: inline-block; width: 80px; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; vertical-align: middle; margin-right: 6px; }
        .coverage-bar { height: 100%; background: #22c55e; border-radius: 6px; transition: width 0.3s; }
      `}</style>
    </div>
  );
}
