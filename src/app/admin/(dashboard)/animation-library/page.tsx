import { AnimationLibraryPage } from "@/components/admin/AnimationLibrary";
import { requireAdmin } from "@/lib/supabase/queries/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnimationLibraryRoute() {
  await requireAdmin();
  return <AnimationLibraryPage />;
}
