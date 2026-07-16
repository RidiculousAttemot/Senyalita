# Type-to-Sign Landmark Asset Pipeline Design

## Objective

Replace manually maintained Type-to-Sign animation JSON with landmark animations generated from administrator-uploaded FSL videos. Preserve the existing text translation, gloss dictionary, `GestureAnimationAsset`, animation queue, playback engine, and public canvas rendering workflow.

## Scope

- Add an admin-only Landmark Assets workspace under Animations.
- Store uploaded MP4, MOV, and WebM source videos privately in Supabase Storage.
- Extract pose, face, left-hand, and right-hand landmarks in the administrator browser using the installed `@mediapipe/tasks-vision` package.
- Normalize, smooth, interpolate, and validate extracted frames before serializing a renderer-compatible landmark asset.
- Track assets, versions, reviews, and processing jobs in Supabase.
- Preview source video and generated stick-figure landmarks together before approval.
- Publish one approved version per gloss and make it available to Type-to-Sign without exposing source video.
- Render an explicit unavailable state for glosses without a published asset.

## Architecture

The public flow remains `text -> FSL gloss -> AnimationLoader -> AnimationClip -> PlaybackEngine -> existing canvas renderer`. The new system only changes the source that resolves a gloss to an animation asset.

The protected admin flow is `upload -> private Storage -> signed URL -> browser MediaPipe extraction -> normalized asset JSON -> private landmark Storage -> preview -> review -> publish`. Browser-side extraction avoids serverless video processing limits while keeping the original video private. A persisted processing-job record allows an administrator to see queued, processing, ready, and failed work.

## Data Model

`animation_assets` represents one canonical glossary gloss and its current published version.

`animation_asset_versions` stores a source-video path, landmark-JSON path, MediaPipe/extraction settings, FPS, frame count, duration, quality score, lifecycle state, version number, and timestamps. A gloss can have many versions.

`animation_asset_reviews` stores reviewer, decision, notes, and timestamp. `animation_processing_jobs` stores extraction state, progress, errors, and the version it processes.

Only one version for an asset can have the `published` status. Publishing archives the preceding published version. Videos and extracted JSON use separate private Storage buckets. Public playback receives only an approved landmark JSON response through an API resolver; it never receives a source-video URL.

## Asset Format And Rendering

The stored format extends `GestureAnimationAsset` without changing its required hand-landmark fields. Frames keep `landmarks` for existing playback and add optional normalized pose and face landmark collections with explicit versioned metadata. This lets legacy hand-only JSON continue to render while new assets contain MediaPipe-style pose, face, left-hand, and right-hand data.

`AdvancedCanvasRenderer`, used by `SignAnimationPlayer`, will render complete extracted frames in the public application. `LandmarkCanvasRenderer` will receive the same support for the review preview. Pose is red, face is dark red, left hand is green, right hand is blue, and the background is transparent or a light neutral controlled by renderer options.

## Admin Experience

The Landmark Assets workspace uses the established Senyalita admin console styling. It has a clear upload action, guided processing state, coverage metrics, searchable gloss/version list, truthful error and unavailable states, and a side-by-side source-video/stick-figure review panel. Buttons are limited to real supported operations: upload, extract or regenerate, approve, reject, publish, archive, and delete.

## Failure And Privacy Rules

- Source videos are private and accessible only to authenticated administrators through short-lived signed URLs.
- Public users never receive a source-video path or signed URL.
- Extraction failures record an error on the processing job and leave the prior published asset untouched.
- Incomplete landmark assets cannot be approved or published.
- A missing published asset produces `Animation unavailable.` and does not break the rest of a translated animation queue.

## Validation

- Unit-test processing normalization, missing-frame repair, status transitions, and public resolution fallback.
- Component-test upload/review and unavailable public asset states.
- Typecheck and lint the touched application code.
- Use authenticated browser validation when an admin session is available; otherwise validate client components with focused tests and API route contracts.