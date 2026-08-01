import { AnimationInspector } from "@/components/admin/AnimationInspector";
import { requireAdmin } from "@/lib/supabase/queries/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnimationInspectorPage() {
  await requireAdmin();
  return <AnimationInspector />;
}
