import type { SentenceSegment } from "../types";
import type { SentenceSegmenter as ISentenceSegmenter } from "../interfaces";

export class SentenceSegmenterService implements ISentenceSegmenter {
  readonly name = "SentenceSegmenter";

  segment(input: string): SentenceSegment[] {
    const segments: SentenceSegment[] = [];
    const rawSegments = input.split(/(?<=[.!?])\s*/);

    let index = 0;
    for (const raw of rawSegments) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      let type: SentenceSegment["type"] = "declarative";
      if (trimmed.endsWith("?")) type = "interrogative";
      else if (trimmed.endsWith("!")) type = "exclamatory";
      else if (/^(please|pakiusap|can|could|will|would)/i.test(trimmed)) type = "imperative";

      segments.push({
        text: trimmed.replace(/[.!?]$/, "").trim(),
        index,
        type,
      });
      index++;
    }

    if (segments.length === 0) {
      segments.push({
        text: input.trim(),
        index: 0,
        type: "declarative",
      });
    }

    return segments;
  }
}

export const defaultSentenceSegmenter = new SentenceSegmenterService();
