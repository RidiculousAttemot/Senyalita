import Link from "next/link";
import { SenyalitaMark } from "./SenyalitaMark";

const GITHUB_URL = "https://github.com/RidiculousAttemot/SignLangVisual";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Live Translation", href: "/translate" },
      { label: "Conversation Mode", href: "/conversation" },
      { label: "Learn FSL", href: "/learn" },
      { label: "History", href: "/history" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "How it works", href: "#research" },
      { label: "Accessibility commitments", href: "#accessibility" },
      { label: "Documentation", href: `${GITHUB_URL}/tree/main/docs`, external: true },
      { label: "Source on GitHub", href: GITHUB_URL, external: true },
    ],
  },
  {
    title: "Project",
    links: [{ label: "Admin Login", href: "/admin/login" }],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-senyalita-border bg-senyalita-dark text-slate-300">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <SenyalitaMark className="h-9 w-9" iconClassName="h-5 w-5" />
              <span className="font-display text-lg font-bold text-white">Senyalita</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              An undergraduate research thesis exploring AI-powered recognition and
              animation of Filipino Sign Language — built to help Deaf, Hard-of-Hearing,
              and hearing Filipinos understand each other, on-device and without an
              account.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              [University / department name] · BS Computer Science thesis, 2026
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-slate-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Senyalita. Built for accessible, inclusive communication.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>Research &amp; development: [add research team names]</span>
            <span className="hidden md:inline text-slate-700">&middot;</span>
            <span>Contact: [add team email] &middot; Academic use — thesis project</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
