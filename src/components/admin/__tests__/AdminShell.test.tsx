import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminShell from "../AdminShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

describe("AdminShell", () => {
  it("renders authenticated workspace context and a mobile navigation trigger", () => {
    render(
      <AdminShell isAuthenticated email="admin@senyalita.test">
        <p>Dashboard content</p>
      </AdminShell>
    );

    expect(screen.getByText("admin@senyalita.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Dashboard content");
  });
});