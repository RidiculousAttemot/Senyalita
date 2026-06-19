export type RecognitionMode = "auto" | "alphabet-practice" | "conversation";

export type ModeConfig = {
  label: string;
  description: string;
  recommended: boolean;
};

export const MODE_CONFIGS: Record<RecognitionMode, ModeConfig> = {
  auto: { label: "Auto", description: "System automatically chooses the best approach", recommended: true },
  "alphabet-practice": { label: "Alphabet Practice", description: "Optimized for letters and handshapes", recommended: false },
  conversation: { label: "Conversation Mode", description: "Optimized for phrases and communication gestures", recommended: false },
};

export const DEFAULT_MODE: RecognitionMode = "auto";

export class ModeManager {
  private mode: RecognitionMode = DEFAULT_MODE;

  getMode(): RecognitionMode {
    return this.mode;
  }

  setMode(mode: RecognitionMode): void {
    this.mode = mode;
  }

  reset(): void {
    this.mode = DEFAULT_MODE;
  }

  getWeight(mode: RecognitionMode, category: "alphabet" | "phrase"): number {
    switch (mode) {
      case "auto":
        return 1.0;
      case "alphabet-practice":
        return category === "alphabet" ? 1.3 : 0.9;
      case "conversation":
        return category === "phrase" ? 1.3 : 0.9;
    }
  }
}
