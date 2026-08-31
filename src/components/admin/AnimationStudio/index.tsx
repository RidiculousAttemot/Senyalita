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
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .animation-studio-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }
        .animation-studio-stepper {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: 1fr;
          gap: 8px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .animation-studio-stepper { grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
        }
        .animation-studio-tab {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        .animation-studio-tab:hover:not(:disabled) {
          border-color: #bfdbfe;
          background: #f8fafc;
          color: #1d4ed8;
        }
        .animation-studio-tab.active {
          color: #1d4ed8;
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 1px 3px rgba(37,99,235,0.1);
        }
        .animation-studio-tab:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .animation-studio-tab svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .animation-studio-stepnum {
          display: grid;
          width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 50%;
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .animation-studio-tab.active .animation-studio-stepnum {
          background: #2563eb;
          color: #fff;
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
          color: #334155;
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

      <div className="animation-studio-stepper">
        {TABS.map((tab, idx) => (
          <button
            key={tab.id}
            className={`animation-studio-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            disabled={!canProceed(tab.id) && tab.id !== "upload"}
            aria-current={activeTab === tab.id ? "step" : undefined}
          >
            <span className="animation-studio-stepnum">{idx + 1}</span>
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
