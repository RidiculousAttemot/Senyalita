import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionOverviewView } from "../CollectionOverviewView";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("CollectionOverviewView", () => {
  it("shows an honest empty campaign state and links its operations to valid routes", () => {
    render(
      <CollectionOverviewView
        campaigns={[]}
        diversitySessions={[]}
        metrics={{ approvedSamples: 0, collectedSamples: 0, pendingReviews: 4, registeredSigners: 0, totalPredictions: 17 }}
        signers={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Data collection" })).toBeTruthy();
    expect(screen.getByText("No active collection campaigns are defined.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /review queue/i }).every((link) => link.getAttribute("href") === "/admin/review")).toBe(true);
    expect(screen.getByRole("link", { name: /training center/i }).getAttribute("href")).toBe("/admin/training");
    expect(screen.getAllByRole("link", { name: /capture samples/i }).every((link) => link.getAttribute("href") === "/admin/dataset")).toBe(true);
  });
});