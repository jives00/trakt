import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks",
    maxWorkers: 4,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@trakt/types": resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
