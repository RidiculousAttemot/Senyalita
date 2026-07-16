import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminTranslationPage from "../../../app/admin/(dashboard)/translation/page";

describe("AdminTranslationPage", () => {
  it("presents the translation manager and its dictionary coverage summary", () => {
    render(<AdminTranslationPage />);

    expect(screen.getByRole("heading", { name: "Translation manager" })).toBeTruthy();
    expect(screen.getByText("Dictionary coverage")).toBeTruthy();
    expect(screen.getByRole("button", { name: /reset translation context/i })).toBeTruthy();
  });
});