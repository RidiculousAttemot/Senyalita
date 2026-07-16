import type { ExpressionTag, DetectedLanguage } from "../types";
import type { ExpressionController as IExpressionController } from "../interfaces";

interface ExpressionRule {
  glosses: string[];
  categories: string[];
  keywords: string[];
  tag: ExpressionTag;
  priority: number;
}

const EXPRESSION_RULES: ExpressionRule[] = [
  { glosses: ["HELLO", "HI", "HEY", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING"], categories: ["greeting"], keywords: ["hello", "hi", "hey"], tag: "happy", priority: 100 },
  { glosses: ["THANK YOU", "THANKS", "SALAMAT", "YOURE WELCOME"], categories: ["politeness"], keywords: ["thank", "thanks", "salamat"], tag: "happy", priority: 90 },
  { glosses: ["CONGRATULATIONS", "CONGRATS", "WOW", "AMAZING", "GREAT", "EXCELLENT"], categories: [], keywords: ["congratulations", "congrats", "wow", "amazing", "great"], tag: "happy", priority: 100 },
  { glosses: ["HAPPY", "MASAPA", "JOY", "GLAD", "WONDERFUL", "FANTASTIC"], categories: ["emotion"], keywords: ["happy", "glad", "joy", "masaya"], tag: "happy", priority: 80 },
  { glosses: ["SAD", "MALUNGKOT", "LUNGKOT", "UNHAPPY", "DEPRESSED"], categories: [], keywords: ["sad", "malungkot", "lungkot", "unhappy"], tag: "sad", priority: 80 },
  { glosses: ["ANGRY", "GALIT", "MAGALIT", "FURIOUS", "MAD"], categories: [], keywords: ["angry", "galit", "magalit", "furious", "mad"], tag: "angry", priority: 80 },
  { glosses: ["WHY", "WHAT", "WHERE", "WHEN", "WHO", "HOW", "WHICH"], categories: ["question"], keywords: ["why", "what", "where", "when", "who", "how", "?", "ba", "saan", "ano", "bakit", "kailan", "paano", "sino"], tag: "questioning", priority: 100 },
  { glosses: ["SURPRISED", "SURPRISE", "SHOCKED", "ASTONISHED", "AMAZED"], categories: [], keywords: ["surprise", "shock", "astonish", "amaze", "wow"], tag: "surprised", priority: 80 },
  { glosses: ["YES", "YEP", "YEAH", "SURE", "OKAY", "OK", "CORRECT", "RIGHT", "TRUE", "AGREE"], categories: ["affirmation"], keywords: ["yes", "yeah", "yep", "sure", "okay", "ok", "correct", "right", "true", "agree", "oo", "opo"], tag: "nodding", priority: 70 },
  { glosses: ["NO", "NOPE", "NOT", "DONT", "WONT", "CANT", "INCORRECT", "WRONG", "FALSE", "DISAGREE"], categories: ["negation"], keywords: ["no", "nope", "not", "dont", "wont", "cant", "incorrect", "wrong", "false", "disagree", "hindi", "ayaw"], tag: "shaking", priority: 70 },
  { glosses: ["HELP", "STOP", "DANGER", "WARNING", "FIRE", "EMERGENCY"], categories: [], keywords: ["help", "stop", "danger", "warning", "fire", "emergency", "tulong"], tag: "emphatic", priority: 100 },
  { glosses: ["I LOVE YOU", "LOVE", "MAHAL", "CARE", "ADORE"], categories: [], keywords: ["love", "mahal", "care", "adore", "i love you"], tag: "happy", priority: 90 },
];

export class ExpressionControllerService implements IExpressionController {
  readonly name = "ExpressionController";

  getExpressionTag(gloss: string, _context: string, _language: DetectedLanguage): ExpressionTag {
    const upper = gloss.toUpperCase();

    for (const rule of EXPRESSION_RULES) {
      if (rule.glosses.includes(upper)) return rule.tag;
    }

    return "neutral";
  }

  getExpressionTags(glosses: string[], _language: DetectedLanguage): ExpressionTag[] {
    const questionCount = glosses.filter((g) => {
      const upper = g.toUpperCase();
      return ["WHY", "WHAT", "WHERE", "WHEN", "WHO", "HOW", "WHICH", "?"].includes(upper);
    }).length;

    const happyCount = glosses.filter((g) => {
      const upper = g.toUpperCase();
      return ["HELLO", "HI", "THANK YOU", "CONGRATULATIONS", "HAPPY", "LOVE", "WOW"].includes(upper);
    }).length;

    const dominantEmotion: ExpressionTag =
      questionCount > happyCount ? "questioning"
      : happyCount > 0 ? "happy"
      : "neutral";

    return glosses.map((g) => {
      const tag = this.getExpressionTag(g, glosses.join(" "), _language);
      return tag === "neutral" ? dominantEmotion : tag;
    });
  }
}

export const defaultExpressionController = new ExpressionControllerService();
