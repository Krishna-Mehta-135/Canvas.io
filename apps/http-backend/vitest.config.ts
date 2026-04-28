import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    alias: {
      "@repo/db/client": path.resolve(
        __dirname,
        "../../packages/db/src/index.ts",
      ),
      "@repo/common/types": path.resolve(
        __dirname,
        "../../packages/common/src/types.ts",
      ),
      "@repo/backend-common/config": path.resolve(
        __dirname,
        "../../packages/backend-common/src/config.ts",
      ),
      "@repo/queue-sync": path.resolve(
        __dirname,
        "../../packages/queue-sync/src/index.ts",
      ),
    },
  },
});
