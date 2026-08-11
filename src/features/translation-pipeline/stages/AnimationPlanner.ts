import type { OptimizedGloss, AnimationPlan, AnimationPlanItem, TimelineSegment, TimelineTransition, DetectedLanguage, ExpressionTag } from "../types";
import type { AnimationPlanner as IAnimationPlanner } from "../interfaces";

export interface AnimationPlannerConfig {
  baseDuration: number;
  transitionDuration: number;
  pauseBetweenGlosses: number;
  pauseAfterSentence: number;
  pauseAfterQuestion: number;
  pauseAfterExclamation: number;
  fingerspellingSpeed: number;
  expressionDuration: number;
}

const DEFAULT_CONFIG: AnimationPlannerConfig = {
  baseDuration: 1.5,
  transitionDuration: 0.2,
  pauseBetweenGlosses: 0.15,
  pauseAfterSentence: 0.6,
  pauseAfterQuestion: 0.5,
  pauseAfterExclamation: 0.5,
  fingerspellingSpeed: 0.8,
  expressionDuration: 0.3,
};

const PAUSE_GLOSSES = new Set([",", ".", "!", "?", ";", ":"]);

const CATEGORY_PAUSE_MAP: Record<string, number> = {
  greeting: 0.4,
  farewell: 0.5,
  question: 0.5,
  affirmation: 0.2,
  negation: 0.2,
  politeness: 0.3,
  emotion: 0.3,
  number: 0.1,
  alphabet: 0.1,
};

const EXPRESSION_BY_GLOSS: Record<string, ExpressionTag> = {
  "HELLO": "happy",
  "HI": "happy",
  "GOOD MORNING": "happy",
  "GOOD AFTERNOON": "happy",
  "GOOD EVENING": "happy",
  "THANK YOU": "happy",
  "THANKS": "happy",
  "SALAMAT": "happy",
  "CONGRATULATIONS": "happy",
  "HAPPY": "happy",
  "SAD": "sad",
  "ANGRY": "angry",
  "MALUNGKOT": "sad",
  "GALIT": "angry",
  "WHY": "questioning",
  "WHAT": "questioning",
  "WHERE": "questioning",
  "WHEN": "questioning",
  "WHO": "questioning",
  "HOW": "questioning",
  "SURPRISED": "surprised",
  "WOW": "surprised",
  "AMAZING": "surprised",
  "YES": "nodding",
  "NO": "shaking",
  "DONT": "shaking",
  "STOP": "emphatic",
  "HELP": "emphatic",
  "DANGER": "emphatic",
  "WARNING": "emphatic",
  "I LOVE YOU": "happy",
  "MAHAL": "happy",
  "LOVE": "happy",
};

const EXPRESSION_BY_CATEGORY: Record<string, ExpressionTag> = {
  greeting: "happy",
  farewell: "happy",
  question: "questioning",
  emotion: "happy",
  politeness: "happy",
  affirmation: "nodding",
  negation: "shaking",
};

export class AnimationPlannerService implements IAnimationPlanner {
  readonly name = "AnimationPlanner";
  private config: AnimationPlannerConfig;

  constructor(config?: Partial<AnimationPlannerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  plan(glosses: OptimizedGloss[], _language: DetectedLanguage): AnimationPlan {
    const items: AnimationPlanItem[] = [];
    const segments: TimelineSegment[] = [];
    const transitions: TimelineTransition[] = [];
    let currentTime = 0;

    for (let i = 0; i < glosses.length; i++) {
      const gloss = glosses[i];
      const duration = this.getDuration(gloss);
      const expressionTag = this.resolveExpression(gloss);
      const isFingerspelling = gloss.strategy === "fingerspelling";
      const isPlaceholder = gloss.strategy === "placeholder" || gloss.strategy === "fallback";

      const item: AnimationPlanItem = {
        gloss: gloss.gloss,
        original: gloss.original,
        animationKey: gloss.animationKey ?? gloss.gloss,
        confidence: gloss.confidence,
        startTime: currentTime + (i > 0 ? this.config.transitionDuration : 0),
        duration,
        endTime: currentTime + duration + (i > 0 ? this.config.transitionDuration : 0),
        transitionIn: i > 0 ? this.config.transitionDuration : 0,
        transitionOut: this.config.transitionDuration,
        playbackSpeed: isFingerspelling ? this.config.fingerspellingSpeed : 1.0,
        loop: isPlaceholder,
        loopCount: isPlaceholder ? 2 : 0,
        expressionTag,
        action: "play",
        fallbackUsed: isPlaceholder,
        fallbackReason: isPlaceholder ? "No animation asset found for gloss" : undefined,
      };

      items.push(item);

      segments.push({
        startTime: item.startTime,
        endTime: item.endTime,
        gloss: item.gloss,
        type: item.fallbackUsed ? "transition" : "gesture",
        label: item.gloss,
      });

      if (i > 0) {
        transitions.push({
          fromGloss: glosses[i - 1].gloss,
          toGloss: gloss.gloss,
          startTime: items[i - 1].endTime,
          duration: this.config.transitionDuration,
          blendType: "ease",
        });
      }

      currentTime = item.endTime;

      if (i < glosses.length - 1) {
        const pauseDuration = this.getPauseBetween(glosses[i], glosses[i + 1]);
        if (pauseDuration > 0) {
          segments.push({
            startTime: currentTime,
            endTime: currentTime + pauseDuration,
            gloss: "PAUSE",
            type: "pause",
            label: "",
          });
          currentTime += pauseDuration;
        }
      }
    }

    return {
      items,
      totalDuration: currentTime,
      timeline: { segments, transitions },
    };
  }

  private getDuration(gloss: OptimizedGloss): number {
    if (gloss.strategy === "fingerspelling") return this.config.fingerspellingSpeed;
    return this.config.baseDuration;
  }

  private getPauseBetween(current: OptimizedGloss, next: OptimizedGloss): number {
    const catPause = CATEGORY_PAUSE_MAP[current.category ?? ""];
    if (catPause !== undefined) return catPause;
    return this.config.pauseBetweenGlosses;
  }

  private resolveExpression(gloss: OptimizedGloss): ExpressionTag {
    if (gloss.expressionTag) return gloss.expressionTag;

    const directExpr = EXPRESSION_BY_GLOSS[gloss.gloss.toUpperCase()];
    if (directExpr) return directExpr;

    const catExpr = EXPRESSION_BY_CATEGORY[gloss.category ?? ""];
    if (catExpr) return catExpr;

    return "neutral";
  }

  setConfig(config: Partial<AnimationPlannerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const defaultAnimationPlanner = new AnimationPlannerService();
