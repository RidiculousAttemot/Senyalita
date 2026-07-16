import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrainingCenterView } from "../TrainingCenterView";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("TrainingCenterView", () => {
  it("shows the live capture count and links the training workflow to its real operations routes", () => {
    render(<TrainingCenterView totalSamples={2048} />);

    expect(screen.getByRole("heading", { name: "Training center" })).toBeTruthy();
    expect(screen.getByText("2,048")).toBeTruthy();
    expect(screen.getByRole("link", { name: /data collection/i }).getAttribute("href")).toBe("/admin/collection");
    expect(screen.getAllByRole("link", { name: /model registry/i }).every((link) => link.getAttribute("href") === "/admin/models")).toBe(true);
    expect(screen.getByRole("link", { name: /model health/i }).getAttribute("href")).toBe("/admin/model-health");
  });
});