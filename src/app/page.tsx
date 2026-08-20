import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureJourneySection } from "@/components/landing/FeatureJourneySection";
import { InteractiveShowcaseSection } from "@/components/landing/InteractiveShowcaseSection";
import { LearnSection } from "@/components/landing/LearnSection";
import { AccessibilitySection } from "@/components/landing/AccessibilitySection";
import { ResearchPipelineSection } from "@/components/landing/ResearchPipelineSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { unstable_cache } from "next/cache";
import { listPublishedGlosses } from "@/lib/supabase/queries/animationAssets";

/**
 * Rebuilt hourly rather than pinned at deploy or fetched per visit.
 *
 * The landing page states how many signs you can play, and that number lives in
 * the database -- publishing changes it with no code change and no deploy. It
 * was a literal, 37, and the 91-sign batch made the page wrong by a factor of
 * three and a half without anything failing.
 *
 * Three ways to derive it, and this is the least costly. Fetching client-side
 * would add a request to a page whose whole budget is ~258KB and would show a
 * number that pops in. Full dynamic rendering would put a database round trip
 * in front of every visitor for a figure that changes a few times a month. ISR
 * keeps the page served from cache and lets the count catch up within the hour.
 *
 * `unstable_cache` is load-bearing, not decoration. The Supabase service client
 * pins `cache: "no-store"` on every fetch on purpose -- it hands out time-bound
 * signed URLs, and a memoised one expires in a warm function -- and that alone
 * marks this route dynamic, which is the outcome this comment argues against.
 * Caching the count as a value rather than as a fetch keeps the service
 * client's guarantee intact and the page out of per-request rendering. Measured
 * both ways: without it the build reports `ƒ /`, with it `● /`.
 */
export const revalidate = 3600;

/**
 * How many published signs there are, or null if the database could not say.
 *
 * Null rather than a fallback literal, deliberately. A stale constant is the
 * failure being fixed here, and it is worse than an absent figure because it
 * looks authoritative. The sections drop the claim instead.
 */
const countPublished = unstable_cache(
  async () => (await listPublishedGlosses()).length,
  ["landing-published-sign-count"],
  { revalidate: 3600 },
);

async function publishedSignCount(): Promise<number | null> {
  try {
    return await countPublished();
  } catch (error) {
    console.error(
      "[landing] could not read the published sign count:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export default async function HomePage() {
  const published = await publishedSignCount();

  return (
    <main className="min-h-screen flex-grow bg-senyalita-warm">
      <HeroSection />
      <FeatureJourneySection />
      <InteractiveShowcaseSection />
      <LearnSection publishedSignCount={published} />
      <AccessibilitySection />
      <ResearchPipelineSection />
      <StatsSection publishedSignCount={published} />
    </main>
  );
}
