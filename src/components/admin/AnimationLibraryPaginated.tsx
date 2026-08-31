'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, Eye, Send, Archive, CheckCircle2, Clock, AlertTriangle, XCircle, FileJson, Star, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import type { AnimationLibraryAsset, AnimationLibraryResponse } from '@/lib/animationLibrary';
import { animationLibrary } from '@/lib/animationLibrary';
import { AliasEditor } from './AliasEditor';

type SortOption = 'recent' | 'published' | 'gloss';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Draft', color: '#475569', bg: '#F1F5F9', icon: Clock },
  processing: { label: 'Processing', color: '#B45309', bg: '#FEF3C7', icon: Clock },
  failed: { label: 'Failed', color: '#B91C1C', bg: '#FEE2E2', icon: XCircle },
  ready: { label: 'Needs Review', color: '#1D4ED8', bg: '#DBEAFE', icon: Eye },
  approved: { label: 'Approved', color: '#047857', bg: '#D1FAE5', icon: CheckCircle2 },
  published: { label: 'Published', color: '#047857', bg: '#D1FAE5', icon: Star },
  archived: { label: 'Archived', color: '#64748B', bg: '#F1F5F9', icon: Archive },
};

export function AnimationLibraryPage() {
  const [assets, setAssets] = useState<AnimationLibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AnimationLibraryAsset | null>(null);
  const [glossesWithWords, setGlossesWithWords] = useState<Set<string> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response: AnimationLibraryResponse = await animationLibrary.list({
        search: search || undefined,
        status: statusFilter || undefined,
        sort,
        page,
        limit,
      });
      setAssets(response.assets);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, page, limit]);

  const loadAliasCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/animations/aliases');
      if (!res.ok) return;
      const body = (await res.json()) as { aliases: { gloss: string }[] };
      setGlossesWithWords(new Set(body.aliases.map((a) => a.gloss.toUpperCase())));
    } catch {
      // Silent failure for optional feature
    }
  }, []);

  useEffect(() => {
    void loadAliasCoverage();
  }, [loadAliasCoverage]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleAction = useCallback(
    async (versionId: string, action: 'approve' | 'publish' | 'archive') => {
      setActionLoading(versionId);
      try {
        await animationLibrary.performAction(versionId, action as any);
        // Reload current page
        await loadAssets();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setActionLoading(null);
      }
    },
    [loadAssets]
  );

  const statuses = useMemo(() => {
    const set = new Set(assets.map((a) => a.status));
    return Array.from(set).sort();
  }, [assets]);

  const formatDuration = (ms: number | null | undefined): string => {
    if (!ms) return '—';
    const s = ms / 1000;
    return `${s.toFixed(1)}s`;
  };

  const formatDate = (d: string | null): string => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handlePreviousPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  };

  const handleNewSearch = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1); // Reset to first page on new search
  };

  return (
    <div>
      <style>{`
        .al-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .al-header { margin-bottom: 24px; }
        .al-header h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .al-header p { font-size: 14px; color: #64748b; margin: 0; }
        .al-toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .al-search { flex: 1; min-width: 200px; position: relative; }
        .al-search input {
          width: 100%; padding: 9px 12px 9px 36px;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; font-size: 13px; outline: none; box-sizing: border-box;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .al-search input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .al-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #94a3b8; }
        .al-filter { display: flex; gap: 8px; align-items: center; }
        .al-filter select {
          padding: 9px 12px; background: #fff; border: 1px solid #e2e8f0;
          border-radius: 8px; color: #334155; font-size: 13px; outline: none;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .al-filter select:focus { border-color: #2563eb; }
        .al-stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .al-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px 12px; }
        .al-stat strong { color: #0f172a; font-weight: 600; }
        .al-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .al-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 16px; transition: all 0.15s;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
        }
        .al-card:hover { border-color: #bfdbfe; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08); }
        .al-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .al-card-gloss { font-size: 18px; font-weight: 700; color: #0f172a; }
        .al-card-status {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 500;
        }
        .al-card-body { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .al-card-stat { display: flex; flex-direction: column; gap: 1px; }
        .al-card-stat .lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .al-card-stat .val { font-size: 13px; font-weight: 600; color: #334155; }
        .al-card-actions { display: flex; gap: 4px; flex-wrap: wrap; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .al-card-actions button {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
          font-size: 11px; font-weight: 500; cursor: pointer;
          background: #fff; color: #475569; transition: all 0.12s;
        }
        .al-card-actions button:hover { background: #f1f5f9; color: #0f172a; }
        .al-card-actions button:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-card-actions button svg { width: 13px; height: 13px; }
        .al-card-actions .primary { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }
        .al-card-actions .primary:hover { background: #dbeafe; }
        .al-card-actions .success { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
        .al-card-actions .success:hover { background: #d1fae5; }
        .al-card-actions .danger { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
        .al-card-actions .danger:hover { background: #fee2e2; }
        .al-card-version { font-size: 10px; color: #94a3b8; margin-top: 6px; }
        .al-empty { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b; }
        .al-empty svg { width: 40px; height: 40px; opacity: 0.3; margin-bottom: 12px; }
        .al-error {
          padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; color: #b91c1c; font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .al-loading {
          display: flex; align-items: center; justify-content: center; padding: 60px;
          color: #64748b; font-size: 14px; gap: 8px;
        }
        .al-pagination {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 24px; padding: 16px; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 8px;
        }
        .al-pagination-info { font-size: 13px; color: #475569; }
        .al-pagination-controls { display: flex; gap: 8px; }
        .al-pagination-button {
          padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;
          background: #fff; color: #475569; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.12s; display: flex; align-items: center; gap: 4px;
        }
        .al-pagination-button:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .al-pagination-button:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes al-spin { to { transform: rotate(360deg); } }
        .spin { animation: al-spin 0.8s linear infinite; }
      `}</style>

      <div className="al-container">
        <div className="al-header">
          <h1>Animation Library</h1>
          <p>Browse, search, and manage all animation assets. Published assets are used by Type-to-Sign.</p>
        </div>

        <div className="al-toolbar">
          <div className="al-search">
            <Search />
            <input
              placeholder="Search by gloss label..."
              value={search}
              onChange={(e) => handleNewSearch(e.target.value)}
            />
          </div>
          <div className="al-filter">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => {
                const cfg = STATUS_CONFIG[s] ?? { label: s, color: '#64748b', icon: Clock };
                return (
                  <option key={s} value={s}>
                    {cfg.label}
                  </option>
                );
              })}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
              <option value="recent">Recently added</option>
              <option value="published">Recently published</option>
              <option value="gloss">Alphabetical</option>
            </select>
          </div>
        </div>

        <div className="al-stats">
          <div className="al-stat">
            Total: <strong>{total}</strong>
          </div>
          <div className="al-stat">
            Showing: <strong>{assets.length}</strong>
          </div>
        </div>

        {error && (
          <div className="al-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="al-loading">
            <Loader className="spin" size={18} />
            Loading animation assets...
          </div>
        ) : assets.length === 0 ? (
          <div className="al-grid">
            <div className="al-empty">
              <FileJson />
              <p>No animation assets found</p>
              <p style={{ fontSize: 12 }}>Upload a video in Animation Studio to create your first asset.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="al-grid">
              {assets.map((asset) => {
                const cfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, color: '#64748b', icon: Clock };
                const StatusIcon = cfg.icon;

                return (
                  <div key={asset.id} className="al-card">
                    <div className="al-card-header">
                      <span className="al-card-gloss">{asset.gloss}</span>
                      <span className="al-card-status" style={{ background: cfg.bg, color: cfg.color }}>
                        <StatusIcon size={12} />
                        {cfg.label}
                      </span>
                    </div>

                    {glossesWithWords && !glossesWithWords.has(asset.gloss.toUpperCase()) && (
                      <span className="al-card-status" style={{ background: '#FEF3C7', color: '#92400E', marginTop: 6, width: 'fit-content' }}>
                        <AlertTriangle size={12} />
                        No words
                      </span>
                    )}

                    <div className="al-card-body">
                      <div className="al-card-stat">
                        <span className="lbl">Version</span>
                        <span className="val">{asset.latestVersion?.version ?? 0}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Frames</span>
                        <span className="val">{asset.latestVersion?.totalFrames ?? '—'}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Duration</span>
                        <span className="val">{formatDuration(asset.latestVersion?.durationMs)}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Updated</span>
                        <span className="val">{formatDate(asset.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="al-card-actions">
                      {asset.status === 'ready' && (
                        <button
                          className="primary"
                          disabled={actionLoading === asset.latestVersion?.id}
                          onClick={() => handleAction(asset.latestVersion?.id!, 'approve')}
                        >
                          {actionLoading === asset.latestVersion?.id ? <Loader size={13} className="spin" /> : <CheckCircle2 size={13} />}
                          Approve
                        </button>
                      )}
                      {asset.status === 'approved' && (
                        <button
                          className="success"
                          disabled={actionLoading === asset.latestVersion?.id}
                          onClick={() => handleAction(asset.latestVersion?.id!, 'publish')}
                        >
                          {actionLoading === asset.latestVersion?.id ? <Loader size={13} className="spin" /> : <Send size={13} />}
                          Publish
                        </button>
                      )}
                      {asset.status !== 'archived' && (
                        <button
                          className="danger"
                          disabled={actionLoading === asset.latestVersion?.id}
                          onClick={() => handleAction(asset.latestVersion?.id!, 'archive')}
                        >
                          <Archive size={13} />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="al-pagination">
              <span className="al-pagination-info">
                Page {page} · Showing {assets.length} of {total} assets
              </span>
              <div className="al-pagination-controls">
                <button className="al-pagination-button" disabled={page === 1} onClick={handlePreviousPage}>
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button className="al-pagination-button" disabled={!hasMore} onClick={handleNextPage}>
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
