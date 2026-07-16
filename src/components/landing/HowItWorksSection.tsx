"use client";

import { Users, Video } from "lucide-react";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-[#FBF5E9] px-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-16">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[hsl(var(--primary-hsl))] uppercase mb-4 block">Choose how you communicate</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 mb-6">
            Two simple ways to connect
            </h2>
            <p className="text-lg text-stone-600">Choose the approach that fits your conversation.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[32px] shadow-sm border border-stone-100 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Video className="w-6 h-6 text-[hsl(var(--primary-hsl))]" />
                    </div>
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Sign to Text</h3>
                <p className="text-stone-600 leading-relaxed">
                    Sign in front of your camera and see your message appear as text. Pause between signs to keep each message clear.
                </p>
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-gray-200 rounded-[32px] pointer-events-none transition-colors" />
            </div>

            <div className="bg-white p-10 rounded-[32px] shadow-sm border border-stone-100 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-[hsl(var(--primary-hsl))]" />
                    </div>
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Type to Sign</h3>
                <p className="text-stone-600 leading-relaxed">
                    Type a word or choose a phrase to watch the matching FSL signs. It is a practical way to share and practice everyday messages.
                </p>
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-gray-200 rounded-[32px] pointer-events-none transition-colors" />
            </div>
        </div>
      </div>
    </section>
  );
}
