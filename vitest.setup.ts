// Vitest setup — runs before each test file.
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
