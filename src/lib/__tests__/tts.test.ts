import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Tts,
  isSupported,
  getTts,
  __resetTtsForTests
} from "../tts";

type FakeVoice = Partial<SpeechSynthesisVoice> & {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
};

const installFakeSpeech = (voices: FakeVoice[]) => {
  const handlers: Array<() => void> = [];
  const fakeSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices as unknown as SpeechSynthesisVoice[]),
    addEventListener: (event: string, cb: () => void) => {
      if (event === "voiceschanged") handlers.push(cb);
    },
    _triggerVoicesChanged: () => handlers.forEach((h) => h())
  };
  const fakeUtteranceCtor = vi.fn(function (this: Record<string, unknown>) {
    return this;
  });

  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    },
    document: {},
    speechSynthesis: fakeSynthesis,
    SpeechSynthesisUtterance: fakeUtteranceCtor
  };

  return { fakeSynthesis, fakeUtteranceCtor, handlers };
};

const removeFakeSpeech = () => {
  delete (globalThis as unknown as { window?: unknown }).window;
};

beforeEach(() => {
  localStorage.clear();
  __resetTtsForTests();
});

afterEach(() => {
  removeFakeSpeech();
});

describe("tts — environment checks", () => {
  it("isSupported returns false when window.speechSynthesis is absent", () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      document: {},
      localStorage: window.localStorage
    };
    expect(isSupported()).toBe(false);
  });

  it("isSupported returns true when both APIs are present", () => {
    installFakeSpeech([]);
    expect(isSupported()).toBe(true);
  });
});

describe("Tts — voice management", () => {
  it("getVoices returns an empty array when no voices are available", () => {
    installFakeSpeech([]);
    const tts = new Tts();
    expect(tts.getVoices()).toEqual([]);
  });

  it("getVoices maps the underlying SpeechSynthesisVoice shape", () => {
    const voices: FakeVoice[] = [
      { name: "Alex", lang: "en-US", voiceURI: "uri-alex", localService: true },
      { name: "Samantha", lang: "en-GB", voiceURI: "uri-samantha", localService: false }
    ];
    installFakeSpeech(voices);
    const tts = new Tts();
    const result = tts.getVoices();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "Alex",
      lang: "en-US",
      voiceURI: "uri-alex",
      localService: true
    });
  });

  it("setVoice persists the choice to localStorage", () => {
    installFakeSpeech([
      { name: "Alex", lang: "en-US", voiceURI: "uri-alex", localService: true }
    ]);
    const tts = new Tts();
    tts.setVoice("uri-alex");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "fsl_tts_voice_uri",
      "uri-alex"
    );
  });

  it("setVoice(null) clears the persisted choice", () => {
    installFakeSpeech([]);
    const tts = new Tts();
    tts.setVoice(null);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith("fsl_tts_voice_uri");
  });
});

describe("Tts — speak / cancel", () => {
  it("speak returns false when the API is unavailable", () => {
    const minimalLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      document: {},
      localStorage: minimalLocalStorage
    };
    const tts = new Tts();
    expect(tts.speak("hello")).toBe(false);
  });

  it("speak returns false for empty text", () => {
    installFakeSpeech([]);
    const tts = new Tts();
    expect(tts.speak("")).toBe(false);
    expect(tts.speak("   ")).toBe(false);
  });

  it("speak cancels the previous utterance and speaks the new one", () => {
    const voices: FakeVoice[] = [
      { name: "Alex", lang: "en-US", voiceURI: "uri-alex", localService: true }
    ];
    const { fakeSynthesis, fakeUtteranceCtor } = installFakeSpeech(voices);
    const tts = new Tts();
    tts.setVoice("uri-alex");
    const ok = tts.speak("Hello world");
    expect(ok).toBe(true);
    expect(fakeSynthesis.cancel).toHaveBeenCalled();
    expect(fakeSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(fakeUtteranceCtor).toHaveBeenCalled();
  });

  it("speak applies the provided options", () => {
    const voices: FakeVoice[] = [
      { name: "Alex", lang: "en-US", voiceURI: "uri-alex", localService: true }
    ];
    const { fakeSynthesis } = installFakeSpeech(voices);
    const tts = new Tts();
    tts.speak("Hello", { lang: "en-GB", pitch: 0.8, rate: 1.5, volume: 0.5 });
    const spokenArg = (fakeSynthesis.speak.mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(spokenArg.text).toBe("Hello");
    expect(spokenArg.lang).toBe("en-GB");
    expect(spokenArg.pitch).toBe(0.8);
    expect(spokenArg.rate).toBe(1.5);
    expect(spokenArg.volume).toBe(0.5);
  });

  it("cancel delegates to speechSynthesis.cancel", () => {
    const { fakeSynthesis } = installFakeSpeech([]);
    const tts = new Tts();
    tts.cancel();
    expect(fakeSynthesis.cancel).toHaveBeenCalled();
  });
});

describe("Tts — async voice loading", () => {
  it("listVoicesAsync resolves with current voices", async () => {
    const voices: FakeVoice[] = [
      { name: "Alex", lang: "en-US", voiceURI: "uri-alex", localService: true }
    ];
    const { fakeSynthesis } = installFakeSpeech(voices);
    fakeSynthesis.getVoices.mockReturnValueOnce([] as unknown as SpeechSynthesisVoice[]).mockReturnValueOnce(voices as unknown as SpeechSynthesisVoice[]);
    const tts = new Tts();
    const promise = tts.listVoicesAsync();
    const fake = fakeSynthesis as unknown as { _triggerVoicesChanged: () => void };
    fake._triggerVoicesChanged();
    const list = await promise;
    expect(list).toHaveLength(1);
    expect(list[0].voiceURI).toBe("uri-alex");
  });

  it("listVoicesAsync uses onvoiceschanged when addEventListener is absent", async () => {
    const voices: FakeVoice[] = [
      { name: "Samantha", lang: "en-GB", voiceURI: "uri-sam", localService: true }
    ];
    const handlers: Array<() => void> = [];
    const fakeSynthesis: Record<string, unknown> = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [] as unknown as SpeechSynthesisVoice[]),
      onvoiceschanged: null
    };
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      document: {},
      speechSynthesis: fakeSynthesis,
      SpeechSynthesisUtterance: vi.fn()
    };
    const tts = new Tts();
    const promise = tts.listVoicesAsync();
    const cb = (fakeSynthesis.onvoiceschanged as () => void) ?? null;
    expect(cb).not.toBeNull();
    fakeSynthesis.getVoices = vi.fn(() => voices as unknown as SpeechSynthesisVoice[]);
    cb();
    const list = await promise;
    expect(list).toHaveLength(1);
    expect(list[0].voiceURI).toBe("uri-sam");
    // suppress unused warning
    void handlers;
  });

  it("uses the first available voice when no preference is set", () => {
    const voices: FakeVoice[] = [
      { name: "First", lang: "en-US", voiceURI: "uri-first", localService: true },
      { name: "Second", lang: "en-GB", voiceURI: "uri-second", localService: false }
    ];
    const { fakeSynthesis } = installFakeSpeech(voices);
    const tts = new Tts();
    tts.speak("Hello");
    const spoken = (fakeSynthesis.speak.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    const voice = spoken.voice as { voiceURI: string } | null;
    expect(voice?.voiceURI).toBe("uri-first");
  });

  it("speak returns false when only SpeechSynthesisUtterance is missing", () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      document: {},
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      speechSynthesis: {
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn()
      }
    };
    const tts = new Tts();
    expect(tts.speak("hi")).toBe(false);
  });
});

describe("Tts — singleton", () => {
  it("getTts returns the same instance across calls", () => {
    installFakeSpeech([]);
    const a = getTts();
    const b = getTts();
    expect(a).toBe(b);
  });

  it("__resetTtsForTests creates a new instance on next getTts", () => {
    installFakeSpeech([]);
    const a = getTts();
    __resetTtsForTests();
    const b = getTts();
    expect(a).not.toBe(b);
  });
});
