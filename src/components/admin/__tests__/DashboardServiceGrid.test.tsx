import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardServiceGrid } from "../DashboardServiceGrid";

describe("DashboardServiceGrid", () => {
  it("renders service names and honest unavailable monitoring status", () => {
    render(
      <DashboardServiceGrid
        services={[{
          name: "MediaPipe",
          tone: "unknown",
          label: "Monitoring unavailable",
          detail: "No browser session",
        }]}
      />
    );

    expect(screen.getByText("MediaPipe")).toBeTruthy();
    expect(screen.getByText("Monitoring unavailable")).toBeTruthy();
    expect(screen.getByText("No browser session")).toBeTruthy();
  });
});