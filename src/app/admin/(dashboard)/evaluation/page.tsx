import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvaluationDashboard } from "./evaluationDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminEvaluationPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  
  const { data: sessions } = await supabase
    .from("conversation_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  
  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  
  return <EvaluationDashboard sessions={sessions ?? []} feedback={feedback ?? []} profiles={[]} />;
}
