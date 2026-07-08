type GrammarRule = {
  pattern: RegExp;
  replacement: string | ((match: RegExpExecArray) => string);
};

export type TranslationConfig = {
  language: "en" | "tl";
};

const ENGLISH_GRAMMAR_RULES: GrammarRule[] = [
  { pattern: /\bI WANT\b/g, replacement: "I would like" },
  { pattern: /\bI NEED\b/g, replacement: "I need" },
  { pattern: /\bPLEASE\b/g, replacement: "please" },
  { pattern: /\bTHANK YOU\b/g, replacement: "thank you" },
  { pattern: /\bIM FINE\b/g, replacement: "I'm fine" },
  { pattern: /\bNICE TO MEET YOU\b/g, replacement: "nice to meet you" },
  { pattern: /\bHOW ARE YOU\b/g, replacement: "how are you" },
  { pattern: /\bYOURE WELCOME\b/g, replacement: "you're welcome" },
  { pattern: /\bSEE YOU TOMORROW\b/g, replacement: "see you tomorrow" },
  { pattern: /\bGOOD MORNING\b/g, replacement: "good morning" },
  { pattern: /\bGOOD AFTERNOON\b/g, replacement: "good afternoon" },
  { pattern: /\bGOOD EVENING\b/g, replacement: "good evening" },
  { pattern: /\bDON'T UNDERSTAND\b/g, replacement: "I don't understand" },
  { pattern: /\bDON'T KNOW\b/g, replacement: "I don't know" },
  { pattern: /\bHARD OF HEARING\b/g, replacement: "hard of hearing" },
  { pattern: /\bWHEELCHAIR PERSON\b/g, replacement: "wheelchair person" },
  { pattern: /\bDEAF BLIND\b/g, replacement: "deaf-blind" },
  { pattern: /\bNO SUGAR\b/g, replacement: "no sugar" },
  { pattern: /\b(NO|YES|WRONG|CORRECT|SLOW|FAST|HOT|COLD|LIGHT|DARK)\b/g, replacement: (m: RegExpExecArray) => m[1].toLowerCase() },
];

const TAGALOG_GRAMMAR_RULES: GrammarRule[] = [
  { pattern: /\bTHANK YOU\b/g, replacement: "salamat" },
  { pattern: /\bYOURE WELCOME\b/g, replacement: "walang anuman" },
  { pattern: /\bHELLO\b/g, replacement: "kumusta" },
  { pattern: /\bGOOD MORNING\b/g, replacement: "magandang umaga" },
  { pattern: /\bGOOD AFTERNOON\b/g, replacement: "magandang hapon" },
  { pattern: /\bGOOD EVENING\b/g, replacement: "magandang gabi" },
  { pattern: /\bHOW ARE YOU\b/g, replacement: "kamusta ka" },
  { pattern: /\bIM FINE\b/g, replacement: "mabuti naman" },
  { pattern: /\bNICE TO MEET YOU\b/g, replacement: "ikinagagalak kong makilala ka" },
  { pattern: /\bSEE YOU TOMORROW\b/g, replacement: "hanggang bukas" },
  { pattern: /\bPLEASE\b/g, replacement: "pakiusap" },
  { pattern: /\bI WANT\b/g, replacement: "gusto ko" },
  { pattern: /\bI NEED\b/g, replacement: "kailangan ko" },
  { pattern: /\bUNDERSTAND\b/g, replacement: "naiintindihan" },
  { pattern: /\bDON'T UNDERSTAND\b/g, replacement: "hindi naiintindihan" },
  { pattern: /\bDON'T KNOW\b/g, replacement: "hindi alam" },
  { pattern: /\b(NO|YES)\b/g, replacement: (m: RegExpExecArray) => m[1] === "NO" ? "hindi" : "oo" },
  { pattern: /\bFATHER\b/g, replacement: "tatay" },
  { pattern: /\bMOTHER\b/g, replacement: "nanay" },
  { pattern: /\bSON\b/g, replacement: "anak na lalaki" },
  { pattern: /\bDAUGHTER\b/g, replacement: "anak na babae" },
  { pattern: /\bGRANDFATHER\b/g, replacement: "lolo" },
  { pattern: /\bGRANDMOTHER\b/g, replacement: "lola" },
  { pattern: /\bUNCLE\b/g, replacement: "tiyo" },
  { pattern: /\bAUNTIE\b/g, replacement: "tiya" },
  { pattern: /\bCOUSIN\b/g, replacement: "pinsan" },
  { pattern: /\bPARENTS\b/g, replacement: "magulang" },
  { pattern: /\bBOY\b/g, replacement: "lalaki" },
  { pattern: /\bGIRL\b/g, replacement: "babae" },
  { pattern: /\bMAN\b/g, replacement: "lalaki" },
  { pattern: /\bWOMAN\b/g, replacement: "babae" },
  { pattern: /\bDEAF\b/g, replacement: "bingi" },
  { pattern: /\bHARD OF HEARING\b/g, replacement: "mahina ang pandinig" },
  { pattern: /\bBLIND\b/g, replacement: "bulag" },
  { pattern: /\bMARRIED\b/g, replacement: "kasal" },
  { pattern: /\bBLUE\b/g, replacement: "asul" },
  { pattern: /\bGREEN\b/g, replacement: "berde" },
  { pattern: /\bRED\b/g, replacement: "pula" },
  { pattern: /\bBROWN\b/g, replacement: "kayumanggi" },
  { pattern: /\bBLACK\b/g, replacement: "itim" },
  { pattern: /\bWHITE\b/g, replacement: "puti" },
  { pattern: /\bYELLOW\b/g, replacement: "dilaw" },
  { pattern: /\bORANGE\b/g, replacement: "kahel" },
  { pattern: /\bGRAY\b/g, replacement: "abo" },
  { pattern: /\bPINK\b/g, replacement: "rosas" },
  { pattern: /\bVIOLET\b/g, replacement: "lila" },
  { pattern: /\bBREAD\b/g, replacement: "tinapay" },
  { pattern: /\bEGG\b/g, replacement: "itlog" },
  { pattern: /\bFISH\b/g, replacement: "isda" },
  { pattern: /\bMEAT\b/g, replacement: "karne" },
  { pattern: /\bCHICKEN\b/g, replacement: "manok" },
  { pattern: /\bSPAGHETTI\b/g, replacement: "ispageti" },
  { pattern: /\bRICE\b/g, replacement: "kanin" },
  { pattern: /\bLONGANISA\b/g, replacement: "longanisa" },
  { pattern: /\bSHRIMP\b/g, replacement: "hipon" },
  { pattern: /\bCRAB\b/g, replacement: "alimasag" },
  { pattern: /\bHOT\b/g, replacement: "mainit" },
  { pattern: /\bCOLD\b/g, replacement: "malamig" },
  { pattern: /\bJUICE\b/g, replacement: "katas" },
  { pattern: /\bMILK\b/g, replacement: "gatas" },
  { pattern: /\bCOFFEE\b/g, replacement: "kape" },
  { pattern: /\bTEA\b/g, replacement: "tsaa" },
  { pattern: /\bBEER\b/g, replacement: "serbesa" },
  { pattern: /\bWINE\b/g, replacement: "alak" },
  { pattern: /\bSUGAR\b/g, replacement: "asukal" },
  { pattern: /\bNO SUGAR\b/g, replacement: "walang asukal" },
  { pattern: /\bONE\b/g, replacement: "isa" },
  { pattern: /\bTWO\b/g, replacement: "dalawa" },
  { pattern: /\bTHREE\b/g, replacement: "tatlo" },
  { pattern: /\bFOUR\b/g, replacement: "apat" },
  { pattern: /\bFIVE\b/g, replacement: "lima" },
  { pattern: /\bSIX\b/g, replacement: "anim" },
  { pattern: /\bSEVEN\b/g, replacement: "pito" },
  { pattern: /\bEIGHT\b/g, replacement: "walo" },
  { pattern: /\bNINE\b/g, replacement: "siyam" },
  { pattern: /\bTEN\b/g, replacement: "sampu" },
  { pattern: /\bMONDAY\b/g, replacement: "Lunes" },
  { pattern: /\bTUESDAY\b/g, replacement: "Martes" },
  { pattern: /\bWEDNESDAY\b/g, replacement: "Miyerkules" },
  { pattern: /\bTHURSDAY\b/g, replacement: "Huwebes" },
  { pattern: /\bFRIDAY\b/g, replacement: "Biyernes" },
  { pattern: /\bSATURDAY\b/g, replacement: "Sabado" },
  { pattern: /\bSUNDAY\b/g, replacement: "Linggo" },
  { pattern: /\bJANUARY\b/g, replacement: "Enero" },
  { pattern: /\bFEBRUARY\b/g, replacement: "Pebrero" },
  { pattern: /\bMARCH\b/g, replacement: "Marso" },
  { pattern: /\bAPRIL\b/g, replacement: "Abril" },
  { pattern: /\bMAY\b/g, replacement: "Mayo" },
  { pattern: /\bJUNE\b/g, replacement: "Hunyo" },
  { pattern: /\bJULY\b/g, replacement: "Hulyo" },
  { pattern: /\bAUGUST\b/g, replacement: "Agosto" },
  { pattern: /\bSEPTEMBER\b/g, replacement: "Setyembre" },
  { pattern: /\bOCTOBER\b/g, replacement: "Oktubre" },
  { pattern: /\bNOVEMBER\b/g, replacement: "Nobyembre" },
  { pattern: /\bDECEMBER\b/g, replacement: "Disyembre" },
  { pattern: /\bTODAY\b/g, replacement: "ngayon" },
  { pattern: /\bTOMORROW\b/g, replacement: "bukas" },
  { pattern: /\bYESTERDAY\b/g, replacement: "kahapon" },
];

function applyGrammarRules(text: string, rules: GrammarRule[]): string {
  let result = text;
  for (const rule of rules) {
    result = result.replace(rule.pattern, rule.replacement as string);
  }
  return result;
}

function capitalizeFirst(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function addSentencePunctuation(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (![".", "!", "?", ","].includes(lastChar)) {
    if (/^(how|what|where|when|why|who|which|can|do|is|are|will|would|could|should|may|have|has|does)\b/i.test(trimmed)) {
      return trimmed + "?";
    }
    return trimmed + ".";
  }
  return trimmed;
}

function normalizeLabel(label: string): string {
  return label.replace(/['']/g, "'").toUpperCase();
}

export class NaturalLanguageEngine {
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.config = config;
  }

  setLanguage(language: "en" | "tl"): void {
    this.config.language = language;
  }

  getLanguage(): "en" | "tl" {
    return this.config.language;
  }

  translate(gestureLabels: string[]): { raw: string; natural: string; language: string } {
    const normalized = gestureLabels.map(normalizeLabel);
    const raw = normalized.join(" ");

    if (this.config.language === "tl") {
      const natural = this.translateToTagalog(normalized);
      return { raw, natural: capitalizeFirst(natural), language: "tl" };
    }

    const natural = this.translateToEnglish(normalized);
    return { raw, natural: capitalizeFirst(natural), language: "en" };
  }

  private translateToEnglish(labels: string[]): string {
    let raw = labels.join(" ");
    raw = applyGrammarRules(raw, ENGLISH_GRAMMAR_RULES);

    const words = raw.split(/\s+/).map(w => w.toLowerCase());
    if (words.length > 0) {
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    }

    const joined = words.join(" ");
    return addSentencePunctuation(joined);
  }

  private translateToTagalog(labels: string[]): string {
    let raw = labels.join(" ");
    raw = applyGrammarRules(raw, TAGALOG_GRAMMAR_RULES);

    const words = raw.split(/\s+/).map(w => w.toLowerCase());
    if (words.length > 0) {
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    }

    const joined = words.join(" ");
    return addSentencePunctuation(joined);
  }

  translateSingle(label: string, language?: "en" | "tl"): string {
    const lang = language ?? this.config.language;
    const normalized = normalizeLabel(label);
    if (lang === "tl") {
      return applyGrammarRules(normalized, TAGALOG_GRAMMAR_RULES).toLowerCase();
    }
    return applyGrammarRules(normalized, ENGLISH_GRAMMAR_RULES).toLowerCase();
  }
}
