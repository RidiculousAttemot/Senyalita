import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDatasetCapturePage from "../../../app/admin/(dashboard)/dataset/page";

const getUserMedia = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
  }),
}));

describe("AdminDatasetCapturePage", () => {
  beforeEach(() => {
    getUserMedia.mockResolvedValue({ getTracks: () => [] });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
  });

  it("presents the recording workspace and its review-safe capture controls", async () => {
    render(<AdminDatasetCapturePage />);

    expect(await screen.findByRole("heading", { name: "Dataset capture" })).toBeTruthy();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    expect(screen.getByText("Review required")).toBeTruthy();
    expect(screen.getByPlaceholderText("Gesture label (e.g. HELLO)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent captures" })).toBeTruthy();
  });
});