import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  resolve: {
    // Workspace packages are consumed from their TypeScript source.
    conditions: ["source", "module", "browser", "development|production"],
  },
  server: {
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/test-results/**",
        "**/playwright-report/**",
      ],
    },
  },
});
