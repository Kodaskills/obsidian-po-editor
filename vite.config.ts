import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

import pkg from "./package.json" with { type: "json" };
import tsConfig from "./tsconfig.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pathsResolver = Object.fromEntries(
  Object.entries(tsConfig?.compilerOptions?.paths || {}).map(([key, value]) => {
    return [key.replace(/\/\*$/, ""), resolve(__dirname, value[0].replace(/\/\*$/, ""))];
  }),
);

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  resolve: {
    alias: pathsResolver,
  },
  optimizeDeps: {
    exclude: ["gettext-parser"],
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["dist/**"],
    sortImports: true,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: ["src/**/gettext-parser.d.ts"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    target: "node18",
    minify: true,
    rolldownOptions: {
      treeshake: true,
      external: [
        "@codemirror/commands",
        "@codemirror/state",
        "@codemirror/view",
        "buffer",
        "obsidian",
        "node:path",
        "node:fs",
        "node:url",
        "node:buffer",
        "node:stream",
        "node:util",
        "string_decoder",
      ],
    },
  },
});
