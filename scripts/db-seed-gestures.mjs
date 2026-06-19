// Seed the gesture library with 10 phrases + their suggested replies.
// Idempotent: ON CONFLICT (label) DO NOTHING for gestures, and we
// re-insert replies only if they don't already exist for the gesture.

import pg from "pg";

const GESTURES = [
  {
    label: "HELLO",
    description: "A friendly greeting wave — open palm, side-to-side motion.",
    replies: ["Hello!", "Hi there.", "Hey, good to see you.", "Greetings."]
  },
  {
    label: "THANK YOU",
    description: "Flat hand to chin, then forward — universal sign of gratitude.",
    replies: ["You're welcome.", "No problem.", "My pleasure.", "Glad I could help."]
  },
  {
    label: "YES",
    description: "Closed fist nodding up and down.",
    replies: ["Yes.", "Absolutely.", "Sure thing.", "Definitely."]
  },
  {
    label: "NO",
    description: "Index and middle finger tap against thumb.",
    replies: ["No.", "Not right now.", "Sorry, I can't.", "Negative."]
  },
  {
    label: "GOOD MORNING",
    description: "Flat hand rising from low to high in front of the body.",
    replies: ["Good morning!", "Morning!", "Hope you slept well.", "Have a great day."]
  },
  {
    label: "GOOD AFTERNOON",
    description: "Flat hand held horizontally, moving slightly forward.",
    replies: ["Good afternoon.", "Hope your day is going well.", "Afternoon!", "Hello."]
  },
  {
    label: "GOOD EVENING",
    description: "Flat hand held horizontally, lowered slightly.",
    replies: ["Good evening.", "Hope you had a good day.", "Evening!", "Hello."]
  },
  {
    label: "PLEASE",
    description: "Flat hand circling on the chest.",
    replies: ["Please.", "If you don't mind.", "Could you…?", "Would you…?"]
  },
  {
    label: "SORRY",
    description: "Closed fist circling on the chest.",
    replies: ["I'm sorry.", "My apologies.", "I didn't mean that.", "Pardon me."]
  },
  {
    label: "HELP",
    description: "Closed fist resting on the open palm, both lifted upward.",
    replies: ["I need help.", "Please assist me.", "Can you help?", "I'm in trouble."]
  }
];

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const main = async () => {
  await client.connect();
  let insertedG = 0, existingG = 0, insertedR = 0, existingR = 0;
  for (let i = 0; i < GESTURES.length; i += 1) {
    const g = GESTURES[i];
    const { rows } = await client.query(
      `INSERT INTO public.gestures (label, description, is_active, display_order)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (label) DO UPDATE SET description = EXCLUDED.description
       RETURNING id, (xmax = 0) AS inserted`,
      [g.label, g.description, 100 + i]
    );
    const id = rows[0].id;
    if (rows[0].inserted) insertedG += 1; else existingG += 1;
    for (let j = 0; j < g.replies.length; j += 1) {
      const r = g.replies[j];
      const { rows: rrows } = await client.query(
        `INSERT INTO public.gesture_replies (gesture_id, reply_text, display_order, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [id, r, j]
      );
      if (rrows.length > 0) insertedR += 1; else existingR += 1;
    }
  }
  await client.end();
  console.log(`Gestures: ${insertedG} new, ${existingG} updated/existing.`);
  console.log(`Replies:  ${insertedR} new, ${existingR} skipped (likely duplicates).`);
};

main().catch((e) => { console.error(e); process.exit(1); });
