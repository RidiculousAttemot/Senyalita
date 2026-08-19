/**
 * The (b) landmark storage format: retain only the drawn face indices,
 * null-pad the rest.
 *
 * WHY
 * MediaPipe's face mesh is 478 points. The renderer draws nine groups of them
 * -- FACE_OVAL, both eyebrows, both eyes, nose bridge and tip, lips outer and
 * inner -- and nothing else. Every other point is downloaded on every playback,
 * decoded, and never drawn. Storing them costs bandwidth and Storage quota for
 * no visible pixel.
 *
 * With 91 signs still to publish against a 1 GB free-tier cap, that overhead is
 * the difference between the batch fitting and not.
 *
 * THE FORMAT
 *   1. faceLandmarks stays an array of the SAME length (478).
 *   2. Indices the renderer draws keep their landmark object.
 *   3. Indices it never draws become null.
 *   4. The array is NEVER compacted.
 *   5. Hands, poseLandmarks and timestamp are unchanged from (a).
 *   6. Precision is unchanged. LANDMARK_PRECISION = 4 already landed; 3dp was
 *      measured (-57% vs -54%) and deliberately NOT chosen.
 *
 * THE CONSTRAINT THAT MATTERS -- point 4
 * The renderer indexes by absolute position (`frame.faceLandmarks[i]`, e.g.
 * ExactLandmarkRenderer.ts:176 `for (const i of FACE_OVAL) add(...)`).
 * A compacted subset still has plausible-looking coordinates at every index, so
 * it renders a face -- the WRONG face, quietly, with no error. That is the one
 * failure mode here that looks like working software, which is why the padding
 * is not an implementation detail but the format's defining property.
 *
 * ExactLandmarkRenderer also gates on `faceLandmarks.length >= 50`. Null padding
 * holds the length at 478, so the gate passes unchanged. Compacting to the drawn
 * set alone would give 102 -- still over the gate, so the gate would NOT catch
 * the mistake either.
 *
 * THE RETAINED SET IS DERIVED, NEVER HARDCODED
 * Take the union of the nine FACE_* constants exported from
 * src/features/sign-animation/types/index.ts. Do not paste a literal list: this
 * project has already shipped a UI advertising digits 0-9 against a model with
 * no ZERO class, which is what a hardcoded list drifting from its source looks
 * like.
 *
 * Derived union as of 2026-08-17: 102 distinct indices, min 0, max 454.
 * Per group: OVAL 37, L/R eyebrow 10/10, L/R eye 10/10, nose bridge 5, nose tip
 * 4, lips outer 20, lips inner 17 -- summing to 123, so 21 indices are shared
 * between groups (the lip corners, and where the oval meets its neighbours).
 * The union, not the sum, is the retained set.
 *
 * WHERE ~134 CAME FROM
 * An earlier estimate of ~134 drawn points was a SUM OF THE NINE GROUPS WITHOUT
 * DEDUPLICATING, so it double-counted every shared index. The union was always
 * the right question and 102 is its answer. Recorded here so the miscount is not
 * re-derived by someone else adding the groups up again.
 *
 * CORRECTNESS IS STRUCTURAL, NOT A SIZE
 * Do not gate this transform on a byte count -- sizes are estimates and the
 * first one was wrong. A correct (b) output satisfies exactly four properties:
 *
 *   1. The set of non-null indices EQUALS the union derived from the FACE_*
 *      constants. Not a subset, not a superset. Assert against the derived set
 *      itself, never against the literal 102, so that adding a lip index to the
 *      renderer tomorrow carries the assertion with it.
 *   2. Every other index is null.
 *   3. faceLandmarks.length is 478 at every frame.
 *   4. Hands, poseLandmarks and timestamp are byte-identical to (a).
 *
 * Those four are the transform being correct. Nothing else needs to be true.
 * Size is then a measured fact to be reported and accounted for, not a pass mark.
 *
 * MEASURED, THANK YOU -- HISTORICAL, SUPERSEDED ON THE INDEX COUNT
 * These were taken against the ~134 assumption, so the (b) rows describe a
 * larger retained set than the format actually keeps. The ranking between
 * options still holds; the absolute (b) figures do not.
 *   (a) full mesh, as stored         3.47 MB    --
 *   (b) drawn indices, null-padded   1.60 MB    -54%   <- CHOSEN
 *   (b) + 3dp precision              1.49 MB    -57%   (not chosen)
 *   (c) mesh quantised to 3dp        3.21 MB    -7%
 *   (d) no face at all               0.43 MB    -88%   (rejected: non-manual
 *                                                       markers carry grammar,
 *                                                       so this loses meaning,
 *                                                       not just detail)
 *
 * The 1.60 MB figure was measured WITH null padding, so it is the honest
 * number -- padding is not a saving that gets subtracted from it later.
 *
 * MEASURED AGAINST THE DERIVED 102-INDEX SET, 2026-08-17
 * THANK YOU, 189 frames, all four structural properties asserted PASS:
 *
 *   (a) as stored   3.47 MB   (reproduces the historical figure exactly)
 *   (b) transformed 1.42 MB   -58.9%
 *
 * Better than the -54% recorded above, because 102 indices are retained rather
 * than the 134 that figure assumed. This is the number to project the batch on.
 */

/**
 * !! DO NOT PUBLISH (b) AS SPECIFIED ABOVE. IT BREAKS LIVE READERS. !!
 * Found 2026-08-17, after the transform verified clean and before any publish.
 *
 * THERE ARE THREE RENDERER FAMILIES, NOT ONE
 *   - ExactLandmarkRenderer          -- the FACE_GROUPS set this spec derives from
 *   - AdvancedCanvasRenderer.ts:261  -- its own face handling, index set NOT yet enumerated
 *   - drawStylizedFace               -- its own index set, NOT yet enumerated; used by
 *                                       LandmarkCanvasRenderer, SkeletonPreviewTab,
 *                                       VideoUploadTab, AnimationDatasetManager
 * The union above was derived from one of the three, so it is not the retained
 * set the application actually needs.
 *
 * NULL PADDING CRASHES A WHOLESALE ITERATOR
 * interpolation/oneEuroFilter.ts:113 loops `i < frame.faceLandmarks.length` and
 * dereferences `frame.faceLandmarks[i].x/.y/.z` unconditionally. Padding holds
 * length at 478 -- which is exactly what keeps the `>= 50` gate passing -- so the
 * loop runs the full range and hits `null.x` at the first undrawn index. A
 * TypeError, not a visual artefact.
 *
 * AND SOME PATHS CORRUPT SILENTLY RATHER THAN FAILING
 *   - BodyMotionEngine.ts:71   spreads `null` via `{...lm}` -> a point with no coords
 *   - MotionCurveEngine.ts:70  blends null against real points
 *   - PlaybackEngine.ts:297,347 same, on the live playback path
 *   - ai-assist/animationOptimizer.ts:98 smooths across the padded array
 * Safe by inspection: everything gating on `.length` (animationLibrary.ts:159,
 * qualityAnalyzer.ts:73, PublishTab.tsx:86, and the >= 50 gate), since length is
 * preserved.
 *
 * THE META-POINT, WHICH IS THE REUSABLE PART
 * The four structural properties were asserted and all passed. P1 genuinely
 * proved the non-null set equals ExactLandmarkRenderer's read set. It was sound
 * -- and useless, because that renderer is one consumer of three. A structural
 * proof is only ever as wide as the consumer set it quantifies over. Enumerate
 * the consumers FIRST; a proof over the wrong set is still an assumption wearing
 * a proof's clothing. This is the same error as estimating the union by summing
 * the groups: confident arithmetic over an unchecked premise.
 */

/** Names of the face index groups the renderer draws. Source of truth. */
export const DRAWN_FACE_GROUPS = [
  "FACE_OVAL",
  "FACE_LEFT_EYEBROW",
  "FACE_RIGHT_EYEBROW",
  "FACE_LEFT_EYE",
  "FACE_RIGHT_EYE",
  "FACE_NOSE_BRIDGE",
  "FACE_NOSE_TIP",
  "FACE_LIPS_OUTER",
  "FACE_LIPS_INNER",
];

/**
 * Null-pads one frame's faceLandmarks to the (b) format.
 *
 * `retained` is a Set of absolute indices, derived from the constants by the
 * caller. Length is preserved; only non-retained slots become null.
 */
export function toFormatB(faceLandmarks, retained) {
  if (!Array.isArray(faceLandmarks)) return faceLandmarks;
  return faceLandmarks.map((point, index) => (retained.has(index) ? point : null));
}
