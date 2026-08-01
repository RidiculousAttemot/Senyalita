import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemHealthOverviewView } from "../SystemHealthOverviewView";

describe("SystemHealthOverviewView", () => {
  it("does not claim healthy systems when core service checks are unavailable", () => {
    render(
      <SystemHealthOverviewView
        health={{
          animationAssetCount: null,
          animationExtractionQueueCount: 0,
          animationPublishedCount: 0,
          averageLatencyMs: null,
          databaseAvailable: false,
          model: { status: "loading" },
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
});