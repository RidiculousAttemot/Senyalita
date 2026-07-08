import { describe, it, expect } from "vitest";
import { ConversationIntelligenceAnalyzer } from "../conversationIntelligence";

describe("ConversationIntelligenceAnalyzer", () => {
  const analyzer = new ConversationIntelligenceAnalyzer();

  function makeSession(overrides: {
    id?: string;
    messages?: Array<{ gestureLabel: string; confidence: number; senderType: string; isSelectedReply: boolean; createdAt: string }>;
    totalMessages?: number;
    communicationSuccess?: boolean | null;
    startedAt?: string;
  }) {
    const now = new Date().toISOString();
    return {
      id: overrides.id ?? "session-1",
      startedAt: overrides.startedAt ?? now,
      endedAt: now,
      totalMessages: overrides.totalMessages ?? (overrides.messages?.length ?? 0),
      communicationSuccess: overrides.communicationSuccess ?? null,
      messages: overrides.messages ?? [],
    };
  }

  it("handles empty sessions", () => {
    const report = analyzer.analyze([]);
    expect(report.totalConversations).toBe(0);
    expect(report.successfulConversations).toBe(0);
    expect(report.qualityIndex).toBeGreaterThanOrEqual(0);
  });

  it("detects successful conversations", () => {
    const sessions = [
      makeSession({ id: "s1", totalMessages: 5, communicationSuccess: true }),
      makeSession({ id: "s2", totalMessages: 3, communicationSuccess: true }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.totalConversations).toBe(2);
    expect(report.successfulConversations).toBe(2);
    expect(report.communicationEfficiency).toBeGreaterThanOrEqual(60);
  });

  it("detects stalled conversations", () => {
    const sessions = [
      makeSession({ id: "s1", totalMessages: 1, communicationSuccess: false }),
      makeSession({ id: "s2", totalMessages: 2, communicationSuccess: null }),
      makeSession({ id: "s3", totalMessages: 10, communicationSuccess: true }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.stalledConversations).toBe(2);
  });

  it("detects repeated clarifications", () => {
    const sessions = [
      makeSession({
        id: "s1",
        messages: [
          { gestureLabel: "HELLO", confidence: 0.8, senderType: "signer", isSelectedReply: false, createdAt: new Date(Date.now() - 60000).toISOString() },
          { gestureLabel: "HELLO", confidence: 0.9, senderType: "signer", isSelectedReply: false, createdAt: new Date(Date.now() - 30000).toISOString() },
          { gestureLabel: "GOOD", confidence: 0.7, senderType: "responder", isSelectedReply: true, createdAt: new Date().toISOString() },
        ],
      }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.repeatedClarifications).toBe(1);
  });

  it("tracks low confidence gestures as misunderstood", () => {
    const sessions = [
      makeSession({
        id: "s1",
        messages: [
          { gestureLabel: "HELLO", confidence: 0.3, senderType: "signer", isSelectedReply: false, createdAt: new Date().toISOString() },
          { gestureLabel: "BYE", confidence: 0.4, senderType: "signer", isSelectedReply: false, createdAt: new Date().toISOString() },
          { gestureLabel: "GOOD", confidence: 0.9, senderType: "responder", isSelectedReply: true, createdAt: new Date().toISOString() },
        ],
      }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.misunderstoodGestures).toBe(2);
  });

  it("computes quality index with factors", () => {
    const qIndex = analyzer.computeQualityIndex(0.8, 0.1, 0.05, 0.1, 6);
    expect(qIndex.overall).toBeGreaterThanOrEqual(60);
    expect(qIndex.factors.communicationSuccess).toBe(80);
    expect(qIndex.factors.confidenceQuality).toBe(90);
  });

  it("generates recommendations when metrics are poor", () => {
    const sessions = [
      makeSession({
        id: "s1",
        totalMessages: 1,
        communicationSuccess: null,
        startedAt: new Date().toISOString(),
        messages: [
          { gestureLabel: "HELLO", confidence: 0.3, senderType: "signer", isSelectedReply: false, createdAt: new Date().toISOString() },
        ],
      }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it("has empty top misunderstood for clean sessions", () => {
    const sessions = [
      makeSession({
        id: "s1",
        messages: [
          { gestureLabel: "HELLO", confidence: 0.9, senderType: "signer", isSelectedReply: false, createdAt: new Date().toISOString() },
          { gestureLabel: "GOOD", confidence: 0.8, senderType: "responder", isSelectedReply: true, createdAt: new Date().toISOString() },
        ],
      }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.topMisunderstoodGestures.length).toBe(0);
  });

  it("calculates average response time", () => {
    const baseMs = Date.now();
    const sessions = [
      makeSession({
        id: "s1",
        messages: [
          { gestureLabel: "HELLO", confidence: 0.9, senderType: "signer", isSelectedReply: false, createdAt: new Date(baseMs - 60000).toISOString() },
          { gestureLabel: "GOOD", confidence: 0.8, senderType: "responder", isSelectedReply: true, createdAt: new Date(baseMs - 30000).toISOString() },
          { gestureLabel: "BYE", confidence: 0.95, senderType: "signer", isSelectedReply: false, createdAt: new Date(baseMs).toISOString() },
        ],
      }),
    ];
    const report = analyzer.analyze(sessions);
    expect(report.averageResponseTime).toBeGreaterThan(0);
  });
});
