import { InferenceResult } from "./model";

const LABEL_DISPLAY: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  h: "H",
  i: "I",
  j: "J",
  k: "K",
  l: "L",
  m: "M",
  n: "N",
  "ñ": "Ñ",
  ng: "NG",
  o: "O",
  p: "P",
  q: "Q",
  r: "R",
  s: "S",
  t: "T",
  u: "U",
  v: "V",
  w: "W",
  x: "X",
  y: "Y",
  z: "Z"
};

export const translateLabel = (label: string): string => {
  return LABEL_DISPLAY[label] ?? label.toUpperCase();
};

export const translateResult = (result: InferenceResult): InferenceResult => {
  return {
    label: translateLabel(result.label),
    labelId: result.labelId,
    confidence: result.confidence,
    topK: result.topK.map((item) => ({
      label: translateLabel(item.label),
      confidence: item.confidence
    }))
  };
};
