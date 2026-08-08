"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TypeToSignInterface } from "@/features/type-to-sign/TypeToSignInterface";
import { TranslateHeaderActions } from "@/features/type-to-sign/TranslateHeaderActions";

// Defers the sign-to-text chunk (TF.js model loader, MediaPipe wiring) until
// the user actually opens this tab — the default tab is type-to-sign, so
// most sessions never need to download it at all.
const SignToTextInterface = dynamic(
  () => import("@/features/sign-to-text/SignToTextInterface").then((m) => m.SignToTextInterface),
  {
    loading: () => (
      <div className="mx-auto grid max-w-[1160px] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[470px] w-full rounded-2xl" />
        <Skeleton className="h-[470px] w-full rounded-2xl" />
      </div>
    ),
    ssr: false,
  },
);

export default function TranslatePage() {
  const [activeTab, setActiveTab] = useState<"sign-to-text" | "type-to-sign">("type-to-sign");

  useEffect(() => {
    const updateActiveTab = (event: Event) => {
      const mode = (event as CustomEvent<"type-to-sign" | "sign-to-text">).detail;
      if (mode === "type-to-sign" || mode === "sign-to-text") setActiveTab(mode);
    };

    window.addEventListener("senyalita:translation-mode", updateActiveTab);
    return () => window.removeEventListener("senyalita:translation-mode", updateActiveTab);
  }, []);

  return (
    // Background and the <main> landmark now come from PublicShell, so this is
    // just the page's own width and padding.
    <div className="overflow-hidden">
      <TranslateHeaderActions />
      <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-6 md:px-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsContent value="sign-to-text" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <SignToTextInterface />
          </TabsContent>
          <TabsContent value="type-to-sign" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <TypeToSignInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
