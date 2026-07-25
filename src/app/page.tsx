import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureJourneySection } from "@/components/landing/FeatureJourneySection";
import { InteractiveShowcaseSection } from "@/components/landing/InteractiveShowcaseSection";
import { AccessibilitySection } from "@/components/landing/AccessibilitySection";
import { ResearchPipelineSection } from "@/components/landing/ResearchPipelineSection";
import { StatsSection } from "@/components/landing/StatsSection";

export default function HomePage() {
  return (
    <main className="min-h-screen flex-grow bg-senyalita-warm">
      <HeroSection />
      <FeatureJourneySection />
      <InteractiveShowcaseSection />
      <AccessibilitySection />
      <ResearchPipelineSection />
      <StatsSection />
    </main>
  );
}
