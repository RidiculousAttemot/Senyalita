const ALPHABET_ENTRIES: Array<{
  label: string;
  display: string;
  assetType: string;
  status: "ready" | "draft" | "missing";
  notes: string;
}> = [
  { label: "A", display: "A", assetType: "pose-sequence", status: "ready", notes: "Fist grip — supported by model" },
  { label: "B", display: "B", assetType: "pose-sequence", status: "ready", notes: "Open palm — supported by model" },
  { label: "C", display: "C", assetType: "pose-sequence", status: "ready", notes: "Curved hand — supported by model" },
  { label: "D", display: "D", assetType: "pose-sequence", status: "ready", notes: "Point up — supported by model" },
  { label: "E", display: "E", assetType: "pose-sequence", status: "ready", notes: "Curled fingers — supported by model" },
  { label: "F", display: "F", assetType: "pose-sequence", status: "ready", notes: "OK pinch — supported by model" },
  { label: "G", display: "G", assetType: "pose-sequence", status: "ready", notes: "Point out — supported by model" },
  { label: "H", display: "H", assetType: "pose-sequence", status: "ready", notes: "Two fingers out — supported by model" },
  { label: "I", display: "I", assetType: "pose-sequence", status: "ready", notes: "Pinky up — supported by model" },
  { label: "J", display: "J", assetType: "pose-sequence", status: "ready", notes: "Pinky curl — supported by model" },
  { label: "K", display: "K", assetType: "pose-sequence", status: "ready", notes: "Two fingers V — supported by model" },
  { label: "L", display: "L", assetType: "pose-sequence", status: "ready", notes: "L-shape — supported by model" },
  { label: "M", display: "M", assetType: "pose-sequence", status: "ready", notes: "Three fingers down — supported by model" },
  { label: "N", display: "N", assetType: "pose-sequence", status: "ready", notes: "Two fingers down — supported by model" },
  { label: "Ñ", display: "Ñ", assetType: "pose-sequence", status: "missing", notes: "Not in current model — future" },
  { label: "NG", display: "NG", assetType: "pose-sequence", status: "missing", notes: "Not in current model — future" },
  { label: "O", display: "O", assetType: "pose-sequence", status: "ready", notes: "Round hand — supported by model" },
  { label: "P", display: "P", assetType: "pose-sequence", status: "ready", notes: "Point down — supported by model" },
  { label: "Q", display: "Q", assetType: "pose-sequence", status: "ready", notes: "Hook down — supported by model" },
  { label: "R", display: "R", assetType: "pose-sequence", status: "ready", notes: "Crossed fingers — supported by model" },
  { label: "S", display: "S", assetType: "pose-sequence", status: "ready", notes: "Fist, thumb over — supported by model" },
  { label: "T", display: "T", assetType: "pose-sequence", status: "ready", notes: "Fist, thumb between — supported by model" },
  { label: "U", display: "U", assetType: "pose-sequence", status: "ready", notes: "Two fingers up — supported by model" },
  { label: "V", display: "V", assetType: "pose-sequence", status: "ready", notes: "Victory — supported by model" },
  { label: "W", display: "W", assetType: "pose-sequence", status: "ready", notes: "Three up — supported by model" },
  { label: "X", display: "X", assetType: "pose-sequence", status: "ready", notes: "Hooked index — supported by model" },
  { label: "Y", display: "Y", assetType: "pose-sequence", status: "ready", notes: "Horns+pinky — supported by model" },
  { label: "Z", display: "Z", assetType: "pose-sequence", status: "ready", notes: "Trace Z — supported by model" },
];

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ready: { bg: "#065f46", color: "#a7f3d0", label: "Ready" },
  draft: { bg: "#92400e", color: "#fde68a", label: "Draft" },
  missing: { bg: "#7f1d1d", color: "#fca5a5", label: "Missing" },
};

export default function GestureLibraryPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>Alphabet / Sign Asset Library</h2>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Alphabet-first library for Type-to-Sign. Letters A–Z are supported by the current model.
          Ñ and NG are placeholder entries for future development.
        </p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>Label</th>
            <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>Display</th>
            <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>Asset Type</th>
            <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>Status</th>
            <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {ALPHABET_ENTRIES.map((entry) => {
            const badge = STATUS_BADGE[entry.status];
            return (
              <tr key={entry.label} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{entry.label}</td>
                <td style={{ padding: "10px 12px" }}>{entry.display}</td>
                <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{entry.assetType}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: badge.bg,
                    color: badge.color,
                  }}>
                    {badge.label}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>{entry.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
