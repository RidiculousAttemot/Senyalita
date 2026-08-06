"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Wand2, Eye, Send } from "lucide-react";
import { VideoUploadTab } from "./VideoUploadTab";
import { PoseExtractionTab } from "./PoseExtractionTab";
import { SkeletonPreviewTab } from "./SkeletonPreviewTab";
import { PublishTab } from "./PublishTab";
import type { VideoMetadata, ExtractionResult, PublishData } from "./types";

const TABS = [
  { id: "upload", label: "Video Upload", icon: Upload },
  { id: "extract", label: "Pose Extraction", icon: Wand2 },
  { id: "preview", label: "Skeleton Preview", icon: Eye },
  { id: "publish", label: "Publish", icon: Send },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AnimationStudio() {
  const [activeTab, setActiveTab] = useState<TabId>("upload");
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [publishedData, setPublishedData] = useState<PublishData[]>([]);
  const prevTabRef = useRef<TabId>("upload");

  const handleVideoReady = useCallback((meta: VideoMetadata) => {
    setVideoMeta(meta);
    setExtractionResult(null);
    setActiveTab("extract");
  }, []);

  const handleExtractionComplete = useCallback((result: ExtractionResult) => {
    setExtractionResult(result);
    setActiveTab("preview");
  }, []);

  const handlePublish = useCallback((data: PublishData) => {
    setPublishedData((prev) => [...prev, data]);
    setVideoMeta(null);
    setExtractionResult(null);
    setActiveTab("upload");
  }, []);

  const canProceed = (tabId: TabId): boolean => {
    if (tabId === "upload") return true;
    if (tabId === "extract") return !!videoMeta;
    if (tabId === "preview") return !!extractionResult;
    if (tabId === "publish") return !!extractionResult;
    return true;
  };

  return (
    <div className="animation-studio">
      <style>{`
        .animation-studio {
          padding: 24px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .animation-studio-header {
          margin-bottom: 24px;
        }
        .animation-studio-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 4px 0;
        }
        .animation-studio-header p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }
        .animation-studio-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 0;
        }
        .animation-studio-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border: none;
          background: none;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s ease;
        }
        .animation-studio-tab:hover {
          color: #94a3b8;
          background: rgba(148,163,184,0.05);
        }
        .animation-studio-tab.active {
          color: #60a5fa;
          border-bottom-color: #60a5fa;
        }
        .animation-studio-tab:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .animation-studio-tab svg {
          width: 16px;
          height: 16px;
        }
        .animation-studio-content {
          min-height: 400px;
        }
        .tab-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #64748b;
          text-align: center;
          gap: 12px;
        }
        .tab-placeholder svg {
          width: 48px;
          height: 48px;
          opacity: 0.3;
        }
        .tab-placeholder h3 {
          font-size: 18px;
          font-weight: 600;
          color: #94a3b8;
          margin: 0;
        }
        .tab-placeholder p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
          max-width: 360px;
        }
      `}</style>

      <div className="animation-studio-header">
        <h1>Animation Studio</h1>
        <p>Upload FSL videos, extract pose landmarks, review skeleton preview, and publish animation assets</p>
      </div>

      <div className="animation-studio-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`animation-studio-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            disabled={!canProceed(tab.id) && tab.id !== "upload"}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animation-studio-content">
        {activeTab === "upload" && (
          <VideoUploadTab
            onVideoReady={handleVideoReady}
          />
        )}
        {activeTab === "extract" && videoMeta && (
          <PoseExtractionTab
            videoMeta={videoMeta}
            onExtractionComplete={handleExtractionComplete}
          />
        )}
        {activeTab === "preview" && extractionResult && (
          <SkeletonPreviewTab
            extractionResult={extractionResult}
            videoMeta={videoMeta}
          />
        )}
        {activeTab === "publish" && extractionResult && (
          <PublishTab
            extractionResult={extractionResult}
            sourceFile={videoMeta?.file ?? null}
            onPublish={handlePublish}
          />
        )}
      </div>
    </div>
  );
}
