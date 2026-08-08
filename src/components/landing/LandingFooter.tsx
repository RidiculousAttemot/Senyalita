import Link from "next/link";
import { SenyalitaMark } from "./SenyalitaMark";

const GITHUB_URL = "https://github.com/RidiculousAttemot/SignLangVisual";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Live Translation", href: "/translate" },
      { label: "Learn FSL", href: "/learn" },
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
  // No "Project" column. Its only entry was an admin login link, and the admin
  // surface is local-only and gated at both layers (c2b7990) — so on a
  // deployment that link led somewhere the visitor could not go, and it left a
  // one-item column carrying a heading heavier than its content. /admin is
  // reachable by typing it, which is who it is for.
];

export function LandingFooter() {
  return (
    <footer className="border-t border-senyalita-border bg-senyalita-dark text-slate-300">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-8">
        {/* Three tracks, not four: the fourth held the removed Project column,
            and leaving it turned the gap between Research and the page edge
            into an empty column the eye still reads as a missing one. */}
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-[1.6fr_1fr_1fr] lg:gap-x-16">
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
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-500">
              Taguig City University · CICT · BS Computer Science thesis, 2026
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

        {/* Three columns, one per piece of information.
            These were two blocks — the statement on the left, and the team and
            the contact details stacked together on the right. Stacking made
            them read as one paragraph of small grey text pushed into a corner,
            and the credit the team is owed is not a footnote to an email
            address. Equal thirds give each its own column, and the alignment of
            each follows its position so the row reads outward from the middle. */}
        <div className="mt-14 grid gap-6 border-t border-white/10 pt-8 text-xs leading-relaxed text-slate-500 md:grid-cols-3 md:items-start md:gap-8">
          <p>
            &copy; {new Date().getFullYear()} Senyalita. Built for accessible, inclusive communication.
          </p>
          <p className="md:text-center">
            Research &amp; development: Arwin D., Henry S., Gerard M., John Carlo A.
          </p>
          <p className="md:text-right">
            <a
              href="mailto:arwindante02@gmail.com"
              className="transition-colors hover:text-slate-300"
            >
              arwindante02@gmail.com
            </a>
            <span aria-hidden="true" className="px-2 text-slate-700">&middot;</span>
            Academic use — thesis project
          </p>
        </div>
      </div>
    </footer>
  );
}
