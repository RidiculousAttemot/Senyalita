"use client";

interface AiInsightsPanelProps {
  language: string;
  signsUsed: number;
  fingerSpelled: number;
  durationSeconds: number;
  confidence: number;
  coverage: number;
}

export function AiInsightsPanel({
  language, signsUsed, fingerSpelled, durationSeconds, confidence, coverage,
}: AiInsightsPanelProps) {
  const rows: { label: string; value: string }[] = [
    { label: "Detected language", value: language },
    { label: "Translation mode", value: "FSL dictionary" },
    { label: "Signs used", value: `${signsUsed}` },
    { label: "Finger spelled", value: `${fingerSpelled}` },
    { label: "Estimated duration", value: `${durationSeconds.toFixed(1)} sec` },
    { label: "Dictionary coverage", value: `${Math.round(coverage * 100)}%` },
  ];

  return (
    <section
      aria-labelledby="insights-heading"
      className="rounded-2xl border border-fsl-border bg-fsl-surface p-5 shadow-[0_10px_30px_-20px_rgba(70,45,28,0.4)]"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="insights-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-fsl-muted">
          Translation insights
        </h2>
        <span className="text-[11px] font-semibold tabular-nums text-fsl-teal">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[11px] text-fsl-faint">{row.label}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold text-fsl-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
