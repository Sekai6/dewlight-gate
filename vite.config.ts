import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
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
