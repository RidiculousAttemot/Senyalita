"use client";

import { useMemo, useCallback, useState } from "react";
import { UserSidebar } from "@/components/UserSidebar";
import type { ConversationSession, ConversationMessage } from "@/lib/supabase/types";

type Props = {
  session: ConversationSession;
  messages: ConversationMessage[];
};

export const ConversationTimeline = ({ session, messages }: Props) => {
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState<number | null>(null);
  
  const analytics = useMemo(() => {
    const signerMsgs = messages.filter(m => m.sender_type === "signer");
    const responderMsgs = messages.filter(m => m.sender_type === "responder");
    const avgConfidence = signerMsgs.reduce(
      (sum, m) => sum + (m.confidence ?? 0), 0
    ) / (signerMsgs.length || 1);
    const selectedReplies = messages.filter(m => m.is_selected_reply).length;
    
    return {
      totalMessages: messages.length,
      signerMessages: signerMsgs.length,
      responderMessages: responderMsgs.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      selectedReplies,
      duration: session.started_at && session.ended_at
        ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
        : 0,
      success: session.communication_success,
    };
  }, [messages, session]);
  
  const exportAsText = useCallback(() => {
    const lines = [
      "Conversation Timeline",
      `Started: ${new Date(session.started_at).toLocaleString()}`,
      `Duration: ${analytics.duration}s`,
      `Status: ${session.status}`,
      "",
      "--- Messages ---",
      "",
    ];
    for (const msg of messages) {
      const time = new Date(msg.created_at).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit", hour12: false });
      const sender = msg.sender_type === "signer" ? "Signer" : "Responder";
      const text = msg.translated_text;
      const conf = msg.confidence ? ` (${(msg.confidence * 100).toFixed(0)}%)` : "";
      lines.push(`[${time}] ${sender}: ${text}${conf}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${session.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, session, analytics]);
  
  const startReplay = useCallback(() => {
    setAutoPlay(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i >= messages.length) {
        clearInterval(interval);
        setAutoPlay(false);
        setCurrentHighlight(null);
        return;
      }
      setCurrentHighlight(i);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <UserSidebar>
      <div className="conversation-timeline">
        <h1>Conversation Timeline</h1>
        <p className="timeline-date">{new Date(session.started_at).toLocaleString()}</p>
        
        <div className="timeline-analytics">
          <div className="analytic-card">
            <span className="analytic-value">{analytics.totalMessages}</span>
            <span className="analytic-label">Total Messages</span>
          </div>
          <div className="analytic-card">
            <span className="analytic-value">{analytics.signerMessages}</span>
            <span className="analytic-label">Signer</span>
          </div>
          <div className="analytic-card">
            <span className="analytic-value">{analytics.responderMessages}</span>
            <span className="analytic-label">Responder</span>
          </div>
          <div className="analytic-card">
            <span className="analytic-value">{(analytics.avgConfidence * 100).toFixed(0)}%</span>
            <span className="analytic-label">Avg Confidence</span>
          </div>
          <div className="analytic-card">
            <span className="analytic-value">{analytics.duration}s</span>
            <span className="analytic-label">Duration</span>
          </div>
          <div className="analytic-card">
            <span className="analytic-value">{analytics.success ? "Yes" : "No"}</span>
            <span className="analytic-label">Successful</span>
          </div>
        </div>
        
        <div className="timeline-actions">
          <button className="button" onClick={startReplay} disabled={autoPlay}>
            {autoPlay ? "Playing..." : "Replay"}
          </button>
          <button className="button button-secondary" onClick={exportAsText}>
            Export TXT
          </button>
        </div>
        
        <div className="timeline-messages">
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`timeline-message ${msg.sender_type} ${currentHighlight === i ? "highlight" : ""}`}
            >
              <span className="timeline-time">
                {new Date(msg.created_at).toLocaleTimeString("en-US", {
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="timeline-sender">{msg.sender_type === "signer" ? "\uD83E\uDD1F" : "\uD83D\uDCAC"}</span>
              <span className="timeline-text">{msg.translated_text}</span>
              {msg.confidence && (
                <span className="timeline-confidence">
                  {(msg.confidence * 100).toFixed(0)}%
                </span>
              )}
              {msg.is_selected_reply && (
                <span className="timeline-badge">Selected</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </UserSidebar>
  );
};
