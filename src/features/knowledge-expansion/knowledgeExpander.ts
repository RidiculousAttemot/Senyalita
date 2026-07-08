export type AutoExpansionSuggestion = {
  id: string;
  sourceGesture: string;
  targetGesture: string;
  suggestionType: "definition" | "related_gesture" | "suggested_reply" | "alias";
  content: string;
  confidence: number;
  frequency: number;
  approved: boolean;
  dismissed: boolean;
  createdAt: number;
};

export type ExpansionPattern = {
  from: string;
  to: string;
  count: number;
  contexts: string[];
};

export class KnowledgeBaseAutoExpander {
  private suggestions: AutoExpansionSuggestion[] = [];
  private adminActions: Array<{ gesture: string; action: string; timestamp: number }> = [];
  private storageKey = "fsl_knowledge_expansion";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        this.suggestions = data.suggestions ?? [];
        this.adminActions = data.adminActions ?? [];
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        suggestions: this.suggestions,
        adminActions: this.adminActions,
      }));
    } catch {}
  }

  recordAdminAction(gesture: string, action: string): void {
    this.adminActions.push({ gesture, action, timestamp: Date.now() });
    if (this.adminActions.length > 1000) {
      this.adminActions = this.adminActions.slice(-500);
    }
    this.saveToStorage();
  }

  analyzePatterns(): ExpansionPattern[] {
    const patternCounts = new Map<string, { count: number; contexts: Set<string> }>();

    for (const action of this.adminActions) {
      const key = action.action;
      if (!patternCounts.has(key)) {
        patternCounts.set(key, { count: 0, contexts: new Set() });
      }
      const entry = patternCounts.get(key)!;
      entry.count++;
      entry.contexts.add(action.gesture);
    }

    return Array.from(patternCounts.entries()).map(([action, data]) => ({
      from: Array.from(data.contexts).join(", "),
      to: action,
      count: data.count,
      contexts: Array.from(data.contexts),
    }));
  }

  generateSuggestions(
    gesture: string,
    existingData: {
      category?: string;
      difficulty?: string;
      relatedGestures?: string[];
      suggestedReplies?: string[];
      aliases?: string[];
    }
  ): AutoExpansionSuggestion[] {
    const newSuggestions: AutoExpansionSuggestion[] = [];
    const now = Date.now();

    const patterns = this.analyzePatterns();
    const relevantPatterns = patterns.filter((p) => p.contexts.includes(gesture) || p.count >= 2);

    for (const pattern of relevantPatterns) {
      if (pattern.count >= 3) {
        newSuggestions.push({
          id: `suggest-${now}-${newSuggestions.length}`,
          sourceGesture: gesture,
          targetGesture: gesture,
          suggestionType: "related_gesture",
          content: pattern.to,
          confidence: Math.min(pattern.count * 0.1, 0.9),
          frequency: pattern.count,
          approved: false,
          dismissed: false,
          createdAt: now,
        });
      }
    }

    if (existingData.relatedGestures && existingData.relatedGestures.length > 0) {
      const frequentAct = this.adminActions
        .filter((a) => existingData.relatedGestures!.includes(a.gesture))
        .sort((a, b) => b.timestamp - a.timestamp);

      const actionCounts = new Map<string, number>();
      for (const act of frequentAct) {
        actionCounts.set(act.action, (actionCounts.get(act.action) ?? 0) + 1);
      }

      for (const [action, count] of actionCounts) {
        if (count >= 2 && !existingData.suggestedReplies?.includes(action)) {
          newSuggestions.push({
            id: `suggest-reply-${now}-${newSuggestions.length}`,
            sourceGesture: gesture,
            targetGesture: gesture,
            suggestionType: "suggested_reply",
            content: action,
            confidence: Math.min(count * 0.15, 0.85),
            frequency: count,
            approved: false,
            dismissed: false,
            createdAt: now,
          });
        }
      }
    }

    return newSuggestions;
  }

  approveSuggestion(id: string): void {
    const suggestion = this.suggestions.find((s) => s.id === id);
    if (suggestion) {
      suggestion.approved = true;
      this.saveToStorage();
    }
  }

  dismissSuggestion(id: string): void {
    const suggestion = this.suggestions.find((s) => s.id === id);
    if (suggestion) {
      suggestion.dismissed = true;
      this.saveToStorage();
    }
  }

  getPendingSuggestions(): AutoExpansionSuggestion[] {
    return this.suggestions.filter((s) => !s.approved && !s.dismissed);
  }

  getApprovedSuggestions(): AutoExpansionSuggestion[] {
    return this.suggestions.filter((s) => s.approved);
  }

  getAllSuggestions(): AutoExpansionSuggestion[] {
    return [...this.suggestions];
  }

  clear(): void {
    this.suggestions = [];
    this.adminActions = [];
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const globalKnowledgeExpander = new KnowledgeBaseAutoExpander();
