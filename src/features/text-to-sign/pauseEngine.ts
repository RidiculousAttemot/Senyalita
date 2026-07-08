export interface PauseConfig {
  sentenceEnd: number;
  comma: number;
  question: number;
  exclamation: number;
  colon: number;
  semicolon: number;
  interWord: number;
  emphasisBefore: number;
  emphasisAfter: number;
}

const DEFAULT_PAUSE_CONFIG: PauseConfig = {
  sentenceEnd: 0.8,
  comma: 0.35,
  question: 0.6,
  exclamation: 0.6,
  colon: 0.4,
  semicolon: 0.4,
  interWord: 0.08,
  emphasisBefore: 0.15,
  emphasisAfter: 0.25,
};

export class PauseEngine {
  private config: PauseConfig;

  constructor(config?: Partial<PauseConfig>) {
    this.config = { ...DEFAULT_PAUSE_CONFIG, ...config };
  }

  getPauseDuration(
    currentWord: string,
    nextWord: string,
    originalText: string,
    currentIndex: number,
    totalWords: number,
  ): number {
    if (!nextWord) return 0;

    const between = this.getTextBetween(currentWord, nextWord, originalText);
    const punctPause = this.getPunctuationPause(between);
    if (punctPause > 0) return punctPause;

    if (this.isEmphasisWord(currentWord)) return this.config.emphasisAfter;
    if (this.isEmphasisWord(nextWord)) return this.config.emphasisBefore;

    if (currentIndex === totalWords - 2) return this.config.sentenceEnd * 0.6;

    return this.config.interWord;
  }

  getSentencePause(intent: string): number {
    switch (intent) {
      case "question": return this.config.question;
      case "farewell": return this.config.sentenceEnd * 1.2;
      case "greeting": return this.config.sentenceEnd * 1.1;
      default: return this.config.sentenceEnd;
    }
  }

  private getTextBetween(a: string, b: string, text: string): string {
    const idxA = text.toLowerCase().indexOf(a.toLowerCase());
    const idxB = text.toLowerCase().indexOf(b.toLowerCase(), idxA + 1);
    if (idxA < 0 || idxB < 0) return "";
    return text.slice(idxA + a.length, idxB);
  }

  private getPunctuationPause(between: string): number {
    if (/[?]/.test(between)) return this.config.question;
    if (/[!]/.test(between)) return this.config.exclamation;
    if (/[.]/.test(between)) return this.config.sentenceEnd;
    if (/[,]/.test(between)) return this.config.comma;
    if (/[:]/.test(between)) return this.config.colon;
    if (/[;]/.test(between)) return this.config.semicolon;
    return 0;
  }

  private isEmphasisWord(word: string): boolean {
    const emphasis = ["very", "really", "so", "too", "extremely", "absolutely", "totally", "truly"];
    return emphasis.includes(word.toLowerCase());
  }

  updateConfig(config: Partial<PauseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PauseConfig {
    return { ...this.config };
  }
}

export const globalPauseEngine = new PauseEngine();
