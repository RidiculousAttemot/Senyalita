"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SignToTextInterface } from "@/features/sign-to-text/SignToTextInterface";
import { TypeToSignInterface } from "@/features/type-to-sign/TypeToSignInterface";

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
    <div className="min-h-screen bg-[#FDF8F0] overflow-hidden">
      <main className="flex-grow max-w-[1400px] mx-auto px-4 md:px-6 pt-5 pb-12">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsContent value="sign-to-text" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <SignToTextInterface />
          </TabsContent>
          <TabsContent value="type-to-sign" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <TypeToSignInterface />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
