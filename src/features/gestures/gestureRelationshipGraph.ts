import { ConversationIntent } from "../conversation/types";

export type GestureNode = {
  label: string;
  displayName: string;
  category: "alphabet" | "phrase";
  conversationCategory: ConversationIntent;
  relatedGestures: string[];
  oppositeMeaning: string[];
  followUpGestures: string[];
  usageFrequency: number;
};

export type RelationshipEdge = {
  source: string;
  target: string;
  relationship: "related" | "opposite" | "follow_up" | "conversation_flow";
  weight: number;
};

type OppositePair = [string, string];

const OPPOSITE_PAIRS: OppositePair[] = [
  ["YES", "NO"],
  ["CORRECT", "WRONG"],
  ["HOT", "COLD"],
  ["LIGHT", "DARK"],
  ["FAST", "SLOW"],
  ["UNDERSTAND", "DON'T UNDERSTAND"],
  ["KNOW", "DON'T KNOW"],
  ["GOOD MORNING", "GOOD EVENING"],
  ["TODAY", "YESTERDAY"],
  ["TOMORROW", "YESTERDAY"],
  ["WHITE", "BLACK"],
  ["BOY", "GIRL"],
  ["MAN", "WOMAN"],
  ["FATHER", "MOTHER"],
  ["SON", "DAUGHTER"],
  ["GRANDFATHER", "GRANDMOTHER"],
  ["UNCLE", "AUNTIE"],
  ["HELLO", "GOODBYE"],
  ["SUGAR", "NO SUGAR"],
];

const FOLLOW_UP_CHAINS: Array<{ from: string; to: string; weight: number }> = [
  { from: "HELLO", to: "HOW ARE YOU", weight: 0.9 },
  { from: "HOW ARE YOU", to: "IM FINE", weight: 0.95 },
  { from: "IM FINE", to: "THANK YOU", weight: 0.85 },
  { from: "THANK YOU", to: "YOURE WELCOME", weight: 0.95 },
  { from: "YOURE WELCOME", to: "GOODBYE", weight: 0.5 },
  { from: "GOOD MORNING", to: "HOW ARE YOU", weight: 0.85 },
  { from: "GOOD AFTERNOON", to: "HOW ARE YOU", weight: 0.8 },
  { from: "GOOD EVENING", to: "HOW ARE YOU", weight: 0.8 },
  { from: "NICE TO MEET YOU", to: "NICE TO MEET YOU", weight: 0.85 },
  { from: "YES", to: "THANK YOU", weight: 0.6 },
  { from: "NO", to: "DON'T KNOW", weight: 0.5 },
  { from: "DON'T UNDERSTAND", to: "PLEASE", weight: 0.7 },
  { from: "DON'T UNDERSTAND", to: "SLOW", weight: 0.6 },
  { from: "DON'T KNOW", to: "HELP", weight: 0.7 },
  { from: "UNDERSTAND", to: "THANK YOU", weight: 0.7 },
  { from: "PLEASE", to: "THANK YOU", weight: 0.8 },
  { from: "HELP", to: "THANK YOU", weight: 0.7 },
  { from: "SEE YOU TOMORROW", to: "GOODBYE", weight: 0.8 },
  { from: "GOODBYE", to: "SEE YOU TOMORROW", weight: 0.8 },
  { from: "HOSPITAL", to: "EMERGENCY", weight: 0.8 },
  { from: "PAIN", to: "HOSPITAL", weight: 0.9 },
  { from: "PAIN", to: "HELP", weight: 0.85 },
  { from: "WATER", to: "DRINK", weight: 0.7 },
  { from: "FOOD", to: "EAT", weight: 0.7 },
  { from: "RICE", to: "FOOD", weight: 0.6 },
  { from: "CHICKEN", to: "FOOD", weight: 0.5 },
  { from: "FISH", to: "FOOD", weight: 0.5 },
  { from: "COFFEE", to: "DRINK", weight: 0.6 },
  { from: "JUICE", to: "DRINK", weight: 0.6 },
  { from: "MILK", to: "DRINK", weight: 0.6 },
  { from: "TEA", to: "DRINK", weight: 0.6 },
  { from: "BEER", to: "DRINK", weight: 0.5 },
  { from: "WINE", to: "DRINK", weight: 0.5 },
];

const GESTURE_TO_CATEGORY: Record<string, ConversationIntent> = {
  HELLO: "Greeting",
  "GOOD MORNING": "Greeting",
  "GOOD AFTERNOON": "Greeting",
  "GOOD EVENING": "Greeting",
  "HOW ARE YOU": "Greeting",
  "IM FINE": "Response",
  "NICE TO MEET YOU": "Introduction",
  "THANK YOU": "Response",
  "YOURE WELCOME": "Response",
  "SEE YOU TOMORROW": "Farewell",
  UNDERSTAND: "Response",
  "DON'T UNDERSTAND": "Response",
  KNOW: "Response",
  "DON'T KNOW": "Response",
  NO: "Response",
  YES: "Response",
  WRONG: "Response",
  CORRECT: "Response",
  SLOW: "Request",
  FAST: "Request",
  PLEASE: "Request",
  HELP: "Emergency",
  SORRY: "Response",
  GOODBYE: "Farewell",
  EMERGENCY: "Emergency",
  HOSPITAL: "Healthcare",
  DOCTOR: "Healthcare",
  MEDICINE: "Healthcare",
  PAIN: "Healthcare",
  SICK: "Healthcare",
  WATER: "Food",
  FOOD: "Food",
  EAT: "Food",
  DRINK: "Food",
  RICE: "Food",
  BREAD: "Food",
  MEAT: "Food",
  FISH: "Food",
  CHICKEN: "Food",
  SPAGHETTI: "Food",
  LONGANISA: "Food",
  SHRIMP: "Food",
  CRAB: "Food",
  JUICE: "Food",
  MILK: "Food",
  COFFEE: "Food",
  TEA: "Food",
  BEER: "Food",
  WINE: "Food",
  SUGAR: "Food",
  "NO SUGAR": "Food",
  HOT: "Food",
  COLD: "Food",
  FATHER: "Introduction",
  MOTHER: "Introduction",
  SON: "Introduction",
  DAUGHTER: "Introduction",
  GRANDFATHER: "Introduction",
  GRANDMOTHER: "Introduction",
  UNCLE: "Introduction",
  AUNTIE: "Introduction",
  COUSIN: "Introduction",
  PARENTS: "Introduction",
  BOY: "Introduction",
  GIRL: "Introduction",
  MAN: "Introduction",
  WOMAN: "Introduction",
  DEAF: "Introduction",
  "HARD OF HEARING": "Introduction",
  "WEELCHAIR PERSON": "Introduction",
  BLIND: "Introduction",
  "DEAF BLIND": "Introduction",
  MARRIED: "Introduction",
  TODAY: "Question",
  TOMORROW: "Question",
  YESTERDAY: "Question",
  MONDAY: "Education",
  TUESDAY: "Education",
  WEDNESDAY: "Education",
  THURSDAY: "Education",
  FRIDAY: "Education",
  SATURDAY: "Education",
  SUNDAY: "Education",
  JANUARY: "Education",
  FEBRUARY: "Education",
  MARCH: "Education",
  APRIL: "Education",
  MAY: "Education",
  JUNE: "Education",
  JULY: "Education",
  AUGUST: "Education",
  SEPTEMBER: "Education",
  OCTOBER: "Education",
  NOVEMBER: "Education",
  DECEMBER: "Education",
  ONE: "Education",
  TWO: "Education",
  THREE: "Education",
  FOUR: "Education",
  FIVE: "Education",
  SIX: "Education",
  SEVEN: "Education",
  EIGHT: "Education",
  NINE: "Education",
  TEN: "Education",
  BLUE: "Introduction",
  GREEN: "Introduction",
  RED: "Introduction",
  BROWN: "Introduction",
  BLACK: "Introduction",
  WHITE: "Introduction",
  YELLOW: "Introduction",
  ORANGE: "Introduction",
  GRAY: "Introduction",
  PINK: "Introduction",
  VIOLET: "Introduction",
  LIGHT: "Introduction",
  DARK: "Introduction",
  WANT: "Request",
  NEED: "Request",
  GIVE: "Request",
  SCHOOL: "Education",
  TEACHER: "Education",
  STUDENT: "Education",
  CLASS: "Education",
  LESSON: "Education",
  STUDY: "Education",
  LEARN: "Education",
  BOOK: "Education",
  READ: "Education",
  WRITE: "Education",
  CAR: "Transportation",
  BUS: "Transportation",
  JEEPNEY: "Transportation",
  TAXI: "Transportation",
  TRAIN: "Transportation",
  AIRPORT: "Transportation",
  STATION: "Transportation",
  TICKET: "Transportation",
  GO: "Transportation",
  COME: "Transportation",
  TRAVEL: "Transportation",
};

const ALL_GESTURES = new Set(Object.keys(GESTURE_TO_CATEGORY));

const EXTRA_CATEGORIES: Record<string, ConversationIntent> = {
  "COFFEE": "Food",
  "MILK": "Food",
  "TEA": "Food",
  "BEER": "Food",
  "WINE": "Food",
  "SUGAR": "Food",
  "NO SUGAR": "Food",
  "HOT": "Food",
  "COLD": "Food",
  "BLUE": "Introduction",
  "GREEN": "Introduction",
  "RED": "Introduction",
  "BROWN": "Introduction",
  "BLACK": "Introduction",
  "WHITE": "Introduction",
  "YELLOW": "Introduction",
  "ORANGE": "Introduction",
  "GRAY": "Introduction",
  "PINK": "Introduction",
  "VIOLET": "Introduction",
  "LIGHT": "Introduction",
  "DARK": "Introduction",
  "BOY": "Introduction",
  "GIRL": "Introduction",
  "MAN": "Introduction",
  "WOMAN": "Introduction",
  "DEAF": "Introduction",
  "HARD OF HEARING": "Introduction",
  "BLIND": "Introduction",
  "DEAF BLIND": "Introduction",
  "MARRIED": "Introduction",
  "ONE": "Education",
  "TWO": "Education",
  "THREE": "Education",
  "FOUR": "Education",
  "FIVE": "Education",
  "SIX": "Education",
  "SEVEN": "Education",
  "EIGHT": "Education",
  "NINE": "Education",
  "TEN": "Education",
};

for (const [k, v] of Object.entries(EXTRA_CATEGORIES)) {
  if (!GESTURE_TO_CATEGORY[k]) {
    (GESTURE_TO_CATEGORY as Record<string, ConversationIntent>)[k] = v;
  }
}

export class GestureRelationshipGraph {
  private nodes: Map<string, GestureNode> = new Map();
  private edges: RelationshipEdge[] = [];
  private usageFrequency: Map<string, number> = new Map();

  constructor() {
    this.buildGraph();
  }

  private buildGraph(): void {
    const allLabels = [...ALL_GESTURES];
    for (const label of allLabels) {
      const category = GESTURE_TO_CATEGORY[label] ?? "Unknown";
      const isAlpha = label.length === 1 || (label.length === 2 && (label === "ng" || label === "ñ"));
      const node: GestureNode = {
        label,
        displayName: this.getDisplayName(label),
        category: isAlpha ? "alphabet" : "phrase",
        conversationCategory: category,
        relatedGestures: [],
        oppositeMeaning: [],
        followUpGestures: [],
        usageFrequency: 0,
      };
      this.nodes.set(label, node);
    }

    for (const [a, b] of OPPOSITE_PAIRS) {
      const nodeA = this.nodes.get(a);
      const nodeB = this.nodes.get(b);
      if (nodeA && nodeB) {
        nodeA.oppositeMeaning.push(b);
        nodeB.oppositeMeaning.push(a);
        this.edges.push({ source: a, target: b, relationship: "opposite", weight: 1.0 });
      }
    }

    for (const chain of FOLLOW_UP_CHAINS) {
      const fromNode = this.nodes.get(chain.from);
      const toNode = this.nodes.get(chain.to);
      if (fromNode && toNode) {
        fromNode.followUpGestures.push(chain.to);
        this.edges.push({ source: chain.from, target: chain.to, relationship: "follow_up", weight: chain.weight });
      }
    }

    for (const label of allLabels) {
      const node = this.nodes.get(label);
      if (!node) continue;

      for (const other of allLabels) {
        if (other === label) continue;
        const otherNode = this.nodes.get(other);
        if (!otherNode) continue;

        if (node.conversationCategory === otherNode.conversationCategory && node.conversationCategory !== "Unknown") {
          if (!node.relatedGestures.includes(other) && !node.oppositeMeaning.includes(other) && !node.followUpGestures.includes(other)) {
            node.relatedGestures.push(other);
            this.edges.push({ source: label, target: other, relationship: "related", weight: 0.3 });
          }
        }
      }
    }
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
      "WEELCHAIR PERSON": "Wheelchair Person",
      "DEAF BLIND": "Deaf-Blind",
      "NO SUGAR": "No Sugar",
    };
    return map[label] ?? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  }

  getNode(label: string): GestureNode | undefined {
    return this.nodes.get(label.toUpperCase().replace(/['']/g, "'"));
  }

  getAllNodes(): GestureNode[] {
    return [...this.nodes.values()];
  }

  getEdges(): RelationshipEdge[] {
    return this.edges;
  }

  getGraphData(): { nodes: GestureNode[]; edges: RelationshipEdge[] } {
    return { nodes: this.getAllNodes(), edges: this.edges };
  }

  getConnectedGestures(label: string, maxDistance = 1): GestureNode[] {
    const normalized = label.toUpperCase().replace(/['']/g, "'");
    const node = this.nodes.get(normalized);
    if (!node) return [];

    const connected = new Set<string>();
    const addConnections = (lbl: string, distance: number) => {
      if (distance > maxDistance) return;
      const n = this.nodes.get(lbl);
      if (!n) return;

      for (const rel of n.relatedGestures) {
        if (!connected.has(rel)) {
          connected.add(rel);
          addConnections(rel, distance + 1);
        }
      }
      for (const opp of n.oppositeMeaning) {
        if (!connected.has(opp)) {
          connected.add(opp);
          addConnections(opp, distance + 1);
        }
      }
      for (const follow of n.followUpGestures) {
        if (!connected.has(follow)) {
          connected.add(follow);
          addConnections(follow, distance + 1);
        }
      }
    };

    addConnections(normalized, 0);

    return [...connected].map(l => this.nodes.get(l)!);
  }

  getFollowUpChain(label: string, depth = 5): string[] {
    const normalized = label.toUpperCase().replace(/['']/g, "'");
    const chain: string[] = [normalized];
    let current = normalized;

    for (let i = 0; i < depth; i++) {
      const node = this.nodes.get(current);
      if (!node || node.followUpGestures.length === 0) break;
      const next = node.followUpGestures[0];
      chain.push(next);
      current = next;
    }

    return chain;
  }

  recordUsage(label: string): void {
    const normalized = label.toUpperCase().replace(/['']/g, "'");
    const current = this.usageFrequency.get(normalized) ?? 0;
    this.usageFrequency.set(normalized, current + 1);
    const node = this.nodes.get(normalized);
    if (node) {
      node.usageFrequency = current + 1;
    }
  }

  getUsageFrequency(label: string): number {
    return this.usageFrequency.get(label.toUpperCase().replace(/['']/g, "'")) ?? 0;
  }

  getGesturesByCategory(category: ConversationIntent): GestureNode[] {
    return this.getAllNodes().filter(n => n.conversationCategory === category);
  }

  getMostFrequentGestures(limit = 10): GestureNode[] {
    return this.getAllNodes()
      .sort((a, b) => b.usageFrequency - a.usageFrequency)
      .slice(0, limit);
  }

  getLeastFrequentGestures(limit = 10): GestureNode[] {
    return this.getAllNodes()
      .sort((a, b) => a.usageFrequency - b.usageFrequency)
      .slice(0, limit);
  }
}
