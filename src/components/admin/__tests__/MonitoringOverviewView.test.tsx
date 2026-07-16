import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonitoringOverviewView } from "../MonitoringOverviewView";

describe("MonitoringOverviewView", () => {
  it("labels unavailable model rollups explicitly while retaining the feedback summary", () => {
    render(<MonitoringOverviewView feedback={[]} metrics={[]} />);

    expect(screen.getByRole("heading", { name: "Model monitoring" })).toBeTruthy();
    expect(screen.getByText("Rollups unavailable")).toBeTruthy();
    expect(screen.getByText("No daily rollups are available for the selected period.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Feedback quality" })).toBeTruthy();
  });
});