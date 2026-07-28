import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedResult } from "@/features/recognition/model";
import { ModelRegistryView, type ArchitectureMetrics } from "@/components/admin/ModelRegistryView";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loadBenchmark(): ArchitectureMetrics[] {
  const path = resolve(process.cwd(), "models/fsl_unified/benchmark.json");
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return data.architectures ?? [];
  } catch {
    return [];
  }
}

export default async function AdminModelsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: versions } = await supabase
    .from("model_versions")
    .select("*")
    .order("created_at", { ascending: false });

  const modelLoadResult = getCachedResult();
  const architectures = loadBenchmark();

  return <ModelRegistryView architectures={architectures} runtimeStatus={modelLoadResult.status} versions={versions ?? []} />;
}
