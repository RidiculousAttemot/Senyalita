import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { TranslationEvaluation } from "@/features/translation-pipeline/debug/TranslationEvaluation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TranslationEvaluationPage() {
  await requireAdmin();
  return <TranslationEvaluation />;
}
