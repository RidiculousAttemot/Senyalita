import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSidebar from "../AdminSidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/animation-studio" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("AdminSidebar", () => {
  it("marks the active nested route and exposes a collapse control", () => {
    render(<AdminSidebar collapsed={false} onCollapsedChange={vi.fn()} mobileOpen={false} onMobileOpenChange={vi.fn()} />);

    // Repointed from the deleted /admin/models. Animation Studio is the
    // surviving non-exact entry, so it exercises the same active-marking path.
    const studioLink = screen.getByRole("link", { name: /animation studio/i });
    expect(studioLink.getAttribute("aria-current")).toBe("page");

    // Overview must NOT light up: it is `exact`, and every admin route is
    // prefixed by "/admin".
    const overviewLink = screen.getByRole("link", { name: /overview/i });
    expect(overviewLink.getAttribute("aria-current")).toBeNull();

    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeTruthy();
  });
});