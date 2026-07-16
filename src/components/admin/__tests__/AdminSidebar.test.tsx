import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSidebar from "../AdminSidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/models/training" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("AdminSidebar", () => {
  it("marks the active nested route and exposes a collapse control", () => {
    render(<AdminSidebar collapsed={false} onCollapsedChange={vi.fn()} mobileOpen={false} onMobileOpenChange={vi.fn()} />);

    const modelsLink = screen.getByRole("link", { name: /models/i });
    expect(modelsLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeTruthy();
  });
});