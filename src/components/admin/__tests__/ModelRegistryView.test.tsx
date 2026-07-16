import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelRegistryView } from "../ModelRegistryView";

describe("ModelRegistryView", () => {
  it("labels missing benchmark and version data as unavailable rather than inventing deployment details", () => {
    render(<ModelRegistryView architectures={[]} runtimeStatus="loading" versions={[]} />);

    expect(screen.getByRole("heading", { name: "Model registry" })).toBeTruthy();
    expect(screen.getByText("Monitoring unavailable")).toBeTruthy();
    expect(screen.getByText("No benchmark data is available in this environment.")).toBeTruthy();
    expect(screen.getByText("No registered model versions.")).toBeTruthy();
  });
});