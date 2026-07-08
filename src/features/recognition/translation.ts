import { InferenceResult } from "./model";
import type { RecognitionCategory } from "./types";

const ALPHABET_LABELS = new Set([
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]);

const GESTURE_DISPLAY_MAP: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  h: "H",
  i: "I",
  j: "J",
  k: "K",
  l: "L",
  m: "M",
  n: "N",
  o: "O",
  p: "P",
  q: "Q",
  r: "R",
  s: "S",
  t: "T",
  u: "U",
  v: "V",
  w: "W",
  x: "X",
  y: "Y",
  z: "Z",
  "GOOD MORNING": "Good Morning",
  "GOOD AFTERNOON": "Good Afternoon",
  "GOOD EVENING": "Good Evening",
  HELLO: "Hello",
  "HOW ARE YOU": "How Are You",
  "IM FINE": "I'm Fine",
  "NICE TO MEET YOU": "Nice to Meet You",
  "THANK YOU": "Thank You",
  "YOURE WELCOME": "You're Welcome",
  "SEE YOU TOMORROW": "See You Tomorrow",
  UNDERSTAND: "Understand",
  "DON'T UNDERSTAND": "Don't Understand",
  KNOW: "Know",
  "DON'T KNOW": "Don't Know",
  NO: "No",
  YES: "Yes",
  WRONG: "Wrong",
  CORRECT: "Correct",
  SLOW: "Slow",
  FAST: "Fast",
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
  JANUARY: "January",
  FEBRUARY: "February",
  MARCH: "March",
  APRIL: "April",
  MAY: "May",
  JUNE: "June",
  JULY: "July",
  AUGUST: "August",
  SEPTEMBER: "September",
  OCTOBER: "October",
  NOVEMBER: "November",
  DECEMBER: "December",
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  YESTERDAY: "Yesterday",
  FATHER: "Father",
  MOTHER: "Mother",
  SON: "Son",
  DAUGHTER: "Daughter",
  GRANDFATHER: "Grandfather",
  GRANDMOTHER: "Grandmother",
  UNCLE: "Uncle",
  AUNTIE: "Auntie",
  COUSIN: "Cousin",
  PARENTS: "Parents",
  BOY: "Boy",
  GIRL: "Girl",
  MAN: "Man",
  WOMAN: "Woman",
  DEAF: "Deaf",
  "HARD OF HEARING": "Hard of Hearing",
  "WHEELCHAIR PERSON": "Wheelchair Person",
  BLIND: "Blind",
  "DEAF BLIND": "Deaf-Blind",
  MARRIED: "Married",
  BLUE: "Blue",
  GREEN: "Green",
  RED: "Red",
  BROWN: "Brown",
  BLACK: "Black",
  WHITE: "White",
  YELLOW: "Yellow",
  ORANGE: "Orange",
  GRAY: "Gray",
  PINK: "Pink",
  VIOLET: "Violet",
  LIGHT: "Light",
  DARK: "Dark",
  BREAD: "Bread",
  EGG: "Egg",
  FISH: "Fish",
  MEAT: "Meat",
  CHICKEN: "Chicken",
  SPAGHETTI: "Spaghetti",
  RICE: "Rice",
  LONGANISA: "Longanisa",
  SHRIMP: "Shrimp",
  CRAB: "Crab",
  HOT: "Hot",
  COLD: "Cold",
  JUICE: "Juice",
  MILK: "Milk",
  COFFEE: "Coffee",
  TEA: "Tea",
  BEER: "Beer",
  WINE: "Wine",
  SUGAR: "Sugar",
  "NO SUGAR": "No Sugar"
};

export const translateLabel = (label: string): string => {
  return GESTURE_DISPLAY_MAP[label] ?? label;
};

export const translateResult = (result: InferenceResult): InferenceResult => {
  return {
    label: translateLabel(result.label),
    labelId: result.labelId,
    confidence: result.confidence,
    topK: result.topK.map((item) => ({
      label: translateLabel(item.label),
      confidence: item.confidence
    }))
  };
};

export const classifyLabel = (label: string): RecognitionCategory => {
  const key = label.toLowerCase();
  if (ALPHABET_LABELS.has(key)) return "alphabet";
  return "phrase";
};

export const getRecognitionCategory = (result: {
  label: string;
}): RecognitionCategory => {
  return classifyLabel(result.label);
};
