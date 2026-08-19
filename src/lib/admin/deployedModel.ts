/**
 * What the deployed recognition model is, asked of the model itself.
 *
 * The dashboard used to ask public.model_versions, and rendered three separate
 * "Unavailable -- model registry could not be read" surfaces when that failed:
 * a MODEL ACCURACY card, an ACTIVE MODEL card, and a production-model panel
 * restating both. It failed because the table is not there. Migration
 * 0020_phase16_model_versions.sql creates it and seeds a v1.0.0 row, but it was
 * never applied to this project -- PostgREST answers "Could not find the table
 * 'public.model_versions' in the schema cache" -- and, more to the point,
 * NOTHING IN THE APPLICATION EVER WRITES IT. The only inserts live in
 * docs/incremental-training-guide.md as SQL to paste by hand, and
 * scripts/incremental-retrain.mjs merely prints "Update model_versions" as a
 * step for a human. So the registry was never one row away from working: it was
 * a hand-maintained table with no writer, and a hand-maintained row would have
 * drifted from the model actually being served the first time anyone exported a
 * new one without remembering the SQL.
 *
 * The artifacts are the source of truth instead. They ship in the same commit
 * as the weights they describe, so this cannot go stale the way a registry row
 * silently did -- swapping the model rewrites these files.
 *
 * ACCURACY IS DELIBERATELY ABSENT. Neither file records it, nothing in the app
 * measures it, and no other source exists, so there is no honest number to put
 * in that card. It is removed rather than left reading "Unavailable" forever.
 *
 * Imported rather than read from public/ at request time, for the same reason
 * as modelLabels.ts: files under public/ are static assets and are not
 * guaranteed to be on a serverless function's filesystem.
 */

import modelTopology from "../../../public/models/fsl_unified/bilstm_tfjs/model.json";
import { MODEL_LABELS } from "./modelLabels";

export type DeployedModel = {
  /** The exporter that produced it, e.g. "unified-bilstm-export". */
  architecture: string;
  /** TFJS artifact format, e.g. "tfjs-graph-model". */
  format: string;
  /** Classes the model can actually emit -- the coverage denominator. */
  classes: number;
  /** ISO timestamp the artifacts were converted, or null if the field is absent. */
  convertedAt: string | null;
};

const manifest = modelTopology as { format?: string; generatedBy?: string; convertedAt?: string };

export const DEPLOYED_MODEL: DeployedModel = {
  architecture: manifest.generatedBy ?? "Unknown exporter",
  format: manifest.format ?? "Unknown format",
  classes: MODEL_LABELS.length,
  convertedAt: manifest.convertedAt ?? null,
};

/** "unified-bilstm-export · 131 classes" and similar, for a one-line summary. */
export const describeDeployedModel = (model: DeployedModel = DEPLOYED_MODEL): string =>
  `${model.architecture} · ${model.classes} classes`;
