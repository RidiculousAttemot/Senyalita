import { AnimationDatasetManager } from "@/components/admin/AnimationDataset";
import { requireAdmin } from "@/lib/supabase/queries/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnimationDatasetRoute() {
  await requireAdmin();
  return <AnimationDatasetManager />;
}
