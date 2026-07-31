import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { NotFoundError } from "@/server/http/errors";

/**
 * Backend catalogue for the admin Animation Dataset Manager.
 *
 * Replaces a filesystem scan of datasets/processed/user_holistic_assets, which
 * was the last component reading animation data from disk. That directory is
 * gitignored and never deployed, so the Manager only ever worked locally.
 *
 * Shape note: on disk each gloss had ~5 recorded takes, but the old endpoint
 * only ever served `files[0]`, so four in five were unreachable. Supabase
 * models this properly as versions per asset, so a gloss lists one row per
 * *version* rather than one per raw take.
 */

const LANDMARK_BUCKET = "animation-landmarks";
const VIDEO_BUCKET = "animation-source-videos";
const SIGNED_URL_TTL_SECONDS = 600;

/** Kept identical to the old filesystem response so the UI needs no changes. */
export interface DatasetAssetSummary {
  label: string;
  file: string;
  filePath: string;
  frameCount: number;
  duration: number;
  // Additive backend metadata; the existing UI ignores what it does not read.
  id: string;
  gloss: string;
  language: string;
  version: number;
  status: string;
  fps: number;
  durationMs: number;
  qualityScore: number | null;
  storageBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DatasetListResult {
  labels: string[];
  assets: DatasetAssetSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Mirrors the status check constraint in 0035. */
export type VersionStatus =
  | "pending" | "processing" | "failed" | "ready" | "approved" | "published" | "archived";

export const VERSION_STATUSES: readonly VersionStatus[] = [
  "pending", "processing", "failed", "ready", "approved", "published", "archived",
];

export function isVersionStatus(value: string): value is VersionStatus {
  return (VERSION_STATUSES as readonly string[]).includes(value);
}

export interface DatasetListOptions {
  search?: string;
  language?: string;
  status?: VersionStatus;
  sort?: "gloss" | "version" | "created" | "frames" | "duration";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** `v3_asset.json` — the UI strips `_asset.json`, so this renders as "v3". */
function versionFileName(version: number): string {
  return `v${version}_asset.json`;
}

function parseVersionFromFile(file: string): number | null {
  const m = /^v(\d+)_asset\.json$/.exec(file);
  return m ? Number(m[1]) : null;
}

const SORT_COLUMNS: Record<NonNullable<DatasetListOptions["sort"]>, string> = {
  gloss: "gloss",
  version: "version",
  created: "created_at",
  frames: "total_frames",
  duration: "duration_ms",
};

export async function listDatasetAssets(options: DatasetListOptions = {}): Promise<DatasetListResult> {
  const supabase = createSupabaseServiceClient();
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const offset = Math.max(options.offset ?? 0, 0);
  const order = options.order === "asc" ? true : false;

  // Versions carry the metadata; the parent asset carries the gloss.
  let query = supabase
    .from("animation_asset_versions")
    .select(
      "id, asset_id, version, status, language, fps, total_frames, duration_ms, quality_score, storage_bytes, landmark_json_path, created_at, updated_at, animation_assets!animation_asset_versions_asset_id_fkey!inner(gloss)",
      { count: "exact" },
    );

  if (options.status) query = query.eq("status", options.status);
  if (options.language) query = query.eq("language", options.language);
  if (options.search) {
    // Filter on the joined gloss; ilike keeps it case-insensitive.
    query = query.ilike("animation_assets.gloss", `%${options.search}%`);
  }

  const sortKey = options.sort ?? "version";
  if (sortKey === "gloss") {
    query = query.order("gloss", { ascending: order, referencedTable: "animation_assets" });
  } else {
    query = query.order(SORT_COLUMNS[sortKey], { ascending: order });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`Unable to list dataset assets: ${error.message}`);

  const assets: DatasetAssetSummary[] = (data ?? []).map((row) => {
    const parent = row.animation_assets as unknown as { gloss: string } | { gloss: string }[] | null;
    const gloss = Array.isArray(parent) ? parent[0]?.gloss ?? "" : parent?.gloss ?? "";
    return {
      label: gloss,
      file: versionFileName(row.version),
      filePath: row.landmark_json_path ?? "",
      frameCount: row.total_frames ?? 0,
      duration: row.duration_ms ?? 0,
      id: row.id,
      gloss,
      language: row.language ?? "fsl",
      version: row.version,
      status: row.status,
      fps: Number(row.fps ?? 0),
      durationMs: row.duration_ms ?? 0,
      qualityScore: row.quality_score === null ? null : Number(row.quality_score),
      storageBytes: row.storage_bytes ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  });

  // The label list is the distinct set of glosses, matching the old response.
  const labels = [...new Set(assets.map((a) => a.label))].filter(Boolean).sort();

  return { labels, assets, total: count ?? assets.length, limit, offset };
}

export interface ResolvedDatasetAsset {
  asset: unknown;
  status: string;
  version: number;
}

/**
 * Streams one version's landmark JSON out of Storage.
 *
 * The payload is returned byte-for-byte as stored, so Skeleton Preview, the
 * Animation Inspector, PlaybackEngine and AdvancedCanvasRenderer all keep
 * receiving the exact shape they already parse.
 */
export async function getDatasetAsset(label: string, file: string): Promise<ResolvedDatasetAsset> {
  const supabase = createSupabaseServiceClient();
  const version = parseVersionFromFile(file);

  const { data: parent, error: parentError } = await supabase
    .from("animation_assets")
    .select("id")
    .eq("gloss", label.toUpperCase())
    .maybeSingle();
  if (parentError) throw new Error(`Unable to look up gloss: ${parentError.message}`);
  if (!parent) throw new NotFoundError(`No animation asset for gloss "${label}".`);

  let versionQuery = supabase
    .from("animation_asset_versions")
    .select("version, status, landmark_json_path")
    .eq("asset_id", parent.id);

  // Without a parseable version, fall back to the newest one.
  versionQuery = version !== null
    ? versionQuery.eq("version", version)
    : versionQuery.order("version", { ascending: false }).limit(1);

  const { data: row, error: versionError } = await versionQuery.maybeSingle();
  if (versionError) throw new Error(`Unable to look up version: ${versionError.message}`);
  if (!row?.landmark_json_path) throw new NotFoundError("That animation version has no stored landmarks.");

  const { data: blob, error: downloadError } = await supabase.storage
    .from(LANDMARK_BUCKET)
    .download(row.landmark_json_path);
  if (downloadError || !blob) throw new NotFoundError("Stored landmark data could not be read.");

  return { asset: JSON.parse(await blob.text()), status: row.status, version: row.version };
}

/**
 * What /api/videos/[label]/[file] should do for a recording.
 *
 * `redirect` is the only production path: the browser is sent to a signed
 * Storage URL and fetches the bytes itself. `absent` and `failed` are
 * deliberately distinct — a 404 means "no published source video", a 503
 * means the lookup infrastructure broke and the request should retry.
 */
export type SourceVideoUrlResolution =
  | { outcome: "redirect"; url: string }
  | { outcome: "absent" }
  | { outcome: "failed"; stage: "asset" | "version" | "sign"; message: string };

/**
 * Resolves a recording to a short-lived signed Storage URL without touching
 * the bytes.
 *
 * The old implementation read the raw file off the local filesystem
 * (datasets/raw/user_videos). The bytes always lived in Storage under
 * animation-source-videos; the filesystem copy was never deployed, so in
 * production every request 404'd and the Human/Split/Overlay panes rendered
 * as a silent blank box. Signing is a local HMAC against the service key — no
 * download, no Range plumbing, no function-timeout exposure on a large file.
 */
export async function resolveSourceVideoUrl(label: string, file: string): Promise<SourceVideoUrlResolution> {
  const supabase = createSupabaseServiceClient();
  const version = parseVersionFromFile(file);

  const { data: parent, error: parentError } = await supabase
    .from("animation_assets").select("id").eq("gloss", label.toUpperCase()).maybeSingle();
  if (parentError) return { outcome: "failed", stage: "asset", message: parentError.message };
  if (!parent) return { outcome: "absent" };

  let q = supabase.from("animation_asset_versions").select("source_video_path").eq("asset_id", parent.id);
  q = version !== null ? q.eq("version", version) : q.order("version", { ascending: false }).limit(1);

  const { data: row, error: versionError } = await q.maybeSingle();
  if (versionError) return { outcome: "failed", stage: "version", message: versionError.message };
  if (!row?.source_video_path) return { outcome: "absent" };

  const { data: signed, error: signError } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(row.source_video_path, SIGNED_URL_TTL_SECONDS);
  if (signError) return { outcome: "failed", stage: "sign", message: signError.message };
  if (!signed?.signedUrl) {
    return { outcome: "failed", stage: "sign", message: "storage returned no signed URL and no error" };
  }
  return { outcome: "redirect", url: signed.signedUrl };
}

/** Short-lived signed URL for the original recording, for provenance views. */
export async function getSourceVideoUrl(label: string, file: string): Promise<string | null> {
  const resolution = await resolveSourceVideoUrl(label, file);
  return resolution.outcome === "redirect" ? resolution.url : null;
}
