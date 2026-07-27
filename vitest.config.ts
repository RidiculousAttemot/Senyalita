/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "src/features/**/__tests__/**/*.test.ts",
      "src/features/**/__tests__/**/*.test.tsx",
      "src/components/**/__tests__/**/*.test.tsx",
      "src/lib/__tests__/**/*.test.ts",
      "src/lib/supabase/**/__tests__/**/*.test.ts",
      "src/server/**/__tests__/**/*.test.ts"
    ],
    exclude: ["node_modules", ".next", "dist"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: [
        "src/features/recognition/buffer.ts",
        "src/features/recognition/normalize.ts",
        "src/features/recognition/smoothing.ts",
        "src/features/recognition/translation.ts",
        "src/features/logging/logger.ts",
        "src/features/logging/storage.ts",
        "src/features/logging/sync.ts",
        "src/lib/tts.ts"
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "vitest.shims/server-only.ts")
    }
  }
});

