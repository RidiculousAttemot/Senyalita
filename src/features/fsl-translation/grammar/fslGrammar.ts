import type { GrammarRule, DetectedLanguage } from "../types";

const DEFAULT_RULES: GrammarRule[] = [
  {
    name: "question-subject-object",
    pattern: ["HOW", "ARE", "YOU"],
    replacement: ["YOU", "HOW"],
    priority: 100,
    languages: ["en", "mixed"],
    description: "How are you → YOU HOW",
  },
  {
    name: "question-what",
    pattern: ["WHAT", "IS", "YOUR", "NAME"],
    replacement: ["NAME", "YOUR", "WHAT"],
    priority: 90,
    languages: ["en", "mixed"],
    description: "What is your name → NAME YOUR WHAT",
  },
  {
    name: "question-where",
    pattern: ["WHERE", "IS"],
    replacement: ["WHERE"],
    priority: 80,
    languages: ["en", "mixed"],
    description: "Where is → WHERE (location implied)",
  },
  {
    name: "i-am-happy",
    pattern: ["I", "AM", "HAPPY"],
    replacement: ["I", "HAPPY"],
    priority: 70,
    languages: ["en", "mixed"],
    description: "I am happy → I HAPPY",
  },
  {
    name: "i-am-tired",
    pattern: ["I", "AM", "TIRED"],
    replacement: ["I", "TIRED"],
    priority: 70,
    languages: ["en", "mixed"],
    description: "I am tired → I TIRED",
  },
  {
    name: "i-need",
    pattern: ["I", "NEED"],
    replacement: ["NEED", "I"],
    priority: 90,
    languages: ["en", "mixed"],
    description: "I need → NEED I",
  },
  {
    name: "i-want",
    pattern: ["I", "WANT"],
    replacement: ["WANT", "I"],
    priority: 90,
    languages: ["en", "mixed"],
    description: "I want → WANT I",
  },
  {
    name: "i-have",
    pattern: ["I", "HAVE"],
    replacement: ["HAVE", "I"],
    priority: 90,
    languages: ["en", "mixed"],
    description: "I have → HAVE I",
  },
  {
    name: "my-name",
    pattern: ["MY", "NAME"],
    replacement: ["NAME", "MY"],
    priority: 90,
    languages: ["en", "mixed"],
    description: "My name → NAME MY",
  },
  {
    name: "nice-to-meet",
    pattern: ["NICE", "TO", "MEET", "YOU"],
    replacement: ["NICE", "MEET", "YOU"],
    priority: 85,
    languages: ["en", "mixed"],
    description: "Nice to meet you → NICE MEET YOU",
  },
  {
    name: "subject-adjective",
    pattern: ["I", "AM", "VERY"],
    replacement: ["I", "VERY"],
    priority: 60,
    languages: ["en", "mixed"],
    description: "I am very → I VERY (partial)",
  },
  {
    name: "time-first",
    pattern: ["TODAY"],
    replacement: ["TODAY"],
    priority: 50,
    languages: ["en", "mixed", "tl"],
    description: "Time markers go first in FSL",
  },
  {
    name: "time-first-tomorrow",
    pattern: ["TOMORROW"],
    replacement: ["TOMORROW"],
    priority: 50,
    languages: ["en", "mixed", "tl"],
    description: "Time markers go first in FSL",
  },
  {
    name: "time-first-yesterday",
    pattern: ["YESTERDAY"],
    replacement: ["YESTERDAY"],
    priority: 50,
    languages: ["en", "mixed", "tl"],
    description: "Time markers go first in FSL",
  },
  {
    name: "very-before-adjective",
    pattern: ["VERY"],
    replacement: ["VERY"],
    priority: 40,
    languages: ["en", "mixed"],
    description: "VERY stays before adjective in FSL",
  },
  {
    name: "subject-object-verb-tl",
    pattern: ["AKO", "AY"],
    replacement: ["I"],
    priority: 95,
    languages: ["tl"],
    description: "Ako ay → I (simplify)",
  },
  {
    name: "question-tagalog-saan",
    pattern: ["SAAN"],
    replacement: ["WHERE"],
    priority: 80,
    languages: ["tl"],
    description: "Saan → WHERE",
  },
  {
    name: "question-tagalog-bakit",
    pattern: ["BAKIT"],
    replacement: ["WHY"],
    priority: 80,
    languages: ["tl"],
    description: "Bakit → WHY",
  },
  {
    name: "tagalog-salamat",
    pattern: ["SALAMAT"],
    replacement: ["THANK", "YOU"],
    priority: 90,
    languages: ["tl"],
    description: "Salamat → THANK YOU",
  },
  {
    name: "remove-ay",
    pattern: ["AY"],
    replacement: [],
    priority: 100,
    languages: ["tl", "mixed"],
    description: "Remove inversion marker 'ay'",
  },
  {
    name: "remove-ba",
    pattern: ["BA"],
    replacement: [],
    priority: 100,
    languages: ["tl", "mixed"],
    description: "Remove question marker 'ba'",
  },
  {
    name: "remove-po",
    pattern: ["PO"],
    replacement: [],
    priority: 100,
    languages: ["tl", "mixed"],
    description: "Remove politeness marker 'po' for gloss",
  },
  {
    name: "remove-opo",
    pattern: ["OPO"],
    replacement: ["YES"],
    priority: 90,
    languages: ["tl", "mixed"],
    description: "Opo → YES",
  },
  {
    name: "tagalog-maganda",
    pattern: ["MAGANDA"],
    replacement: ["BEAUTIFUL"],
    priority: 80,
    languages: ["tl"],
    description: "Maganda → BEAUTIFUL",
  },
  {
    name: "tagalog-mabuti",
    pattern: ["MABUTI"],
    replacement: ["GOOD"],
    priority: 80,
    languages: ["tl"],
    description: "Mabuti → GOOD",
  },
  {
    name: "tagalog-kumusta",
    pattern: ["KUMUSTA"],
    replacement: ["HOW", "ARE", "YOU"],
    priority: 90,
    languages: ["tl"],
    description: "Kumusta → HOW ARE YOU",
  },
  {
    name: "tagalog-ayaw",
    pattern: ["AYAW"],
    replacement: ["DONT", "WANT"],
    priority: 80,
    languages: ["tl"],
    description: "Ayaw → DONT WANT",
  },
  {
    name: "tagalog-gusto",
    pattern: ["GUSTO"],
    replacement: ["WANT"],
    priority: 80,
    languages: ["tl"],
    description: "Gusto → WANT",
  },
  {
    name: "tagalog-puede",
    pattern: ["PWEDE", "PUEDE"],
    replacement: ["CAN"],
    priority: 80,
    languages: ["tl"],
    description: "Puede/Pwede → CAN",
  },
  {
    name: "negation-hindi",
    pattern: ["HINDI"],
    replacement: ["NO", "NOT"],
    priority: 80,
    languages: ["tl"],
    description: "Hindi → NO",
  },
  {
    name: "possessive-ko",
    pattern: ["KO"],
    replacement: ["MY"],
    priority: 70,
    languages: ["tl"],
    description: "Ko → MY",
  },
  {
    name: "possessive-mo",
    pattern: ["MO"],
    replacement: ["YOUR"],
    priority: 70,
    languages: ["tl"],
    description: "Mo → YOUR",
  },
  {
    name: "you-question-tl",
    pattern: ["KA"],
    replacement: ["YOU"],
    priority: 70,
    languages: ["tl"],
    description: "Ka → YOU",
  },
  {
    name: "time-phrase",
    pattern: ["SEE", "YOU", "TOMORROW"],
    replacement: ["SEE", "YOU", "TOMORROW"],
    priority: 85,
    languages: ["en", "mixed"],
    description: "See you tomorrow stays as-is",
  },
  {
    name: "article-removal",
    pattern: ["THE", "A", "AN"],
    replacement: [],
    priority: 100,
    languages: ["en", "mixed"],
    description: "Remove English articles",
  },
];

export function getGrammarRules(): GrammarRule[] {
  return [...DEFAULT_RULES];
}

export function addGrammarRule(rule: GrammarRule): void {
  DEFAULT_RULES.push(rule);
  DEFAULT_RULES.sort((a, b) => b.priority - a.priority);
}

export function clearGrammarRules(): void {
  DEFAULT_RULES.length = 0;
}

export function resetGrammarRules(): void {
  DEFAULT_RULES.length = 0;
  DEFAULT_RULES.push(...getDefaultRules());
}

function getDefaultRules(): GrammarRule[] {
  return [...DEFAULT_RULES];
}

export function applyGrammarRules(
  glossTokens: string[],
  language: DetectedLanguage,
  rules?: GrammarRule[],
): string[] {
  const activeRules = (rules ?? DEFAULT_RULES)
    .filter((r) => r.languages.includes(language) || r.languages.includes("mixed"))
    .sort((a, b) => b.priority - a.priority);

  let result = [...glossTokens];
  let changed = true;

  while (changed) {
    changed = false;
    for (const rule of activeRules) {
      for (let i = 0; i <= result.length - rule.pattern.length; i++) {
        const slice = result.slice(i, i + rule.pattern.length);
        if (arraysMatch(slice, rule.pattern)) {
          result = [
            ...result.slice(0, i),
            ...rule.replacement,
            ...result.slice(i + rule.pattern.length),
          ];
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return result;
}

function arraysMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val.toUpperCase() === b[i].toUpperCase());
}
