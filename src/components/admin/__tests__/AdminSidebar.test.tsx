import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSidebar from "../AdminSidebar";
import { ADMIN_NAVIGATION } from "@/lib/admin/navigation";

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

  /**
   * Collapsed used to render every label anyway and rely on `overflow: hidden`
   * to hide it. On a 72px rail that clipped each entry to its first two or
   * three characters -- "Ove", "Ani", "Ani", "Ani" -- so the nav was both
   * unreadable and, for the animation entries, ambiguous. It also gave the
   * scroll container something to scroll sideways, which is where the stray
   * arrow/thumb/arrow strip under the nav came from.
   *
   * Icon-only has to mean the text is absent from the DOM, not merely
   * invisible; anything weaker leaves the same clipping one CSS change away.
   */
  it("renders no visible label text when collapsed, but keeps the name accessible", () => {
    const { container } = render(
      <AdminSidebar collapsed onCollapsedChange={vi.fn()} mobileOpen={false} onMobileOpenChange={vi.fn()} />
    );

    const studioLink = screen.getByRole("link", { name: /animation studio/i });
    expect(studioLink.textContent).toBe("");
    // The name still has to reach a screen reader and a hovering pointer.
    expect(studioLink.getAttribute("title")).toBe("Animation Studio");

    expect(container.textContent).not.toMatch(/Studio|Dataset|Library|Inspector|Overview/);
  });

  /**
   * Three of four items began "Animation" under a heading already saying
   * Animations, so the distinguishing word came ninth. The visible label is
   * now the distinguishing word alone.
   */
  it("prints labels that differ in their first characters", () => {
    render(<AdminSidebar collapsed={false} onCollapsedChange={vi.fn()} mobileOpen={false} onMobileOpenChange={vi.fn()} />);

    const printed = ADMIN_NAVIGATION.flatMap((section) => section.items).map((item) => item.label);
    const firstThree = printed.map((label) => label.slice(0, 3).toLowerCase());

    expect(new Set(firstThree).size, `labels collide when truncated: ${printed.join(", ")}`).toBe(printed.length);
    // The shortened text is what the sidebar actually prints.
    expect(screen.getByRole("link", { name: /animation studio/i }).textContent).toBe("Studio");
  });
});