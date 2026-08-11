import type { DictionaryEntry } from "../types";
import { CONTRACTIONS } from "@/features/translation-pipeline/stages/TextNormalizer";

/** Applies the same contraction expansion the normalizer does, word by word. */
function expandContractions(form: string): string {
  return form
    .toLowerCase()
    .split(/\s+/)
    .map((w) => CONTRACTIONS[w] ?? w)
    .join(" ")
    .trim();
}

// Exported so tests can walk every entry rather than naming cases by hand.
export const BUILT_IN_DICTIONARY: DictionaryEntry[] = [
  { label: "HELLO", gloss: "HELLO", synonyms: ["hi", "hey", "hello", "kumusta"], english: ["hello"], filipino: ["kumusta", "hello"], category: "greeting", animationAsset: "HELLO", referenceVideo: undefined, suggestedReplies: ["HELLO", "HOW ARE YOU", "GOOD MORNING"] },
  { label: "GOOD MORNING", gloss: "GOOD MORNING", synonyms: ["morning"], english: ["good morning", "morning"], filipino: ["magandang umaga"], category: "greeting", animationAsset: "GOOD MORNING", suggestedReplies: ["GOOD MORNING", "HOW ARE YOU"] },
  { label: "GOOD AFTERNOON", gloss: "GOOD AFTERNOON", synonyms: ["afternoon"], english: ["good afternoon", "afternoon"], filipino: ["magandang hapon"], category: "greeting", animationAsset: "GOOD AFTERNOON", suggestedReplies: ["GOOD AFTERNOON", "HOW ARE YOU"] },
  { label: "GOOD EVENING", gloss: "GOOD EVENING", synonyms: ["evening"], english: ["good evening", "evening"], filipino: ["magandang gabi"], category: "greeting", animationAsset: "GOOD EVENING", suggestedReplies: ["GOOD EVENING", "HOW ARE YOU"] },
  { label: "HOW ARE YOU", gloss: "HOW ARE YOU", synonyms: ["how are you", "kumusta", "kamusta"], english: ["how are you", "how are you doing"], filipino: ["kumusta", "kamusta"], category: "greeting", animationAsset: "HOW ARE YOU", suggestedReplies: ["IM FINE", "FINE", "GOOD"] },
  { label: "IM FINE", gloss: "IM FINE", synonyms: ["fine", "im fine", "i'm fine", "okay", "mabuti"], english: ["i am fine", "i'm fine", "fine"], filipino: ["mabuti naman", "fine"], category: "greeting", animationAsset: "IM FINE", suggestedReplies: ["THANK YOU", "HOW ARE YOU"] },
  { label: "NICE TO MEET YOU", gloss: "NICE TO MEET YOU", synonyms: ["nice to meet you", "nice meeting you"], english: ["nice to meet you"], filipino: ["ikinagagalak kong makilala ka"], category: "greeting", animationAsset: "NICE TO MEET YOU", suggestedReplies: ["NICE TO MEET YOU", "HELLO"] },
  { label: "SEE YOU TOMORROW", gloss: "SEE YOU TOMORROW", synonyms: ["see you tomorrow", "see you"], english: ["see you tomorrow", "see you later"], filipino: ["kitakits", "paalam"], category: "farewell", animationAsset: "SEE YOU TOMORROW", suggestedReplies: ["SEE YOU TOMORROW", "BYE"] },
  { label: "THANK YOU", gloss: "THANK YOU", synonyms: ["thanks", "thank you", "thank", "salamat", "ty"], english: ["thank you", "thanks"], filipino: ["salamat"], category: "politeness", animationAsset: "THANK YOU", suggestedReplies: ["YOURE WELCOME", "WELCOME"] },
  { label: "YOURE WELCOME", gloss: "YOURE WELCOME", synonyms: ["youre welcome", "you're welcome", "welcome", "walang anuman"], english: ["you're welcome", "you are welcome"], filipino: ["walang anuman"], category: "politeness", animationAsset: "YOURE WELCOME", suggestedReplies: ["THANK YOU"] },
  { label: "PLEASE", gloss: "PLEASE", synonyms: ["please", "pls", "plz", "pakiusap"], english: ["please"], filipino: ["pakiusap"], category: "politeness", animationAsset: undefined, suggestedReplies: ["THANK YOU", "YES"] },
  { label: "SORRY", gloss: "SORRY", synonyms: ["sorry", "apologize", "patawad", "pasensya"], english: ["sorry", "i'm sorry"], filipino: ["pasensya", "patawad"], category: "politeness", animationAsset: undefined, suggestedReplies: ["ITS OKAY", "NO PROBLEM"] },
  { label: "YES", gloss: "YES", synonyms: ["yes", "yeah", "yep", "sure", "okay", "ok", "oo", "opo"], english: ["yes", "yeah", "okay"], filipino: ["oo", "opo"], category: "affirmation", animationAsset: "YES", suggestedReplies: ["YES", "GOOD"] },
  { label: "NO", gloss: "NO", synonyms: ["no", "nope", "hindi"], english: ["no", "nope"], filipino: ["hindi"], category: "negation", animationAsset: "NO", suggestedReplies: ["NO", "OKAY"] },
  { label: "WRONG", gloss: "WRONG", synonyms: ["wrong", "incorrect", "mali"], english: ["wrong", "incorrect", "not correct"], filipino: ["mali"], category: "negation", animationAsset: "WRONG", suggestedReplies: ["CORRECT", "TRY AGAIN"] },
  { label: "CORRECT", gloss: "CORRECT", synonyms: ["correct", "right", "tama"], english: ["correct", "right"], filipino: ["tama"], category: "affirmation", animationAsset: "CORRECT", suggestedReplies: ["YES", "GOOD"] },
  { label: "UNDERSTAND", gloss: "UNDERSTAND", synonyms: ["understand", "understood", "gets", "intindihin"], english: ["understand", "understood", "i understand"], filipino: ["naiintindihan", "intindi"], category: "cognition", animationAsset: "UNDERSTAND", suggestedReplies: ["UNDERSTAND", "GOOD"] },
  { label: "DON'T UNDERSTAND", gloss: "DONT UNDERSTAND", synonyms: ["dont understand", "don't understand", "do not understand", "hindi maintindihan"], english: ["don't understand", "do not understand"], filipino: ["hindi maintindihan"], category: "cognition", animationAsset: "DON'T UNDERSTAND", suggestedReplies: ["PLEASE REPEAT", "SLOW"] },
  { label: "KNOW", gloss: "KNOW", synonyms: ["know", "alam"], english: ["know", "i know"], filipino: ["alam"], category: "cognition", animationAsset: "KNOW", suggestedReplies: ["KNOW", "UNDERSTAND"] },
  { label: "DON'T KNOW", gloss: "DONT KNOW", synonyms: ["dont know", "don't know", "do not know", "hindi alam"], english: ["don't know", "do not know", "i dont know"], filipino: ["hindi alam", "ewan"], category: "cognition", animationAsset: "DON'T KNOW", suggestedReplies: ["ITS OKAY", "ASK SOMEONE"] },
  { label: "SLOW", gloss: "SLOW", synonyms: ["slow", "slowly", "mabagal", "bagal"], english: ["slow", "slowly"], filipino: ["mabagal", "bagal"], category: "description", animationAsset: "SLOW", suggestedReplies: ["SLOW", "OKAY"] },
  { label: "FAST", gloss: "FAST", synonyms: ["fast", "quick", "quickly", "mabilis"], english: ["fast", "quick", "quickly"], filipino: ["mabilis"], category: "description", animationAsset: "FAST", suggestedReplies: ["SLOW", "OKAY"] },
  { label: "HOT", gloss: "HOT", synonyms: ["hot", "warm", "mainit"], english: ["hot", "warm"], filipino: ["mainit"], category: "description", animationAsset: "HOT", suggestedReplies: ["COLD", "WATER"] },
  { label: "COLD", gloss: "COLD", synonyms: ["cold", "cool", "chilly", "malamig"], english: ["cold", "cool"], filipino: ["malamig"], category: "description", animationAsset: "COLD", suggestedReplies: ["HOT", "WATER"] },
  { label: "LIGHT", gloss: "LIGHT", synonyms: ["light", "bright", "liwanag"], english: ["light", "bright"], filipino: ["liwanag", "maliwanag"], category: "description", animationAsset: "LIGHT", suggestedReplies: ["DARK"] },
  { label: "DARK", gloss: "DARK", synonyms: ["dark", "dim", "dilim", "madilim"], english: ["dark"], filipino: ["dilim", "madilim"], category: "description", animationAsset: "DARK", suggestedReplies: ["LIGHT"] },
  { label: "HAPPY", gloss: "HAPPY", synonyms: ["happy", "glad", "joyful", "masaya"], english: ["happy", "glad", "joyful"], filipino: ["masaya"], category: "emotion", animationAsset: undefined, suggestedReplies: ["GOOD", "THANK YOU"] },
  { label: "SAD", gloss: "SAD", synonyms: ["sad", "unhappy", "malungkot", "lungkot"], english: ["sad", "unhappy"], filipino: ["malungkot", "lungkot"], category: "emotion", animationAsset: undefined, suggestedReplies: ["HAPPY", "OKAY"] },
  { label: "GOOD", gloss: "GOOD", synonyms: ["good", "fine", "nice", "great", "excellent", "mabuti", "maganda", "ayos"], english: ["good", "fine", "nice", "great"], filipino: ["mabuti", "maganda", "ayos"], category: "description", animationAsset: undefined, suggestedReplies: ["THANK YOU", "GOOD"] },
  { label: "BAD", gloss: "BAD", synonyms: ["bad", "terrible", "awful", "masama"], english: ["bad", "terrible", "awful"], filipino: ["masama"], category: "description", animationAsset: undefined, suggestedReplies: ["SORRY", "OKAY"] },
  { label: "BEAUTIFUL", gloss: "BEAUTIFUL", synonyms: ["beautiful", "pretty", "handsome", "gorgeous", "maganda", "guwapo"], english: ["beautiful", "pretty", "handsome"], filipino: ["maganda", "guwapo"], category: "description", animationAsset: undefined, suggestedReplies: ["THANK YOU"] },
  { label: "UGLY", gloss: "UGLY", synonyms: ["ugly", "pangit"], english: ["ugly"], filipino: ["pangit"], category: "description", animationAsset: undefined, suggestedReplies: ["SORRY"] },
  { label: "BIG", gloss: "BIG", synonyms: ["big", "large", "huge", "malaki"], english: ["big", "large", "huge"], filipino: ["malaki"], category: "description", animationAsset: undefined, suggestedReplies: ["SMALL"] },
  { label: "SMALL", gloss: "SMALL", synonyms: ["small", "little", "tiny", "maliit"], english: ["small", "little", "tiny"], filipino: ["maliit"], category: "description", animationAsset: undefined, suggestedReplies: ["BIG"] },
  { label: "OLD", gloss: "OLD", synonyms: ["old", "elderly", "matanda"], english: ["old", "elderly", "aged"], filipino: ["matanda"], category: "description", animationAsset: undefined, suggestedReplies: ["YOUNG"] },
  { label: "YOUNG", gloss: "YOUNG", synonyms: ["young", "youthful", "bata"], english: ["young", "youth"], filipino: ["bata", "kabataan"], category: "description", animationAsset: undefined, suggestedReplies: ["OLD"] },
  { label: "NEW", gloss: "NEW", synonyms: ["new", "fresh", "bago"], english: ["new", "fresh", "brand new"], filipino: ["bago"], category: "description", animationAsset: undefined, suggestedReplies: ["OLD", "GOOD"] },
  { label: "FATHER", gloss: "FATHER", synonyms: ["father", "dad", "daddy", "tatay", "ama"], english: ["father", "dad", "daddy"], filipino: ["tatay", "ama"], category: "family", animationAsset: "FATHER", suggestedReplies: ["MOTHER", "PARENTS"] },
  { label: "MOTHER", gloss: "MOTHER", synonyms: ["mother", "mom", "mommy", "mum", "nanay", "ina"], english: ["mother", "mom", "mommy", "mum"], filipino: ["nanay", "ina"], category: "family", animationAsset: "MOTHER", suggestedReplies: ["FATHER", "PARENTS"] },
  { label: "SON", gloss: "SON", synonyms: ["son", "anak"], english: ["son"], filipino: ["anak na lalaki"], category: "family", animationAsset: "SON", suggestedReplies: ["DAUGHTER", "FAMILY"] },
  { label: "DAUGHTER", gloss: "DAUGHTER", synonyms: ["daughter", "anak"], english: ["daughter"], filipino: ["anak na babae"], category: "family", animationAsset: "DAUGHTER", suggestedReplies: ["SON", "FAMILY"] },
  { label: "GRANDFATHER", gloss: "GRANDFATHER", synonyms: ["grandfather", "grandpa", "lolo"], english: ["grandfather", "grandpa"], filipino: ["lolo"], category: "family", animationAsset: "GRANDFATHER", suggestedReplies: ["GRANDMOTHER", "FAMILY"] },
  { label: "GRANDMOTHER", gloss: "GRANDMOTHER", synonyms: ["grandmother", "grandma", "lola"], english: ["grandmother", "grandma"], filipino: ["lola"], category: "family", animationAsset: "GRANDMOTHER", suggestedReplies: ["GRANDFATHER", "FAMILY"] },
  { label: "UNCLE", gloss: "UNCLE", synonyms: ["uncle", "tito"], english: ["uncle"], filipino: ["tito", "tiyo"], category: "family", animationAsset: "UNCLE", suggestedReplies: ["AUNTIE", "FAMILY"] },
  { label: "AUNTIE", gloss: "AUNTIE", synonyms: ["auntie", "aunt", "tita"], english: ["aunt", "auntie"], filipino: ["tita", "tiya"], category: "family", animationAsset: "AUNTIE", suggestedReplies: ["UNCLE", "FAMILY"] },
  { label: "COUSIN", gloss: "COUSIN", synonyms: ["cousin", "pinsan"], english: ["cousin"], filipino: ["pinsan"], category: "family", animationAsset: "COUSIN", suggestedReplies: ["FAMILY"] },
  { label: "PARENTS", gloss: "PARENTS", synonyms: ["parents", "magulang"], english: ["parents"], filipino: ["magulang"], category: "family", animationAsset: "PARENTS", suggestedReplies: ["FAMILY", "FATHER", "MOTHER"] },
  { label: "BOY", gloss: "BOY", synonyms: ["boy", "lalaki"], english: ["boy"], filipino: ["lalaki"], category: "people", animationAsset: "BOY", suggestedReplies: ["GIRL", "MAN"] },
  { label: "GIRL", gloss: "GIRL", synonyms: ["girl", "babae"], english: ["girl"], filipino: ["babae"], category: "people", animationAsset: "GIRL", suggestedReplies: ["BOY", "WOMAN"] },
  { label: "MAN", gloss: "MAN", synonyms: ["man", "lalaki"], english: ["man", "men"], filipino: ["lalaki"], category: "people", animationAsset: "MAN", suggestedReplies: ["WOMAN", "BOY"] },
  { label: "WOMAN", gloss: "WOMAN", synonyms: ["woman", "babae"], english: ["woman", "women"], filipino: ["babae"], category: "people", animationAsset: "WOMAN", suggestedReplies: ["MAN", "GIRL"] },
  { label: "DEAF", gloss: "DEAF", synonyms: ["deaf", "bingi", "deaf person"], english: ["deaf"], filipino: ["bingi"], category: "identity", animationAsset: "DEAF", suggestedReplies: ["HEARING", "HARD OF HEARING"] },
  { label: "BLIND", gloss: "BLIND", synonyms: ["blind", "bulag"], english: ["blind"], filipino: ["bulag"], category: "identity", animationAsset: "BLIND", suggestedReplies: ["DEAF", "DEAF BLIND"] },
  { label: "HARD OF HEARING", gloss: "HARD OF HEARING", synonyms: ["hard of hearing", "hard-of-hearing", "hoh"], english: ["hard of hearing"], filipino: ["mahina ang pandinig"], category: "identity", animationAsset: "HARD OF HEARING", suggestedReplies: ["DEAF", "HEARING"] },
  { label: "DEAF BLIND", gloss: "DEAF BLIND", synonyms: ["deaf blind", "deaf-blind"], english: ["deaf blind", "deaf-blind"], filipino: ["bingi at bulag"], category: "identity", animationAsset: "DEAF BLIND", suggestedReplies: ["HELP", "NEED ASSISTANCE"] },
  { label: "MARRIED", gloss: "MARRIED", synonyms: ["married", "kasado"], english: ["married"], filipino: ["kasal", "may asawa"], category: "relationship", animationAsset: "MARRIED", suggestedReplies: ["SINGLE", "FAMILY"] },
  { label: "BLUE", gloss: "BLUE", synonyms: ["blue", "asul"], english: ["blue"], filipino: ["asul", "bughaw"], category: "color", animationAsset: "BLUE", suggestedReplies: ["RED", "GREEN"] },
  { label: "RED", gloss: "RED", synonyms: ["red", "pula"], english: ["red"], filipino: ["pula"], category: "color", animationAsset: "RED", suggestedReplies: ["BLUE", "WHITE"] },
  { label: "GREEN", gloss: "GREEN", synonyms: ["green", "berde"], english: ["green"], filipino: ["berde", "luntian"], category: "color", animationAsset: "GREEN", suggestedReplies: ["BLUE", "YELLOW"] },
  { label: "YELLOW", gloss: "YELLOW", synonyms: ["yellow", "dilaw"], english: ["yellow"], filipino: ["dilaw"], category: "color", animationAsset: "YELLOW", suggestedReplies: ["GREEN", "ORANGE"] },
  { label: "ORANGE", gloss: "ORANGE", synonyms: ["orange", "kahel", "dalandan"], english: ["orange"], filipino: ["kahel", "dalandan"], category: "color", animationAsset: "ORANGE", suggestedReplies: ["YELLOW", "RED"] },
  { label: "BLACK", gloss: "BLACK", synonyms: ["black", "itim"], english: ["black"], filipino: ["itim"], category: "color", animationAsset: "BLACK", suggestedReplies: ["WHITE", "GRAY"] },
  { label: "WHITE", gloss: "WHITE", synonyms: ["white", "puti"], english: ["white"], filipino: ["puti"], category: "color", animationAsset: "WHITE", suggestedReplies: ["BLACK", "GRAY"] },
  { label: "BROWN", gloss: "BROWN", synonyms: ["brown", "kayumanggi"], english: ["brown"], filipino: ["kayumanggi", "brown"], category: "color", animationAsset: "BROWN", suggestedReplies: ["BLACK", "GRAY"] },
  { label: "GRAY", gloss: "GRAY", synonyms: ["gray", "grey", "abo"], english: ["gray", "grey"], filipino: ["abo", "gris"], category: "color", animationAsset: "GRAY", suggestedReplies: ["BLACK", "WHITE"] },
  { label: "PINK", gloss: "PINK", synonyms: ["pink", "rosas"], english: ["pink"], filipino: ["rosas", "kulay-rosas"], category: "color", animationAsset: "PINK", suggestedReplies: ["RED", "VIOLET"] },
  { label: "VIOLET", gloss: "VIOLET", synonyms: ["violet", "purple", "lila", "ube"], english: ["violet", "purple"], filipino: ["lila", "ube", "kulay-ube"], category: "color", animationAsset: "VIOLET", suggestedReplies: ["PINK", "BLUE"] },
  { label: "BREAD", gloss: "BREAD", synonyms: ["bread", "tinapay"], english: ["bread"], filipino: ["tinapay"], category: "food", animationAsset: "BREAD", suggestedReplies: ["RICE", "FOOD"] },
  { label: "RICE", gloss: "RICE", synonyms: ["rice", "kanin", "bigas"], english: ["rice"], filipino: ["kanin", "bigas"], category: "food", animationAsset: "RICE", suggestedReplies: ["BREAD", "FOOD"] },
  { label: "EGG", gloss: "EGG", synonyms: ["egg", "eggs", "itlog"], english: ["egg", "eggs"], filipino: ["itlog"], category: "food", animationAsset: "EGG", suggestedReplies: ["BREAD", "BREAKFAST"] },
  { label: "FISH", gloss: "FISH", synonyms: ["fish", "isda"], english: ["fish"], filipino: ["isda"], category: "food", animationAsset: "FISH", suggestedReplies: ["MEAT", "CHICKEN"] },
  { label: "MEAT", gloss: "MEAT", synonyms: ["meat", "karne"], english: ["meat"], filipino: ["karne"], category: "food", animationAsset: "MEAT", suggestedReplies: ["FISH", "CHICKEN"] },
  { label: "CHICKEN", gloss: "CHICKEN", synonyms: ["chicken", "manok"], english: ["chicken"], filipino: ["manok"], category: "food", animationAsset: "CHICKEN", suggestedReplies: ["MEAT", "FISH"] },
  { label: "SPAGHETTI", gloss: "SPAGHETTI", synonyms: ["spaghetti", "pasta", "ispageti"], english: ["spaghetti", "pasta"], filipino: ["ispageti"], category: "food", animationAsset: "SPAGHETTI", suggestedReplies: ["RICE", "BREAD"] },
  { label: "LONGANISA", gloss: "LONGANISA", synonyms: ["longanisa", "longganisa"], english: ["longanisa", "sausage"], filipino: ["longganisa"], category: "food", animationAsset: "LONGANISA", suggestedReplies: ["RICE", "EGG"] },
  { label: "SHRIMP", gloss: "SHRIMP", synonyms: ["shrimp", "hipon"], english: ["shrimp"], filipino: ["hipon"], category: "food", animationAsset: "SHRIMP", suggestedReplies: ["CRAB", "FISH"] },
  { label: "CRAB", gloss: "CRAB", synonyms: ["crab", "alimasag", "alimango"], english: ["crab"], filipino: ["alimasag", "alimango"], category: "food", animationAsset: "CRAB", suggestedReplies: ["SHRIMP", "FISH"] },
  { label: "SUGAR", gloss: "SUGAR", synonyms: ["sugar", "asukal", "sweet"], english: ["sugar"], filipino: ["asukal"], category: "food", animationAsset: "SUGAR", suggestedReplies: ["NO SUGAR", "COFFEE"] },
  { label: "NO SUGAR", gloss: "NO SUGAR", synonyms: ["no sugar", "walang asukal"], english: ["no sugar", "without sugar"], filipino: ["walang asukal"], category: "food", animationAsset: "NO SUGAR", suggestedReplies: ["SUGAR", "COFFEE"] },
  { label: "JUICE", gloss: "JUICE", synonyms: ["juice", "dyus"], english: ["juice"], filipino: ["dyus", "katas"], category: "drink", animationAsset: "JUICE", suggestedReplies: ["WATER", "MILK"] },
  { label: "MILK", gloss: "MILK", synonyms: ["milk", "gatas"], english: ["milk"], filipino: ["gatas"], category: "drink", animationAsset: "MILK", suggestedReplies: ["JUICE", "WATER"] },
  { label: "COFFEE", gloss: "COFFEE", synonyms: ["coffee", "kape"], english: ["coffee"], filipino: ["kape"], category: "drink", animationAsset: "COFFEE", suggestedReplies: ["TEA", "WATER", "SUGAR"] },
  { label: "TEA", gloss: "TEA", synonyms: ["tea", "tsa"], english: ["tea"], filipino: ["tsa"], category: "drink", animationAsset: "TEA", suggestedReplies: ["COFFEE", "WATER"] },
  { label: "BEER", gloss: "BEER", synonyms: ["beer", "serbesa"], english: ["beer"], filipino: ["serbesa", "alak"], category: "drink", animationAsset: "BEER", suggestedReplies: ["WINE", "WATER"] },
  { label: "WINE", gloss: "WINE", synonyms: ["wine", "alak"], english: ["wine"], filipino: ["alak"], category: "drink", animationAsset: "WINE", suggestedReplies: ["BEER", "WATER"] },
  { label: "WATER", gloss: "WATER", synonyms: ["water", "tubig"], english: ["water"], filipino: ["tubig"], category: "drink", animationAsset: undefined, suggestedReplies: ["DRINK", "THANK YOU"] },
  { label: "TODAY", gloss: "TODAY", synonyms: ["today", "ngayon"], english: ["today"], filipino: ["ngayon"], category: "time", animationAsset: "TODAY", suggestedReplies: ["TOMORROW", "YESTERDAY"] },
  { label: "TOMORROW", gloss: "TOMORROW", synonyms: ["tomorrow", "bukas"], english: ["tomorrow"], filipino: ["bukas"], category: "time", animationAsset: "TOMORROW", suggestedReplies: ["TODAY", "YESTERDAY"] },
  { label: "YESTERDAY", gloss: "YESTERDAY", synonyms: ["yesterday", "kahapon"], english: ["yesterday"], filipino: ["kahapon"], category: "time", animationAsset: "YESTERDAY", suggestedReplies: ["TODAY", "TOMORROW"] },
  { label: "MONDAY", gloss: "MONDAY", synonyms: ["monday", "lunes"], english: ["monday"], filipino: ["lunes"], category: "time", animationAsset: "MONDAY"},
  { label: "TUESDAY", gloss: "TUESDAY", synonyms: ["tuesday", "martes"], english: ["tuesday"], filipino: ["martes"], category: "time", animationAsset: "TUESDAY"},
  { label: "WEDNESDAY", gloss: "WEDNESDAY", synonyms: ["wednesday", "miyerkules"], english: ["wednesday"], filipino: ["miyerkules"], category: "time", animationAsset: "WEDNESDAY"},
  { label: "THURSDAY", gloss: "THURSDAY", synonyms: ["thursday", "huwebes"], english: ["thursday"], filipino: ["huwebes"], category: "time", animationAsset: "THURSDAY"},
  { label: "FRIDAY", gloss: "FRIDAY", synonyms: ["friday", "biyernes"], english: ["friday"], filipino: ["biyernes"], category: "time", animationAsset: "FRIDAY"},
  { label: "SATURDAY", gloss: "SATURDAY", synonyms: ["saturday", "sabado"], english: ["saturday"], filipino: ["sabado"], category: "time", animationAsset: "SATURDAY"},
  { label: "SUNDAY", gloss: "SUNDAY", synonyms: ["sunday", "linggo"], english: ["sunday"], filipino: ["linggo"], category: "time", animationAsset: "SUNDAY"},
  { label: "JANUARY", gloss: "JANUARY", synonyms: ["january", "enero"], english: ["january"], filipino: ["enero"], category: "time", animationAsset: "JANUARY"},
  { label: "FEBRUARY", gloss: "FEBRUARY", synonyms: ["february", "pebrero"], english: ["february"], filipino: ["pebrero"], category: "time", animationAsset: "FEBRUARY"},
  { label: "MARCH", gloss: "MARCH", synonyms: ["march", "marso"], english: ["march"], filipino: ["marso"], category: "time", animationAsset: "MARCH"},
  { label: "APRIL", gloss: "APRIL", synonyms: ["april", "abril"], english: ["april"], filipino: ["abril"], category: "time", animationAsset: "APRIL"},
  { label: "MAY", gloss: "MAY", synonyms: ["may", "mayo"], english: ["may"], filipino: ["mayo"], category: "time", animationAsset: "MAY"},
  { label: "JUNE", gloss: "JUNE", synonyms: ["june", "hunyo"], english: ["june"], filipino: ["hunyo"], category: "time", animationAsset: "JUNE"},
  { label: "JULY", gloss: "JULY", synonyms: ["july", "hulyo"], english: ["july"], filipino: ["hulyo"], category: "time", animationAsset: "JULY"},
  { label: "AUGUST", gloss: "AUGUST", synonyms: ["august", "agosto"], english: ["august"], filipino: ["agosto"], category: "time", animationAsset: "AUGUST"},
  { label: "SEPTEMBER", gloss: "SEPTEMBER", synonyms: ["september", "setyembre"], english: ["september"], filipino: ["setyembre"], category: "time", animationAsset: "SEPTEMBER"},
  { label: "OCTOBER", gloss: "OCTOBER", synonyms: ["october", "oktubre"], english: ["october"], filipino: ["oktubre"], category: "time", animationAsset: "OCTOBER"},
  { label: "NOVEMBER", gloss: "NOVEMBER", synonyms: ["november", "nobyembre"], english: ["november"], filipino: ["nobyembre"], category: "time", animationAsset: "NOVEMBER"},
  { label: "DECEMBER", gloss: "DECEMBER", synonyms: ["december", "disyembre"], english: ["december"], filipino: ["disyembre"], category: "time", animationAsset: "DECEMBER"},
  { label: "ONE", gloss: "ONE", synonyms: ["one", "isa"], english: ["one"], filipino: ["isa"], category: "number", animationAsset: "ONE"},
  { label: "TWO", gloss: "TWO", synonyms: ["two", "dalawa"], english: ["two"], filipino: ["dalawa"], category: "number", animationAsset: "TWO"},
  { label: "THREE", gloss: "THREE", synonyms: ["three", "tatlo"], english: ["three"], filipino: ["tatlo"], category: "number", animationAsset: "THREE"},
  { label: "FOUR", gloss: "FOUR", synonyms: ["four", "apat"], english: ["four"], filipino: ["apat"], category: "number", animationAsset: "FOUR"},
  { label: "FIVE", gloss: "FIVE", synonyms: ["five", "lima"], english: ["five"], filipino: ["lima"], category: "number", animationAsset: "FIVE"},
  { label: "SIX", gloss: "SIX", synonyms: ["six", "anim"], english: ["six"], filipino: ["anim"], category: "number", animationAsset: "SIX"},
  { label: "SEVEN", gloss: "SEVEN", synonyms: ["seven", "pito"], english: ["seven"], filipino: ["pito"], category: "number", animationAsset: "SEVEN"},
  { label: "EIGHT", gloss: "EIGHT", synonyms: ["eight", "walo"], english: ["eight"], filipino: ["walo"], category: "number", animationAsset: "EIGHT"},
  { label: "NINE", gloss: "NINE", synonyms: ["nine", "siyam"], english: ["nine"], filipino: ["siyam"], category: "number", animationAsset: "NINE"},
  { label: "TEN", gloss: "TEN", synonyms: ["ten", "sampu"], english: ["ten"], filipino: ["sampu"], category: "number", animationAsset: "TEN"},
  { label: "NAME", gloss: "NAME", synonyms: ["name", "pangalan"], english: ["name"], filipino: ["pangalan"], category: "general", animationAsset: undefined, suggestedReplies: ["MY NAME", "WHAT", "HELLO"] },
  { label: "HELP", gloss: "HELP", synonyms: ["help", "tulong"], english: ["help", "assistance"], filipino: ["tulong", "saklolo"], category: "general", animationAsset: undefined, suggestedReplies: ["NEED HELP", "EMERGENCY"] },
  { label: "NEED", gloss: "NEED", synonyms: ["need", "kailangan"], english: ["need", "require"], filipino: ["kailangan"], category: "general", animationAsset: undefined, suggestedReplies: ["HELP", "WANT"] },
  { label: "WANT", gloss: "WANT", synonyms: ["want", "gusto", "would like"], english: ["want", "desire", "would like"], filipino: ["gusto", "nais"], category: "general", animationAsset: undefined, suggestedReplies: ["NEED", "GET"] },
  { label: "LIKE", gloss: "LIKE", synonyms: ["like", "gusto", "enjoy"], english: ["like", "enjoy", "fond"], filipino: ["gusto", "mahilig"], category: "emotion", animationAsset: undefined, suggestedReplies: ["LOVE", "DISLIKE"] },
  { label: "LOVE", gloss: "LOVE", synonyms: ["love", "mahal", "ibig"], english: ["love", "adore"], filipino: ["mahal", "pag-ibig"], category: "emotion", animationAsset: undefined, suggestedReplies: ["LIKE", "CARE"] },
  { label: "STOP", gloss: "STOP", synonyms: ["stop", "tigil", "hinto"], english: ["stop", "cease", "halt"], filipino: ["tigil", "hinto"], category: "action", animationAsset: undefined, suggestedReplies: ["GO", "WAIT"] },
  { label: "GO", gloss: "GO", synonyms: ["go", "punta", "alis", "pumunta"], english: ["go", "leave", "proceed"], filipino: ["punta", "alis", "pumunta"], category: "action", animationAsset: undefined, suggestedReplies: ["STOP", "COME"] },
  { label: "COME", gloss: "COME", synonyms: ["come", "halika", "lapit"], english: ["come", "approach"], filipino: ["halika", "lapit"], category: "action", animationAsset: undefined, suggestedReplies: ["GO", "HERE"] },
  { label: "HERE", gloss: "HERE", synonyms: ["here", "dito", "eto"], english: ["here", "over here"], filipino: ["dito", "eto", "heto"], category: "location", animationAsset: undefined, suggestedReplies: ["THERE", "COME"] },
  { label: "THERE", gloss: "THERE", synonyms: ["there", "doon", "roon", "ayan"], english: ["there", "over there"], filipino: ["doon", "roon", "ayan"], category: "location", animationAsset: undefined, suggestedReplies: ["HERE", "WHERE"] },
  { label: "WHERE", gloss: "WHERE", synonyms: ["where", "saan"], english: ["where"], filipino: ["saan"], category: "question", animationAsset: undefined, suggestedReplies: ["HERE", "THERE"] },
  { label: "WHAT", gloss: "WHAT", synonyms: ["what", "ano"], english: ["what"], filipino: ["ano"], category: "question", animationAsset: undefined, suggestedReplies: ["WHAT", "WHY"] },
  { label: "WHEN", gloss: "WHEN", synonyms: ["when", "kailan"], english: ["when"], filipino: ["kailan"], category: "question", animationAsset: undefined, suggestedReplies: ["TODAY", "TOMORROW"] },
  { label: "WHO", gloss: "WHO", synonyms: ["who", "sino"], english: ["who"], filipino: ["sino"], category: "question", animationAsset: undefined, suggestedReplies: ["PERSON", "NAME"] },
  { label: "WHY", gloss: "WHY", synonyms: ["why", "bakit"], english: ["why"], filipino: ["bakit"], category: "question", animationAsset: undefined, suggestedReplies: ["BECAUSE", "EXPLAIN"] },
  { label: "HOW", gloss: "HOW", synonyms: ["how", "paano"], english: ["how"], filipino: ["paano"], category: "question", animationAsset: undefined, suggestedReplies: ["HOW", "LIKE THIS"] },
  { label: "FRIEND", gloss: "FRIEND", synonyms: ["friend", "kaibigan"], english: ["friend", "buddy", "pal"], filipino: ["kaibigan"], category: "people", animationAsset: undefined, suggestedReplies: ["HELLO", "FAMILY"] },
  { label: "FAMILY", gloss: "FAMILY", synonyms: ["family", "pamilya"], english: ["family", "relatives"], filipino: ["pamilya", "mag-anak"], category: "people", animationAsset: undefined, suggestedReplies: ["FRIEND", "HOME"] },
  { label: "TEACHER", gloss: "TEACHER", synonyms: ["teacher", "guro", "maestro"], english: ["teacher", "instructor"], filipino: ["guro", "maestro"], category: "people", animationAsset: undefined, suggestedReplies: ["STUDENT", "SCHOOL"] },
  { label: "STUDENT", gloss: "STUDENT", synonyms: ["student", "estudyante", "mag-aaral"], english: ["student", "pupil", "learner"], filipino: ["estudyante", "mag-aaral"], category: "people", animationAsset: undefined, suggestedReplies: ["TEACHER", "SCHOOL"] },
  { label: "DOCTOR", gloss: "DOCTOR", synonyms: ["doctor", "doktor", "mediko"], english: ["doctor", "physician"], filipino: ["doktor", "mediko"], category: "healthcare", animationAsset: undefined, suggestedReplies: ["HOSPITAL", "SICK", "HELP"] },
  { label: "HOSPITAL", gloss: "HOSPITAL", synonyms: ["hospital", "ospital"], english: ["hospital"], filipino: ["ospital"], category: "healthcare", animationAsset: undefined, suggestedReplies: ["DOCTOR", "SICK", "EMERGENCY"] },
  { label: "MEDICINE", gloss: "MEDICINE", synonyms: ["medicine", "gamot", "medisina"], english: ["medicine", "medication", "drug"], filipino: ["gamot", "medisina"], category: "healthcare", animationAsset: undefined, suggestedReplies: ["DOCTOR", "SICK"] },
  { label: "SICK", gloss: "SICK", synonyms: ["sick", "ill", "may sakit"], english: ["sick", "ill", "unwell"], filipino: ["may sakit", "masama ang pakiramdam"], category: "health", animationAsset: undefined, suggestedReplies: ["DOCTOR", "HOSPITAL", "MEDICINE"] },
  { label: "PAIN", gloss: "PAIN", synonyms: ["pain", "sakit"], english: ["pain", "hurt", "ache"], filipino: ["sakit", "masakit"], category: "health", animationAsset: undefined, suggestedReplies: ["DOCTOR", "MEDICINE", "HELP"] },
  { label: "HUNGRY", gloss: "HUNGRY", synonyms: ["hungry", "gutom"], english: ["hungry", "starving"], filipino: ["gutom"], category: "emotion", animationAsset: undefined, suggestedReplies: ["FOOD", "EAT", "RICE"] },
  { label: "THIRSTY", gloss: "THIRSTY", synonyms: ["thirsty", "uhaw"], english: ["thirsty"], filipino: ["uhaw"], category: "emotion", animationAsset: undefined, suggestedReplies: ["WATER", "DRINK", "JUICE"] },
  { label: "TIRED", gloss: "TIRED", synonyms: ["tired", "pagod", "pagal"], english: ["tired", "exhausted", "fatigued"], filipino: ["pagod", "pagal"], category: "emotion", animationAsset: undefined, suggestedReplies: ["SLEEP", "REST", "HOME"] },
  { label: "SLEEP", gloss: "SLEEP", synonyms: ["sleep", "tulog"], english: ["sleep", "rest", "nap"], filipino: ["tulog", "matulog"], category: "action", animationAsset: undefined, suggestedReplies: ["BED", "TIRED", "HOME"] },
  { label: "HOME", gloss: "HOME", synonyms: ["home", "bahay", "tahanan"], english: ["home", "house"], filipino: ["bahay", "tahanan"], category: "location", animationAsset: undefined, suggestedReplies: ["FAMILY", "SCHOOL", "WORK"] },
  { label: "SCHOOL", gloss: "SCHOOL", synonyms: ["school", "paaralan", "eskwela"], english: ["school"], filipino: ["paaralan", "eskwela"], category: "location", animationAsset: undefined, suggestedReplies: ["TEACHER", "STUDENT", "LEARN"] },
  { label: "WORK", gloss: "WORK", synonyms: ["work", "trabaho", "gawain"], english: ["work", "job", "employment"], filipino: ["trabaho", "gawain"], category: "action", animationAsset: undefined, suggestedReplies: ["OFFICE", "HOME", "MONEY"] },
  { label: "MONEY", gloss: "MONEY", synonyms: ["money", "pera"], english: ["money", "cash", "currency"], filipino: ["pera"], category: "general", animationAsset: undefined, suggestedReplies: ["BUY", "PRICE", "WORK"] },
  { label: "TIME", gloss: "TIME", synonyms: ["time", "oras"], english: ["time"], filipino: ["oras"], category: "time", animationAsset: undefined, suggestedReplies: ["WHAT TIME", "NOW", "LATER"] },
  { label: "EAT", gloss: "EAT", synonyms: ["eat", "kain"], english: ["eat", "dine", "have a meal"], filipino: ["kain", "kumain"], category: "action", animationAsset: undefined, suggestedReplies: ["FOOD", "HUNGRY", "RICE"] },
  { label: "DRINK", gloss: "DRINK", synonyms: ["drink", "inom"], english: ["drink", "beverage"], filipino: ["inom", "inumin"], category: "action", animationAsset: undefined, suggestedReplies: ["WATER", "THIRSTY", "JUICE"] },
  { label: "FOOD", gloss: "FOOD", synonyms: ["food", "pagkain"], english: ["food", "meal"], filipino: ["pagkain"], category: "food", animationAsset: undefined, suggestedReplies: ["EAT", "RICE", "HUNGRY"] },
  { label: "BATHROOM", gloss: "BATHROOM", synonyms: ["bathroom", "toilet", "restroom", "banyo", "palikuran", "cr"], english: ["bathroom", "toilet", "restroom"], filipino: ["banyo", "palikuran", "cr"], category: "location", animationAsset: undefined, suggestedReplies: ["GO", "WHERE"] },
  { label: "FIRST", gloss: "FIRST", synonyms: ["first", "una"], english: ["first"], filipino: ["una", "nauna"], category: "order", animationAsset: undefined, suggestedReplies: ["LAST", "SECOND"] },
  { label: "LAST", gloss: "LAST", synonyms: ["last", "huli"], english: ["last", "final"], filipino: ["huli", "panghuli"], category: "order", animationAsset: undefined, suggestedReplies: ["FIRST", "NEXT"] },
  { label: "NOW", gloss: "NOW", synonyms: ["now", "ngayon"], english: ["now", "currently", "at the moment"], filipino: ["ngayon"], category: "time", animationAsset: undefined, suggestedReplies: ["LATER", "TODAY"] },
  { label: "LATER", gloss: "LATER", synonyms: ["later", "mamaya"], english: ["later", "afterwards"], filipino: ["mamaya"], category: "time", animationAsset: undefined, suggestedReplies: ["NOW", "TOMORROW"] },
  { label: "ALWAYS", gloss: "ALWAYS", synonyms: ["always", "laging", "palagi"], english: ["always", "forever"], filipino: ["laging", "palagi"], category: "time", animationAsset: undefined, suggestedReplies: ["NEVER", "SOMETIMES"] },
  { label: "NEVER", gloss: "NEVER", synonyms: ["never", "hindi kailanman"], english: ["never"], filipino: ["hindi kailanman"], category: "time", animationAsset: undefined, suggestedReplies: ["ALWAYS", "SOMETIMES"] },
  { label: "SOMETIMES", gloss: "SOMETIMES", synonyms: ["sometimes", "minsan"], english: ["sometimes", "occasionally"], filipino: ["minsan"], category: "time", animationAsset: undefined, suggestedReplies: ["ALWAYS", "NEVER"] },
  { label: "INSIDE", gloss: "INSIDE", synonyms: ["inside", "loob", "sa loob"], english: ["inside", "indoor", "within"], filipino: ["loob", "sa loob"], category: "location", animationAsset: undefined, suggestedReplies: ["OUTSIDE", "HERE"] },
  { label: "OUTSIDE", gloss: "OUTSIDE", synonyms: ["outside", "labas", "sa labas"], english: ["outside", "outdoor", "exterior"], filipino: ["labas", "sa labas"], category: "location", animationAsset: undefined, suggestedReplies: ["INSIDE", "THERE"] },
  { label: "UP", gloss: "UP", synonyms: ["up", "taas"], english: ["up", "above", "upward"], filipino: ["taas", "pataas"], category: "location", animationAsset: undefined, suggestedReplies: ["DOWN", "HERE"] },
  { label: "DOWN", gloss: "DOWN", synonyms: ["down", "baba"], english: ["down", "below", "downward"], filipino: ["baba", "pababa"], category: "location", animationAsset: undefined, suggestedReplies: ["UP", "THERE"] },
  { label: "LEFT", gloss: "LEFT", synonyms: ["left", "kaliwa"], english: ["left"], filipino: ["kaliwa"], category: "location", animationAsset: undefined, suggestedReplies: ["RIGHT", "CENTER"] },
  { label: "RIGHT", gloss: "RIGHT", synonyms: ["right", "kanan"], english: ["right"], filipino: ["kanan"], category: "location", animationAsset: undefined, suggestedReplies: ["LEFT", "CENTER"] },
  { label: "CENTER", gloss: "CENTER", synonyms: ["center", "middle", "gitna"], english: ["center", "middle"], filipino: ["gitna", "sentro"], category: "location", animationAsset: undefined, suggestedReplies: ["LEFT", "RIGHT"] },
  { label: "HELLO", gloss: "HELLO", synonyms: ["hello"], english: ["hello"], filipino: ["hello"], category: "greeting", animationAsset: "HELLO", suggestedReplies: ["HELLO"] },

  { label: "I", gloss: "I", synonyms: ["i", "ako", "me"], english: ["i", "me"], filipino: ["ako"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "YOU", gloss: "YOU", synonyms: ["you", "ikaw", "ka", "kayo"], english: ["you"], filipino: ["ikaw", "ka", "kayo"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "MY", gloss: "MY", synonyms: ["my", "mine", "ko", "akin"], english: ["my", "mine"], filipino: ["ko", "akin"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "YOUR", gloss: "YOUR", synonyms: ["your", "yours", "mo", "inyo"], english: ["your", "yours"], filipino: ["mo", "inyo"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "WE", gloss: "WE", synonyms: ["we", "tayo", "kami"], english: ["we", "us"], filipino: ["tayo", "kami"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "THEY", gloss: "THEY", synonyms: ["they", "sila"], english: ["they", "them"], filipino: ["sila"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "HE", gloss: "HE", synonyms: ["he", "siya", "lalaki"], english: ["he", "him", "his"], filipino: ["siya"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "SHE", gloss: "SHE", synonyms: ["she", "siya", "babae"], english: ["she", "her", "hers"], filipino: ["siya"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "IT", gloss: "IT", synonyms: ["it", "ito", "iyon"], english: ["it"], filipino: ["ito", "iyon"], category: "pronoun", animationAsset: undefined, suggestedReplies: [] },
  { label: "NOT", gloss: "NOT", synonyms: ["not", "hindi", "wag"], english: ["not", "don't"], filipino: ["hindi", "wag"], category: "negation", animationAsset: undefined, suggestedReplies: [] },
  { label: "CAN", gloss: "CAN", synonyms: ["can", "kaya", "maaari"], english: ["can", "able", "could"], filipino: ["kaya", "maaari"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "WILL", gloss: "WILL", synonyms: ["will", "gagawin"], english: ["will", "shall", "going to"], filipino: ["gagawin"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "DO", gloss: "DO", synonyms: ["do", "gawin"], english: ["do", "does", "did"], filipino: ["gawin", "ginagawa"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "HAVE", gloss: "HAVE", synonyms: ["have", "may", "mayroon"], english: ["have", "has", "had", "possess"], filipino: ["may", "mayroon"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "IS", gloss: "IS", synonyms: ["is", "was", "ay", "am"], english: ["is", "am", "are", "was", "were", "be", "been"], filipino: ["ay"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "THIS", gloss: "THIS", synonyms: ["this", "ito", "dito"], english: ["this", "these"], filipino: ["ito", "dito"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "THAT", gloss: "THAT", synonyms: ["that", "iyon", "doon"], english: ["that", "those"], filipino: ["iyon", "doon"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "WITH", gloss: "WITH", synonyms: ["with", "kasama"], english: ["with", "together with"], filipino: ["kasama"], category: "preposition", animationAsset: undefined, suggestedReplies: [] },
  { label: "FOR", gloss: "FOR", synonyms: ["for", "para"], english: ["for"], filipino: ["para", "para sa"], category: "preposition", animationAsset: undefined, suggestedReplies: [] },
  { label: "AND", gloss: "AND", synonyms: ["and", "at", "saka"], english: ["and"], filipino: ["at", "saka"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
  { label: "BUT", gloss: "BUT", synonyms: ["but", "pero", "ngunit"], english: ["but", "however"], filipino: ["pero", "ngunit"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
  { label: "OR", gloss: "OR", synonyms: ["or", "o"], english: ["or"], filipino: ["o"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
  { label: "SO", gloss: "SO", synonyms: ["so", "kaya"], english: ["so", "therefore"], filipino: ["kaya"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
  { label: "IF", gloss: "IF", synonyms: ["if", "kung"], english: ["if"], filipino: ["kung"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
  { label: "VERY", gloss: "VERY", synonyms: ["very", "sobra", "talaga"], english: ["very", "really", "extremely"], filipino: ["sobra", "talaga"], category: "adverb", animationAsset: undefined, suggestedReplies: [] },
  { label: "ALL", gloss: "ALL", synonyms: ["all", "lahat"], english: ["all", "every", "everything"], filipino: ["lahat"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "SOME", gloss: "SOME", synonyms: ["some", "ilan", "mayroon"], english: ["some", "a few", "several"], filipino: ["ilan", "mayroon"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "MANY", gloss: "MANY", synonyms: ["many", "marami"], english: ["many", "much", "a lot"], filipino: ["marami"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "MORE", gloss: "MORE", synonyms: ["more", "pa", "dagdag"], english: ["more", "additional", "extra"], filipino: ["pa", "dagdag"], category: "determiner", animationAsset: undefined, suggestedReplies: [] },
  { label: "AGAIN", gloss: "AGAIN", synonyms: ["again", "muli", "ulit"], english: ["again", "once more"], filipino: ["muli", "ulit"], category: "adverb", animationAsset: undefined, suggestedReplies: [] },
  { label: "ARE", gloss: "ARE", synonyms: ["are", "kayo", "sila"], english: ["are", "you are"], filipino: ["kayo", "sila"], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "AM", gloss: "AM", synonyms: ["am"], english: ["am"], filipino: [], category: "verb", animationAsset: undefined, suggestedReplies: [] },
  { label: "MEET", gloss: "MEET", synonyms: ["meet", "meeting", "makilala"], english: ["meet", "meeting", "encounter"], filipino: ["makilala", "makisalamuha"], category: "action", animationAsset: undefined, suggestedReplies: [] },
  { label: "HOW", gloss: "HOW", synonyms: ["how", "paano"], english: ["how"], filipino: ["paano"], category: "question", animationAsset: undefined, suggestedReplies: [] },
  { label: "NICE", gloss: "NICE", synonyms: ["nice"], english: ["nice"], filipino: ["maganda"], category: "description", animationAsset: undefined, suggestedReplies: [] },
  { label: "TO", gloss: "TO", synonyms: ["to", "para", "sa"], english: ["to"], filipino: ["para", "sa"], category: "preposition", animationAsset: undefined, suggestedReplies: [] },
  { label: "BECAUSE", gloss: "BECAUSE", synonyms: ["because", "dahil", "kasi"], english: ["because", "cause"], filipino: ["dahil", "kasi"], category: "conjunction", animationAsset: undefined, suggestedReplies: [] },
];

const ALPHABET_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => ({
  label: l, gloss: l, synonyms: [l.toLowerCase()],
  english: [l.toLowerCase()], filipino: [l.toLowerCase()],
  category: "alphabet", animationAsset: l, suggestedReplies: [] as string[],
}));

const NUMBER_WORDS: Array<{ num: number; gloss: string }> = [
  { num: 0, gloss: "ZERO" }, { num: 1, gloss: "ONE" }, { num: 2, gloss: "TWO" },
  { num: 3, gloss: "THREE" }, { num: 4, gloss: "FOUR" }, { num: 5, gloss: "FIVE" },
  { num: 6, gloss: "SIX" }, { num: 7, gloss: "SEVEN" }, { num: 8, gloss: "EIGHT" },
  { num: 9, gloss: "NINE" }, { num: 10, gloss: "TEN" },
];

export class GestureDictionary {
  private entries: Map<string, DictionaryEntry> = new Map();
  private synonymIndex: Map<string, string> = new Map();
  private englishIndex: Map<string, string[]> = new Map();
  private filipinoIndex: Map<string, string[]> = new Map();
  private cache = new Map<string, DictionaryEntry>();
  private longestForm = 0;

  constructor() {
    this.loadBuiltIn();
  }

  private loadBuiltIn(): void {
    for (const entry of [...BUILT_IN_DICTIONARY, ...ALPHABET_LABELS]) {
      this.addEntry(entry);
    }
  }

  addEntry(entry: DictionaryEntry): void {
    this.entries.set(entry.label, entry);
    this.cache.clear();
    this.longestForm = 0;
    for (const syn of entry.synonyms) {
      this.synonymIndex.set(syn.toLowerCase(), entry.label);
      // …and the form the normalizer will actually hand us. It expands
      // contractions before lookup, so "i dont know" arrives as "i do not
      // know" and the stored key never matched. Indexing both means the index
      // and the input cannot disagree.
      const expanded = expandContractions(syn);
      if (expanded !== syn.toLowerCase()) this.synonymIndex.set(expanded, entry.label);
    }
    for (const en of entry.english) {
      for (const key of new Set([en.toLowerCase(), expandContractions(en)])) {
        const existing = this.englishIndex.get(key) ?? [];
        existing.push(entry.label);
        this.englishIndex.set(key, existing);
      }
    }
    for (const tl of entry.filipino) {
      for (const key of new Set([tl.toLowerCase(), expandContractions(tl)])) {
        const existing = this.filipinoIndex.get(key) ?? [];
        existing.push(entry.label);
        this.filipinoIndex.set(key, existing);
      }
    }
  }

  lookup(word: string): DictionaryEntry | undefined {
    const lower = word.toLowerCase().trim();

    const cached = this.cache.get(lower);
    if (cached) return cached;

    if (this.entries.has(word.toUpperCase())) {
      const entry = this.entries.get(word.toUpperCase())!;
      this.cache.set(lower, entry);
      return entry;
    }

    const synLabel = this.synonymIndex.get(lower);
    if (synLabel) {
      const entry = this.entries.get(synLabel);
      if (entry) {
        this.cache.set(lower, entry);
        return entry;
      }
    }

    // The english/filipino lists were only reachable through searchByEnglish /
    // searchByFilipino, which the translator never calls. So a form listed only
    // there -- "ikinagagalak kong makilala ka" is filipino-only -- resolved to
    // nothing and fingerspelled, even though the entry it belongs to has a
    // published animation. Same sign, same asset, more lexical forms reaching
    // it; no second upload involved.
    for (const index of [this.filipinoIndex, this.englishIndex]) {
      const labels = index.get(lower);
      const entry = labels?.length ? this.entries.get(labels[0]) : undefined;
      if (entry) {
        this.cache.set(lower, entry);
        return entry;
      }
    }

    if (lower.length === 1 && /^[a-z]$/.test(lower)) {
      const label = lower.toUpperCase();
      if (this.entries.has(label)) {
        const entry = this.entries.get(label)!;
        this.cache.set(lower, entry);
        return entry;
      }
    }

    const numVal = parseInt(lower, 10);
    if (!isNaN(numVal) && numVal >= 0 && numVal <= 10) {
      const nw = NUMBER_WORDS.find((n) => n.num === numVal);
      if (nw) {
        const entry = this.entries.get(nw.gloss);
        if (entry) {
          this.cache.set(lower, entry);
          return entry;
        }
      }
    }

    return undefined;
  }

  /**
   * Longest lexical form in the dictionary, in words.
   *
   * Bounds the n-gram scan in FslTranslator: there is no point trying a 7-word
   * window when nothing here is longer than 4. Derived rather than hardcoded so
   * a longer entry added later is matched without anyone remembering to raise a
   * constant.
   */
  maxPhraseWords(): number {
    if (this.longestForm > 0) return this.longestForm;
    let longest = 1;
    for (const key of [
      ...this.synonymIndex.keys(),
      ...this.englishIndex.keys(),
      ...this.filipinoIndex.keys(),
      ...this.entries.keys(),
    ]) {
      const n = key.trim().split(/\s+/).length;
      if (n > longest) longest = n;
    }
    this.longestForm = longest;
    return longest;
  }

  searchByEnglish(word: string): DictionaryEntry[] {
    const lower = word.toLowerCase();
    const labels = this.englishIndex.get(lower);
    if (!labels) return [];
    return labels.map((l) => this.entries.get(l)!).filter(Boolean);
  }

  searchByFilipino(word: string): DictionaryEntry[] {
    const lower = word.toLowerCase();
    const labels = this.filipinoIndex.get(lower);
    if (!labels) return [];
    return labels.map((l) => this.entries.get(l)!).filter(Boolean);
  }

  findSynonyms(gloss: string): string[] {
    const entry = this.entries.get(gloss.toUpperCase());
    if (!entry) return [];
    return entry.synonyms;
  }

  findRelated(gloss: string): string[] {
    const entry = this.entries.get(gloss.toUpperCase());
    if (!entry) return [];
    const related: string[] = [];
    for (const [label, e] of this.entries) {
      if (label === gloss.toUpperCase()) continue;
      if (e.category === entry.category) related.push(label);
    }
    return related;
  }

  hasAnimation(label: string): boolean {
    const entry = this.entries.get(label.toUpperCase());
    return entry?.animationAsset !== undefined;
  }

  getAnimationAsset(label: string): string | undefined {
    const entry = this.entries.get(label.toUpperCase());
    return entry?.animationAsset;
  }

  getAllEntries(): DictionaryEntry[] {
    return [...this.entries.values()];
  }

  getAllLabels(): string[] {
    return [...this.entries.keys()];
  }

  getCount(): number {
    return this.entries.size;
  }

  getCoverageStats(): { total: number; withAnimation: number; withoutAnimation: number; categories: Record<string, number> } {
    const entries = this.getAllEntries();
    const withAnimation = entries.filter((e) => e.animationAsset).length;
    const categories: Record<string, number> = {};
    for (const e of entries) {
      categories[e.category] = (categories[e.category] ?? 0) + 1;
    }
    return {
      total: entries.length,
      withAnimation,
      withoutAnimation: entries.length - withAnimation,
      categories,
    };
  }

  clear(): void {
    this.entries.clear();
    this.synonymIndex.clear();
    this.englishIndex.clear();
    this.filipinoIndex.clear();
    this.cache.clear();
  }
}

export const globalDictionary = new GestureDictionary();
