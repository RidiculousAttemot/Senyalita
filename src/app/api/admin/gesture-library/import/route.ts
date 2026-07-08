import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertGesture, upsertReply } from "@/lib/supabase/queries/gestures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LABELS_PATH = join(
  process.cwd(),
  "public",
  "models",
  "fsl_unified",
  "bilstm_tfjs",
  "labels.json"
);

const DEFAULT_REPLIES: Record<string, string[]> = {
  greeting: ["Hello!", "How are you?", "Nice to see you"],
  survival: ["I understand", "I don't know", "Please repeat"],
  number: ["Number {label}", "Count again"],
  calendar: ["Month {label}", "Mark my calendar"],
  days: ["Day {label}", "Schedule it", "What day?"],
  family: ["My {label}", "Family member", "Tell me more"],
  relationships: ["I understand", "That's good to know"],
  color: ["Color {label}", "Nice color", "I like that color"],
  food: ["I want {label}", "Delicious!", "Let's eat"],
  drink: ["I want {label}", "Refreshing", "Another please"],
  alphabet: ["Letter {label}", "Spell it again"],
};

const GREETING_LABELS = new Set([
  "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HELLO",
  "HOW ARE YOU", "IM FINE", "NICE TO MEET YOU", "THANK YOU",
  "YOURE WELCOME", "SEE YOU TOMORROW",
]);
const SURVIVAL_LABELS = new Set([
  "UNDERSTAND", "DON'T UNDERSTAND", "KNOW", "DON'T KNOW",
  "NO", "YES", "WRONG", "CORRECT", "SLOW", "FAST",
]);
const CALENDAR_LABELS = new Set([
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
]);
const DAYS_LABELS = new Set([
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY",
  "SATURDAY", "SUNDAY", "TODAY", "TOMORROW", "YESTERDAY",
]);
const FAMILY_LABELS = new Set([
  "FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER",
  "GRANDMOTHER", "UNCLE", "AUNTIE", "COUSIN", "PARENTS",
]);
const RELATIONSHIPS_LABELS = new Set([
  "BOY", "GIRL", "MAN", "WOMAN", "DEAF", "HARD OF HEARING",
  "WHEELCHAIR PERSON", "BLIND", "DEAF BLIND", "MARRIED",
]);
const COLOR_LABELS = new Set([
  "BLUE", "GREEN", "RED", "BROWN", "BLACK", "WHITE", "YELLOW",
  "ORANGE", "GRAY", "PINK", "VIOLET", "LIGHT", "DARK",
]);
const FOOD_LABELS = new Set([
  "BREAD", "EGG", "FISH", "MEAT", "CHICKEN", "SPAGHETTI",
  "RICE", "LONGANISA", "SHRIMP", "CRAB",
]);
const DRINK_LABELS = new Set([
  "HOT", "COLD", "JUICE", "MILK", "COFFEE", "TEA", "BEER",
  "WINE", "SUGAR", "NO SUGAR",
]);

const getCategory = (label: string): string => {
  const u = label.toUpperCase();
  if (GREETING_LABELS.has(u)) return "greeting";
  if (SURVIVAL_LABELS.has(u)) return "survival";
  if (CALENDAR_LABELS.has(u)) return "calendar";
  if (DAYS_LABELS.has(u)) return "days";
  if (FAMILY_LABELS.has(u)) return "family";
  if (RELATIONSHIPS_LABELS.has(u)) return "relationships";
  if (COLOR_LABELS.has(u)) return "color";
  if (FOOD_LABELS.has(u)) return "food";
  if (DRINK_LABELS.has(u)) return "drink";
  if (/^[A-Z]$/.test(u) || u === "Ñ" || u === "NG") return "alphabet";
  if (/^[0-9]+$/.test(u.replace(/^NUMBER\s*/i, ""))) return "number";
  return "default";
};

export const POST = async () => {
  try {
    await requireAdmin();

    // 1. Read model labels
    const raw = readFileSync(LABELS_PATH, "utf8");
    const { labels: modelLabels } = JSON.parse(raw) as { labels: string[] };
    const supabase = await createSupabaseServerClient();

    // 2. Get existing gesture labels
    const { data: existing } = await supabase
      .from("gestures")
      .select("label");
    const existingLabels = new Set((existing ?? []).map((r) => r.label));

    // 3. Find missing
    const missing = modelLabels.filter((l) => !existingLabels.has(l));
    const errors: string[] = [];

    // 4. Insert missing gestures + replies
    for (const label of missing) {
      try {
        const displayOrder = modelLabels.indexOf(label) + 1000;
        const description = `FSL sign: ${label}`;
        const gesture = await upsertGesture({
          label,
          description,
          display_order: displayOrder,
          is_active: true,
          status: "approved",
        });

        // Insert default replies
        const category = getCategory(label);
        const templates = DEFAULT_REPLIES[category] ?? ["I understand", "Good"];
        const replies = templates.map((t) => t.replace("{label}", label.toLowerCase()));
        for (let idx = 0; idx < replies.length; idx++) {
          await upsertReply({
            gesture_id: gesture.id,
            reply_text: replies[idx],
            display_order: idx + 1,
          });
        }
      } catch (e) {
        errors.push(`${label}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    return NextResponse.json({
      modelLabels: modelLabels.length,
      dbLabels: existingLabels.size,
      inserted: missing.length,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};
