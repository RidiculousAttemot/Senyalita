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
    expect(screen.getByRole("link", { name: /import assets/i }).getAttribute("href")).toBe("/admin/gesture-library/import");
    expect(screen.queryByRole("link", { name: /start recording/i })).toBeNull();
  });
});