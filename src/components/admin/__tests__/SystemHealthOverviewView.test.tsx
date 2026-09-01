import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemHealthOverviewView } from "../SystemHealthOverviewView";

describe("SystemHealthOverviewView", () => {
  it("does not claim healthy systems when core service checks are unavailable", () => {
    render(
      <SystemHealthOverviewView
        health={{
          aiAcceptanceRate: null,
          aiRepliesSent: null,
          averageLatencyMs: null,
          captureCount: null,
          databaseAvailable: false,
          model: { status: "loading" },
          pendingReviewCount: null,
          recentPredictions: null,
          sourceBreakdown: {},
          storageAvailable: false,
          storageFileCount: 0,
          telemetryAvailable: false,
          totalPredictions: null,
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "System health" })).toBeTruthy();
    expect(screen.getByText("Service checks unavailable")).toBeTruthy();
    expect(screen.getByText("Browser runtime monitoring unavailable")).toBeTruthy();
    expect(screen.getByText("Telemetry unavailable")).toBeTruthy();
  });

  it("renders empty-data states honestly instead of unavailable placeholders", () => {
    render(
      <SystemHealthOverviewView
        health={{
          aiAcceptanceRate: null,
          aiRepliesSent: 0,
          averageLatencyMs: null,
          captureCount: 0,
          databaseAvailable: true,
          model: { status: "ready", modelType: "BiLSTM", classes: 131 },
          pendingReviewCount: 0,
          recentPredictions: 0,
          sourceBreakdown: {},
          storageAvailable: true,
          storageFileCount: 0,
          telemetryAvailable: true,
          totalPredictions: 0,
        }}
      />
    );

    expect(screen.getAllByText("No data").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not tracked").length).toBeGreaterThan(0);
  });
});