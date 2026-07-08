import type { NormalizedText } from "../types";

const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{231A}-\u{23CF}]/gu;

const ABBREVIATIONS: Record<string, string> = {
  "u": "you",
  "ur": "your",
  "r": "are",
  "y": "why",
  "k": "okay",
  "thx": "thanks",
  "ty": "thank you",
  "pls": "please",
  "plz": "please",
  "btw": "by the way",
  "idk": "i dont know",
  "idc": "i dont care",
  "imo": "in my opinion",
  "tbh": "to be honest",
  "lol": "laughing",
  "omg": "oh my god",
  "bc": "because",
  "cuz": "because",
  "gonna": "going to",
  "wanna": "want to",
  "gotta": "got to",
  "lemme": "let me",
  "gimme": "give me",
  "kinda": "kind of",
  "sorta": "sort of",
  "lotsa": "lots of",
  "outta": "out of",
  "dunno": "dont know",
  "tell em": "tell them",
  "gotcha": "got you",
};

const CONTRACTIONS: Record<string, string> = {
  "don't": "do not",
  "dont": "do not",
  "can't": "cannot",
  "cant": "cannot",
  "won't": "will not",
  "wont": "will not",
  "isn't": "is not",
  "isnt": "is not",
  "aren't": "are not",
  "arent": "are not",
  "wasn't": "was not",
  "wasnt": "was not",
  "weren't": "were not",
  "werent": "were not",
  "hasn't": "has not",
  "hasnt": "has not",
  "haven't": "have not",
  "havent": "have not",
  "hadn't": "had not",
  "hadnt": "had not",
  "doesn't": "does not",
  "doesnt": "does not",
  "didn't": "did not",
  "didnt": "did not",
  "couldn't": "could not",
  "couldnt": "could not",
  "shouldn't": "should not",
  "shouldnt": "should not",
  "wouldn't": "would not",
  "wouldnt": "would not",
  "mightn't": "might not",
  "mightnt": "might not",
  "mustn't": "must not",
  "mustnt": "must not",
  "i'm": "i am",
  "im": "i am",
  "you're": "you are",
  "youre": "you are",
  "he's": "he is",
  "hes": "he is",
  "she's": "she is",
  "shes": "she is",
  "it's": "it is",
  "its": "it is",
  "we're": "we are",
  "were": "we are",
  "they're": "they are",
  "theyre": "they are",
  "i've": "i have",
  "ive": "i have",
  "you've": "you have",
  "youve": "you have",
  "we've": "we have",
  "weve": "we have",
  "they've": "they have",
  "theyve": "they have",
  "i'll": "i will",
  "ill": "i will",
  "you'll": "you will",
  "youll": "you will",
  "he'll": "he will",
  "hell": "he will",
  "she'll": "she will",
  "shell": "she will",
  "we'll": "we will",
  "well": "we will",
  "they'll": "they will",
  "theyll": "they will",
  "i'd": "i would",
  "id": "i would",
  "you'd": "you would",
  "youd": "you would",
  "he'd": "he would",
  "hed": "he would",
  "she'd": "she would",
  "shed": "she would",
  "we'd": "we would",
  "wed": "we would",
  "they'd": "they would",
  "theyd": "they would",
};

export function normalizeText(text: string): NormalizedText {
  let cleaned = text.trim();

  cleaned = cleaned.replace(EMOJI_PATTERN, " ");

  cleaned = cleaned.replace(/(.)\1{3,}/g, "$1$1");

  cleaned = cleaned.replace(/[^\w\s'-ñáéíóúàèìòùäëïöüâêîôû]/g, " ");

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  let words = cleaned.toLowerCase().split(/\s+/);

  words = words
    .map((w) => {
      w = w.replace(/^['"]+|['"]+$/g, "");
      return w;
    })
    .filter((w) => w.length > 0);

  words = words.map((w) => {
    const expanded = ABBREVIATIONS[w];
    if (expanded) return expanded;
    return w;
  });

  words = words.map((w) => {
    const expanded = CONTRACTIONS[w];
    if (expanded) return expanded;
    return w;
  });

  words = words.flatMap((w) => w.split(/\s+/));

  return {
    original: text.trim(),
    cleaned: words.join(" "),
    words,
  };
}

export function cleanPunctuation(text: string): string {
  return text.replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();
}
