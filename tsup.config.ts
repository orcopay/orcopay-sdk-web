import { defineConfig } from "tsup";

export default defineConfig({
  entry: { orcopay: "src/index.ts" },
  format: ["esm", "cjs", "iife"],
  globalName: "Orcopay",
  outExtension({ format }) {
    if (format === "iife") return { js: ".global.js" };
    if (format === "cjs") return { js: ".cjs" };
    return { js: ".esm.js" };
  },
  dts: true,
  sourcemap: true,
  minify: true,
  clean: true,
});
