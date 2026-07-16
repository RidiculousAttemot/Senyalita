"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Bell, AlertTriangle, CheckCircle2, Info, XCircle, ExternalLink, Archive } from "lucide-react";

interface NotificationEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  gesture_label: string | null;
  confidence: number | null;
  created_at: string;
}

const NOTIFICATION_TYPES: Record<string, { icon: any; color: string; label: string }> = {
  low_confidence: { icon: AlertTriangle, color: "#fde68a", label: "Low Confidence" },
  retraining_started: { icon: Info, color: "#60a5fa", label: "Training Started" },
  retraining_completed: { icon: CheckCircle2, color: "#4ade80", label: "Training Complete" },
  translation_failed: { icon: XCircle, color: "#f87171", label: "Translation Failed" },
  recognition_failure: { icon: XCircle, color: "#f87171", label: "Recognition Failure" },
  admin_login: { icon: Info, color: "#94a3b8", label: "Admin Login" },
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  low_confidence: { bg: "rgba(234,179,8,0.1)", color: "#fde68a" },
  translation_failed: { bg: "rgba(220,38,38,0.1)", color: "#fca5a5" },
  recognition_failure: { bg: "rgba(220,38,38,0.1)", color: "#fca5a5" },
  retraining_completed: { bg: "rgba(22,163,74,0.1)", color: "#86efac" },
};

export function NotificationCenterView() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-learning?section=notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const filtered = filter === "all"
    ? notifications
    : notifications.filter((n) => n.event_type === filter);

  const unread = notifications.length;

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>Notification Center</h1>
          <p className="admin-dashboard-subtitle">System events, alerts, and activity notifications.</p>
        </div>
        <div className="admin-dashboard-actions">
          <button onClick={fetchNotifications} className="admin-action-button">
            <Loader2 size={16} /> Refresh
          </button>
        </div>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <p className="admin-metric-label">Total Notifications</p>
          <strong className="admin-metric-value">{notifications.length}</strong>
          <p className="admin-metric-note">Last 14 days</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Unread</p>
          <strong className="admin-metric-value" style={{ color: "#60a5fa" }}>{unread}</strong>
          <p className="admin-metric-note">All notifications</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Alerts</p>
          <strong className="admin-metric-value" style={{ color: "#f87171" }}>
            {notifications.filter((n) => n.event_type === "translation_failed" || n.event_type === "recognition_failure").length}
          </strong>
          <p className="admin-metric-note">Requires attention</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Events / Day</p>
          <strong className="admin-metric-value">
            {notifications.length > 0 ? Math.round(notifications.length / 14) : 0}
          </strong>
          <p className="admin-metric-note">Average</p>
        </article>
      </div>

      <div className="admin-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "8px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none" }}>
            <option value="all">All Types</option>
            {Object.entries(NOTIFICATION_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} notification(s)</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "#64748b" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <Bell size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((n) => {
              const type = NOTIFICATION_TYPES[n.event_type] ?? { icon: Info, color: "#64748b", label: n.event_type };
              const severity = SEVERITY_COLORS[n.event_type];
              const Icon = type.icon;
              const eventData = n.event_data as Record<string, unknown> | undefined;
              const message = eventData?.message as string ?? eventData?.title as string ?? n.gesture_label ?? "No details";
              const link = eventData?.link as string ?? null;

              return (
                <div key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px", background: severity?.bg ?? "#1e293b",
                  border: `1px solid ${severity?.color ?? "#334155"}20`,
                  borderRadius: 8, transition: "all 0.15s",
                }}>
                  <Icon size={18} color={type.color} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{type.label}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{message}</p>
                    {link && (
                      <a href={link} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#60a5fa", marginTop: 4, textDecoration: "none" }}>
                        View Details <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {n.event_type === "low_confidence" && (
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(234,179,8,0.15)", color: "#fde68a" }}>
                        {n.confidence !== null ? `${(n.confidence * 100).toFixed(0)}%` : "—"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
