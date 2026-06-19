"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  modelLabels: number;
  dbLabels: number;
  inserted: number;
  repliesInserted: number;
  errors: string[];
};

export default function GestureLibraryImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/gesture-library/import", {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="admin-section">
        <h1>Import Gesture Library</h1>
        <p className="panel-note">
          Reads all 133 labels from the deployed model and inserts any missing
          entries into the <code>gestures</code> table with default reply
          suggestions.
        </p>

        <button
          className="button"
          type="button"
          onClick={handleImport}
          disabled={loading}
          style={{ marginTop: 16 }}
        >
          {loading ? "Importing..." : "Sync Gesture Library"}
        </button>

        {error && (
          <div className="error-text" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16 }}>
            <h2>Import Report</h2>
            <table className="admin-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Model labels</td>
                  <td>{result.modelLabels}</td>
                </tr>
                <tr>
                  <td>DB labels (before)</td>
                  <td>{result.dbLabels}</td>
                </tr>
                <tr>
                  <td>Newly inserted</td>
                  <td>{result.inserted}</td>
                </tr>
                <tr>
                  <td>Replies inserted</td>
                  <td>{result.repliesInserted}</td>
                </tr>
                {result.errors.length > 0 && (
                  <tr>
                    <td>Errors</td>
                    <td>{result.errors.join("; ")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => router.push("/admin/gestures")}
          >
            Back to gesture library
          </button>
        </div>
      </section>
    </main>
  );
}
