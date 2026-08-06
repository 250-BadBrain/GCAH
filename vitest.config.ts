import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "release/**"]
  },
  resolve: {
    alias: {
      "@gcah/core": fromRoot("./packages/core/src/index.ts"),
      "@gcah/credentials": fromRoot("./packages/credentials/src/index.ts"),
      "@gcah/governance": fromRoot("./packages/governance/src/index.ts"),
      "@gcah/llm": fromRoot("./packages/llm/src/index.ts"),
      "@gcah/persistence": fromRoot("./packages/persistence/src/index.ts"),
      "@gcah/shared": fromRoot("./packages/shared/src/index.ts"),
      "@gcah/tools": fromRoot("./packages/tools/src/index.ts"),
    },
  },
});
