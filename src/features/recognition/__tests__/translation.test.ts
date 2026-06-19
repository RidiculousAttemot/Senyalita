import { describe, it, expect } from "vitest";
import { translateLabel, translateResult, classifyLabel } from "../translation";
import type { InferenceResult } from "../model";

describe("translateLabel", () => {
  it("uppercases known alphabet labels", () => {
    expect(translateLabel("a")).toBe("A");
    expect(translateLabel("z")).toBe("Z");
    expect(translateLabel("m")).toBe("M");
  });

  it("handles ñ and ng", () => {
    expect(translateLabel("ñ")).toBe("Ñ");
    expect(translateLabel("ng")).toBe("NG");
  });

  it("converts FSL-105 gesture labels to display form", () => {
    expect(translateLabel("GOOD MORNING")).toBe("Good Morning");
    expect(translateLabel("THANK YOU")).toBe("Thank You");
    expect(translateLabel("HOW ARE YOU")).toBe("How Are You");
    expect(translateLabel("NO")).toBe("No");
    expect(translateLabel("YES")).toBe("Yes");
    expect(translateLabel("HARD OF HEARING")).toBe("Hard of Hearing");
    expect(translateLabel("DEAF BLIND")).toBe("Deaf-Blind");
    expect(translateLabel("NO SUGAR")).toBe("No Sugar");
  });

  it("falls back to raw label for unknown entries", () => {
    expect(translateLabel("UNKNOWN_LABEL")).toBe("UNKNOWN_LABEL");
    expect(translateLabel("42")).toBe("42");
  });
});

describe("translateResult", () => {
  it("translates the top label and all topK suggestions", () => {
    const input: InferenceResult = {
      label: "GOOD MORNING",
      labelId: 28,
      confidence: 0.9,
      topK: [
        { label: "GOOD MORNING", confidence: 0.9 },
        { label: "GOOD AFTERNOON", confidence: 0.05 }
      ]
    };
    const out = translateResult(input);
    expect(out.label).toBe("Good Morning");
    expect(out.topK[0].label).toBe("Good Morning");
    expect(out.topK[1].label).toBe("Good Afternoon");
  });

  it("preserves confidence, labelId, and category", () => {
    const input: InferenceResult = {
      label: "x",
      labelId: 23,
      confidence: 0.42,
      topK: []
    };
    const out = translateResult(input);
    expect(out.labelId).toBe(23);
    expect(out.confidence).toBe(0.42);
  });
});

describe("classifyLabel", () => {
  it("classifies single lowercase letters as alphabet", () => {
    expect(classifyLabel("a")).toBe("alphabet");
    expect(classifyLabel("z")).toBe("alphabet");
    expect(classifyLabel("m")).toBe("alphabet");
  });

  it("classifies ñ and ng as alphabet", () => {
    expect(classifyLabel("ñ")).toBe("alphabet");
    expect(classifyLabel("ng")).toBe("alphabet");
  });

  it("classifies multi-word phrases as phrase", () => {
    expect(classifyLabel("GOOD MORNING")).toBe("phrase");
    expect(classifyLabel("THANK YOU")).toBe("phrase");
    expect(classifyLabel("HARD OF HEARING")).toBe("phrase");
    expect(classifyLabel("NO SUGAR")).toBe("phrase");
  });

  it("classifies single-word FSL-105 labels as phrase", () => {
    expect(classifyLabel("HELLO")).toBe("phrase");
    expect(classifyLabel("UNDERSTAND")).toBe("phrase");
    expect(classifyLabel("FATHER")).toBe("phrase");
    expect(classifyLabel("BLUE")).toBe("phrase");
  });

  it("classifies unknown labels as phrase", () => {
    expect(classifyLabel("UNKNOWN")).toBe("phrase");
    expect(classifyLabel("123")).toBe("phrase");
  });
});
