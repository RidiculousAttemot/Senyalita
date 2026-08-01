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

  // aria-sort belongs on the <th> (role="columnheader"); the nested <button>
  // has an implicit role of "button", which does not support aria-sort.
  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span aria-hidden="true">{direction === "asc" ? " \u25B2" : " \u25BC"}</span>;
  };

  return (
    <div className="admin-table-wrap admin-table-wrap--compact">
      <table className="admin-table admin-table--compact">
        <thead>
          <tr>
            <th scope="col" aria-sort={sortLabel("timestamp")}>
              <button type="button" className="admin-sort-button" onClick={() => toggleSort("timestamp")}>
                Time{sortIndicator("timestamp")}
              </button>
            </th>
            <th scope="col" aria-sort={sortLabel("category")}>
              <button type="button" className="admin-sort-button" onClick={() => toggleSort("category")}>
                Category{sortIndicator("category")}
              </button>
            </th>
            <th scope="col" aria-sort={sortLabel("item")}>
              <button type="button" className="admin-sort-button" onClick={() => toggleSort("item")}>
                Item{sortIndicator("item")}
              </button>
            </th>
            <th scope="col" aria-sort={sortLabel("severity")}>
              <button type="button" className="admin-sort-button" onClick={() => toggleSort("severity")}>
                Severity{sortIndicator("severity")}
              </button>
            </th>
            <th scope="col" aria-sort={sortLabel("status")}>
              <button type="button" className="admin-sort-button" onClick={() => toggleSort("status")}>
                Status{sortIndicator("status")}
              </button>
            </th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.timestamp).toLocaleString()}</td>
              <td>{row.category}</td>
              <td>
                <strong>{row.item}</strong>
              </td>
              <td>
                <span className={`role-pill role-${row.severity}`}>{severityLabel[row.severity]}</span>
              </td>
              <td>{row.status}</td>
              <td className="admin-table-truncate">{row.detail || "No data yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}