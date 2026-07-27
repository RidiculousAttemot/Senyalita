-- Adds the animation metadata the Animation Library needs to display and
-- filter assets, and that Text-to-Sign needs to pick a language variant.
--
-- Kept as a separate migration rather than an edit to 0035 so that any
-- database which has already run 0035 picks these up cleanly.
-- Idempotent: `add column if not exists` plus guarded policy recreation.

alter table public.animation_asset_versions
  add column if not exists language text not null default 'fsl',
  add column if not exists thumbnail_path text,
  add column if not exists storage_bytes bigint;

comment on column public.animation_asset_versions.language is
  'Sign language variant this recording represents (fsl, asl, ...). Lets one gloss carry several regional variants.';
comment on column public.animation_asset_versions.thumbnail_path is
  'Storage path of a preview frame in animation-landmarks, for the Animation Library grid.';
comment on column public.animation_asset_versions.storage_bytes is
  'Size of the stored landmark JSON, so storage usage is reportable without listing the bucket.';

-- Language is part of the lookup key: a published FSL "HELLO" and a published
-- ASL "HELLO" must be able to coexist. The unique index from 0035 allowed only
-- one published version per asset regardless of language.
drop index if exists public.animation_asset_versions_one_published_per_asset;
create unique index if not exists animation_asset_versions_one_published_per_language
  on public.animation_asset_versions(asset_id, language) where status = 'published';

create index if not exists animation_asset_versions_language_idx
  on public.animation_asset_versions(language);
