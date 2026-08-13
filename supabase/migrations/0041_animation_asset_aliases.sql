-- Admin-managed word→sign mappings.
--
-- Which words play a given animation stops being a source-code fact. An alias
-- is a lexical form; the gloss remains the identity, and nothing here is ever
-- the key for /api/animations/[gloss] -- an alias used as an asset key 404s and
-- silently fingerspells, which reads as a dictionary bug rather than a
-- labelling one.
--
-- OWNERSHIP RULE:
--   A gloss with a row in animation_assets owns its lexical forms here. Every
--   other gloss owns them in gestureDictionary.ts. The two sets are disjoint by
--   construction, so there is no precedence to resolve and no drift to manage.
--
-- HISTORY, because this file does not read like a first draft:
--   The table was created directly against the database before it was ever
--   written down, so this migration was reconstructed from the live schema
--   rather than the other way round. It is written to be re-runnable against
--   both a database that already has the table and an empty one, which is why
--   the constraint is dropped and recreated instead of being declared inline.

create table if not exists public.animation_asset_aliases (
  id uuid primary key default gen_random_uuid(),

  -- Attached to the asset, not to a version: replacing an animation must not
  -- lose the words that reach it.
  asset_id uuid not null references public.animation_assets(id) on delete cascade,

  -- Stored exactly as the tokeniser emits it, NOT as the admin typed it.
  --
  -- TextNormalizer does more than lowercase and strip punctuation: it also
  -- substitutes spelling variants, contractions and abbreviations before
  -- lookup, so "kumusta ka" reaches the matcher as "kamusta ka". Storing the
  -- typed form would make that alias unmatchable while looking correct in the
  -- admin. The constraint below cannot express that rule -- only shared code
  -- can -- so it checks the shape and a test asserts the fixed point.
  phrase text not null,

  language text not null,

  -- The form to show the user for this sign in this language. At most one per
  -- (asset, language).
  is_canonical boolean not null default false,

  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.animation_asset_aliases
  drop constraint if exists animation_asset_aliases_language_check;
alter table public.animation_asset_aliases
  add constraint animation_asset_aliases_language_check
  check (language in ('en', 'tl'));

-- The alphabet a normalised phrase can contain.
--
-- Mirrors ALIAS_PHRASE_SQL_PATTERN in src/lib/aliases/phrasePattern.ts, which
-- is derived from TextNormalizer's own whitelist and covered by a test that
-- runs real input through the pipeline and asserts every emitted phrase
-- matches. If these two ever disagree, the admin accepts a phrase the database
-- then refuses with a raw constraint error.
--
-- This replaces `^[a-z0-9ñ]+( [a-z0-9ñ]+)*$`, which was narrower than the
-- normaliser's output. "mag-aral", "sino'ng kasama" and "café" all normalise
-- cleanly and were all unstorable: the apostrophe and hyphen the normaliser
-- preserves were missing, and `ñ` was allowed while every other accented
-- letter it whitelists was not.
--
-- The hyphen sits last in the class on purpose. Escaped as \- it would be
-- ambiguous inside a Postgres bracket expression; trailing, it is a literal
-- here and in the JavaScript copy, so the two stay character-identical.
alter table public.animation_asset_aliases
  drop constraint if exists animation_asset_aliases_phrase_check;
alter table public.animation_asset_aliases
  add constraint animation_asset_aliases_phrase_check
  check (phrase ~ '^[a-z0-9_''ñáéíóúàèìòùäëïöüâêîôû-]+( [a-z0-9_''ñáéíóúàèìòùäëïöüâêîôû-]+)*$');

-- Duplicate ownership is refused by the database, not only by the UI.
--
-- Globally unique rather than per-language: matching is language-agnostic --
-- the tokeniser hands the matcher a word sequence with no language attached --
-- so one phrase claimed by two assets is ambiguous no matter which languages
-- they were tagged with.
create unique index if not exists animation_asset_aliases_phrase_unique
  on public.animation_asset_aliases (phrase);

-- One canonical display form per asset per language.
create unique index if not exists animation_asset_aliases_one_canonical_per_language
  on public.animation_asset_aliases (asset_id, language)
  where is_canonical;

-- Covers the read the admin actually makes: one asset's aliases, grouped by
-- language, in display order.
create index if not exists animation_asset_aliases_asset_idx
  on public.animation_asset_aliases (asset_id, language, sort_order);

alter table public.animation_asset_aliases enable row level security;

-- Admin-only, matching every other animation_* table. The public site reads
-- aliases through a server route backed by the service-role client, exactly as
-- it already reads published animations, so no anon policy is needed and the
-- table is not directly exposed.
drop policy if exists "admin manages animation asset aliases" on public.animation_asset_aliases;
create policy "admin manages animation asset aliases"
  on public.animation_asset_aliases for all
  using (public.is_admin()) with check (public.is_admin());
