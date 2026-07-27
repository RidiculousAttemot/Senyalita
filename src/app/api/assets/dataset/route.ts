import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { toErrorResponse } from "@/server/http/errors";
import {
  getDatasetAsset,
  isVersionStatus,
  listDatasetAssets,
  type DatasetListOptions,
} from "@/server/services/datasetCatalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SORTS = new Set(["gloss", "version", "created", "frames", "duration"]);

export async function GET(req: NextRequest) {
  try {
    // This endpoint exposes version statuses, quality scores and storage paths,
    // so it is admin-only. It is consumed from the already admin-gated
    // Animation Dataset Manager, whose fetch carries the session cookie.
    await requireAdmin();

    const params = req.nextUrl.searchParams;
    const label = params.get("label");
    const file = params.get("file");

    // Single asset: stream the stored landmark JSON, byte-identical to what
    // Skeleton Preview / PlaybackEngine / the renderers already parse.
    if (label && file) {
      const { asset, status } = await getDatasetAsset(label, file);
      const published = status === "published";
      return NextResponse.json(asset, {
        headers: {
          // A published version is immutable — publishing again creates a new
          // version rather than mutating this one. Drafts must never be cached,
          // or the preview goes stale the moment the asset is re-extracted.
          "Cache-Control": published
            ? "private, max-age=3600, immutable"
            : "no-store",
          "X-Asset-Status": status,
        },
      });
    }

    const sortParam = params.get("sort");
    const statusParam = params.get("status");
    const options: DatasetListOptions = {
      search: params.get("search")?.trim() || undefined,
      language: params.get("language") || undefined,
      status: statusParam && isVersionStatus(statusParam) ? statusParam : undefined,
      sort: sortParam && SORTS.has(sortParam) ? (sortParam as DatasetListOptions["sort"]) : undefined,
      order: params.get("order") === "asc" ? "asc" : "desc",
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      offset: params.get("offset") ? Number(params.get("offset")) : undefined,
    };

    const result = await listDatasetAssets(options);

    // Metadata only — no landmark payloads are read here, so listing stays
    // cheap regardless of how large the corpus grows.
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/assets/dataset");
  }
}
