import { ConversationIntent } from "../conversation/types";

export type GestureSuggestion = {
  label: string;
  displayName: string;
  score: number;
  context: "follow_up" | "related" | "opposite" | "conversation_flow" | "spelling";
};

type SuggestionRule = {
  gesture: string;
  suggestions: Array<{ label: string; score: number; type?: "follow_up" | "related" | "opposite" }>;
};

const FOLLOW_UP_SUGGESTIONS: SuggestionRule[] = [
  { gesture: "THANK YOU", suggestions: [{ label: "YOURE WELCOME", score: 0.95 }, { label: "THANK YOU", score: 0.7 }, { label: "SEE YOU TOMORROW", score: 0.5 }] },
  { gesture: "HELLO", suggestions: [{ label: "HOW ARE YOU", score: 0.9 }, { label: "NICE TO MEET YOU", score: 0.7 }, { label: "IM FINE", score: 0.5 }] },
  { gesture: "GOOD MORNING", suggestions: [{ label: "HOW ARE YOU", score: 0.9 }, { label: "GOOD AFTERNOON", score: 0.5 }, { label: "GOOD EVENING", score: 0.4 }] },
  { gesture: "GOOD AFTERNOON", suggestions: [{ label: "HOW ARE YOU", score: 0.9 }, { label: "GOOD EVENING", score: 0.5 }, { label: "GOOD MORNING", score: 0.4 }] },
  { gesture: "GOOD EVENING", suggestions: [{ label: "HOW ARE YOU", score: 0.9 }, { label: "GOOD NIGHT", score: 0.6 }, { label: "SEE YOU TOMORROW", score: 0.5 }] },
  { gesture: "HOW ARE YOU", suggestions: [{ label: "IM FINE", score: 0.95 }, { label: "THANK YOU", score: 0.6 }, { label: "HOW ARE YOU", score: 0.4 }] },
  { gesture: "IM FINE", suggestions: [{ label: "THANK YOU", score: 0.8 }, { label: "HOW ARE YOU", score: 0.7 }, { label: "NICE TO MEET YOU", score: 0.5 }] },
  { gesture: "NICE TO MEET YOU", suggestions: [{ label: "THANK YOU", score: 0.8 }, { label: "HOW ARE YOU", score: 0.6 }, { label: "IM FINE", score: 0.5 }] },
  { gesture: "YOURE WELCOME", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "SEE YOU TOMORROW", score: 0.5 }, { label: "HELLO", score: 0.4 }] },
  { gesture: "SEE YOU TOMORROW", suggestions: [{ label: "GOOD MORNING", score: 0.6 }, { label: "THANK YOU", score: 0.5 }, { label: "HELLO", score: 0.4 }] },
  { gesture: "YES", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "CORRECT", score: 0.6 }, { label: "UNDERSTAND", score: 0.5 }] },
  { gesture: "NO", suggestions: [{ label: "DON'T KNOW", score: 0.7 }, { label: "WRONG", score: 0.6 }, { label: "DON'T UNDERSTAND", score: 0.5 }] },
  { gesture: "UNDERSTAND", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "YES", score: 0.6 }, { label: "CORRECT", score: 0.5 }] },
  { gesture: "DON'T UNDERSTAND", suggestions: [{ label: "SLOW", score: 0.8 }, { label: "PLEASE", score: 0.7 }, { label: "HELP", score: 0.6 }] },
  { gesture: "KNOW", suggestions: [{ label: "UNDERSTAND", score: 0.7 }, { label: "YES", score: 0.6 }, { label: "THANK YOU", score: 0.5 }] },
  { gesture: "DON'T KNOW", suggestions: [{ label: "HELP", score: 0.7 }, { label: "PLEASE", score: 0.6 }, { label: "UNDERSTAND", score: 0.5 }] },
  { gesture: "PLEASE", suggestions: [{ label: "THANK YOU", score: 0.8 }, { label: "HELP", score: 0.6 }, { label: "YES", score: 0.5 }] },
  { gesture: "SORRY", suggestions: [{ label: "THANK YOU", score: 0.6 }, { label: "PLEASE", score: 0.5 }, { label: "UNDERSTAND", score: 0.4 }] },
  { gesture: "WRONG", suggestions: [{ label: "CORRECT", score: 0.7 }, { label: "NO", score: 0.6 }, { label: "DON'T KNOW", score: 0.5 }] },
  { gesture: "CORRECT", suggestions: [{ label: "YES", score: 0.7 }, { label: "THANK YOU", score: 0.6 }, { label: "UNDERSTAND", score: 0.5 }] },
  { gesture: "SLOW", suggestions: [{ label: "PLEASE", score: 0.6 }, { label: "DON'T UNDERSTAND", score: 0.5 }, { label: "HELP", score: 0.4 }] },
  { gesture: "FAST", suggestions: [{ label: "SLOW", score: 0.5 }, { label: "GO", score: 0.4 }, { label: "NOW", score: 0.3 }] },
  { gesture: "HOT", suggestions: [{ label: "COLD", score: 0.7 }, { label: "WATER", score: 0.6 }, { label: "JUICE", score: 0.4 }] },
  { gesture: "COLD", suggestions: [{ label: "HOT", score: 0.7 }, { label: "WATER", score: 0.5 }, { label: "COFFEE", score: 0.4 }] },
  { gesture: "HELP", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "PLEASE", score: 0.6 }, { label: "HOSPITAL", score: 0.5 }] },
  { gesture: "WATER", suggestions: [{ label: "PLEASE", score: 0.8 }, { label: "THANK YOU", score: 0.6 }, { label: "DRINK", score: 0.5 }] },
  { gesture: "FOOD", suggestions: [{ label: "EAT", score: 0.8 }, { label: "RICE", score: 0.6 }, { label: "WATER", score: 0.5 }] },
  { gesture: "HOSPITAL", suggestions: [{ label: "HELP", score: 0.8 }, { label: "DOCTOR", score: 0.7 }, { label: "PAIN", score: 0.6 }] },
  { gesture: "PAIN", suggestions: [{ label: "HOSPITAL", score: 0.8 }, { label: "HELP", score: 0.7 }, { label: "MEDICINE", score: 0.6 }] },
];

const RELATED_SUGGESTIONS: SuggestionRule[] = [
  // Numbers
  { gesture: "ONE", suggestions: [{ label: "TWO", score: 0.8 }, { label: "THREE", score: 0.6 }, { label: "FIRST", score: 0.5 }] },
  { gesture: "TWO", suggestions: [{ label: "ONE", score: 0.8 }, { label: "THREE", score: 0.8 }, { label: "FOUR", score: 0.6 }] },
  { gesture: "THREE", suggestions: [{ label: "TWO", score: 0.8 }, { label: "FOUR", score: 0.8 }, { label: "FIVE", score: 0.6 }] },
  { gesture: "FOUR", suggestions: [{ label: "THREE", score: 0.8 }, { label: "FIVE", score: 0.8 }, { label: "SIX", score: 0.6 }] },
  { gesture: "FIVE", suggestions: [{ label: "FOUR", score: 0.8 }, { label: "SIX", score: 0.8 }, { label: "TEN", score: 0.5 }] },
  { gesture: "SIX", suggestions: [{ label: "FIVE", score: 0.8 }, { label: "SEVEN", score: 0.8 }, { label: "EIGHT", score: 0.6 }] },
  { gesture: "SEVEN", suggestions: [{ label: "SIX", score: 0.8 }, { label: "EIGHT", score: 0.8 }, { label: "NINE", score: 0.6 }] },
  { gesture: "EIGHT", suggestions: [{ label: "SEVEN", score: 0.8 }, { label: "NINE", score: 0.8 }, { label: "TEN", score: 0.6 }] },
  { gesture: "NINE", suggestions: [{ label: "EIGHT", score: 0.8 }, { label: "TEN", score: 0.8 }, { label: "ONE", score: 0.5 }] },
  { gesture: "TEN", suggestions: [{ label: "NINE", score: 0.8 }, { label: "ONE", score: 0.6 }, { label: "FIVE", score: 0.5 }] },
  // Days of the week
  { gesture: "MONDAY", suggestions: [{ label: "TUESDAY", score: 0.8 }, { label: "WEDNESDAY", score: 0.6 }, { label: "TODAY", score: 0.5 }] },
  { gesture: "TUESDAY", suggestions: [{ label: "MONDAY", score: 0.8 }, { label: "WEDNESDAY", score: 0.8 }, { label: "THURSDAY", score: 0.6 }] },
  { gesture: "WEDNESDAY", suggestions: [{ label: "TUESDAY", score: 0.8 }, { label: "THURSDAY", score: 0.8 }, { label: "FRIDAY", score: 0.6 }] },
  { gesture: "THURSDAY", suggestions: [{ label: "WEDNESDAY", score: 0.8 }, { label: "FRIDAY", score: 0.8 }, { label: "SATURDAY", score: 0.6 }] },
  { gesture: "FRIDAY", suggestions: [{ label: "THURSDAY", score: 0.8 }, { label: "SATURDAY", score: 0.8 }, { label: "SUNDAY", score: 0.6 }] },
  { gesture: "SATURDAY", suggestions: [{ label: "FRIDAY", score: 0.8 }, { label: "SUNDAY", score: 0.8 }, { label: "MONDAY", score: 0.5 }] },
  { gesture: "SUNDAY", suggestions: [{ label: "SATURDAY", score: 0.8 }, { label: "MONDAY", score: 0.7 }, { label: "TODAY", score: 0.5 }] },
  // Months
  { gesture: "JANUARY", suggestions: [{ label: "FEBRUARY", score: 0.8 }, { label: "DECEMBER", score: 0.6 }, { label: "MARCH", score: 0.5 }] },
  { gesture: "FEBRUARY", suggestions: [{ label: "JANUARY", score: 0.8 }, { label: "MARCH", score: 0.8 }, { label: "APRIL", score: 0.5 }] },
  { gesture: "MARCH", suggestions: [{ label: "FEBRUARY", score: 0.8 }, { label: "APRIL", score: 0.8 }, { label: "MAY", score: 0.5 }] },
  { gesture: "APRIL", suggestions: [{ label: "MARCH", score: 0.8 }, { label: "MAY", score: 0.8 }, { label: "JUNE", score: 0.5 }] },
  { gesture: "MAY", suggestions: [{ label: "APRIL", score: 0.8 }, { label: "JUNE", score: 0.8 }, { label: "JULY", score: 0.5 }] },
  { gesture: "JUNE", suggestions: [{ label: "MAY", score: 0.8 }, { label: "JULY", score: 0.8 }, { label: "AUGUST", score: 0.5 }] },
  { gesture: "JULY", suggestions: [{ label: "JUNE", score: 0.8 }, { label: "AUGUST", score: 0.8 }, { label: "SEPTEMBER", score: 0.5 }] },
  { gesture: "AUGUST", suggestions: [{ label: "JULY", score: 0.8 }, { label: "SEPTEMBER", score: 0.8 }, { label: "OCTOBER", score: 0.5 }] },
  { gesture: "SEPTEMBER", suggestions: [{ label: "AUGUST", score: 0.8 }, { label: "OCTOBER", score: 0.8 }, { label: "NOVEMBER", score: 0.5 }] },
  { gesture: "OCTOBER", suggestions: [{ label: "SEPTEMBER", score: 0.8 }, { label: "NOVEMBER", score: 0.8 }, { label: "DECEMBER", score: 0.5 }] },
  { gesture: "NOVEMBER", suggestions: [{ label: "OCTOBER", score: 0.8 }, { label: "DECEMBER", score: 0.8 }, { label: "SEPTEMBER", score: 0.5 }] },
  { gesture: "DECEMBER", suggestions: [{ label: "NOVEMBER", score: 0.8 }, { label: "JANUARY", score: 0.8 }, { label: "OCTOBER", score: 0.5 }] },
  // Time
  { gesture: "TODAY", suggestions: [{ label: "TOMORROW", score: 0.8 }, { label: "YESTERDAY", score: 0.7 }, { label: "NOW", score: 0.6 }] },
  { gesture: "TOMORROW", suggestions: [{ label: "TODAY", score: 0.8 }, { label: "YESTERDAY", score: 0.6 }, { label: "SEE YOU TOMORROW", score: 0.5 }] },
  { gesture: "YESTERDAY", suggestions: [{ label: "TODAY", score: 0.8 }, { label: "TOMORROW", score: 0.6 }, { label: "YESTERDAY", score: 0.5 }] },
  // Family
  { gesture: "FATHER", suggestions: [{ label: "MOTHER", score: 0.9 }, { label: "SON", score: 0.7 }, { label: "DAUGHTER", score: 0.7 }] },
  { gesture: "MOTHER", suggestions: [{ label: "FATHER", score: 0.9 }, { label: "DAUGHTER", score: 0.7 }, { label: "SON", score: 0.7 }] },
  { gesture: "SON", suggestions: [{ label: "DAUGHTER", score: 0.8 }, { label: "FATHER", score: 0.7 }, { label: "MOTHER", score: 0.7 }] },
  { gesture: "DAUGHTER", suggestions: [{ label: "SON", score: 0.8 }, { label: "MOTHER", score: 0.7 }, { label: "FATHER", score: 0.7 }] },
  { gesture: "GRANDFATHER", suggestions: [{ label: "GRANDMOTHER", score: 0.9 }, { label: "FATHER", score: 0.7 }, { label: "UNCLE", score: 0.5 }] },
  { gesture: "GRANDMOTHER", suggestions: [{ label: "GRANDFATHER", score: 0.9 }, { label: "MOTHER", score: 0.7 }, { label: "AUNTIE", score: 0.5 }] },
  { gesture: "UNCLE", suggestions: [{ label: "AUNTIE", score: 0.8 }, { label: "COUSIN", score: 0.7 }, { label: "GRANDFATHER", score: 0.5 }] },
  { gesture: "AUNTIE", suggestions: [{ label: "UNCLE", score: 0.8 }, { label: "COUSIN", score: 0.7 }, { label: "GRANDMOTHER", score: 0.5 }] },
  { gesture: "COUSIN", suggestions: [{ label: "UNCLE", score: 0.7 }, { label: "AUNTIE", score: 0.7 }, { label: "FRIEND", score: 0.5 }] },
  { gesture: "PARENTS", suggestions: [{ label: "FATHER", score: 0.8 }, { label: "MOTHER", score: 0.8 }, { label: "FAMILY", score: 0.6 }] },
  // People
  { gesture: "BOY", suggestions: [{ label: "GIRL", score: 0.8 }, { label: "MAN", score: 0.7 }, { label: "SON", score: 0.6 }] },
  { gesture: "GIRL", suggestions: [{ label: "BOY", score: 0.8 }, { label: "WOMAN", score: 0.7 }, { label: "DAUGHTER", score: 0.6 }] },
  { gesture: "MAN", suggestions: [{ label: "WOMAN", score: 0.8 }, { label: "BOY", score: 0.6 }, { label: "FATHER", score: 0.5 }] },
  { gesture: "WOMAN", suggestions: [{ label: "MAN", score: 0.8 }, { label: "GIRL", score: 0.6 }, { label: "MOTHER", score: 0.5 }] },
  // Identity
  { gesture: "DEAF", suggestions: [{ label: "HARD OF HEARING", score: 0.8 }, { label: "DEAF BLIND", score: 0.6 }, { label: "MARRIED", score: 0.3 }] },
  { gesture: "HARD OF HEARING", suggestions: [{ label: "DEAF", score: 0.8 }, { label: "DEAF BLIND", score: 0.6 }, { label: "BLIND", score: 0.4 }] },
  { gesture: "DEAF BLIND", suggestions: [{ label: "DEAF", score: 0.7 }, { label: "BLIND", score: 0.7 }, { label: "HARD OF HEARING", score: 0.5 }] },
  { gesture: "BLIND", suggestions: [{ label: "DEAF BLIND", score: 0.7 }, { label: "DEAF", score: 0.5 }, { label: "HARD OF HEARING", score: 0.4 }] },
  { gesture: "WHEELCHAIR PERSON", suggestions: [{ label: "HELP", score: 0.6 }, { label: "BLIND", score: 0.4 }, { label: "DEAF", score: 0.3 }] },
  { gesture: "MARRIED", suggestions: [{ label: "FAMILY", score: 0.6 }, { label: "LOVE", score: 0.5 }, { label: "FATHER", score: 0.4 }] },
  // Colors
  { gesture: "RED", suggestions: [{ label: "BLUE", score: 0.6 }, { label: "GREEN", score: 0.5 }, { label: "YELLOW", score: 0.5 }] },
  { gesture: "BLUE", suggestions: [{ label: "GREEN", score: 0.7 }, { label: "RED", score: 0.6 }, { label: "VIOLET", score: 0.5 }] },
  { gesture: "GREEN", suggestions: [{ label: "BLUE", score: 0.7 }, { label: "YELLOW", score: 0.6 }, { label: "BROWN", score: 0.5 }] },
  { gesture: "YELLOW", suggestions: [{ label: "GREEN", score: 0.6 }, { label: "ORANGE", score: 0.6 }, { label: "RED", score: 0.5 }] },
  { gesture: "ORANGE", suggestions: [{ label: "YELLOW", score: 0.7 }, { label: "RED", score: 0.6 }, { label: "BROWN", score: 0.5 }] },
  { gesture: "BROWN", suggestions: [{ label: "GREEN", score: 0.6 }, { label: "YELLOW", score: 0.5 }, { label: "BLACK", score: 0.5 }] },
  { gesture: "BLACK", suggestions: [{ label: "WHITE", score: 0.8 }, { label: "DARK", score: 0.6 }, { label: "GRAY", score: 0.5 }] },
  { gesture: "WHITE", suggestions: [{ label: "BLACK", score: 0.8 }, { label: "LIGHT", score: 0.6 }, { label: "GRAY", score: 0.5 }] },
  { gesture: "GRAY", suggestions: [{ label: "BLACK", score: 0.7 }, { label: "WHITE", score: 0.7 }, { label: "BROWN", score: 0.4 }] },
  { gesture: "PINK", suggestions: [{ label: "RED", score: 0.6 }, { label: "VIOLET", score: 0.6 }, { label: "WHITE", score: 0.4 }] },
  { gesture: "VIOLET", suggestions: [{ label: "PINK", score: 0.6 }, { label: "BLUE", score: 0.6 }, { label: "PURPLE", score: 0.5 }] },
  { gesture: "LIGHT", suggestions: [{ label: "DARK", score: 0.8 }, { label: "WHITE", score: 0.6 }, { label: "LIGHT", score: 0.4 }] },
  { gesture: "DARK", suggestions: [{ label: "LIGHT", score: 0.8 }, { label: "BLACK", score: 0.7 }, { label: "NIGHT", score: 0.5 }] },
  // Food
  { gesture: "BREAD", suggestions: [{ label: "RICE", score: 0.6 }, { label: "EGG", score: 0.5 }, { label: "MEAT", score: 0.5 }] },
  { gesture: "RICE", suggestions: [{ label: "BREAD", score: 0.6 }, { label: "FISH", score: 0.5 }, { label: "CHICKEN", score: 0.5 }] },
  { gesture: "EGG", suggestions: [{ label: "BREAD", score: 0.6 }, { label: "RICE", score: 0.5 }, { label: "MEAT", score: 0.4 }] },
  { gesture: "MEAT", suggestions: [{ label: "CHICKEN", score: 0.7 }, { label: "FISH", score: 0.6 }, { label: "SPAGHETTI", score: 0.4 }] },
  { gesture: "FISH", suggestions: [{ label: "MEAT", score: 0.6 }, { label: "SHRIMP", score: 0.6 }, { label: "CRAB", score: 0.5 }] },
  { gesture: "CHICKEN", suggestions: [{ label: "MEAT", score: 0.7 }, { label: "EGG", score: 0.5 }, { label: "RICE", score: 0.5 }] },
  { gesture: "SPAGHETTI", suggestions: [{ label: "MEAT", score: 0.5 }, { label: "BREAD", score: 0.4 }, { label: "RICE", score: 0.4 }] },
  { gesture: "LONGANISA", suggestions: [{ label: "RICE", score: 0.6 }, { label: "EGG", score: 0.5 }, { label: "MEAT", score: 0.4 }] },
  { gesture: "SHRIMP", suggestions: [{ label: "FISH", score: 0.6 }, { label: "CRAB", score: 0.6 }, { label: "RICE", score: 0.5 }] },
  { gesture: "CRAB", suggestions: [{ label: "SHRIMP", score: 0.7 }, { label: "FISH", score: 0.6 }, { label: "SPAGHETTI", score: 0.3 }] },
  { gesture: "SUGAR", suggestions: [{ label: "NO SUGAR", score: 0.7 }, { label: "COFFEE", score: 0.6 }, { label: "TEA", score: 0.5 }] },
  { gesture: "NO SUGAR", suggestions: [{ label: "SUGAR", score: 0.7 }, { label: "COFFEE", score: 0.5 }, { label: "TEA", score: 0.4 }] },
  // Drinks
  { gesture: "JUICE", suggestions: [{ label: "WATER", score: 0.6 }, { label: "MILK", score: 0.5 }, { label: "COFFEE", score: 0.4 }] },
  { gesture: "MILK", suggestions: [{ label: "COFFEE", score: 0.6 }, { label: "TEA", score: 0.5 }, { label: "JUICE", score: 0.5 }] },
  { gesture: "COFFEE", suggestions: [{ label: "TEA", score: 0.7 }, { label: "MILK", score: 0.6 }, { label: "SUGAR", score: 0.5 }] },
  { gesture: "TEA", suggestions: [{ label: "COFFEE", score: 0.7 }, { label: "JUICE", score: 0.5 }, { label: "MILK", score: 0.4 }] },
  { gesture: "BEER", suggestions: [{ label: "WINE", score: 0.6 }, { label: "WATER", score: 0.4 }, { label: "JUICE", score: 0.3 }] },
  { gesture: "WINE", suggestions: [{ label: "BEER", score: 0.6 }, { label: "WATER", score: 0.4 }, { label: "JUICE", score: 0.3 }] },
];

const OPPOSITE_SUGGESTIONS: SuggestionRule[] = [
  { gesture: "YES", suggestions: [{ label: "NO", score: 0.9 }, { label: "WRONG", score: 0.5 }] },
  { gesture: "NO", suggestions: [{ label: "YES", score: 0.9 }, { label: "CORRECT", score: 0.5 }] },
  { gesture: "HOT", suggestions: [{ label: "COLD", score: 0.9 }] },
  { gesture: "COLD", suggestions: [{ label: "HOT", score: 0.9 }] },
  { gesture: "SLOW", suggestions: [{ label: "FAST", score: 0.8 }] },
  { gesture: "FAST", suggestions: [{ label: "SLOW", score: 0.8 }] },
  { gesture: "LIGHT", suggestions: [{ label: "DARK", score: 0.9 }] },
  { gesture: "DARK", suggestions: [{ label: "LIGHT", score: 0.9 }] },
  { gesture: "BLACK", suggestions: [{ label: "WHITE", score: 0.9 }] },
  { gesture: "WHITE", suggestions: [{ label: "BLACK", score: 0.9 }] },
  { gesture: "SUGAR", suggestions: [{ label: "NO SUGAR", score: 0.9 }] },
  { gesture: "NO SUGAR", suggestions: [{ label: "SUGAR", score: 0.9 }] },
  { gesture: "CORRECT", suggestions: [{ label: "WRONG", score: 0.8 }] },
  { gesture: "WRONG", suggestions: [{ label: "CORRECT", score: 0.8 }] },
  { gesture: "UNDERSTAND", suggestions: [{ label: "DON'T UNDERSTAND", score: 0.8 }] },
  { gesture: "DON'T UNDERSTAND", suggestions: [{ label: "UNDERSTAND", score: 0.8 }] },
  { gesture: "KNOW", suggestions: [{ label: "DON'T KNOW", score: 0.8 }] },
  { gesture: "DON'T KNOW", suggestions: [{ label: "KNOW", score: 0.8 }] },
  { gesture: "BOY", suggestions: [{ label: "GIRL", score: 0.8 }] },
  { gesture: "GIRL", suggestions: [{ label: "BOY", score: 0.8 }] },
  { gesture: "MAN", suggestions: [{ label: "WOMAN", score: 0.8 }] },
  { gesture: "WOMAN", suggestions: [{ label: "MAN", score: 0.8 }] },
  { gesture: "FATHER", suggestions: [{ label: "MOTHER", score: 0.7 }] },
  { gesture: "MOTHER", suggestions: [{ label: "FATHER", score: 0.7 }] },
  { gesture: "SON", suggestions: [{ label: "DAUGHTER", score: 0.7 }] },
  { gesture: "DAUGHTER", suggestions: [{ label: "SON", score: 0.7 }] },
  { gesture: "GRANDFATHER", suggestions: [{ label: "GRANDMOTHER", score: 0.7 }] },
  { gesture: "GRANDMOTHER", suggestions: [{ label: "GRANDFATHER", score: 0.7 }] },
  { gesture: "UNCLE", suggestions: [{ label: "AUNTIE", score: 0.7 }] },
  { gesture: "AUNTIE", suggestions: [{ label: "UNCLE", score: 0.7 }] },
  { gesture: "GOOD MORNING", suggestions: [{ label: "GOOD EVENING", score: 0.6 }] },
  { gesture: "GOOD EVENING", suggestions: [{ label: "GOOD MORNING", score: 0.6 }] },
];

const ALPHABET_SUGGESTIONS: Record<string, string[]> = {
  // Each letter suggests the next and previous letter in the alphabet
  "A": ["B", "C", "Z"],
  "B": ["A", "C", "D"],
  "C": ["B", "D", "A"],
  "D": ["C", "E", "B"],
  "E": ["D", "F", "C"],
  "F": ["E", "G", "D"],
  "G": ["F", "H", "E"],
  "H": ["G", "I", "F"],
  "I": ["H", "J", "G"],
  "J": ["I", "K", "H"],
  "K": ["J", "L", "I"],
  "L": ["K", "M", "J"],
  "M": ["L", "N", "K"],
  "N": ["M", "O", "L"],
  "O": ["N", "P", "M"],
  "P": ["O", "Q", "N"],
  "Q": ["P", "R", "O"],
  "R": ["Q", "S", "P"],
  "S": ["R", "T", "Q"],
  "T": ["S", "U", "R"],
  "U": ["T", "V", "S"],
  "V": ["U", "W", "T"],
  "W": ["V", "X", "U"],
  "X": ["W", "Y", "V"],
  "Y": ["X", "Z", "W"],
  "Z": ["Y", "A", "X"],
};

const GESTURE_DISPLAY_NAMES: Record<string, string> = {
  "YOURE WELCOME": "You're Welcome",
  "THANK YOU": "Thank You",
  "SEE YOU TOMORROW": "See You Tomorrow",
  "GOOD MORNING": "Good Morning",
  "GOOD AFTERNOON": "Good Afternoon",
  "GOOD EVENING": "Good Evening",
  "HOW ARE YOU": "How Are You",
  "IM FINE": "I'm Fine",
  "NICE TO MEET YOU": "Nice to Meet You",
  "DON'T UNDERSTAND": "Don't Understand",
  "DON'T KNOW": "Don't Know",
  "HARD OF HEARING": "Hard of Hearing",
  "WHEELCHAIR PERSON": "Wheelchair Person",
  "DEAF BLIND": "Deaf-Blind",
  "NO SUGAR": "No Sugar",
  "LONGANISA": "Longanisa",
  "SPAGHETTI": "Spaghetti",
  "GRANDFATHER": "Grandfather",
  "GRANDMOTHER": "Grandmother",
  "AUNTIE": "Auntie",
  "PARENTS": "Parents",
  "COUSIN": "Cousin",
  "DAUGHTER": "Daughter",
  "UNCLE": "Uncle",
  "MOTHER": "Mother",
  "FATHER": "Father",
  "VIOLET": "Violet",
  "ORANGE": "Orange",
  "BROWN": "Brown",
  "YELLOW": "Yellow",
  "GREEN": "Green",
  "BLUE": "Blue",
  "BLACK": "Black",
  "WHITE": "White",
  "GRAY": "Gray",
  "PINK": "Pink",
  "LIGHT": "Light",
  "DARK": "Dark",
  "SUGAR": "Sugar",
  "SHRIMP": "Shrimp",
  "CHICKEN": "Chicken",
  "BREAD": "Bread",
  "COFFEE": "Coffee",
  "JUICE": "Juice",
  "BEAUTIFUL": "Beautiful",
  "HANDSOME": "Handsome",
  "MONDAY": "Monday",
  "TUESDAY": "Tuesday",
  "WEDNESDAY": "Wednesday",
  "THURSDAY": "Thursday",
  "FRIDAY": "Friday",
  "SATURDAY": "Saturday",
  "SUNDAY": "Sunday",
  "JANUARY": "January",
  "FEBRUARY": "February",
  "MARCH": "March",
  "APRIL": "April",
  "MAY": "May",
  "JUNE": "June",
  "JULY": "July",
  "AUGUST": "August",
  "SEPTEMBER": "September",
  "OCTOBER": "October",
  "NOVEMBER": "November",
  "DECEMBER": "December",
  "TODAY": "Today",
  "TOMORROW": "Tomorrow",
  "YESTERDAY": "Yesterday",
  "HOSPITAL": "Hospital",
  "DOCTOR": "Doctor",
  "MEDICINE": "Medicine",
  "BATHROOM": "Bathroom",
  "TEACHER": "Teacher",
  "STUDENT": "Student",
  "HAPPY": "Happy",
  "SAD": "Sad",
  "ANGRY": "Angry",
  "TIRED": "Tired",
  "HUNGRY": "Hungry",
  "THIRSTY": "Thirsty",
  "SICK": "Sick",
};

function getDisplayName(label: string): string {
  const upper = label.toUpperCase().replace(/['']/g, "'");
  if (GESTURE_DISPLAY_NAMES[upper]) return GESTURE_DISPLAY_NAMES[upper];
  return upper.charAt(0).toUpperCase() + upper.slice(1).toLowerCase();
}

const INTENT_FLOW_PRIORITIES: Record<string, string[]> = {
  Greeting: ["Introduction", "Question", "Response"],
  Introduction: ["Question", "Response", "Greeting"],
  Question: ["Response", "Question", "Request"],
  Response: ["Question", "Greeting", "Farewell"],
  Request: ["Response", "Question", "Farewell"],
  Emergency: ["Response", "Healthcare", "Request"],
  Food: ["Response", "Question", "Request", "Drink"],
  Healthcare: ["Response", "Emergency", "Request"],
  Education: ["Response", "Question", "Request"],
  Transportation: ["Response", "Question", "Request"],
  Farewell: ["Greeting", "Unknown", "Response"],
  Unknown: ["Greeting", "Question", "Response"],
  Confirmation: ["Response", "Question", "Greeting"],
  Time: ["Response", "Question", "Greeting"],
  Description: ["Response", "Question", "Food"],
  Color: ["Description", "Question", "Response"],
  Family: ["Greeting", "Question", "Response"],
  Number: ["Response", "Question", "Time"],
  Drink: ["Response", "Food", "Question"],
};

export class SmartGestureSuggestions {
  private recentSuggestions: string[] = [];
  private maxRecentHistory = 10;
  private suggestionUseCount: Map<string, number> = new Map();

  getSuggestions(
    currentGesture: string,
    conversationHistory: Array<{ gestureLabel: string; intent?: ConversationIntent }>,
    maxSuggestions = 5
  ): GestureSuggestion[] {
    const normalizedGesture = currentGesture.toUpperCase().replace(/['']/g, "'");
    const suggestions: GestureSuggestion[] = [];

    // Follow-up suggestions
    const followUps = this.getFollowUpSuggestions(normalizedGesture);
    for (const s of followUps) {
      suggestions.push({ ...s, context: "follow_up" });
    }

    // Related suggestions
    const related = this.getRelatedSuggestions(normalizedGesture);
    for (const s of related) {
      const exists = suggestions.some(e => e.label === s.label);
      if (!exists) suggestions.push({ ...s, context: "related" });
    }

    // Opposite suggestions
    const opposites = this.getOppositeSuggestions(normalizedGesture);
    for (const s of opposites) {
      const exists = suggestions.some(e => e.label === s.label);
      if (!exists) suggestions.push({ ...s, context: "opposite" });
    }

    // Alphabet neighbors
    if (normalizedGesture.length === 1 && /^[A-Z]$/.test(normalizedGesture)) {
      const neighbors = ALPHABET_SUGGESTIONS[normalizedGesture];
      if (neighbors) {
        for (const n of neighbors) {
          const exists = suggestions.some(e => e.label === n);
          if (!exists) {
            suggestions.push({
              label: n,
              displayName: n.toUpperCase(),
              score: 0.5,
              context: "spelling",
            });
          }
        }
      }
    }

    // Conversation flow from history
    const recentGestures = conversationHistory.slice(-3).map(m => m.gestureLabel.toUpperCase());
    for (const recent of recentGestures) {
      if (recent !== normalizedGesture) {
        const flowSuggestions = [
          ...this.getFollowUpSuggestions(recent),
          ...this.getRelatedSuggestions(recent),
        ];
        for (const s of flowSuggestions) {
          const exists = suggestions.some(e => e.label === s.label);
          if (!exists) {
            suggestions.push({ ...s, score: s.score * 0.6, context: "conversation_flow" });
          }
        }
      }
    }

    // Intent-based suggestions
    if (conversationHistory.length > 0) {
      const lastIntent = conversationHistory[conversationHistory.length - 1].intent;
      if (lastIntent && lastIntent !== "Unknown") {
        const intentFlow = INTENT_FLOW_PRIORITIES[lastIntent];
        if (intentFlow) {
          const intentGestures = this.getGesturesByIntent(lastIntent);
          for (const gesture of intentGestures) {
            const exists = suggestions.some(s => s.label === gesture);
            if (!exists && gesture !== normalizedGesture) {
              suggestions.push({
                label: gesture,
                displayName: getDisplayName(gesture),
                score: 0.3,
                context: "conversation_flow",
              });
            }
          }
        }
      }
    }

    // Boost frequently-used suggestions
    for (const s of suggestions) {
      const useCount = this.suggestionUseCount.get(s.label) ?? 0;
      if (useCount > 0) {
        s.score = Math.min(1, s.score + useCount * 0.02);
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    const unique = this.deduplicate(suggestions);
    return unique.slice(0, maxSuggestions);
  }

  private getFollowUpSuggestions(gesture: string): GestureSuggestion[] {
    const rule = FOLLOW_UP_SUGGESTIONS.find(s => s.gesture === gesture);
    if (!rule) return [];

    return rule.suggestions.map(s => ({
      label: s.label,
      displayName: getDisplayName(s.label),
      score: s.score,
      context: "follow_up" as const,
    }));
  }

  private getRelatedSuggestions(gesture: string): GestureSuggestion[] {
    const rule = RELATED_SUGGESTIONS.find(s => s.gesture === gesture);
    if (!rule) return [];

    return rule.suggestions.map(s => ({
      label: s.label,
      displayName: getDisplayName(s.label),
      score: s.score * 0.8,
      context: "related" as const,
    }));
  }

  private getOppositeSuggestions(gesture: string): GestureSuggestion[] {
    const rule = OPPOSITE_SUGGESTIONS.find(s => s.gesture === gesture);
    if (!rule) return [];

    return rule.suggestions.map(s => ({
      label: s.label,
      displayName: getDisplayName(s.label),
      score: s.score * 0.7,
      context: "opposite" as const,
    }));
  }

  private getGesturesByIntent(intent: ConversationIntent): string[] {
    const map: Partial<Record<ConversationIntent, string[]>> = {
      Greeting: ["HELLO", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HOW ARE YOU", "NICE TO MEET YOU", "IM FINE"],
      Response: ["YES", "NO", "THANK YOU", "IM FINE", "UNDERSTAND", "DON'T UNDERSTAND", "CORRECT", "WRONG"],
      Farewell: ["GOODBYE", "SEE YOU TOMORROW", "THANK YOU", "GOOD EVENING"],
      Request: ["PLEASE", "HELP", "WANT", "NEED", "WATER", "FOOD"],
      Food: ["FOOD", "WATER", "RICE", "BREAD", "MEAT", "FISH", "CHICKEN", "SPAGHETTI", "LONGANISA", "SHRIMP", "CRAB", "SUGAR", "NO SUGAR"],
      Emergency: ["HELP", "HOSPITAL", "PAIN", "MEDICINE", "DOCTOR"],
      Question: ["WHAT", "WHERE", "WHEN", "WHO", "WHY", "HOW", "HOW ARE YOU"],
      Confirmation: ["YES", "NO", "CORRECT", "WRONG", "UNDERSTAND", "DON'T UNDERSTAND"],
      Time: ["TODAY", "TOMORROW", "YESTERDAY", "NOW", "LATER", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      Description: ["HOT", "COLD", "SLOW", "FAST", "LIGHT", "DARK", "BIG", "SMALL", "GOOD", "BAD"],
      Color: ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "BROWN", "BLACK", "WHITE", "GRAY", "PINK", "VIOLET"],
      Family: ["FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER", "GRANDMOTHER", "UNCLE", "AUNTIE", "COUSIN", "PARENTS"],
      Number: ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"],
      Drink: ["WATER", "JUICE", "MILK", "COFFEE", "TEA", "BEER", "WINE"],
      Healthcare: ["DOCTOR", "HOSPITAL", "MEDICINE", "PAIN", "SICK"],
    };
    return map[intent] ?? [];
  }

  private deduplicate(suggestions: GestureSuggestion[]): GestureSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  }

  recordSuggestionUsed(label: string): void {
    const current = this.suggestionUseCount.get(label) ?? 0;
    this.suggestionUseCount.set(label, current + 1);
    this.recentSuggestions.push(label);
    if (this.recentSuggestions.length > this.maxRecentHistory) {
      this.recentSuggestions.shift();
    }
  }

  reset(): void {
    this.recentSuggestions = [];
    this.suggestionUseCount.clear();
  }
}
