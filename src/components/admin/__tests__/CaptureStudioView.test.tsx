import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptureStudioView } from "../CaptureStudioView";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("CaptureStudioView", () => {
  it("keeps asset import available and labels the missing recording workspace honestly", () => {
    render(<CaptureStudioView />);

    expect(screen.getByRole("heading", { name: "Capture studio" })).toBeTruthy();
    expect(screen.getByText("Recording workspace unavailable")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /start recording/i })).toBeNull();
  });

  /**
   * This previously asserted href="/admin/gesture-library/import", a route
   * that has never existed in the app — so the test was pinning a 404 in
   * place. Both links now point at the Animation Studio, which is the real
   * upload -> extract -> publish workspace.
   */
  it("links asset import at a route that actually exists", () => {
    render(<CaptureStudioView />);

    for (const name of [/import assets/i, /open import workspace/i]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe("/admin/animation-studio");
    }
  });
});