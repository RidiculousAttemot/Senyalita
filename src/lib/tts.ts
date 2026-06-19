// Web Speech API wrapper. Exposes a small, testable surface:
//   - speak(text): enqueue an utterance
//   - cancel(): cancel any pending or active speech
//   - getVoices(): enumerate available voices
//   - setVoice(uri): pin to a specific voice
//   - isSupported(): false on SSR or in browsers without Web Speech
//
// Designed so the camera page can call `tts.speak(transcript)` after a
// confirmed gesture without worrying about the underlying browser
// quirks (Chrome loads voices asynchronously, Safari ships them, etc.).

export type TtsVoice = {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
};

export type TtsOptions = {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
};

export interface SpeechSynthesisLike {
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener?: (event: "voiceschanged", cb: () => void) => void;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  lang: string;
  pitch: number;
  rate: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export interface SpeechSynthesisCtor {
  new (): SpeechSynthesisLike;
  cancel: () => void;
  speak: (u: SpeechSynthesisUtteranceLike) => void;
}

const PREFERRED_VOICE_URI_KEY = "fsl_tts_voice_uri";

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.document !== "undefined";

const getSynthesis = (): SpeechSynthesisLike | null => {
  if (!isBrowser()) return null;
  const w = window as unknown as {
    speechSynthesis?: SpeechSynthesisLike;
  };
  return w.speechSynthesis ?? null;
};

const getUtteranceCtor = (): SpeechSynthesisCtor | null => {
  if (!isBrowser()) return null;
  const w = window as unknown as {
    SpeechSynthesisUtterance?: SpeechSynthesisCtor;
  };
  return w.SpeechSynthesisUtterance ?? null;
};

export const isSupported = (): boolean =>
  Boolean(getSynthesis() && getUtteranceCtor());

const loadPreferredVoiceUri = (): string | null => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(PREFERRED_VOICE_URI_KEY);
  } catch {
    return null;
  }
};

const savePreferredVoiceUri = (uri: string | null): void => {
  if (!isBrowser()) return;
  try {
    if (uri) {
      window.localStorage.setItem(PREFERRED_VOICE_URI_KEY, uri);
    } else {
      window.localStorage.removeItem(PREFERRED_VOICE_URI_KEY);
    }
  } catch {
    /* localStorage may be disabled — ignore */
  }
};

const waitForVoices = (synth: SpeechSynthesisLike): Promise<SpeechSynthesisVoice[]> =>
  new Promise((resolve) => {
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", () => {
        resolve(synth.getVoices());
      });
      return;
    }
    const previous = (synth as unknown as { onvoiceschanged: (() => void) | null })
      .onvoiceschanged;
    (synth as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged =
      () => {
        if (previous) previous();
        resolve(synth.getVoices());
      };
  });

export class Tts {
  private synth: SpeechSynthesisLike | null;
  private Utterance: SpeechSynthesisCtor | null;
  private voiceUri: string | null;
  private voiceCache: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synth = getSynthesis();
    this.Utterance = getUtteranceCtor();
    this.voiceUri = loadPreferredVoiceUri();
  }

  private createUtterance(): SpeechSynthesisUtteranceLike | null {
    if (!this.Utterance) return null;
    return new this.Utterance() as unknown as SpeechSynthesisUtteranceLike;
  }

  private resolveVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    if (this.voiceCache.length === 0) {
      this.voiceCache = this.synth.getVoices();
    }
    if (this.voiceUri) {
      const found = this.voiceCache.find((v) => v.voiceURI === this.voiceUri);
      if (found) return found;
    }
    if (this.voiceCache.length > 0) {
      return this.voiceCache[0] ?? null;
    }
    return null;
  }

  isSupported(): boolean {
    return Boolean(this.synth && this.Utterance);
  }

  getVoices(): TtsVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices().map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      localService: v.localService
    }));
  }

  setVoice(uri: string | null): void {
    this.voiceUri = uri;
    this.voiceCache = [];
    savePreferredVoiceUri(uri);
  }

  cancel(): void {
    this.synth?.cancel();
  }

  async listVoicesAsync(): Promise<TtsVoice[]> {
    if (!this.synth) return [];
    const voices = await waitForVoices(this.synth);
    this.voiceCache = voices;
    return voices.map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      localService: v.localService
    }));
  }

  speak(text: string, opts: TtsOptions = {}): boolean {
    if (!this.isSupported()) return false;
    if (!text || !text.trim()) return false;

    this.Utterance = getUtteranceCtor();
    if (!this.Utterance) return false;

    const synth = this.synth;
    if (!synth) return false;

    const utterance = this.createUtterance();
    if (!utterance) return false;
    utterance.text = text;
    utterance.lang = opts.lang ?? "en-US";
    utterance.pitch = opts.pitch ?? 1.0;
    utterance.rate = opts.rate ?? 1.0;
    utterance.volume = opts.volume ?? 1.0;
    utterance.voice = this.resolveVoice();

    synth.cancel();
    synth.speak(utterance as unknown as SpeechSynthesisUtterance);
    return true;
  }
}

let singleton: Tts | null = null;

export const getTts = (): Tts => {
  if (!singleton) singleton = new Tts();
  return singleton;
};

export const __resetTtsForTests = (): void => {
  singleton = null;
};
