import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { TranslationDebugPanel } from "@/features/translation-pipeline/debug/TranslationDebugPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TranslationDebugPage() {
  await requireAdmin();
  return <TranslationDebugPanel />;
}
