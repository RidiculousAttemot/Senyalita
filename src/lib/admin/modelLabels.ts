import labelsFile from "../../../public/models/fsl_unified/bilstm_tfjs/labels.json";

/**
 * The deployed model's own label list, for server-side use.
 *
 * Imported rather than read from `public/` at request time on purpose: files
 * under public/ are served as static assets and are not guaranteed to exist in
 * a serverless function's filesystem, so an fs.readFile here would work locally
 * and return an empty coverage report in production — the exact failure mode
 * where a wrong number is worse than no number.
 *
 * Importing it means the count is fixed at build time. That is the correct
 * coupling: swapping the model means redeploying the app that serves it, and
 * this file changes in the same commit as the weights.
 */
export const MODEL_LABELS: readonly string[] = labelsFile.labels;
