import { defineConfig } from "vitest/config";
import { transformWithEsbuild } from "vite";
import path from "node:path";

export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.js"] },
  plugins: [{
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      if (id.includes("/components/") && id.endsWith(".js")) return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
    }
  }],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } }
});
