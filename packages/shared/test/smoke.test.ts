import { describe, expect, it } from "vitest";

import { workspaceReady } from "../src/index.js";

describe("workspace", () => {
  it("exports the shared package", () => {
    expect(workspaceReady).toBe(true);
  });
});
