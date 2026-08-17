"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Hand, Search, Video } from "lucide-react";
import { Badge, SectionHeader, SurfaceCard, inputClasses } from "@/components/ui/surfaces";
import { LearnSignPlayer } from "@/features/learn/LearnSignPlayer";
import {
  ALPHABET,
  NUMBERS,
  buildVocabulary,
  matchesQuery,
  type VocabularyEntry,
} from "@/lib/learn/vocabulary";
import tutorialData from "@/data/tutorials.json";

const LABELS_URL = "/models/fsl_unified/bilstm_tfjs/labels.json";
// The published library. The route caches it for 30s, so a newly published sign
// appears here quickly without every visitor reaching the database.
const PUBLISHED_URL = "/api/animations";

type Tutorial = {
  id: string;
  title: string;
  url: string;
  topic: string;
  creator: string;
  kind: string;
  note: string;
};

const TOPICS = tutorialData.topics as Array<{ id: string; label: string }>;
const TUTORIALS = tutorialData.tutorials as Tutorial[];

export default function LearnPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("A");
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [publishedGlosses, setPublishedGlosses] = useState<string[]>([]);

  /**
   * Two sources, neither of them a copy checked in here.
   *
   * labels.json is the model's own label list, so retraining cannot silently
   * desync the page from what the camera recognises. /api/animations is the
   * published library, so publishing a sign cannot silently desync it from what
   * can actually be played — which is exactly what happened when THANK YOU went
   * live and this page went on calling it unanimated.
   */
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(LABELS_URL)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: { labels?: string[] } | string[]) => (Array.isArray(data) ? data : data.labels ?? []))
        .catch(() => [] as string[]),
      fetch(PUBLISHED_URL)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: { glosses?: string[] }) => data.glosses ?? [])
        .catch(() => [] as string[]),
    ]).then(([labels, glosses]) => {
      if (cancelled) return;
      setPublishedGlosses(glosses);
      setVocabulary(buildVocabulary(labels, glosses));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The alphabet grid, from the library rather than from A-Z and 0-10 literals.
   *
   * Those constants were accurate the day they were written and are a claim
   * about the database, not a fact of the alphabet — if a letter were ever
   * unpublished the grid would still offer it and the stage would fail to load.
   * Falls back to the literals only while the fetch is in flight, so the grid
   * is never empty on first paint.
   */
  const signs = useMemo(() => {
    const fromLibrary = publishedGlosses
      .filter((g) => g.length === 1 || NUMBERS.includes(g))
      .sort((a, b) => {
        const numeric = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
        const [na, nb] = [numeric(a), numeric(b)];
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        if (!Number.isNaN(na)) return 1;
        if (!Number.isNaN(nb)) return -1;
        return a.localeCompare(b);
      });
    const source = fromLibrary.length > 0 ? fromLibrary : [...ALPHABET, ...NUMBERS];
    return source.filter((g) => matchesQuery(g, query));
  }, [publishedGlosses, query]);
  const phrases = useMemo(
    () => vocabulary.filter((v) => matchesQuery(v.label, query) || matchesQuery(v.category, query)),
    [vocabulary, query],
  );
  const tutorials = useMemo(
    () =>
      TUTORIALS.filter(
        (t) => matchesQuery(t.title, query) || matchesQuery(t.creator, query) || matchesQuery(t.topic, query),
      ),
    [query],
  );

  const playable = phrases.filter((p) => p.gloss);
  const recognisedOnly = phrases.filter((p) => !p.gloss);

  return (
    <div className="min-h-screen bg-senyalita-warm">
      <main id="main-content" className="mx-auto max-w-[1160px] px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-8">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-senyalita-primary">
            Learn FSL
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-senyalita-dark sm:text-4xl">
            The signs this system knows
          </h1>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-senyalita-muted">
            Every letter and number below has a recorded sign you can play. The phrase list is what
            the camera can recognise when you sign to it — a different, larger set, and most of it
            has no animation yet.
          </p>
        </header>

        <div className="sticky top-2 z-10 mb-8">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-senyalita-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search letters, phrases, tutorials…"
              aria-label="Search the learning material"
              data-testid="learn-search"
              className={inputClasses("light", "w-full pl-9")}
            />
          </div>
        </div>

        {/* 1. ALPHABET & NUMBERS — the 37 glosses with a published animation. */}
        <SurfaceCard tone="light" className="mb-8 p-5 sm:p-6" data-testid="section-alphabet">
          <SectionHeader tone="light" icon={<Hand className="h-4 w-4" />}>
            Alphabet &amp; numbers
          </SectionHeader>
          <p className="mt-2 text-sm text-senyalita-muted">
            {ALPHABET.length} letters and {NUMBERS.length} numbers, each with a recorded sign.
          </p>

          {signs.length === 0 ? (
            <p className="py-6 text-center text-sm text-senyalita-muted">
              Nothing here matches “{query}”.
            </p>
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
              <div className="order-2 lg:order-1">
                <LearnSignPlayer gloss={selected} />
              </div>

              <div
                className="order-1 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:order-2 lg:grid-cols-9"
                role="group"
                aria-label="Choose a letter or number"
              >
                {signs.map((gloss) => (
                  <button
                    key={gloss}
                    type="button"
                    onClick={() => setSelected(gloss)}
                    aria-pressed={selected === gloss}
                    data-testid={`sign-${gloss}`}
                    className={`flex aspect-square items-center justify-center rounded-xl border font-display text-lg font-bold transition-all duration-150 ${
                      selected === gloss
                        ? "border-senyalita-primary bg-senyalita-primary text-white shadow-md"
                        : "border-senyalita-border bg-white text-senyalita-dark hover:-translate-y-0.5 hover:border-senyalita-primary/40 hover:text-senyalita-primary"
                    }`}
                  >
                    {gloss}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SurfaceCard>

        {/* 2. RECOGNITION VOCABULARY — what the camera knows, not what animates. */}
        <SurfaceCard tone="light" className="mb-8 p-5 sm:p-6" data-testid="section-phrases">
          <SectionHeader tone="light" icon={<BookOpen className="h-4 w-4" />}>
            Signs &amp; phrases the camera recognises
          </SectionHeader>
          <p className="mt-2 text-sm text-senyalita-muted">
            Sign these to the camera on Sign → Text. Most have no animation yet, so they are listed
            rather than played.
          </p>

          {playable.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-senyalita-muted">
                Playable ({playable.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {playable.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={() => entry.gloss && setSelected(entry.gloss)}
                    data-testid={`phrase-${entry.label}`}
                    className="rounded-full border border-senyalita-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-senyalita-primary transition-colors hover:bg-senyalita-primary hover:text-white"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-senyalita-muted">
              Recognised, no animation yet ({recognisedOnly.length})
            </p>
            {recognisedOnly.length === 0 ? (
              <p className="py-4 text-sm text-senyalita-muted">
                {vocabulary.length === 0
                  ? "Vocabulary list unavailable — the model labels could not be read."
                  : `Nothing matches “${query}”.`}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {recognisedOnly.map((entry) => (
                  <li key={entry.label}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-senyalita-border bg-white/70 px-3 py-1.5 text-xs text-senyalita-dark">
                      {entry.label}
                      <span className="text-[0.625rem] uppercase tracking-wide text-senyalita-muted">
                        {entry.category}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SurfaceCard>

        {/* 3. TUTORIALS — curated, credited, external. */}
        <SurfaceCard tone="light" className="p-5 sm:p-6" data-testid="section-tutorials">
          <SectionHeader tone="light" icon={<Video className="h-4 w-4" />}>
            Tutorials
          </SectionHeader>
          <p className="mt-2 text-sm text-senyalita-muted">
            Material made by the FSL community. Links open on the creator&rsquo;s own site.
          </p>

          {tutorials.length === 0 ? (
            <p className="py-6 text-center text-sm text-senyalita-muted">
              No tutorials match “{query}”.
            </p>
          ) : (
            TOPICS.map((topic) => {
              const group = tutorials.filter((t) => t.topic === topic.id);
              if (group.length === 0) return null;
              return (
                <section key={topic.id} className="mt-5">
                  <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-senyalita-muted">
                    {topic.label}
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {group.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="tutorial-link"
                          className="group flex h-full flex-col rounded-2xl border border-senyalita-border bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-senyalita-primary/40 hover:shadow-md"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-senyalita-dark">{t.title}</span>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-senyalita-muted transition-colors group-hover:text-senyalita-primary" />
                          </span>
                          <span className="mt-1 text-xs leading-relaxed text-senyalita-muted">
                            {t.note}
                          </span>
                          {/* Attribution is not optional: this is other people's work. */}
                          <span className="mt-3 flex items-center gap-2">
                            <Badge tone="neutral">{t.kind}</Badge>
                            <span className="text-[0.6875rem] text-senyalita-muted">by {t.creator}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </SurfaceCard>

        {/*
          The page ends on the thing it is for. Everything above is reference —
          watching a sign, or reading which ones the camera knows — and the
          obvious next move is to go and use it. This stands in for the footer
          that used to close the page, which repeated links /learn had already
          made in context.
        */}
        <section className="mt-8 flex flex-col items-center gap-5 rounded-3xl border border-senyalita-border bg-white px-6 py-10 text-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-senyalita-dark">
              Want to try it yourself?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-senyalita-muted">
              Sign to the camera and read it back as text, or type a message and watch it signed.
            </p>
          </div>
          <Link
            href="/translate"
            data-testid="learn-try-cta"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-senyalita-primary px-7 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all duration-150 hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
          >
            Open the translator
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </section>
      </main>
    </div>
  );
}
