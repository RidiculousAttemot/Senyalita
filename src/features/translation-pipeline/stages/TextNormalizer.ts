import type { NormalizationResult } from "../types";
import type { TextNormalizer as ITextNormalizer } from "../interfaces";

const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{231A}-\u{23CF}]/gu;

const REPEATED_LETTER_PATTERN = /(.)\1{3,}/g;

const ABBREVIATIONS: Record<string, string> = {
  "u": "you", "ur": "your", "r": "are", "y": "why", "k": "okay",
  "thx": "thanks", "ty": "thank you",
  "btw": "by the way", "idk": "i dont know", "idc": "i dont care",
  "imo": "in my opinion", "tbh": "to be honest", "lol": "laughing",
  "omg": "oh my god", "bc": "because", "cuz": "because",
  "gonna": "going to", "wanna": "want to", "gotta": "got to",
  "lemme": "let me", "gimme": "give me", "kinda": "kind of",
  "sorta": "sort of", "lotsa": "lots of", "outta": "out of",
  "dunno": "dont know", "gotcha": "got you", "brb": "be right back",
  "l8r": "later", "2day": "today", "2moro": "tomorrow",
  "2nite": "tonight", "4got": "forgot", "4give": "forgive",
  "msg": "message", "ez": "easy",
  "asap": "as soon as possible", "fyi": "for your information",
  "ttyl": "talk to you later", "jk": "just kidding",
  "np": "no problem", "nvm": "never mind", "omw": "on my way",
  "tysm": "thank you so much", "yw": "youre welcome",
  "rn": "right now", "afk": "away from keyboard",
  "bday": "birthday", "bf": "boyfriend", "gf": "girlfriend",
  "fr": "for real", "ik": "i know", "ily": "i love you",
  "lmao": "laughing", "rofl": "laughing", "smh": "shaking my head",
  "wtf": "what", "wth": "what", "gtg": "got to go",
  "hmu": "hit me up", "dm": "direct message",
  "pics": "pictures", "pic": "picture", "info": "information",
  "tho": "though", "thru": "through", "nite": "night",
};

// Exported so the dictionary can index the same expansions it will be queried
// with. The normalizer turns "dont" into "do not" before lookup happens, so a
// key stored only in its contracted form is unreachable -- "i dont know" was
// listed and could never match.
export const CONTRACTIONS: Record<string, string> = {
  "don't": "do not", "dont": "do not", "can't": "cannot", "cant": "cannot",
  "won't": "will not", "wont": "will not", "isn't": "is not", "isnt": "is not",
  "aren't": "are not", "arent": "are not", "wasn't": "was not", "wasnt": "was not",
  "weren't": "were not", "werent": "were not", "hasn't": "has not", "hasnt": "has not",
  "haven't": "have not", "havent": "have not", "hadn't": "had not", "hadnt": "had not",
  "doesn't": "does not", "doesnt": "does not", "didn't": "did not", "didnt": "did not",
  "couldn't": "could not", "couldnt": "could not", "shouldn't": "should not", "shouldnt": "should not",
  "wouldn't": "would not", "wouldnt": "would not", "mightn't": "might not", "mightnt": "might not",
  "mustn't": "must not", "mustnt": "must not",
  "i'm": "i am", "im": "i am", "you're": "you are", "youre": "you are",
  "he's": "he is", "hes": "he is", "she's": "she is", "shes": "she is",
  "it's": "it is", "its": "it is", "we're": "we are",
  "they're": "they are", "theyre": "they are",
  "i've": "i have", "ive": "i have", "you've": "you have", "youve": "you have",
  "we've": "we have", "weve": "we have", "they've": "they have", "theyve": "they have",
  "i'll": "i will", "ill": "i will", "you'll": "you will", "youll": "you will",
  "he'll": "he will", "hell": "he will", "she'll": "she will", "shell": "she will",
  "we'll": "we will", "well": "we will", "they'll": "they will", "theyll": "they will",
  "i'd": "i would", "id": "i would", "you'd": "you would", "youd": "you would",
  "he'd": "he would", "hed": "he would", "she'd": "she would", "shed": "she would",
  "we'd": "we would", "wed": "we would", "they'd": "they would", "theyd": "they would",
  "ain't": "is not", "aint": "is not",
  "needa": "need to", "coulda": "could have",
  "shoulda": "should have", "woulda": "would have", "mighta": "might have",
  "musta": "must have",
};

const FILIPINO_SPELLING_VARIANTS: Record<string, string> = {
  "kumusta": "kamusta", "cge": "sige", "c": "si", "k": "ka",
  "mg": "mga", "meron": "may", "wala": "wala",
  "ung": "ang", "ung mga": "ang mga", "sakin": "sa akin",
  "sken": "sa akin", "skn": "sa akin", "tyo": "tayo",
  "kse": "kasi", "kz": "kasi", "ksi": "kasi",
  "dahil": "kasi", "kase": "kasi",
  "daw": "raw", "rin": "din", "parang": "parang",
  "kya": "kaya",
  "anu": "ano", "snu": "sino", "knlan": "kailan",
  "sn": "saan", "bkt": "bakit", "pno": "paano",
  "gnun": "ganun", "gnito": "ganito", "gnyn": "ganyan",
  "pra": "para", "skl": "share ko lang",
  "emi": "emote", "q": "ako",
  "ngiti": "ngiti", "tau": "tayo", "kme": "kami",
  "kmo": "kayo", "sla": "sila", "sya": "siya",
  "lng": "lang", "sna": "sana",
  "nman": "naman", "nmn": "naman",
  "khit": "kahit", "mkhit": "makahit", "prang": "parang",
  "w8": "wait", "2morow": "tomorrow",
};

/** A token that is only sentence punctuation — never a gloss to look up. */
const PUNCTUATION_ONLY = /^[,.!?;:]+$/;

export class TextNormalizerService implements ITextNormalizer {
  readonly name = "TextNormalizer";

  normalize(input: string): NormalizationResult {
    let cleaned = input.trim();

    cleaned = cleaned.replace(EMOJI_PATTERN, " ");
    cleaned = cleaned.replace(REPEATED_LETTER_PATTERN, "$1$1");

    // Split sentence punctuation off the word it is attached to, rather than
    // deleting it.
    //
    // Attached, "kamusta ka?" tokenises as ["kamusta", "ka?"], so the second
    // word is looked up as the gloss KA? and fetched from
    // /api/animations/KA%3F, which 404s — "ka" loses its sign purely because
    // it ended a question, while "kamusta" one word earlier gets one.
    //
    // Deleting it instead would be wrong in the other direction: `normalized`
    // is rebuilt from these tokens and SentenceSegmenter reads a trailing "?"
    // to mark a sentence interrogative, and AnimationPlanner keeps these
    // characters as PAUSE_GLOSSES. Separated, the word is looked up clean and
    // the mark still reaches both.
    cleaned = cleaned.replace(/([,.!?;:])/g, " $1 ");

    // Everything else that is not a word character, space, apostrophe, hyphen
    // or accented letter goes.
    //
    // The hyphen is escaped, and that is the entire fix: unescaped, `'-ñ` is a
    // RANGE from U+0027 to U+00F1 — 203 code points — so rather than allowing
    // the two literals ' and -, it whitelisted , . : ; ? @ ( ) and nearly all
    // of ASCII punctuation. Only ! and #, which sort below ', were ever
    // actually stripped, which is why this looked like it worked.
    cleaned = cleaned.replace(/[^\w\s'\-ñáéíóúàèìòùäëïöüâêîôû,.!?;:]/g, " ");
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    let words = cleaned.toLowerCase().split(/\s+/);

    words = words
      .map((w) => w.replace(/^['"]+|['"]+$/g, ""))
      .filter((w) => w.length > 0);

    words = words.map((w) => {
      if (FILIPINO_SPELLING_VARIANTS[w]) return FILIPINO_SPELLING_VARIANTS[w];
      return w;
    });

    words = words.map((w) => {
      if (CONTRACTIONS[w]) return CONTRACTIONS[w];
      return w;
    });

    words = words.map((w) => {
      if (ABBREVIATIONS[w]) return ABBREVIATIONS[w];
      return w;
    });

    words = words.flatMap((w) => w.split(/\s+/));

    // Built before punctuation is dropped, because the two consumers want
    // different things: SentenceSegmenter reads `normalized` and decides a
    // sentence is interrogative from a trailing "?", while the translator
    // reads `words` and would otherwise look "?" up as a gloss and fetch
    // /api/animations/? for it.
    //
    // AnimationPlanner declares a PAUSE_GLOSSES set for exactly these
    // characters, but nothing reads it — so punctuation reaching the planner
    // does not become a pause, it becomes a failed asset request.
    const normalized = words.join(" ");

    words = words.filter((w) => !PUNCTUATION_ONLY.test(w));

    return {
      original: input.trim(),
      normalized,
      cleaned,
      words,
    };
  }
}

export const defaultTextNormalizer = new TextNormalizerService();
