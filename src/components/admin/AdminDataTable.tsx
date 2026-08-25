"use client";

import { useMemo, useState } from "react";

export type AdminDataTableRow = {
  id: string;
  timestamp: string;
  category: string;
  item: string;
  detail: string;
  severity: "low" | "medium" | "high";
  status: string;
};

type SortKey = "timestamp" | "category" | "item" | "severity" | "status";

const severityOrder: Record<AdminDataTableRow["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const severityLabel: Record<AdminDataTableRow["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Column widths live here rather than in the stylesheet because they belong to
 * this table's six specific columns, and a <colgroup> is what makes the header
 * and the body share them. Percentages so the whole thing still fits a narrow
 * viewport before .admin-table's min-width hands over to the scroller.
 */
const COLUMNS: { key: SortKey | "detail"; label: string; width: string; sortable: boolean }[] = [
  { key: "timestamp", label: "Time", width: "20%", sortable: true },
  { key: "category", label: "Category", width: "16%", sortable: true },
  { key: "item", label: "Item", width: "13%", sortable: true },
  { key: "severity", label: "Severity", width: "11%", sortable: true },
  { key: "status", label: "Status", width: "14%", sortable: true },
  { key: "detail", label: "Details", width: "26%", sortable: false },
];

/**
 * Seconds, plus the millisecond field.
 *
 * A single recognition emits three events -- recognition_success,
 * gesture_used and low_confidence -- within about 13ms of each other, so
 * toLocaleString() printed the same second three times running and the table
 * looked seeded. It is a genuine burst; showing the milliseconds is what makes
 * that legible instead of suspicious.
 */
const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}.${ms}`;
};

export default function AdminDataTable({ rows }: { rows: AdminDataTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    const valueFor = (row: AdminDataTableRow, key: SortKey) => {
      switch (key) {
        case "timestamp":
          return new Date(row.timestamp).getTime();
        case "category":
          return row.category.toLowerCase();
        case "item":
          return row.item.toLowerCase();
        case "severity":
          return severityOrder[row.severity];
        case "status":
          return row.status.toLowerCase();
      }
    };

    return [...rows].sort((left, right) => {
      const leftValue = valueFor(left, sortKey);
      const rightValue = valueFor(right, sortKey);
      if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
      if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [direction, rows, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "timestamp" ? "desc" : "asc");
  };

  const sortLabel = (key: SortKey) => {
    if (sortKey !== key) return "none";
    return direction === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="admin-table-wrap admin-table-wrap--compact">
      <table className="admin-table admin-table--compact">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) =>
              column.sortable ? (
                <th key={column.key} scope="col" aria-sort={sortLabel(column.key as SortKey)}>
                  <button
                    type="button"
                    className="admin-sort-button"
                    onClick={() => toggleSort(column.key as SortKey)}
                  >
                    {column.label}
                    {sortKey === column.key && (
                      <span className="admin-sort-caret" aria-hidden="true">
                        {direction === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </button>
                </th>
              ) : (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              {/* title carries the full ISO value, which is the only place the
                  ordering of a same-second burst is actually visible. */}
              <td title={row.timestamp}>{formatTimestamp(row.timestamp)}</td>
              <td title={row.category}>{row.category}</td>
              <td title={row.item}>
                <strong>{row.item}</strong>
              </td>
              <td>
                <span className={`role-pill role-${row.severity}`}>{severityLabel[row.severity]}</span>
              </td>
              <td title={row.status}>{row.status}</td>
              <td className="admin-table-truncate" title={row.detail || undefined}>
                {row.detail || "No data yet"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}