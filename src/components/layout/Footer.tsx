"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function Footer() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname?.startsWith("/admin/")) {
    return null;
  }

  // Landing page ("/") gets its own richer footer — scoped here so the
  // simpler footer used by /translate, /learn, /conversation, etc. is untouched.
  if (pathname === "/") {
    return <LandingFooter />;
  }

  return (
    <footer className="bg-[#FDF8F0] border-t border-stone-200/50">
      <div className="max-w-[1000px] mx-auto px-6 py-16">
        <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold tracking-[0.2em] text-stone-400 uppercase mb-4 block">A project by team</span>
            <div className="flex items-center gap-2 mb-12">
              <span className="font-display text-2xl font-bold text-gray-900 tracking-tight">
                Senyalita
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-12">
                <Link href="#why-it-matters" className="text-sm font-medium text-stone-500 hover:text-gray-900 transition-colors">Why it matters</Link>
                <Link href="#how-it-works" className="text-sm font-medium text-stone-500 hover:text-gray-900 transition-colors">How you use it</Link>
                <Link href="#principles" className="text-sm font-medium text-stone-500 hover:text-gray-900 transition-colors">Principles</Link>
                <Link href="/admin/login" className="text-sm font-medium text-stone-300 hover:text-stone-500 transition-colors">Admin Login</Link>
            </div>
            
            <p className="text-xs text-stone-400">
                © {new Date().getFullYear()} Senyalita FSL Thesis Project. Built for inclusive communication.
            </p>
        </div>
      </div>
    </footer>
  );
}
