import { AnimationStudio } from "@/components/admin/AnimationStudio";
import { requireAdmin } from "@/lib/supabase/queries/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnimationStudioPage() {
  await requireAdmin();
  return <AnimationStudio />;
}
