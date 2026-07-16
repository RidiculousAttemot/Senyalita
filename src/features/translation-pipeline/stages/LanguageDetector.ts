import type { LanguageDetectionResult, DetectedLanguage } from "../types";
import type { LanguageDetector as ILanguageDetector } from "../interfaces";

const TAGALOG_MARKERS = new Set([
  "ang", "ng", "sa", "ay", "ako", "ikaw", "siya", "tayo", "kami", "kayo",
  "sila", "ito", "iyan", "iyon", "opo", "oo", "hindi", "po", "salamat",
  "maganda", "pakiusap", "kumusta", "kamusta", "mabuti", "sige", "ba", "na", "pa",
  "din", "rin", "daw", "raw", "kasi", "kaya", "para", "may", "mayroon",
  "wala", "meron", "ating", "inyo", "kanila", "dito", "doon", "roon",
  "ganyan", "ganoon", "ganito", "saan", "ilan", "gaano", "bakit", "ano",
  "sino", "kailan", "paano", "oo", "hindi", "talaga", "lang", "lamang",
  "muna", "ulit", "naman", "pala", "yata", "kaya", "sana", "daw", "raw",
  "puede", "pwede", "sige", "tara", "halika", "e", "a", "naku", "aray",
  "susmaryosep", "aba", "oye", "hoy", "psst",
  "magandang", "tanghali", "umaga", "hapon", "gabi", "tanghali",
  "kain", "tulog", "luto", "laba", "linis", "laro", "takbo", "lakad",
  "lapit", "alis", "uwi", "punta", "bili", "bigay", "kuha", "hanap",
  "bukas", "sarado", "init", "lamig", "gutom", "uhaw", "pagod",
  "masaya", "malungkot", "galit", "takot", "lungkot", "tuwa",
  "ninyo", "natin", "namin", "nila", "niya", "ko", "mo",
]);

const ENGLISH_MARKERS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "out",
  "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "because", "but", "and", "or", "if", "while", "about", "against",
  "between", "through", "during", "before", "after", "above", "below",
  "from", "up", "down", "in", "out", "on", "off", "over", "under",
  "again", "then", "once", "here", "there", "what", "which", "who",
  "whom", "this", "that", "these", "those", "am",
]);

export class LanguageDetectorService implements ILanguageDetector {
  readonly name = "LanguageDetector";

  detect(_input: string, words: string[]): LanguageDetectionResult {
    const tlScore = words.filter((w) => TAGALOG_MARKERS.has(w)).length;
    const enScore = words.filter((w) => ENGLISH_MARKERS.has(w)).length;
    const total = words.length;

    if (total === 0) {
      return { language: "en", confidence: 0 };
    }

    const tlRatio = tlScore / total;
    const enRatio = enScore / total;

    if (tlRatio > enRatio && tlRatio >= 0.25) {
      return { language: "tl", confidence: Math.min(tlRatio + 0.1, 1) };
    }

    if (enRatio > tlRatio && enRatio >= 0.25) {
      return { language: "en", confidence: Math.min(enRatio + 0.1, 1) };
    }

    if (tlRatio >= 0.15 && enRatio >= 0.15) {
      return { language: "mixed", confidence: (tlRatio + enRatio) / 2 };
    }

    if (tlRatio > 0) {
      return { language: "tl", confidence: tlRatio };
    }

    return { language: "en", confidence: Math.max(enRatio, 0.3) };
  }
}

export const defaultLanguageDetector = new LanguageDetectorService();
