"use client";

import { motion } from "framer-motion";

export function FeaturesSection() {
  return (
    <section className="py-24 bg-[#FDF8F0] px-6">
      <div className="max-w-[1000px] mx-auto text-center">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[hsl(var(--primary-hsl))] uppercase mb-4 block">Made for connection</span>
        <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 mb-6 max-w-[600px] mx-auto leading-tight">
          Everyday communication, made clearer
        </h2>
        <p className="text-lg text-stone-600 max-w-[700px] mx-auto mb-16 leading-relaxed">
          Use signs, text, and visual guidance to make conversations more accessible for FSL signers, learners, families, and communities.
        </p>

        <div className="grid md:grid-cols-3 gap-6 text-left">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100"
          >
            <h3 className="text-4xl font-display font-bold text-[hsl(var(--primary-hsl))] mb-4">Sign to text</h3>
            <p className="text-gray-900 font-medium mb-4">Use your camera to turn the signs you make into words.</p>
            <p className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">Made for clear expression</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100"
          >
            <h3 className="text-4xl font-display font-bold text-[hsl(var(--primary-hsl))] mb-4">Text to sign</h3>
            <p className="text-gray-900 font-medium mb-4">Enter a word or phrase and follow the sign animation.</p>
            <p className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">Learn at your own pace</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100"
          >
            <h3 className="text-4xl font-display font-bold text-[hsl(var(--primary-hsl))] mb-4">Start freely</h3>
            <p className="text-gray-900 font-medium mb-4">Open Senyalita and begin communicating without an account.</p>
            <p className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">No sign-up needed</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
