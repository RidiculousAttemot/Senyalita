export type AiReplyRequest = {
  gesture: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  language?: "en" | "tl";
};

export type AiReplyResult = {
  replies: string[];
  model: string;
};

let cachedAiReplies: Map<string, { replies: string[]; timestamp: number }> = new Map();
const CACHE_TTL = 60000;

export const fetchAiReplies = async (
  request: AiReplyRequest
): Promise<AiReplyResult> => {
  const cacheKey = `${request.gesture}_${(request.conversationHistory ?? []).slice(-2).map((m) => m.text).join("_")}_${request.language ?? "en"}`;
  const cached = cachedAiReplies.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { replies: cached.replies, model: "cache" };
  }

  try {
    const response = await fetch("/api/ai/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.warn("AI reply API returned", response.status);
      return { replies: getRuleBasedReplies(request.gesture, request.language ?? "en"), model: "rule-based" };
    }

    const data: AiReplyResult = await response.json();
    cachedAiReplies.set(cacheKey, { replies: data.replies, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.warn("AI reply fetch failed:", error);
    return { replies: getRuleBasedReplies(request.gesture, request.language ?? "en"), model: "rule-based" };
  }
};

export const getRuleBasedReplies = (gesture: string, language: "en" | "tl"): string[] => {
  const upper = gesture.toUpperCase();
  const db: Record<string, string[]> = {
    "THANK YOU": ["You're welcome", "My pleasure", "Glad to help"],
    "HELLO": ["Hello!", "Hi, how are you?", "Nice to see you"],
    "GOOD MORNING": ["Good morning!", "Good morning to you too", "Have a great day"],
    "HOW ARE YOU": ["I'm fine, thank you", "Doing well", "Not feeling well"],
    "IM FINE": ["Good to hear!", "Glad you're doing well", "That's great"],
    "NICE TO MEET YOU": ["Nice to meet you too", "Likewise", "Pleasure to meet you"],
    "YES": ["Great!", "Perfect", "I agree"],
    "NO": ["Okay, I understand", "No problem", "Maybe later"],
    "HELP": ["How can I help?", "I'm here to help", "Let me assist you"],
    "GOODBYE": ["Goodbye!", "See you later", "Take care"],
    "SORRY": ["No problem", "It's okay", "Don't worry about it"],
    "PLEASE": ["Of course", "Sure thing", "Absolutely"],
    "GOOD AFTERNOON": ["Good afternoon!", "Good afternoon to you", "How's your day going?"],
    "GOOD EVENING": ["Good evening!", "Good evening to you", "How was your day?"],
    "SEE YOU TOMORROW": ["See you tomorrow!", "Looking forward to it", "Have a good night"],
    "UNDERSTAND": ["Good, glad we're on the same page", "Perfect", "I understand too"],
    "DON'T UNDERSTAND": ["Let me explain again", "I'll repeat that", "Let me show you"],
    "KNOW": ["I know too", "That's right", "Yes, I know"],
    "DON'T KNOW": ["Let me find out", "I'll check", "Let me ask someone"],
  };

  if (language === "tl") {
    const tlDb: Record<string, string[]> = {
      "THANK YOU": ["Walang anuman", "Ikinalulugod ko", "Natutuwa akong makatulong"],
      "HELLO": ["Kamusta!", "Magandang araw!", "Kumusta ka?"],
      "GOOD MORNING": ["Magandang umaga!", "Magandang umaga rin!", "Sana maganda ang araw mo"],
      "HOW ARE YOU": ["Mabuti naman", "Okay lang", "Medyo pagod"],
      "GOODBYE": ["Paalam!", "Hanggang sa muli!", "Ingat lagi"],
      "YES": ["Oo!", "Tama", "Sige"],
      "NO": ["Hindi", "Okay lang", "Siguro mamaya"],
      "HELP": ["Paano kita matutulungan?", "Nandito ako para tumulong", "Ano ang kailangan mo?"],
      "SORRY": ["Walang problema", "Okay lang", "Huwag kang mag-alala"],
      "PLEASE": ["Oo naman", "Sige", "Walang anuman"],
    };
    return tlDb[upper] ?? ["Salamat!", "Okay", "Sige"];
  }

  return db[upper] ?? ["Hello!", "How can I help?", "Nice to meet you!"];
};
