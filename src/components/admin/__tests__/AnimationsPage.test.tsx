import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAnimationsPage from "../../../app/admin/(dashboard)/animations/page";

vi.mock("@/features/sign-animation/loader", () => ({
  AnimationLoader: class { load = vi.fn(); },
}));

describe("AdminAnimationsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("presents the animation asset workspace while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<AdminAnimationsPage />);

    expect(screen.getByRole("heading", { name: "Animation assets" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search animation assets")).toBeTruthy();
    expect(screen.getByText("Loading animation assets...")).toBeTruthy();
  });
});
