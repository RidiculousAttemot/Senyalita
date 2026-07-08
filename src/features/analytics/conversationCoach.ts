export type GestureCoachData = {
  label: string;
  displayName: string;
  meaning: string;
  handshape: string;
  movementDescription: string;
  commonMistakes: string[];
  relatedGestures: string[];
  sampleConversations: string[];
  recommendedNextGesture: string;
  difficultyLevel: "easy" | "medium" | "hard";
  category: string;
};

type CoachEntry = {
  meaning: string;
  handshape: string;
  movement: string;
  mistakes: string[];
  related: string[];
  conversations: string[];
  nextGesture: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
};

const COACH_DATA: Record<string, CoachEntry> = {
  "HELLO": {
    meaning: "A greeting used to start a conversation",
    handshape: "Open hand, fingers together, palm facing forward",
    movement: "Move hand from side to side at chest level",
    mistakes: ["Moving too fast", "Using wrong palm orientation", "Not making eye contact"],
    related: ["GOOD MORNING", "HOW ARE YOU", "NICE TO MEET YOU"],
    conversations: ["HELLO -> HOW ARE YOU?", "HELLO -> Nice to meet you!", "HELLO -> Good morning!"],
    nextGesture: "HOW ARE YOU",
    difficulty: "easy",
    category: "Greeting",
  },
  "HOW ARE YOU": {
    meaning: "Ask about someone's wellbeing",
    handshape: "Open hand, palm up, fingers slightly curved",
    movement: "Circular motion at chest level moving outward",
    mistakes: ["Not using questioning expression", "Moving too small", "Forgetting eyebrow raise"],
    related: ["HELLO", "IM FINE", "GOOD MORNING"],
    conversations: ["HELLO -> HOW ARE YOU -> IM FINE", "HOW ARE YOU -> IM FINE -> THANK YOU"],
    nextGesture: "IM FINE",
    difficulty: "easy",
    category: "Greeting",
  },
  "IM FINE": {
    meaning: "Respond that you are doing well",
    handshape: "Closed fist with thumb up",
    movement: "Tap chest twice with thumb",
    mistakes: ["Using wrong handshape", "Not making contact with chest", "Tapping too hard"],
    related: ["HOW ARE YOU", "THANK YOU", "GOOD"],
    conversations: ["HOW ARE YOU -> IM FINE -> THANK YOU", "IM FINE -> HOW ARE YOU"],
    nextGesture: "THANK YOU",
    difficulty: "easy",
    category: "Response",
  },
  "THANK YOU": {
    meaning: "Express gratitude",
    handshape: "Open hand, fingers together, palm facing inward",
    movement: "Move hand from chin forward and downward",
    mistakes: ["Starting from wrong position", "Moving upward instead of forward", "Using flat hand instead of curved"],
    related: ["YOURE WELCOME", "PLEASE", "GOOD"],
    conversations: ["THANK YOU -> YOURE WELCOME", "PLEASE -> THANK YOU -> YOURE WELCOME"],
    nextGesture: "YOURE WELCOME",
    difficulty: "easy",
    category: "Response",
  },
  "YOURE WELCOME": {
    meaning: "Polite response to thank you",
    handshape: "Open hand, palm up, fingers together",
    movement: "Small outward push from chest",
    mistakes: ["Pushing too far", "Using wrong hand orientation", "Not smiling"],
    related: ["THANK YOU", "PLEASE", "GOOD"],
    conversations: ["THANK YOU -> YOURE WELCOME", "YOURE WELCOME -> SEE YOU TOMORROW"],
    nextGesture: "SEE YOU TOMORROW",
    difficulty: "easy",
    category: "Response",
  },
  "GOOD MORNING": {
    meaning: "Morning greeting",
    handshape: "Open hand, palm facing recipient",
    movement: "Slight nod while moving hand outward",
    mistakes: ["Not nodding head", "Using too much movement", "Wrong timing"],
    related: ["GOOD AFTERNOON", "GOOD EVENING", "HELLO"],
    conversations: ["GOOD MORNING -> HOW ARE YOU", "GOOD MORNING -> GOOD MORNING (reply)"],
    nextGesture: "HOW ARE YOU",
    difficulty: "easy",
    category: "Greeting",
  },
  "GOOD AFTERNOON": {
    meaning: "Afternoon greeting",
    handshape: "Open hand, palm facing recipient",
    movement: "Slight bow while moving hand downward",
    mistakes: ["Confusing with good morning", "Not adjusting for time of day"],
    related: ["GOOD MORNING", "GOOD EVENING", "HELLO"],
    conversations: ["GOOD AFTERNOON -> HOW ARE YOU", "GOOD AFTERNOON -> GOOD AFTERNOON (reply)"],
    nextGesture: "HOW ARE YOU",
    difficulty: "easy",
    category: "Greeting",
  },
  "GOOD EVENING": {
    meaning: "Evening greeting",
    handshape: "Open hand, palm facing recipient",
    movement: "Slight downward motion with nod",
    mistakes: ["Using same motion as good afternoon", "Not adjusting for time of day"],
    related: ["GOOD MORNING", "GOOD AFTERNOON", "GOOD NIGHT"],
    conversations: ["GOOD EVENING -> HOW ARE YOU", "GOOD EVENING -> HOW WAS YOUR DAY"],
    nextGesture: "HOW ARE YOU",
    difficulty: "easy",
    category: "Greeting",
  },
  "NICE TO MEET YOU": {
    meaning: "Pleasure meeting someone new",
    handshape: "Open hands, palms facing each other",
    movement: "Hands move together and clasp gently",
    mistakes: ["Moving too fast", "Not showing warmth in expression", "Forgetting to smile"],
    related: ["HELLO", "HOW ARE YOU", "INTRODUCTION"],
    conversations: ["HELLO -> NICE TO MEET YOU -> NICE TO MEET YOU TOO"],
    nextGesture: "HOW ARE YOU",
    difficulty: "easy",
    category: "Introduction",
  },
  "SEE YOU TOMORROW": {
    meaning: "Farewell indicating future meeting",
    handshape: "Open hand, palm forward, fingers together with index finger pointing forward",
    movement: "Hand moves forward and down in an arc from near the eye",
    mistakes: ["Moving hand too far", "Not including tomorrow reference clearly", "Speed too fast"],
    related: ["GOODBYE", "TOMORROW", "LATER"],
    conversations: ["SEE YOU TOMORROW -> GOODBYE", "SEE YOU TOMORROW -> TAKE CARE"],
    nextGesture: "GOODBYE",
    difficulty: "medium",
    category: "Farewell",
  },
  "YES": {
    meaning: "Affirmation or agreement",
    handshape: "Closed fist with thumb up",
    movement: "Small nod of the hand at wrist",
    mistakes: ["Too large movement", "Confusing with NO", "Not nodding head simultaneously"],
    related: ["NO", "CORRECT", "GOOD"],
    conversations: ["YES -> THANK YOU", "QUESTION -> YES -> GREAT"],
    nextGesture: "THANK YOU",
    difficulty: "easy",
    category: "Response",
  },
  "NO": {
    meaning: "Negation or disagreement",
    handshape: "Extended index, middle, and ring fingers, held together, thumb touching chin",
    movement: "Fingers move away from chin in a flicking motion",
    mistakes: ["Using wrong fingers", "Not making proper contact with chin", "Too weak a motion"],
    related: ["YES", "WRONG", "DON'T KNOW"],
    conversations: ["NO -> SORRY -> EXPLAIN", "QUESTION -> NO -> EXPLAIN"],
    nextGesture: "SORRY",
    difficulty: "easy",
    category: "Response",
  },
  "UNDERSTAND": {
    meaning: "Comprehend what was communicated",
    handshape: "Open hand, palm up, fingers slightly apart",
    movement: "Hand moves up and touches temple area",
    mistakes: ["Not touching temple", "Hand too far from head", "Wrong hand orientation"],
    related: ["DON'T UNDERSTAND", "KNOW", "LEARN"],
    conversations: ["EXPLAIN -> UNDERSTAND -> THANK YOU", "UNDERSTAND -> YES -> GOOD"],
    nextGesture: "THANK YOU",
    difficulty: "medium",
    category: "Response",
  },
  "DON'T UNDERSTAND": {
    meaning: "Need clarification or repetition",
    handshape: "Open hand, palm down, fingers spread",
    movement: "Hand rotates side to side near head while shaking head",
    mistakes: ["Not shaking head", "Too subtle movement", "Wrong hand position"],
    related: ["UNDERSTAND", "PLEASE", "SLOW", "REPEAT"],
    conversations: ["DON'T UNDERSTAND -> PLEASE -> SLOW", "DON'T UNDERSTAND -> REPEAT"],
    nextGesture: "PLEASE",
    difficulty: "medium",
    category: "Response",
  },
  "PLEASE": {
    meaning: "Polite request",
    handshape: "Open hand, palm facing chest, circular motion",
    movement: "Hand makes circular motion over chest",
    mistakes: ["Making circle too large", "Not keeping hand near chest", "Wrong palm orientation"],
    related: ["THANK YOU", "WANT", "HELP"],
    conversations: ["PLEASE -> THANK YOU", "WANT -> PLEASE -> WATER -> THANK YOU"],
    nextGesture: "THANK YOU",
    difficulty: "easy",
    category: "Request",
  },
  "HELP": {
    meaning: "Request assistance",
    handshape: "Closed fist with thumb up",
    movement: "Hand moves up and down slightly while held up",
    mistakes: ["Moving too much", "Not showing urgency in expression", "Too low hand position"],
    related: ["EMERGENCY", "PLEASE", "WANT"],
    conversations: ["HELP -> THANK YOU", "HELP -> HOSPITAL -> EMERGENCY"],
    nextGesture: "THANK YOU",
    difficulty: "medium",
    category: "Emergency",
  },
  "GOODBYE": {
    meaning: "Farewell gesture",
    handshape: "Open hand, palm forward, fingers together",
    movement: "Wave hand side to side",
    mistakes: ["Waving too fast", "Not smiling", "Wrong hand orientation"],
    related: ["SEE YOU TOMORROW", "HELLO", "LATER"],
    conversations: ["GOODBYE -> SEE YOU TOMORROW", "GOODBYE -> TAKE CARE"],
    nextGesture: "SEE YOU TOMORROW",
    difficulty: "easy",
    category: "Farewell",
  },
  "WATER": {
    meaning: "Request or refer to water",
    handshape: "Hand forms 'W' shape with three fingers up",
    movement: "Tap index finger on chin twice",
    mistakes: ["Wrong finger formation", "Not using correct W handshape", "Tapping wrong location"],
    related: ["DRINK", "JUICE", "COLD", "THIRSTY"],
    conversations: ["WATER -> PLEASE -> THANK YOU", "THIRSTY -> WATER -> DRINK"],
    nextGesture: "PLEASE",
    difficulty: "medium",
    category: "Food",
  },
  "RICE": {
    meaning: "Refer to rice or food staple",
    handshape: "Pinch fingers and thumb together",
    movement: "Bring hand to mouth as if eating",
    mistakes: ["Confusing with EAT", "Wrong handshape", "Not completing motion to mouth"],
    related: ["FOOD", "EAT", "RICE", "CHICKEN"],
    conversations: ["HUNGRY -> RICE -> EAT", "RICE -> CHICKEN -> EAT"],
    nextGesture: "EAT",
    difficulty: "easy",
    category: "Food",
  },
  "FATHER": {
    meaning: "Refer to one's father",
    handshape: "Open hand, thumb extended",
    movement: "Tap thumb on forehead twice",
    mistakes: ["Tapping forehead too low", "Confusing with mother sign", "Using wrong handshape"],
    related: ["MOTHER", "PARENTS", "FAMILY"],
    conversations: ["FATHER -> MOTHER -> PARENTS", "FATHER -> DEAF -> FATHER"],
    nextGesture: "MOTHER",
    difficulty: "easy",
    category: "Introduction",
  },
  "MOTHER": {
    meaning: "Refer to one's mother",
    handshape: "Open hand, thumb extended",
    movement: "Tap thumb on chin twice",
    mistakes: ["Tapping chin too low", "Confusing with father sign"],
    related: ["FATHER", "PARENTS", "FAMILY"],
    conversations: ["MOTHER -> FATHER -> PARENTS", "MOTHER -> DEAF -> MOTHER"],
    nextGesture: "FATHER",
    difficulty: "easy",
    category: "Introduction",
  },
  "DEAF": {
    meaning: "Refer to Deaf identity or community",
    handshape: "Index finger pointing to ear, then to mouth",
    movement: "Point to ear then to mouth in sequence",
    mistakes: ["Not completing both points", "Wrong order", "Not showing pride in expression"],
    related: ["HARD OF HEARING", "DEAF BLIND", "SIGN LANGUAGE"],
    conversations: ["DEAF -> SIGN LANGUAGE -> LEARN", "DEAF -> PROUD"],
    nextGesture: "HARD OF HEARING",
    difficulty: "medium",
    category: "Introduction",
  },
  "HARD OF HEARING": {
    meaning: "Refer to hard of hearing identity",
    handshape: "Open hand near ear",
    movement: "Hand makes small horizontal movement near ear",
    mistakes: ["Wrong position", "Confusing with DEAF sign"],
    related: ["DEAF", "DEAF BLIND", "HEARING"],
    conversations: ["HARD OF HEARING -> DEAF COMMUNITY", "HARD OF HEARING -> PROUD"],
    nextGesture: "DEAF",
    difficulty: "medium",
    category: "Introduction",
  },
  "LEARN": {
    meaning: "Process of acquiring knowledge",
    handshape: "Open hand, palm up, fingers together",
    movement: "Hand moves from forehead forward and down, as if taking knowledge from head",
    mistakes: ["Starting too low", "Not showing acquisition motion", "Too fast"],
    related: ["STUDY", "TEACHER", "SCHOOL", "BOOK"],
    conversations: ["LEARN -> SIGN LANGUAGE -> TEACHER", "LEARN -> PRACTICE -> IMPROVE"],
    nextGesture: "PRACTICE",
    difficulty: "medium",
    category: "Education",
  },
  "TEACHER": {
    meaning: "Person who teaches",
    handshape: "Two open hands, palms facing, in front of chest",
    movement: "Hands move outward as if presenting",
    mistakes: ["Moving hands too far apart", "Wrong hand orientation"],
    related: ["STUDENT", "SCHOOL", "LEARN", "CLASS"],
    conversations: ["TEACHER -> LEARN -> STUDENT", "TEACHER -> CLASS -> LESSON"],
    nextGesture: "STUDENT",
    difficulty: "medium",
    category: "Education",
  },
  "HOSPITAL": {
    meaning: "Medical facility",
    handshape: "Open hand, palm facing chest, with 'H' handshape",
    movement: "Cross sign on upper arm as if indicating medical location",
    mistakes: ["Wrong handshape", "Crossing wrong location"],
    related: ["DOCTOR", "MEDICINE", "EMERGENCY", "SICK"],
    conversations: ["HOSPITAL -> DOCTOR -> MEDICINE", "SICK -> HOSPITAL -> DOCTOR"],
    nextGesture: "DOCTOR",
    difficulty: "hard",
    category: "Healthcare",
  },
  "EMERGENCY": {
    meaning: "Urgent situation requiring immediate help",
    handshape: "Open hand, palm out, held high",
    movement: "Rapid waving motion for attention",
    mistakes: ["Not urgent enough movement", "Too low hand position", "Not showing urgency in face"],
    related: ["HELP", "HOSPITAL", "DANGER", "ACCIDENT"],
    conversations: ["EMERGENCY -> HELP -> HOSPITAL", "EMERGENCY -> CALL -> POLICE"],
    nextGesture: "HELP",
    difficulty: "hard",
    category: "Emergency",
  },
  "COFFEE": {
    meaning: "The beverage coffee",
    handshape: "Closed fist as if holding a cup",
    movement: "Bring hand to mouth as if drinking from a cup",
    mistakes: ["Wrong handshape", "Not holding as if cup", "Confusing with other drinks"],
    related: ["TEA", "JUICE", "MILK", "HOT", "DRINK"],
    conversations: ["COFFEE -> PLEASE -> THANK YOU", "WANT -> COFFEE -> DRINK"],
    nextGesture: "DRINK",
    difficulty: "easy",
    category: "Food",
  },
  "BLUE": {
    meaning: "The color blue",
    handshape: "Open hand with 'B' handshape",
    movement: "Slight shake of the hand",
    mistakes: ["Wrong handshape", "Confusing with other color signs"],
    related: ["RED", "GREEN", "YELLOW", "COLOR"],
    conversations: ["BLUE -> RED -> GREEN", "COLOR -> BLUE -> NICE"],
    nextGesture: "RED",
    difficulty: "easy",
    category: "Introduction",
  },
  "ONE": {
    meaning: "Number one",
    handshape: "Index finger extended, others closed",
    movement: "Hold up index finger, palm forward",
    mistakes: ["Wrong finger extended", "Palm orientation wrong"],
    related: ["TWO", "THREE", "FOUR", "FIVE", "NUMBER"],
    conversations: ["ONE -> TWO -> THREE", "COUNT -> ONE -> TWO"],
    nextGesture: "TWO",
    difficulty: "easy",
    category: "Education",
  },
  "SORRY": {
    meaning: "Apology or regret",
    handshape: "Closed fist with circular motion on chest",
    movement: "Hand makes circular motion over heart area",
    mistakes: ["Wrong location", "Too large circles", "Not showing remorse in expression"],
    related: ["PLEASE", "UNDERSTAND", "WRONG"],
    conversations: ["SORRY -> OKAY -> UNDERSTAND", "SORRY -> PLEASE -> FORGIVE"],
    nextGesture: "UNDERSTAND",
    difficulty: "easy",
    category: "Response",
  },
};

export class ConversationCoach {
  getGestureCoachData(label: string): GestureCoachData | null {
    const normalized = label.toUpperCase().replace(/['']/g, "'");
    const entry = COACH_DATA[normalized];
    if (!entry) return null;

    return {
      label: normalized,
      displayName: this.getDisplayName(normalized),
      meaning: entry.meaning,
      handshape: entry.handshape,
      movementDescription: entry.movement,
      commonMistakes: entry.mistakes,
      relatedGestures: entry.related,
      sampleConversations: entry.conversations,
      recommendedNextGesture: entry.nextGesture,
      difficultyLevel: entry.difficulty as "easy" | "medium" | "hard",
      category: entry.category,
    };
  }

  getAllCoachData(): GestureCoachData[] {
    return Object.keys(COACH_DATA).map(label => this.getGestureCoachData(label)!);
  }

  getGesturesByDifficulty(difficulty: "easy" | "medium" | "hard"): GestureCoachData[] {
    return this.getAllCoachData().filter(g => g.difficultyLevel === difficulty);
  }

  getGesturesByCategory(category: string): GestureCoachData[] {
    return this.getAllCoachData().filter(g => g.category === category);
  }

  getBeginnerGestures(): GestureCoachData[] {
    return this.getGesturesByDifficulty("easy");
  }

  getRecommendedLearningPath(): string[] {
    return [
      "HELLO", "GOOD MORNING", "HOW ARE YOU", "IM FINE",
      "THANK YOU", "YOURE WELCOME", "NICE TO MEET YOU",
      "YES", "NO", "PLEASE", "SORRY",
      "UNDERSTAND", "GOODBYE", "SEE YOU TOMORROW",
      "FATHER", "MOTHER", "DEAF",
      "WATER", "RICE", "COFFEE",
      "ONE", "TWO", "THREE",
      "BLUE", "RED", "GREEN",
      "HOSPITAL", "HELP", "EMERGENCY",
    ];
  }

  private getDisplayName(label: string): string {
    const map: Record<string, string> = {
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
    };
    return map[label] ?? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  }

  isAvailable(label: string): boolean {
    return label.toUpperCase().replace(/['']/g, "'") in COACH_DATA;
  }

  getCount(): number {
    return Object.keys(COACH_DATA).length;
  }
}
