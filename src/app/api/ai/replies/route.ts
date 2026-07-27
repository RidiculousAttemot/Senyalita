import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitHeaders } from "@/server/http/rateLimit";

export const runtime = "nodejs";

type ReplyRequest = {
  gesture: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  language?: "en" | "tl";
};

type ReplyResponse = {
  replies: string[];
  model: string;
};

// This endpoint is deliberately public — it powers the conversation view for
// unauthenticated users — but each call spends money at an upstream LLM and
// interpolates caller-supplied text into a prompt. The caps below bound both
// the spend and the injection surface.
const MAX_GESTURE_CHARS = 80;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 300;
const RATE_LIMIT = { limit: 20, windowMs: 60_000, bucket: "ai-replies" };

/**
 * Strips characters that let caller text escape its line in the prompt.
 * Newlines are the important one: without this, a "gesture" containing
 * "\n\nIgnore previous instructions" reads as a new prompt directive.
 */
function sanitisePromptText(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")   // collapses newlines, tabs, line separators
    .replace(/[`]/g, "")
    .trim()
    .slice(0, maxChars);
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, RATE_LIMIT);
    if (!limit.allowed) {
      // Degrade rather than fail: the caller still gets usable replies, and no
      // upstream request is made.
      return NextResponse.json(
        { replies: generateFallbackReplies("", "en"), model: "rate-limited" },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }

    const body: ReplyRequest = await request.json();
    const language: "en" | "tl" = body?.language === "tl" ? "tl" : "en";
    const gesture = sanitisePromptText(body?.gesture, MAX_GESTURE_CHARS);
    const conversationHistory = Array.isArray(body?.conversationHistory)
      ? body.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
      : [];

    if (!gesture) {
      return NextResponse.json(
        { error: "A gesture label is required." },
        { status: 400, headers: rateLimitHeaders(limit) },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.AI_API_BASE_URL || "https://api.openai.com/v1";

    if (!apiKey) {
      return NextResponse.json(
        { replies: generateFallbackReplies(gesture, language), model: "rule-based" },
        { status: 200, headers: rateLimitHeaders(limit) }
      );
    }

    const historyText = conversationHistory
      .map((m) => `${m.sender === "signer" ? (language === "tl" ? "Bingi" : "Signer") : language === "tl" ? "Tagatugon" : "Responder"}: ${sanitisePromptText(m.text, MAX_MESSAGE_CHARS)}`)
      .join("\n");

    const systemPrompt = language === "tl"
      ? `Ikaw ay isang assistant para sa Filipino Sign Language communication. Ang nakaraang usapan ay:\n${historyText || "Wala pang usapan."}\n\nAng kilos na kinilala ay: "${gesture}".\n\nMagmungkahi ng 3-5 natural na tugon sa Filipino/Ingles. Ibalik lamang ang mga tugon, isa sa bawat linya.`
      : `You are a Filipino Sign Language communication assistant. The conversation history is:\n${historyText || "No prior conversation."}\n\nThe recognized gesture is: "${gesture}".\n\nSuggest 3-5 natural, context-aware replies in English. Return only the replies, one per line.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gesture: ${gesture}` },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI reply generation failed:", response.status, errorText);
      return NextResponse.json(
        { replies: generateFallbackReplies(gesture, language), model: "rule-based-fallback" },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const replies = content
      .split("\n")
      .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((l) => l.length > 0 && !l.startsWith("-"))
      .slice(0, 5);

    if (replies.length === 0) {
      return NextResponse.json(
        { replies: generateFallbackReplies(gesture, language), model: "rule-based-empty" },
        { status: 200, headers: rateLimitHeaders(limit) }
      );
    }

    return NextResponse.json(
      { replies, model: "gpt-4o-mini" },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    console.error("AI reply error:", error);
    return NextResponse.json(
      { replies: ["Hello!", "How can I help?", "Nice to meet you!"], model: "error-fallback" },
      { status: 200 }
    );
  }
}

function generateFallbackReplies(gesture: string, language: "en" | "tl"): string[] {
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
  };

  if (language === "tl") {
    const tlDb: Record<string, string[]> = {
      "THANK YOU": ["Walang anuman", "Ikinalulugod ko", "Natutuwa akong makatulong"],
      "HELLO": ["Kamusta!", "Magandang araw!", "Kumusta ka?"],
      "GOOD MORNING": ["Magandang umaga!", "Magandang umaga rin!", "Sana maganda ang araw mo"],
      "HOW ARE YOU": ["Mabuti naman", "Okay lang", "Medyo pagod"],
      "GOODBYE": ["Paalam!", "Hanggang sa muli!", "Ingat lagi"],
    };
    return tlDb[upper] ?? ["Salamat!", "Okay", "Sige"];
  }

  return db[upper] ?? ["Hello!", "How can I help?", "Nice to meet you!"];
}
