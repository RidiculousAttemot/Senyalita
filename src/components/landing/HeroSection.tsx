"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative px-6 py-24 md:py-32 overflow-hidden flex flex-col items-center justify-center min-h-[90vh]">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-[#E2B7A8]/30 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-[800px] mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto w-24 h-24 bg-gray-900 rounded-[28px] mb-12 flex items-center justify-center shadow-lg"
        >
          <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/>
            <circle cx="12" cy="13" r="4" fill="transparent" stroke="white" strokeWidth="2"/>
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 text-sm font-medium mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Filipino Sign Language, made easier
        </motion.div>

        <motion.h1 
          className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6 font-display"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Making conversations <br />
          <span className="text-[hsl(var(--primary-hsl))]">easier to share</span>
        </motion.h1>

        <motion.p 
          className="text-lg md:text-xl text-stone-600 mb-10 max-w-[600px] mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Senyalita helps turn Filipino Sign Language into text and written words into clear signs, making everyday conversations easier to follow.
        </motion.p>

        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link 
            href="/translate" 
            className="flex items-center justify-center bg-[hsl(var(--primary-hsl))] hover:bg-black text-white px-8 py-3.5 rounded-full font-medium transition-colors w-full sm:w-auto shadow-md"
          >
            Start translating <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
          <Link 
            href="#how-it-works" 
            className="flex items-center justify-center border border-stone-200 hover:border-stone-300 bg-white text-stone-700 px-8 py-3.5 rounded-full font-medium transition-colors w-full sm:w-auto shadow-sm"
          >
            See how it works
          </Link>
        </motion.div>

        <motion.div 
          className="mt-12 flex items-center justify-center gap-6 text-sm text-stone-500 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> Ready to communicate</span>
          <span className="w-1 h-1 rounded-full bg-stone-300"></span>
          <span>Use it wherever you are</span>
          <span className="w-1 h-1 rounded-full bg-stone-300"></span>
          <span>No sign-up</span>
        </motion.div>
      </div>

      {/* Floating Dialog Bubbles */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
        className="absolute top-1/4 left-[5%] md:left-[10%] bg-white p-4 rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 hidden md:block max-w-[200px]"
      >
        <span className="text-[10px] uppercase font-bold tracking-wider text-[hsl(var(--primary-hsl))] mb-1 block">A shared greeting</span>
        <p className="text-sm font-medium text-gray-800">&quot;Kumusta ka?&quot;</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute top-1/2 right-[5%] md:right-[10%] bg-white p-4 rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 hidden md:block max-w-[200px]"
      >
        <span className="text-[10px] uppercase font-bold tracking-wider text-green-600 mb-1 block">Made for everyday use</span>
        <p className="text-sm font-medium text-gray-800">Clearer conversations, one sign at a time</p>
      </motion.div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <motion.div
           animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }}
        >
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
        </motion.div>
      </div>
    </section>
  );
}