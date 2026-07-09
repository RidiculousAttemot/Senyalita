import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KnowledgeBaseEditor } from "./editor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminKnowledgeBasePage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: kb } = await supabase.from("gesture_knowledge_base").select("*").order("label");
  return (
    <div>
      <h2>Gesture Knowledge Base</h2>
      <p className="panel-note">Central management for all 133 gestures — edit metadata, difficulty, replies, and related gestures.</p>
      <KnowledgeBaseEditor initial={kb ?? []} />
    </div>
  );
}
