import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollectionOverviewView, type CollectionCampaign } from "@/components/admin/CollectionOverviewView";
import type { SessionDiversity, SignerProfile } from "@/lib/supabase/types";
import { readdirSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminCollectionPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [
    { data: pendingReviews },
    { data: approvedSamples },
    { data: signerProfiles },
    { data: diversitySessions },
    { count: totalPredictions },
  ] = await Promise.all([
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("training_samples").select("id", { count: "exact", head: true }),
    supabase.from("signer_profiles").select("*"),
    supabase.from("session_diversity_metadata").select("*"),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }),
  ]);

  // Load campaign definitions
  const campaignsDir = resolve(process.cwd(), "datasets/real_world/campaigns");
  let campaigns: CollectionCampaign[] = [];
  if (existsSync(campaignsDir)) {
    for (const f of readdirSync(campaignsDir).filter(f => f.startsWith("campaign_") && f.endsWith(".json"))) {
      try {
        const c = JSON.parse(readFileSync(resolve(campaignsDir, f), "utf-8"));
        const name = c.campaign;
        const target = c.target_samples ?? 20;
        let collected = 0;
        const campaignCollectionPath = resolve(process.cwd(), "datasets/real_world/collected", name.toLowerCase());
        if (existsSync(campaignCollectionPath)) {
          for (const collectedFile of readdirSync(campaignCollectionPath).filter((file) => file.endsWith(".json"))) {
            try {
              const collectedData = JSON.parse(readFileSync(resolve(campaignCollectionPath, collectedFile), "utf-8"));
              collected += collectedData.session?.samples_collected ?? 0;
            } catch {}
          }
        }
        campaigns.push({
          name,
          target,
          priority: `P${c.priority - 1}`,
          collected,
        });
      } catch {}
    }
  }

  // Load collected samples
  const collectedDir = resolve(process.cwd(), "datasets/real_world/collected");
  let collectedSamples = 0;
  let collectedSigners = new Set<string>();
  if (existsSync(collectedDir)) {
    for (const campaignDir of readdirSync(collectedDir)) {
      const campaignPath = resolve(collectedDir, campaignDir);
      if (!existsSync(campaignPath)) continue;
      for (const f of readdirSync(campaignPath).filter(f => f.endsWith(".json"))) {
        try {
          const data = JSON.parse(readFileSync(resolve(campaignPath, f), "utf-8"));
          collectedSamples += data.session?.samples_collected ?? 0;
          if (data.session?.signer_id) collectedSigners.add(data.session.signer_id);
        } catch {}
      }
    }
  }

  const pending = pendingReviews?.length ?? 0;
  const approved = approvedSamples?.length ?? 0;
  const signers = (signerProfiles ?? []) as SignerProfile[];
  const diversity = (diversitySessions ?? []) as SessionDiversity[];

  return <CollectionOverviewView campaigns={campaigns} diversitySessions={diversity} metrics={{ approvedSamples: approved, collectedSamples, pendingReviews: pending, registeredSigners: signers.length, totalPredictions: totalPredictions ?? 0 }} signers={signers} />;
}
