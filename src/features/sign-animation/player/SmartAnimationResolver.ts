import type { GestureAnimationAsset, ResolverResult, ResolutionStrategy } from "../types";
import { AnimationLoader } from "../loader/AnimationLoader";
import { normalizeGloss } from "../gloss";

interface SynonymMap {
  [canonical: string]: string[];
}

interface CategoryMap {
  [category: string]: string[];
}

const SYNONYM_MAP: SynonymMap = {
  HELLO: ["HI", "HEY", "GREETINGS", "GOOD_DAY"],
  "HOW_ARE_YOU": ["HOWDY", "WHATSUP", "HELLO_HOW"],
  THANK_YOU: ["THANKS", "THANK", "APPRECIATE", "GRATEFUL"],
  GOODBYE: ["BYE", "SEE_YA", "FAREWELL", "GOOD_BYE"],
  YES: ["YEP", "YEAH", "SURE", "CORRECT", "RIGHT"],
  NO: ["NAH", "NOPE", "WRONG", "INCORRECT", "NEGATIVE"],
  SORRY: ["APOLOGIZE", "FORGIVE", "PARDON"],
  PLEASE: ["PLEASE_HELP", "BEG"],
  HELP: ["ASSIST", "AID", "SUPPORT"],
  STOP: ["HALT", "CEASE", "END"],
  GO: ["MOVE", "WALK", "PROCEED"],
  EAT: ["FOOD", "DINE", "MEAL"],
  DRINK: ["WATER", "THIRSTY", "BEVERAGE"],
  SLEEP: ["TIRED", "REST", "BED"],
  HAPPY: ["GLAD", "JOYFUL", "CHEERFUL", "DELIGHTED"],
  SAD: ["UNHAPPY", "DEPRESSED", "MELANCHOLY"],
  BIG: ["LARGE", "HUGE", "GIANT", "ENORMOUS"],
  SMALL: ["TINY", "LITTLE", "MINIATURE"],
  GOOD: ["GREAT", "EXCELLENT", "WONDERFUL", "FANTASTIC"],
  BAD: ["TERRIBLE", "AWFUL", "HORRIBLE"],
  BEAUTIFUL: ["PRETTY", "LOVELY", "GORGEOUS"],
  UGLY: ["HIDEOUS", "UNATTRACTIVE"],
  FAST: ["QUICK", "RAPID", "SPEEDY"],
  SLOW: ["SLOWLY", "LEISURELY"],
  HOT: ["WARM", "BURNING", "HEAT"],
  COLD: ["FREEZING", "COOL", "CHILLY"],
  LOVE: ["LIKE", "ADORE", "CHERISH"],
  HATE: ["DETEST", "LOATHE", "DISLIKE"],
  MOTHER: ["MOM", "MAMA", "MOTHER_FIGURE"],
  FATHER: ["DAD", "PAPA", "FATHER_FIGURE"],
  SIBLING: ["BROTHER", "SISTER", "SIBLINGS"],
  FRIEND: ["BUDDY", "PAL", "COMPANION"],
  HOUSE: ["HOME", "RESIDENCE", "DWELLING"],
  SCHOOL: ["ACADEMY", "UNIVERSITY", "COLLEGE"],
  WORK: ["JOB", "EMPLOYMENT", "OCCUPATION", "LABOR"],
  MONEY: ["CASH", "FUNDS", "WEALTH"],
  TIME: ["CLOCK", "HOUR", "MOMENT"],
  DAY: ["TODAY", "DAILY", "DAYTIME"],
  NIGHT: ["EVENING", "DARK", "NIGHTTIME"],
  MORNING: ["DAWN", "SUNRISE", "EARLY"],
  AFTERNOON: ["MIDDAY", "NOON"],
  WEATHER: ["RAIN", "SUNNY", "CLOUDY", "STORM"],
  NAME: ["CALLED", "CALL", "NAMED"],
  SIGN: ["SIGN_LANGUAGE", "GESTURE", "SIGNING"],
  UNDERSTAND: ["COMPREHEND", "GET_IT", "FOLLOW"],
  "DONT_KNOW": ["UNKNOWN", "NO_IDEA", "NOT_SURE"],
  "DONT_UNDERSTAND": ["CONFUSED", "NOT_FOLLOW"],
  "NICE_TO_MEET_YOU": ["NICE_MEET", "PLEASED"],
  GOOD_MORNING: ["MORNING_GREETING"],
  GOOD_AFTERNOON: ["AFTERNOON_GREETING"],
  GOOD_EVENING: ["EVENING_GREETING"],
  "I_LOVE_YOU": ["LOVE_YOU", "ILY"],
  SEE_YOU_TOMORROW: ["TOMORROW_SEE", "SEE_TOMORROW"],
  WHAT_IS_YOUR_NAME: ["YOUR_NAME", "NAME_WHAT"],
  PLEASE_HELP_ME: ["HELP_PLEASE", "PLEASE_ASSIST"],
  TAKE_CARE: ["CARE_TAKE", "GOODBYE_CARE"],
};

const CATEGORY_MAP: CategoryMap = {
  greeting: ["HELLO", "HI", "GOOD_MORNING", "GOOD_AFTERNOON", "GOOD_EVENING", "NICE_TO_MEET_YOU", "WELCOME"],
  farewell: ["GOODBYE", "BYE", "SEE_YOU_LATER", "TAKE_CARE", "SEE_YOU_TOMORROW", "GOOD_NIGHT"],
  question_word: ["WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW", "WHICH"],
  politeness: ["PLEASE", "THANK_YOU", "SORRY", "EXCUSE_ME", "PLEASE_HELP_ME", "YOU_ARE_WELCOME"],
  affirmation: ["YES", "SURE", "CORRECT", "RIGHT", "TRUE"],
  negation: ["NO", "WRONG", "INCORRECT", "FALSE", "NEVER"],
  family: ["MOTHER", "FATHER", "SIBLING", "BROTHER", "SISTER", "FAMILY"],
  emotion: ["HAPPY", "SAD", "LOVE", "HATE", "ANGRY", "SURPRISED", "AFRAID"],
  time: ["TIME", "DAY", "NIGHT", "MORNING", "AFTERNOON", "EVENING", "TODAY", "TOMORROW", "YESTERDAY"],
  action: ["GO", "STOP", "COME", "WALK", "RUN", "SIT", "STAND", "EAT", "DRINK", "SLEEP"],
  quality: ["GOOD", "BAD", "BIG", "SMALL", "FAST", "SLOW", "HOT", "COLD", "BEAUTIFUL"],
};

export class SmartAnimationResolver {
  private loader: AnimationLoader;
  private resolutionCache: Map<string, ResolverResult> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private phraseCache: Map<string, ResolverResult> = new Map();

  constructor(loader?: AnimationLoader) {
    this.loader = loader ?? new AnimationLoader();
    this.buildAliasMap();
  }

  private buildAliasMap(): void {
    for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
      for (const syn of synonyms) {
        this.aliasMap.set(syn, canonical);
      }
    }
  }

  async resolve(gloss: string, context?: { categories?: string[] }): Promise<ResolverResult> {
    const key = normalizeGloss(gloss);
    const cached = this.resolutionCache.get(key);
    if (cached) return cached;

    const fallbackChain: string[] = [];

    // Strategy 1: Exact phrase match (multi-word)
    if (key.includes("_") && key.split("_").length > 1) {
      const phraseAsset = await this.loadAsset(key);
      if (phraseAsset) {
        const result: ResolverResult = {
          resolved: true,
          strategy: "exact_phrase",
          originalGloss: gloss,
          resolvedGloss: key,
          asset: phraseAsset,
          confidence: 1,
          fallbackChain: ["exact_phrase"],
        };
        return this.cacheResult(key, result);
      }
      fallbackChain.push("exact_phrase");

      // Strategy 2: Phrase alias
      const phraseCanonical = this.aliasMap.get(key);
      if (phraseCanonical) {
        const aliasAsset = await this.loadAsset(phraseCanonical);
        if (aliasAsset) {
          return this.cacheResult(key, {
            resolved: true,
            strategy: "phrase_alias",
            originalGloss: gloss,
            resolvedGloss: phraseCanonical,
            asset: aliasAsset,
            confidence: 0.9,
            fallbackChain: [...fallbackChain, "phrase_alias"],
          });
        }
        fallbackChain.push("phrase_alias");
      }
    }

    // Strategy 3: Exact gloss match
    const exactAsset = await this.loadAsset(key);
    if (exactAsset) {
      return this.cacheResult(key, {
        resolved: true,
        strategy: "exact_gloss",
        originalGloss: gloss,
        resolvedGloss: key,
        asset: exactAsset,
        confidence: 1,
        fallbackChain: [...fallbackChain, "exact_gloss"],
      });
    }
    fallbackChain.push("exact_gloss");

    // Strategy 4: Gloss alias / synonym lookup
    const canonical = this.aliasMap.get(key);
    if (canonical) {
      const aliasAsset = await this.loadAsset(canonical);
      if (aliasAsset) {
        return this.cacheResult(key, {
          resolved: true,
          strategy: "gloss_alias",
          originalGloss: gloss,
          resolvedGloss: canonical,
          asset: aliasAsset,
          confidence: 0.85,
          fallbackChain: [...fallbackChain, "gloss_alias"],
        });
      }
    }
    fallbackChain.push("gloss_alias");

    // Strategy 5: Synonym (partial match)
    for (const [canonicalKey, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (canonicalKey.includes(key) || key.includes(canonicalKey)) {
        const partialAsset = await this.loadAsset(canonicalKey);
        if (partialAsset) {
          return this.cacheResult(key, {
            resolved: true,
            strategy: "synonym",
            originalGloss: gloss,
            resolvedGloss: canonicalKey,
            asset: partialAsset,
            confidence: 0.7,
            fallbackChain: [...fallbackChain, "synonym"],
          });
        }
      }
      for (const syn of synonyms) {
        if (syn.includes(key) || key.includes(syn)) {
          const synAsset = await this.loadAsset(canonicalKey);
          if (synAsset) {
            return this.cacheResult(key, {
              resolved: true,
              strategy: "synonym",
              originalGloss: gloss,
              resolvedGloss: canonicalKey,
              asset: synAsset,
              confidence: 0.6,
              fallbackChain: [...fallbackChain, "synonym"],
            });
          }
        }
      }
    }
    fallbackChain.push("synonym");

    // Strategy 6: Morphological variants
    const stripped = key.replace(/^(RE_|UN_|DIS_|MIS_|PRE_)/, "").replace(/_(ING|ED|S|ER|EST|LY|TION|MENT|NESS)$/, "");
    if (stripped !== key) {
      const morphAsset = await this.loadAsset(stripped);
      if (morphAsset) {
        return this.cacheResult(key, {
          resolved: true,
          strategy: "morphological",
          originalGloss: gloss,
          resolvedGloss: stripped,
          asset: morphAsset,
          confidence: 0.5,
          fallbackChain: [...fallbackChain, "morphological"],
        });
      }
    }
    fallbackChain.push("morphological");

    // Strategy 7: Category mapping
    if (context?.categories) {
      for (const cat of context.categories) {
        const catEntries = CATEGORY_MAP[cat];
        if (catEntries) {
          for (const entry of catEntries) {
            const catAsset = await this.loadAsset(entry);
            if (catAsset) {
              return this.cacheResult(key, {
                resolved: true,
                strategy: "category_mapping",
                originalGloss: gloss,
                resolvedGloss: entry,
                asset: catAsset,
                confidence: 0.4,
                fallbackChain: [...fallbackChain, "category_mapping"],
              });
            }
          }
        }
      }
    }
    fallbackChain.push("category_mapping");

    return this.cacheResult(key, {
      resolved: false,
      strategy: "unknown_placeholder",
      originalGloss: gloss,
      resolvedGloss: key,
      asset: null,
      confidence: 0,
      fallbackChain,
    });
  }

  private async loadAsset(key: string): Promise<GestureAnimationAsset | null> {
    try {
      return await this.loader.load(key);
    } catch {
      return null;
    }
  }

  private cacheResult(key: string, result: ResolverResult): ResolverResult {
    this.resolutionCache.set(key, result);
    return result;
  }

  isFingerspellFallback(gloss: string): boolean {
    const result = this.resolutionCache.get(normalizeGloss(gloss));
    return !result?.resolved || result.strategy === "unknown_placeholder";
  }

  addSynonym(canonical: string, synonym: string): void {
    const existing = this.aliasMap.get(normalizeGloss(synonym));
    if (!existing) {
      this.aliasMap.set(normalizeGloss(synonym), normalizeGloss(canonical));
    }
  }

  clearCache(): void {
    this.resolutionCache.clear();
    this.phraseCache.clear();
  }

  getCacheStats(): { size: number; hitRate: number } {
    return { size: this.resolutionCache.size, hitRate: this.resolutionCache.size > 0 ? 1 : 0 };
  }
}
