import { ContextMessage, ConversationIntent } from "./types";

const MAX_CONTEXT_SIZE = 10;

export class ContextMemory {
  private messages: ContextMessage[] = [];

  addMessage(
    gestureLabel: string,
    translatedText: string,
    confidence: number,
    intent?: ConversationIntent
  ): void {
    this.messages.push({
      gestureLabel,
      translatedText,
      confidence,
      timestamp: Date.now(),
      intent,
    });

    if (this.messages.length > MAX_CONTEXT_SIZE) {
      this.messages.shift();
    }
  }

  getContext(): ContextMessage[] {
    return [...this.messages];
  }

  getRecentContext(count = 3): ContextMessage[] {
    return this.messages.slice(-count);
  }

  clearContext(): void {
    this.messages = [];
  }

  get size(): number {
    return this.messages.length;
  }

  hasContent(): boolean {
    return this.messages.length > 0;
  }

  getTopics(): string[] {
    const topics: string[] = [];
    for (const msg of this.messages) {
      if (msg.intent && msg.intent !== "Unknown" && !topics.includes(msg.intent)) {
        topics.push(msg.intent);
      }
    }
    return topics;
  }
}
