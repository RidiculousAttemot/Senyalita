"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Shield, BookOpen, Volume2, Globe } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-24 bg-[#FDF8F0] px-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-16">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[hsl(var(--primary-hsl))] uppercase mb-4 block">Built around people</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 mb-6">
            Private, welcoming, and easy to use
            </h2>
            <p className="text-lg text-stone-600">Designed to support communication with care, comfort, and respect.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <Shield className="w-5 h-5 text-[hsl(var(--primary-hsl))]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">Your privacy matters</h3>
                <p className="text-stone-500 text-xs leading-relaxed flex-grow">Your camera is used to help with your signs while you are using Senyalita.</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <BookOpen className="w-5 h-5 text-[hsl(var(--primary-hsl))]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">Learn by doing</h3>
                <p className="text-stone-500 text-xs leading-relaxed flex-grow">Practice FSL signs and build confidence through clear visual feedback.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <Volume2 className="w-5 h-5 text-[hsl(var(--primary-hsl))]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">Hear and read messages</h3>
                <p className="text-stone-500 text-xs leading-relaxed flex-grow">Listen to your transcript or read it together during a conversation.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <Globe className="w-5 h-5 text-[hsl(var(--primary-hsl))]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">Ready when you are</h3>
                <p className="text-stone-500 text-xs leading-relaxed flex-grow">Open Senyalita and begin without creating an account.</p>
            </div>
        </div>

        <motion.div 
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            className="md:max-w-[800px] mx-auto bg-gradient-to-br from-gray-50 to-white border border-gray-200 p-12 md:p-16 rounded-[40px] text-center shadow-xl shadow-gray-200/50 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
            <div className="mx-auto w-16 h-16 bg-gray-900 rounded-2xl mb-8 flex items-center justify-center shadow-md relative z-10">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/>
                    <circle cx="12" cy="13" r="4" fill="transparent" stroke="white" strokeWidth="2"/>
                </svg>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 mb-6 relative z-10">
                Start a translation session
            </h2>
            <p className="text-stone-600 mb-10 relative z-10">
                No installation or sign-up required. You can begin right away.
            </p>
            
            <Link 
                href="/translate" 
                className="inline-flex items-center justify-center bg-[hsl(var(--primary-hsl))] hover:bg-black text-white px-8 py-3.5 rounded-full font-medium transition-colors shadow-md relative z-10"
            >
                Open Senyalita <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
        </motion.div>
      </div>
    </section>
  );
}
